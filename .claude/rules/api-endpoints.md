---
paths:
  - "**/[Rr]outes/**/*.{js,jsx,ts,tsx}"
  - "**/[Cc]ontrollers/**/*.{js,jsx,ts,tsx}"
  - "**/[Aa]pi/**/*.{js,jsx,ts,tsx}"
  - "**/*[Rr]oute*.{js,jsx,ts,tsx}"
  - "**/*[Cc]ontroller*.{js,jsx,ts,tsx}"
  - "**/*[Vv]alidator*.{js,jsx,ts,tsx}"
---

# API endpoints

## Every endpoint needs, in this order

1. A declared permission (default deny)
2. Schema validation with zod or joi — unknown keys stripped, not passed through
3. Ownership scoping on every query
4. Business logic
5. A response containing no internal detail

## MongoDB injection (B2)

The real risk on this stack. `{"$gt": ""}` sent as a password logs an attacker in if the
value reaches the query. Reject objects where a string is expected. Use
`express-mongo-sanitize`. Never pass `req.body`, `req.query` or `req.params` into a query
unvalidated.

## Rate limiting (B7)

`express-rate-limit` backed by Redis so limits survive restarts and hold across processes.
Required on auth, OTP, search and AI endpoints. AI endpoints also need a per-organisation
quota — an unbounded GPT endpoint is a billing incident waiting to happen.

## Errors (B8)

One central error handler. Return a generic message plus a request ID; log the detail
server-side against that ID. Never return a Mongo error, a stack trace, a collection name
or a driver message to a client.

## File uploads (B6)

Allowlist extensions, verify MIME against magic bytes with the `file-type` package, cap
size. Upload to Cloudinary rather than the application server. Never serve uploads from a
directory that can execute.

## Headers (B3, B5)

`helmet` with CSP, HSTS, `X-Content-Type-Options`, frame-ancestors, Referrer-Policy.

## Never

- A route added without a permission declaration
- `dangerouslySetInnerHTML` anywhere
- An endpoint that returns a full user or organisation document without field selection
- Pagination without a maximum page size
