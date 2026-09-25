# MPX Global — What we need from you

**Updated 2026-09-25.**

Everything below is something only you can decide, provide or authorise. We have built around
each of them so that nothing is stuck waiting, with one exception: **item 1.1 is breaking the
live platform right now.**

Where we could write something accurate ourselves, we already have. This list is deliberately
short and contains only genuine decisions, content and access.

---

## 1 · Blocking — needed now

### 1.1 Email is being rejected by your mail provider 🔴 *(live problem today)*

**Right now, no email leaves the platform.** Every attempt is refused by your mail provider
with error `554`, and we have seen it fail for Gmail and other recipients alike.

What this breaks, today:

- Anyone signing in with **email** gets no one-time code, so **they cannot sign in**
- Buyers and sellers outside India — who have no Indian mobile number — are the worst affected
- Verification, ticket and quotation emails are not being delivered either

Sign-in with an **Indian mobile number still works**, because those codes go by SMS.

**This is a setting on your mail account, not something we can fix in the software.** The
provider is accepting our connection and our password, then refusing the message — which
almost always means the "from" address we send as is not one your mail account is allowed to
use.

Please ask whoever manages your email hosting to confirm:

- The **sender address** we send from is **verified** on the account, or belongs to it
- Your **domain is authenticated** for sending (your provider will call this SPF and DKIM)
- The account is **not restricted to a trial or sandbox** mode that only allows approved
  recipients

If it is simpler, send us working credentials for a mail service you already trust
(Google Workspace, Zoho, Brevo, SendGrid) and we will switch it over.

### 1.2 Your Terms of Service and Privacy Policy 🔴

**Please send us your own Terms of Service and Privacy Policy**, prepared or approved by your
legal adviser. These are legal documents that bind you and your users, so they should come
from you rather than from us. Any format — Word, PDF, Google Doc, plain text — and we will
publish them and link them from signup on both the website and the app.

**In the meantime the site is not empty.** So that nobody is asked to agree to a document that
does not exist, we have published an interim Terms and Privacy Policy describing accurately how
the platform actually works — what data is collected, where it is stored, which outside
services process it, and what is public versus private. Every statement was checked against the
software, and both pages carry a visible notice that they are interim.

**One thing to tell your adviser:** the platform holds **KYC documents** (identity and business
registration papers) and **bank account details that sellers print on their quotations**. Your
adviser should know that both exist. The bank details are shown on documents for buyers to pay
sellers directly — **MPX Global never holds or moves anyone's money.**

### 1.3 Your registered company details

For the Terms to name the right legal entity, and so we can publish them in the website footer
and at the bottom of every email:

- **Registered company name**
- **Registered address**
- **Country / state whose law governs** the terms
- **LinkedIn page** (optional — it appears as a footer link if you give one)

### 1.4 Real support contact details

The platform currently carries placeholder values (`support@example.com` and a made-up phone
number) because we did not want to invent real ones.

Please give us:

- **Support email address** — also used for privacy and data requests, unless you want them
  separate
- **Support phone number**
- **Support hours** (for example, "Mon–Sat, 10am–7pm IST")

No code change is needed — your super admin can set all three from the platform's own settings
screen, and change them whenever you like.

### 1.5 Confirm the public website address

We have the **API** address (`api.mpx.nxtgendigitals.com`). We have assumed the public website
is **`mpx.nxtgendigitals.com`**, and the mobile app uses it to open the Terms and Privacy pages.

**Please confirm the exact address**, including whether it should be with or without `www`,
before the app is published to the stores — it is built into the app and changing it later
means a new release.

---

## 2 · Before the mobile apps go on the stores

We can build and send you an installable Android file today (we have already done so for
testing). Publishing to the stores needs things only you can provide.

### 2.1 Store accounts

- A **Google Play Developer account** (one-off fee, verification takes a few days)
- An **Apple Developer account** if you want the iPhone app (annual fee, and Apple's review is
  stricter — allow extra time)

### 2.2 Store listing content

- App **description** — short and long
- **Screenshots** (we can produce these from the finished app if you prefer)
- The **privacy policy address** — Apple and Google both require a working link, which makes
  item 1.2 a store blocker too
- A **support contact** for the listing — the same as 1.4

### 2.3 Final app artwork ✅ *(done 2026-09-25)*

The app carried the old blue logo, icon and splash. All of it has been regenerated from the
red-and-navy brand artwork, so the app and the website now use the same mark. **Nothing needed
from you** — unless you would prefer a different treatment for the home-screen icon, in which
case send the artwork you want.

### 2.4 App signing key ✅ *(done 2026-09-25)*

Set up with **Play App Signing**: Google holds the key that signs the published app, and we hold
an "upload key" used to send releases to them. This is the safer arrangement — if our upload key
is ever lost, Google resets it and your app keeps updating normally. **Nothing needed from you**
beyond opening the Play Console account (2.1).

---

## 3 · Security actions before launch — only you can authorise

- **Change the super admin password.** The one in use now was chosen for testing and has been
  shared during development. It must be replaced before real use.
- **Replace the Firebase key** used for phone notifications. The current one was handled during
  development, so by our own rules it counts as exposed. We will generate a replacement; you
  just need to approve it and we will delete the old one.
- **A final security pass on the servers** before handover — connection encryption, database
  user permissions, backups, and log retention. We will list what we need from your hosting.

---

## 4 · Content we still need

### 4.1 Footer pages — do you want them at all?

The original design had **About Us · Careers · Contact · Blog · Help Centre · Trade Guides**.
None of those pages exist, so they were showing as grey text that could not be clicked. We
removed them rather than ship decoration pretending to be navigation.

For each one: **build it** (and send the text), or **drop it**.

Our suggestion: a simple **Contact** page is worth having on day one. The rest can wait until
you have something real to put on them.

### 4.2 Customer testimonials — only if they are real

The design had six customer testimonials. We did not build them: the quotes were invented, and
several praised features the platform does not have. On a platform whose entire value is trust,
publishing invented customer quotes is a serious risk.

**When you have real quotes from real customers, with permission to publish, send them** and we
will add the section.

### 4.3 Wording for the remaining email notifications

Nine emails are live (sign-in codes, verification decisions, document requests, support
tickets, and someone joining your company). Beyond those, tell us **which events should send an
email and what each should say.** We are not inventing them.

### 4.4 Store badges

When the apps are published, send us the two store links and we will make the badges live.

---

## 5 · Decisions still open

These are not blocking anything today, but each one is waiting on you.

### 5.1 Account deletion

There is no "delete my account" button — if someone asks for their data to be removed, your
team does it by hand, and the Privacy Policy says exactly that rather than promising a feature
that does not exist.

If you expect a meaningful number of European or UK buyers, your adviser may want self-service
deletion, or at least a defined process and response time. **Please tell us which.**

### 5.2 Daily limit for AI searches by visitors who are not signed in

Each AI search costs money, so there is a daily ceiling to protect you from an unexpected bill.
**Tell us a number** — your super admin can change it at any time afterwards.

### 5.3 How long should KYC documents be kept?

Identity and business documents are stored privately and served through short-lived links. We
have no instruction on **how long to keep them after an account closes**. Your adviser should
set that period.

---

## 6 · Already settled — no action needed

Recorded here so you can see what is closed.

- **Support tickets** — built. Staff have a queue, companies can raise and follow up tickets on
  web and app, and tickets close themselves after a set period of silence.
- **Quotations and negotiation** — built. Sellers build and send a priced quotation into the
  chat; either side can counter-offer; both sides confirm the final figure with a code sent to
  their email.
- **One company signing up twice** — fixed. A second signup now joins the existing company
  instead of creating a duplicate, so there is one verification, one public profile, and
  blocking a company blocks all of it.
- **Aadhaar** — accepted for individuals, **masked copies only**.
- **Consent at signup** — the signup screen states that continuing means accepting the Terms;
  no tick box, by your decision.
- **Brand colour** — red, applied across the website.
- **Two-factor app for the super admin** — dropped by your decision; staff still sign in with a
  one-time code, which is already two-factor.
- **Platform settings screen** and the **in-app notification centre (website)** — both built.

---

## Summary — what to action first

1. **Get email sending fixed with your mail provider** (1.1) — this is breaking sign-in today.
2. **Send your Terms and Privacy Policy** (1.2) — it also blocks both app stores.
3. **Send your company details and real support contact** (1.3, 1.4).
4. **Send the final app icon and splash artwork** (2.3) and open the store accounts (2.1).
