# MPX Global — Production deployment notes

Everything that lives on the **server**, not in the repo. Each item here has bitten us or is
about to; none of it is optional.

Server: `https://api.mpx.nxtgendigitals.com` (VPS, nginx → Node, self-hosted MongoDB).

Under agreement **§11.2.3** the hosting environment is the Client's to administer. These are the
settings the delivered code needs in order to work there.

---

## 1. 🔴 Environment variables — two of these stop the API from booting

Add to the production `.env` **before** deploying the 2026-08-21 backend or later:

```bash
NODE_ENV=production          # REQUIRED — no default any more
AI_GUEST_DAILY_MAX=500       # REQUIRED in production. The Client picks the number.
```

**Why they are required rather than defaulted.** `NODE_ENV` used to default to `development`,
so a deploy that forgot it ran the whole service in dev mode with **no error anywhere** — Redis
stopped being required, rate limits fell back to in-memory (lost on every restart, not shared
across processes), and `TRUST_PROXY` went unread. That is not hypothetical: the live API was
found running that way on **2026-08-07**. It now fails loudly at boot instead.

`AI_GUEST_DAILY_MAX` is the daily ceiling on AI searches by signed-out visitors. Agreement
**§3.3/§5.1** makes the value the Client's to set, and OpenAI usage is billed to their account
under §8.1 — so "absent" must not quietly mean "unlimited".

### Also set, or things break quietly

```bash
REDIS_URL=redis://…                     # required in production (rate limits)
TRUST_PROXY=1                           # behind nginx; without it req.ip is the proxy and
                                        # every user shares one rate-limit bucket
PUBLIC_WEB_URL=https://<web-domain>      # else sitemap.xml and robots.txt emit localhost URLs
CORS_ORIGINS=https://<web-domain>        # else the web app cannot call the API
FIREBASE_SERVICE_ACCOUNT_JSON=<base64>   # else push is silently inert — no error, no log
```

---

## 2. 🔴 nginx — WebSocket upgrade (live chat depends on it)

**Symptom seen 2026-08-22:** messages sent fine and history loaded fine, but nothing arrived in
real time in the mobile app — every new message needed a manual refresh.

**Cause:** nginx was not upgrading the connection. Proven directly:

```
$ curl -i -H "Connection: Upgrade" -H "Upgrade: websocket" \
    "https://api.mpx.nxtgendigitals.com/socket.io/?EIO=4&transport=websocket"
HTTP/1.1 400 Bad Request        ← should be 101 Switching Protocols
Connection: keep-alive          ← should be Connection: Upgrade
```

The Socket.io server itself was healthy the whole time — connecting with polling allowed
returned `unauthorised` for a fake token, i.e. the server answered and authenticated correctly.
Only the WebSocket transport could not get through.

**Fix — add to the API's `location` block, then `nginx -t && nginx -s reload`:**

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;

    # ↓ These three are what make WebSockets work. Without them nginx talks
    #   HTTP/1.0 upstream and drops the hop-by-hop Upgrade header, so the
    #   upgrade never happens and Socket.io answers 400.
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # A websocket is a long-lived connection; the 60s default closes it
    # repeatedly and the client reconnect-loops.
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

**Verify after reload** — this must print `101`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "https://api.mpx.nxtgendigitals.com/socket.io/?EIO=4&transport=websocket"
```

⚠️ The app no longer *depends* on this — it now falls back to polling, so chat works either way.
But polling costs noticeably more battery and bandwidth on a phone, so this should still be
fixed rather than left.

---

## 3. MongoDB hardening (§11.2.5)

Agreement §11.2.5 states, as a present fact, that NxtGen *"delivers the Platform configured to
connect to its database over an authenticated connection that is not exposed publicly."*
**This has never been verified on the VPS.** Until it is, that sentence may not be true.

On the database server, confirm:

- `security.authorization: enabled` — Mongo actually requires credentials
- `net.bindIp: 127.0.0.1` (or a private address) — **never `0.0.0.0`**
- Firewall blocks `27017` from the internet
- The app's Mongo user has `readWrite` on the app database only — **not** `root`

Also outstanding (tracker **C10**): the audit collections should be **append-only at the database
level** — the app's user needs `insert` and `find` there, never `update` or `delete`. Around 30
action types depend on that trail, and it is currently enforced only by the fact that no code
deletes from it.

---

## 4. 🔒 Rotate the Firebase service account key before launch

The current `FIREBASE_SERVICE_ACCOUNT_JSON` passed through a chat transcript, so by
`secrets-and-hygiene.md` it counts as **compromised**. Before production:

1. Firebase Console → Project settings → Service accounts → generate a new private key
2. Base64-encode it into `FIREBASE_SERVICE_ACCOUNT_JSON`
3. **Delete the old key** from that same screen, so the leaked one stops working

Note the two Firebase files are not the same thing: `google-services.json` ships inside the APK
and is **not** secret; the service account JSON is server-only and **is**.

---

## 5. Before handover

- Rotate every seeded/dev credential, including the superadmin password (it was typed in chat).
- Remove `SEED_SUPERADMIN_PASSWORD` from `.env` once seeding is done — the hash is in the DB.
- Restore Super Admin TOTP 2FA (`docs/Note.md` **D4**).
- Run a secret scan (gitleaks/trufflehog) over git history — tracker **E6**. Note `.env` was
  committed once historically; the values in it have since been rotated locally, but the old
  Atlas cluster should be confirmed deleted rather than merely rotated away from.
