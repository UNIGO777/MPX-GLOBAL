import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi } from '../support/fakeApi.js';
import { renderPage, writes } from '../support/renderPage.jsx';

/**
 * Signup step 2 (A21 + D7 claim). Create a company, or JOIN the one that
 * already holds this verified email/phone. The security model is that the
 * client can never NAME a company: it echoes the opaque `claimChoice` the
 * server issued, and the company's name stays hidden until the existing
 * member's email code proves the claim (rule 6, the recycled-SIM fix).
 */
const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../../src/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: auth.user, restoring: false, completeSignIn: async (r) => r.user ?? { role: 'buyer' } }),
}));

const { SignupCompany } = await import('../../src/pages/auth/SignupCompany.jsx');
const FLOW = { signupToken: 'st', email: 'n••••@example.com', mobile: '+91 ••••• 3210', role: 'buyer', signupPath: '/signup/buyer' };
const refusal = (status, message, code) =>
  Object.assign(new Error(String(status)), { response: { status, data: { error: { message, code } } } });

const HIDDEN = {
  choice: 'opaque-1',
  name: null,
  matchedOn: 'email',
  verifierEmail: 'a••••@deltaknits.example',
  needsOrgEmailOtp: true,
  needs: [],
  verified: true,
};

async function chooseCountry(user, name) {
  const box = screen.getByRole('combobox', { name: /country/i });
  await user.click(box);
  await user.type(box, name);
  await user.click(await screen.findByRole('option', { name: new RegExp(`^${name}`) }));
}

describe('Signup — company step', () => {
  it('without a signup in progress it goes back to sign in', async () => {
    await renderPage(SignupCompany, { auth, url: '/signup/company' });
    expect(screen.getByText('Went to /signin')).toBeTruthy();
  });

  it('nothing to join → create: sends company + country, and never a claim', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/auth/signup/organisation', { organisations: [] });
    fakeApi.on('POST', '/auth/signup/complete', { user: { role: 'buyer' }, accessToken: 'x' });
    await renderPage(SignupCompany, { auth, url: '/signup/company', state: FLOW });
    await user.type(await screen.findByLabelText('Company name'), 'Delta Knits');
    await chooseCountry(user, 'India');
    await user.click(screen.getByRole('button', { name: 'Create my account' }));
    await waitFor(() => expect(writes('POST', '/auth/signup/complete')).toHaveLength(1));
    const sent = writes('POST', '/auth/signup/complete')[0].data;
    expect(sent).toMatchObject({ signupToken: 'st', company: 'Delta Knits', country: 'IN' });
    expect(sent).not.toHaveProperty('claimChoice');
  });

  it('join: the name is hidden and Join is off until the colleague\'s code; then it sends ONLY the opaque choice', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/auth/signup/organisation', { organisations: [HIDDEN] });
    fakeApi.on('POST', '/auth/signup/organisation/code', { sentTo: 'a••••@deltaknits.example' });
    fakeApi.on('POST', '/auth/signup/organisation/verify', {
      organisations: [{ ...HIDDEN, name: 'Delta Knits', country: 'IN', needsOrgEmailOtp: false, carriesTickOver: true }],
    });
    fakeApi.on('POST', '/auth/signup/complete', { user: { role: 'buyer' }, accessToken: 'x' });
    await renderPage(SignupCompany, { auth, url: '/signup/company', state: FLOW });

    expect(screen.queryByText(/Delta Knits/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Join this company' }).disabled).toBe(true);

    await user.click(screen.getByRole('button', { name: /send/i }));
    const boxes = await screen.findAllByLabelText(/^Digit \d$/);
    await user.click(boxes[0]);
    await user.keyboard('123456');

    const join = await screen.findByRole('button', { name: 'Join Delta Knits' });
    expect(join.disabled).toBe(false);
    await user.click(join);
    await waitFor(() => expect(writes('POST', '/auth/signup/complete')).toHaveLength(1));
    const sent = writes('POST', '/auth/signup/complete')[0].data;
    expect(sent.claimChoice).toBe('opaque-1');
    expect(JSON.stringify(sent)).not.toMatch(/orgId|organisationId|6ab/);
    expect(writes('POST', '/auth/signup/organisation/verify')[0].data).toEqual({ signupToken: 'st', choice: 'opaque-1', code: '123456' });
  });

  it('the seat was taken meanwhile → back to the create form, with the server\'s reason', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/auth/signup/organisation', { organisations: [{ ...HIDDEN, name: 'Delta Knits', needsOrgEmailOtp: false }] });
    fakeApi.on('POST', '/auth/signup/complete', () => {
      throw refusal(409, 'That company already has a buyer account.', 'CLAIM_SEAT_TAKEN');
    });
    await renderPage(SignupCompany, { auth, url: '/signup/company', state: FLOW });
    await user.click(screen.getByRole('button', { name: 'Join Delta Knits' }));
    expect(await screen.findByText('That company already has a buyer account.')).toBeTruthy();
    expect(await screen.findByLabelText('Company name')).toBeTruthy();
  });
});
