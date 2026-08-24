# MPX Global — What we need from you

Everything below is something only you can decide or provide. We have built around each of
them so nothing is blocked today, but the items in **Section 1 must be settled before the
platform goes live**.

Where we could write something accurate ourselves, we already have — this list is deliberately
short and contains only genuine decisions and content.

---

## 1 · Needed before launch

### 1.1 A support and privacy contact address 🔴 *(most urgent)*

We have published a Terms of Service and a Privacy Policy on the website. Both documents tell
people to contact you to ask about the policy, request a copy of their data, or ask for their
account to be deleted.

**Right now there is no contact address anywhere on the site**, so that instruction leads
nowhere. We did not invent an address, because a wrong one is worse than none.

Please give us:

- **An email address** for privacy and data requests (this can be the same as general support)
- Optionally, a **general support email** if you want them separate
- Optionally, a **postal address** — some jurisdictions expect a privacy policy to carry one

### 1.2 Your Terms of Service and Privacy Policy 🔴

**Please send us your own Terms of Service and Privacy Policy**, prepared or approved by your
legal adviser. These are legal documents that bind you and your users, so they should come
from you rather than from us. Send them in any format — Word, PDF, Google Doc or plain text —
and we will publish them on the website and link them from the signup screen and the app.

**In the meantime the site is not empty.** So that nobody is asked to agree to a document that
does not exist, we have published an interim Terms and Privacy Policy describing accurately
how the platform actually works — what data is collected, where it is stored, which outside
services process it, and what is public versus private. Every statement in them was checked
against the software. Both pages carry a visible notice saying they are interim. **Your
documents will replace them completely.**

You are welcome to give the interim versions to your adviser as a starting point — they are an
accurate description of the system, which is usually the hardest part to write — but the final
wording is yours.

#### 🔴 One important thing to tell your adviser

A privacy policy is a statement of fact about what your software does. A standard template will
often promise things this platform does not currently do, and publishing those would be a false
statement rather than a harmless bit of boilerplate. **When you send us your documents we will
check them against the actual behaviour of the system and tell you about any mismatch.**

The three most common examples, all true of this platform today:

- **"You can delete your account at any time."** There is no self-service deletion — removal is
  done manually by your team on request. (See 1.4b.)
- **"We keep your data for X months and then delete it."** Nothing is deleted automatically;
  there is no expiry configured on any record.
- **"We are GDPR / DPDP compliant."** We have made no such claim, and compliance is a legal
  assessment, not something the software asserts about itself.

Either the documents should describe the behaviour as it is, or you tell us to change the
software to match the documents — both are fine, but they must agree.

Two things your adviser should also settle, which we have deliberately left open:

- **Governing law and jurisdiction** — not stated anywhere by us.
- Whether MPX Global is positioned as a **discovery and communication platform** that is not a
  party to any trade, and whether the verified tick is explicitly **not a guarantee** of a
  company or its goods. That is how the interim documents describe it, and it matches how the
  platform actually operates — no money moves through it and no trade is contracted on it.

### 1.3 Your registered company details

For the Terms to name the right legal entity, and for us to fill in anything your documents
reference, please confirm:

- The **registered company name**
- The **registered address**
- The **country / state whose law governs** the terms

### 1.4 Two data decisions your adviser should weigh in on

**a) Do we need to record each user's agreement to the terms?**
At the moment the signup screen tells the user that continuing means they accept the Terms and
Privacy Policy, and links to both. We do **not** store a per-account record that they agreed.

Adding a tick box that we do not store would be misleading, so we have not added one. If your
adviser wants provable consent, we can store the agreement — the version accepted and the date
— against each account. **This is a small piece of work but it must be decided before launch**,
because consent cannot be collected retrospectively from users who have already signed up.

**b) Account deletion is currently manual.**
There is no "delete my account" button. If someone asks for their data to be removed, your
team would do it by hand. The Privacy Policy says exactly that rather than promising a
self-service feature that does not exist.

If you expect a meaningful number of European or UK buyers, your adviser may want
self-service deletion (or at least a defined process and response time). Please tell us which
you want.

### 1.5 Confirm the public website address

Our records only document the **API** address (`api.mpx.nxtgendigitals.com`). We have assumed
the public website will be **`mpx.nxtgendigitals.com`**, and the mobile app uses that to open
the Terms and Privacy pages.

**Please confirm the exact public web address** — including whether it should be with or
without `www` — so we can set it correctly in the app before it is published to the stores.

---

## 2 · Website content we need from you

### 2.1 The footer pages — do you want them at all?

The original design had a footer with **About Us · Careers · Contact · Blog · Help Centre ·
Trade Guides**. None of those pages exist, so they were showing as grey text that could not be
clicked — decoration pretending to be navigation.

We have removed them for now. Please tell us, for each one:

- **Yes, build it** — and send us the text you want on it
- **No, drop it** — and we will leave it out

Our suggestion: a simple **Contact** page is worth having on day one (it also solves item 1.1).
The rest can wait until you have something real to put on them.

### 2.2 Customer testimonials — only if they are real

The original design had six customer testimonials. We did not build them, because the
quotes in the design were invented, and several of them praised features the platform does not
have.

On a platform whose entire value is trust, publishing invented customer quotes is a serious
risk. **If and when you have real quotes from real customers, with their permission to publish,
send them to us and we will add the section.** Until then it stays out.

### 2.3 App Store and Play Store badges

You have asked us to leave these for now — noted, nothing needed. When the apps are published,
send us the two store listing links and we will make the badges live.

---

## 3 · Product decisions still open

These are not blocking anything today, but each one is waiting on you.

### 3.1 Support tickets — in this month or later?

The original scope includes staff handling of customer queries (an open / in-progress /
resolved queue). This was set aside for after the first month, but no final decision was made.

Please confirm: **do you want a basic version this month** (staff can see and respond to
queries), or is it fine to leave it for next month?

### 3.2 One company signing up twice creates two separate companies

If a business registers as a **buyer** and separately as an **exporter**, the platform
currently creates **two separate company records** for them. That means two verification
reviews, two public profiles, and — importantly — **blocking the company only blocks one of
them**.

The fix is to let the second signup **claim the existing company** instead of creating a new
one. You asked us to build this later, which is fine, but we want to flag that it is already
happening in the test data.

Please confirm when you want this built.

### 3.3 Which email notifications should go out?

You have approved email notifications in principle, and five are built (including telling a
seller when more information is requested). Beyond those, we need you to tell us **which
events should send an email, and what each one should say** — we are not inventing them.

### 3.4 Confirmed as next month

For completeness, these are agreed and scheduled after the first month — no action needed:

- **Platform settings screen** for the super admin
- **Two-factor authentication (authenticator app) for the super admin** — staff currently sign
  in with a one-time code, which is still two-factor
- **Quotations and negotiation**
- **WhatsApp notifications and the in-app notification centre**

---

## 4 · Before we go live — things we need you to action

- **Change the super admin password.** The one currently set was chosen for testing and has
  been shared during development. It must be changed before the platform is used for real.
- **Confirm the daily limit for AI searches by visitors who are not signed in.** This protects
  you from an unexpectedly large bill, since each search costs money. Tell us a number, and you
  will be able to change it yourself later.

---

**Summary — the three things that actually block launch:** a contact email address (1.1), your
Terms of Service and Privacy Policy (1.2), and your registered company details (1.3).
