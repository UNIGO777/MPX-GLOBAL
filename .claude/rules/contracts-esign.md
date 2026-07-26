---
paths:
  - "**/*[Cc]ontract*.{js,jsx,ts,tsx}"
  - "**/*[Ee][Ss]ign*.{js,jsx,ts,tsx}"
  - "**/*[Ss]ignature*.{js,jsx,ts,tsx}"
  - "**/*[Ss]igning*.{js,jsx,ts,tsx}"
  - "**/[Cc]ontract*/**/*.{js,jsx,ts,tsx}"
---

# Contract generation and eSign

Seven controls committed here. A signed contract is evidence — treat it as immutable.

## Integrity (D1–D3)

- SHA-256 of the generated PDF stored at creation; verified before presenting for
  signature and again after signing. Mismatch blocks the flow.
- An amendment creates a **new version**. Prior signatures are invalidated, never carried
  across. Nothing is deleted — all versions retained.
- The contract stores **its own copy** of parties, goods, quantity, unit price, currency and
  total. Never a live reference to the catalogue: a later price edit must not change a
  signed document.

## Preconditions (D4, D7)

- An expired quotation cannot generate a contract — checked server-side.
- Escrow funding unlocks only after **both** signatures are captured — checked server-side,
  not by hiding a button.

## Signing (D5, D6)

- OTP goes to the authorised signatory email **recorded on the business profile**, never to
  an address supplied in the request.
- Signing links are single-use with a short TTL, re-issuable.
- OTP expiry and attempt limits apply as elsewhere.
- The executed PDF carries an audit certificate: signatory email, timestamps, IP,
  verification method and document hash. Re-hash after merging the certificate.

## Legal boundary

We build the document engine and the signature workflow. We do not draft legal content and
do not assert enforceability. Templates are reviewed by the client's advocate before
go-live. Never generate clause text that asserts a legal position in a client-facing
document without flagging it to me.

## Never

- Mutating a signed contract record in place
- Deleting a superseded version
- A signing endpoint that accepts the signatory email from the request
