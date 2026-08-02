import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `push.client.js` — the FCM transport itself.
 *
 * `m4-push.test.js` mocks this module wholesale to test the push SERVICE (who
 * gets notified, what the payload may contain). That leaves the transport — SDK
 * initialisation, dead-token classification, and the promise that a push failure
 * can never surface in a user's request — almost entirely unexercised.
 *
 * Every case here runs against a fresh module instance, because `getMessaging()`
 * memoises on a module-scope `initialised` flag: one shared import would let the
 * first scenario decide the outcome of all the others.
 */

const CREDENTIAL = Buffer.from(JSON.stringify({ project_id: 'mpx-test' })).toString('base64');

/** Load a pristine `push.client` with a chosen env + firebase-admin stand-in. */
async function loadClient({ credential = CREDENTIAL, messaging = null, initThrows = false } = {}) {
  vi.resetModules();

  vi.doMock('../src/config/env.js', () => ({
    env: { FIREBASE_SERVICE_ACCOUNT_JSON: credential, NODE_ENV: 'test', LOG_LEVEL: 'silent' },
  }));

  const calls = { initialiseCount: 0, sent: [] };
  vi.doMock('firebase-admin', () => ({
    default: {
      apps: [],
      initializeApp: () => {
        calls.initialiseCount += 1;
        if (initThrows) throw new Error('invalid service account');
        return {};
      },
      credential: { cert: () => ({}) },
      messaging: () => ({
        sendEachForMulticast: async (message) => {
          calls.sent.push(message);
          return messaging(message);
        },
      }),
    },
  }));

  const mod = await import('../src/services/push.client.js');
  return { ...mod, calls };
}

/** An FCM multicast reply where the listed indexes failed with the given code. */
const reply = (total, failures = {}) => ({
  successCount: total - Object.keys(failures).length,
  responses: Array.from({ length: total }, (_, i) =>
    failures[i] ? { success: false, error: { code: failures[i] } } : { success: true },
  ),
});

beforeEach(() => {
  vi.resetModules();
});

describe('isPushConfigured', () => {
  it('is false with no credential, true with one', async () => {
    const off = await loadClient({ credential: '' });
    expect(off.isPushConfigured()).toBe(false);

    const on = await loadClient({ credential: CREDENTIAL });
    expect(on.isPushConfigured()).toBe(true);
  });

  it('treats an absent value as unconfigured, never as an error', async () => {
    // `null` rather than `undefined` — the loader's default parameter would
    // otherwise substitute a real credential and test nothing.
    const absent = await loadClient({ credential: null });
    expect(absent.isPushConfigured()).toBe(false);
  });
});

describe('🔴 with NO credential the whole layer is inert', () => {
  it('a send is a silent no-op — no crash, no throw, no SDK initialisation', async () => {
    const { sendToTokens, calls } = await loadClient({ credential: '' });

    const res = await sendToTokens({
      tokens: ['tok-a', 'tok-b'],
      title: 'New enquiry',
      body: 'Buyer Co enquired about Cotton Roll',
    });

    expect(res).toEqual({ sent: 0, deadTokens: [] });
    expect(calls.initialiseCount).toBe(0);
  });

  it('a broken credential disables push for the process instead of throwing', async () => {
    const { sendToTokens } = await loadClient({ initThrows: true, messaging: () => reply(1) });

    const res = await sendToTokens({ tokens: ['tok-a'], title: 't', body: 'b' });
    expect(res).toEqual({ sent: 0, deadTokens: [] });
  });
});

describe('the empty-recipient short-circuit', () => {
  it('🔴 never touches the SDK when there is nobody to notify', async () => {
    const { sendToTokens, calls } = await loadClient({ messaging: () => reply(0) });

    const res = await sendToTokens({ tokens: [], title: 't', body: 'b' });

    expect(res).toEqual({ sent: 0, deadTokens: [] });
    // This is the common case — most counterparties have no device registered —
    // so initialising Firebase to then send to nobody is pure waste.
    expect(calls.initialiseCount).toBe(0);
    expect(calls.sent).toEqual([]);
  });
});

describe('sending', () => {
  it('delivers to every token and reports the success count', async () => {
    const { sendToTokens, calls } = await loadClient({ messaging: () => reply(3) });

    const res = await sendToTokens({
      tokens: ['a', 'b', 'c'],
      title: 'New message',
      body: 'Seller Co — Cotton Roll',
      data: { type: 'message', conversationId: 'abc' },
    });

    expect(res.sent).toBe(3);
    expect(res.deadTokens).toEqual([]);
    expect(calls.sent).toHaveLength(1);
    expect(calls.sent[0]).toEqual({
      tokens: ['a', 'b', 'c'],
      notification: { title: 'New message', body: 'Seller Co — Cotton Roll' },
      data: { type: 'message', conversationId: 'abc' },
    });
  });

  it('defaults `data` to an empty object rather than sending undefined', async () => {
    const { sendToTokens, calls } = await loadClient({ messaging: () => reply(1) });
    await sendToTokens({ tokens: ['a'], title: 't', body: 'b' });
    expect(calls.sent[0].data).toEqual({});
  });

  it('initialises the SDK once and reuses it across sends', async () => {
    const { sendToTokens, calls } = await loadClient({ messaging: () => reply(1) });

    await sendToTokens({ tokens: ['a'], title: 't', body: 'b' });
    await sendToTokens({ tokens: ['b'], title: 't', body: 'b' });
    await sendToTokens({ tokens: ['c'], title: 't', body: 'b' });

    expect(calls.initialiseCount).toBe(1);
    expect(calls.sent).toHaveLength(3);
  });
});

describe('🔴 dead-token classification (what drives the cleanup)', () => {
  it('reports every FCM "this device is gone" code, mapped back to the right token', async () => {
    const { sendToTokens } = await loadClient({
      messaging: () =>
        reply(4, {
          0: 'messaging/registration-token-not-registered',
          2: 'messaging/invalid-registration-token',
          3: 'messaging/invalid-argument',
        }),
    });

    const res = await sendToTokens({ tokens: ['dead1', 'alive', 'dead2', 'dead3'], title: 't', body: 'b' });

    expect(res.sent).toBe(1);
    // Index → token mapping matters: cleaning up the wrong row would silently
    // unsubscribe a live device.
    expect(res.deadTokens).toEqual(['dead1', 'dead2', 'dead3']);
    expect(res.deadTokens).not.toContain('alive');
  });

  it('does NOT treat a transient failure as a dead device', async () => {
    const { sendToTokens } = await loadClient({
      messaging: () =>
        reply(3, {
          0: 'messaging/internal-error',
          1: 'messaging/server-unavailable',
          2: 'messaging/quota-exceeded',
        }),
    });

    const res = await sendToTokens({ tokens: ['a', 'b', 'c'], title: 't', body: 'b' });

    expect(res.sent).toBe(0);
    // Deleting these would unsubscribe devices over a temporary outage.
    expect(res.deadTokens).toEqual([]);
  });

  it('a failure with no error code is left alone', async () => {
    const { sendToTokens } = await loadClient({
      messaging: () => ({ successCount: 0, responses: [{ success: false }] }),
    });

    const res = await sendToTokens({ tokens: ['a'], title: 't', body: 'b' });
    expect(res.deadTokens).toEqual([]);
  });

  it('tolerates a reply with no responses array at all', async () => {
    const { sendToTokens } = await loadClient({ messaging: () => ({}) });

    const res = await sendToTokens({ tokens: ['a'], title: 't', body: 'b' });
    expect(res).toEqual({ sent: 0, deadTokens: [] });
  });
});

describe('🔴 a push problem never reaches the caller', () => {
  it('an SDK throw is swallowed and reported as "sent nothing"', async () => {
    const { sendToTokens } = await loadClient({
      messaging: () => {
        throw new Error('FCM unreachable');
      },
    });

    await expect(
      sendToTokens({ tokens: ['a', 'b'], title: 't', body: 'b' }),
    ).resolves.toEqual({ sent: 0, deadTokens: [] });
  });

  it('a rejected send is caught too — the message that triggered it must still stand', async () => {
    const { sendToTokens } = await loadClient({
      messaging: async () => {
        throw Object.assign(new Error('auth failed'), { code: 'app/invalid-credential' });
      },
    });

    await expect(sendToTokens({ tokens: ['a'], title: 't', body: 'b' })).resolves.toEqual({
      sent: 0,
      deadTokens: [],
    });
  });
});
