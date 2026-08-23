# MPX Global — Mobile App Human Test Guide

**Scope: the whole Android app, start to end — buyer and exporter. Covers signup, login, KYC,
catalogue, discovery, AI search, enquiries, chat and push notifications.**

> This document is for a human tester who is NOT a developer. Do the sections **in order** —
> later ones use accounts and data created earlier. For each step, compare what you see against
> **Expected result** and write **PASS** or **FAIL**. Anything that fails goes in the
> **Bug report log** (§16) with a screenshot.

---

## 0. How to use this document

- Text in `"double quotes"` under Expected result is the **exact wording** the screen should
  show. Check it word for word, not "something like this."
- 🔴 **KNOWN GAP** rows are things the team already knows about. **Still do the step** and write
  down exactly what you see — but you do not need to file it as a new bug.
- **Never write a real password, OTP code, or full mobile number** into this document, a bug
  report, or a screenshot filename. Write `<sent>` or `<redacted>` instead.
- If a screen shows a spinner for more than ~15 seconds, treat it as a FAIL and note which
  screen.

## 0.1 Before you start — what to ask the owner for

1. The **APK** (`app-release.apk`) and confirmation it is the latest build.
2. **Two Android phones**, or one phone plus a computer with the web app. Several tests need a
   buyer and an exporter acting at the same time, and **push notifications cannot be tested on
   one device alone.**
3. **Two spare email addresses and two spare mobile numbers** you can receive codes on — one
   pair for the buyer account, one for the exporter. They must be different.
4. Whether the build points at the **live** server or a test one.

## 0.2 Things that are true of this app — read before testing

These are deliberate. Reporting them as bugs wastes everyone's time.

- **Buyer and exporter are separate accounts**, even with the same email. The login screen asks
  which portal you are entering. The same email may hold one buyer **and** one exporter account.
- **A buyer can do everything from the moment they sign up.** There is no approval gate. The
  verified tick is a trust badge, not a permission.
- **An exporter is public from signup too**, but may only have **3 live products and 10 drafts**
  until verified. Verification removes both limits.
- **There is no "unverified" badge anywhere.** A missing tick is the only signal. If you see a
  badge that says a company is *not* verified, that IS a bug.
- **Search matches whole words only.** "cott" finds nothing; "cotton" does. This is expected —
  see §7.3.
- **Chat is text only.** No photo or file attachments. The attachment button should not exist.
- **No prices are paid in the app.** There is no cart, no checkout, no payment. If you find
  anything that takes money, stop and report it immediately.

---

## 1. Install and first launch

| # | Step | Expected result | P/F |
|---|---|---|---|
|1.1|Install the APK. Android may warn about installing outside the Play Store — allow it.|App installs. Icon shows on the home screen as **MPX Global**.| |
|1.2|Open the app.|A splash screen, then a welcome screen with options to sign in or create an account. **No crash, no blank white screen.**| |
|1.3|Turn the phone to landscape.|The app stays portrait. (It is locked to portrait on purpose.)| |
|1.4|Turn Wi-Fi and mobile data OFF. Force-close and reopen the app.|A clear message that it cannot reach the server, with a way to retry. **It must NOT sign you out** or show a blank screen.| |
|1.5|Turn the network back on and tap retry.|The app continues normally.| |

---

## 2. Buyer signup

Use your **first** spare email + mobile.

| # | Step | Expected result | P/F |
|---|---|---|---|
|2.1|From Welcome, choose to create an account, and pick the **Buyer** side.|A form asking for name, email, mobile and password.| |
|2.2|Enter a password like `abc`.|It is refused with a message about password strength. **You cannot continue.**| |
|2.3|Fill everything correctly and continue.|A verification screen. **Two separate codes are sent — one to your email and one to your mobile.**| |
|2.4|Enter a wrong code on purpose.|A clear "incorrect code" message. **It must not say whether the account exists.**| |
|2.5|Enter both correct codes.|Both channels show as verified.| |
|2.6|Try 6 wrong codes in a row (use resend if needed).|After 5 attempts it locks you out for about 15 minutes.|
|2.7|Complete the company step (company name, country).|Account created and you land **inside the app, signed in** — no third code, no separate login.| |
|2.8|**Note the exact time.** Force-close the app, reopen it.|You are **still signed in**. It does not ask you to log in again.| |

🔴 **KNOWN GAP (2.7):** if two companies with the same name sign up, each still gets its own
separate company record. Joining an existing company is not built yet.

---

## 3. Exporter signup

Use your **second** spare email + mobile, on the **second phone**.

| # | Step | Expected result | P/F |
|---|---|---|---|
|3.1|Create an account and pick the **Exporter** side.|Same two-step flow as the buyer.| |
|3.2|Complete it.|An extra step asks for **business type** (business or individual) and an address.| |
|3.3|Finish and land in the app.|You see the **exporter** home — catalogue and enquiries, not a buyer's shopping view.| |
|3.4|Sign out. Try to sign in with this email on the **Buyer** portal.|It refuses with the **same generic "invalid credentials"** message as a wrong password. **It must not say "this account is an exporter"** or hint the account exists elsewhere.| |
|3.5|Sign back in on the Exporter portal.|Works.| |

---

## 4. Login, forgot password, change password

| # | Step | Expected result | P/F |
|---|---|---|---|
|4.1|Sign out. Sign in with the right email and a **wrong** password.|"Invalid credentials" (or similar). No detail about what was wrong.| |
|4.2|Sign in correctly.|A one-time code is sent. Entering it signs you in.| |
|4.3|Use **Forgot password**. Enter your email.|A reset code/link is sent. The screen must **not** reveal whether that email has an account.| |
|4.4|Complete the reset with a new password.|You can sign in with the new password. **The old password no longer works.**| |
|4.5|After resetting, check the other phone if it was signed in as the same account.|That session is signed out — a password change ends other sessions.| |
|4.6|In the app: Profile → Change password. Change it again.|Works, and again signs out other sessions.| |

---

## 5. Buyer home

Signed in as the **buyer**.

| # | Step | Expected result | P/F |
|---|---|---|---|
|5.1|Look at the top of Home.|A blue bar with a search field, an **AI** chip inside it, a heart (saved) and a profile icon.| |
|5.2|Scroll down slowly, then back up.|Content scrolls smoothly. The blue search bar **stays reachable at the top** once you scroll.| |
|5.3|Look at Categories.|A grid of round category photos with names under them, and an **All** button.| |
|5.4|Tap a category.|A product list for that category opens.| |
|5.5|Go back. Look at the banner area.|A banner that **changes by itself** every few seconds. The dots below it move with it. **Dots must be BELOW the banner, not on top of it.**| |
|5.6|Swipe the banner sideways.|It moves one banner per swipe, cleanly — no half-banner stuck at the edge.| |
|5.7|Scroll to the very bottom, and keep scrolling.|**More products keep loading** as you scroll.| |
|5.8|Keep going until nothing more loads.|It ends with `"You've seen everything listed so far"` — **it must not spin forever.**| |
|5.9|Look at the product cards.|Different cards show different price shapes: a single price, a range, and `"Price on request"`. **All three are correct** — not every product has a price.| |
|5.10|Pull down from the top to refresh.|Content reloads.| |

---

## 6. Buyer — saving products

| # | Step | Expected result | P/F |
|---|---|---|---|
|6.1|Tap the heart on any product card.|It fills in.| |
|6.2|Open the heart icon in the top bar.|Your saved product is listed.| |
|6.3|Unsave it from the saved list.|It disappears from the list.| |
|6.4|Save 3 products, force-close the app, reopen, check saved.|All 3 are still saved.| |

---

## 7. Buyer — search

### 7.1 Search tab

| # | Step | Expected result | P/F |
|---|---|---|---|
|7.1.1|Open the **Search** tab.|Same blue bar and search field as Home, plus an AI band, categories and Goods/Services.| |
|7.1.2|Compare the search field here with the one on Home.|They look **identical**.| |
|7.1.3|Tap **Goods**, go back, tap **Services**.|Each shows a genuinely different set of listings.| |

### 7.2 Searching

| # | Step | Expected result | P/F |
|---|---|---|---|
|7.2.1|Type `cotton` and search.|Matching products appear with a result count.| |
|7.2.2|Switch to the **Suppliers** tab in results.|Companies are listed instead of products.| |
|7.2.3|Open filters. Turn on **Verified only**.|Only companies with a tick remain.| |
|7.2.4|Set a price range, apply.|Results narrow. The filters you applied show as **chips you can remove**.| |
|7.2.5|Remove a chip.|That filter is lifted and results update.| |
|7.2.6|Sort by price low→high, then high→low.|Order changes correctly both ways.| |

### 7.3 When nothing matches

| # | Step | Expected result | P/F |
|---|---|---|---|
|7.3.1|Search for `cottn` (deliberately misspelled).|A "nothing matched" screen that **explains whole-word matching** and suggests `cotton`.| |
|7.3.2|Tap the suggestion.|It searches the corrected word and finds results.| |
|7.3.3|Search for `zzzzqqqq`.|A clean empty state. **No crash, no endless spinner.**| |

🔴 **KNOWN GAP:** there are **no suggestions while you type** and **no "recent searches"** list.
Both are deliberate — do not report.

---

## 8. Buyer — AI search

| # | Step | Expected result | P/F |
|---|---|---|---|
|8.1|Tap the **AI** tab in the middle of the bottom bar.|The AI search screen opens.| |
|8.2|Watch the AI tab icon while on another tab.|It gently pulses. Tapping it does **not** flash or fade like the other tabs.| |
|8.3|Tap one of the example prompts.|It searches immediately and returns a written reply plus results.| |
|8.4|Type your own, e.g. `cotton fabric under 300`, and search.|A short written answer, then matching products, and a correct result count.| |
|8.5|After the search, look at the field at the bottom.|It is **empty**, showing "Search something else…". The words you searched still appear in the results line above.| |
|8.6|Search something nonsense like `qwerty zxcv`.|"Nothing matched" with a suggestion to try different words. **No crash.**| |
|8.7|Sign out and open the app. Try AI search **without signing in**.|It still works — AI search is open to visitors.| |

---

## 9. Buyer — product and supplier pages

| # | Step | Expected result | P/F |
|---|---|---|---|
|9.1|Open any product.|Photos, name, price (or "Price on request"), minimum order quantity, specs, and the seller's name.| |
|9.2|Swipe through the photos.|The photo counter is **fully visible** — not hidden behind the phone's status bar.| |
|9.3|Look at the seller's name on the product.|A green tick appears **only** for verified companies. No badge at all for others.| |
|9.4|Tap the seller name.|Their public page opens: logo, description, country, and their products.| |
|9.5|On the supplier page, look for contact details.|**No phone number and no email address anywhere.** If you find either, that IS a bug — report it immediately.| |

---

## 10. Buyer → exporter: enquiry and chat

**Both phones needed.** Buyer on one, exporter on the other.

| # | Step | Expected result | P/F |
|---|---|---|---|
|10.1|**Buyer:** open a product belonging to your test exporter and tap the enquiry button.|A message form opens, showing which product it is about.| |
|10.2|Send an enquiry with a short note.|You land straight in a chat thread. Your message is there.| |
|10.3|**Buyer:** look at the top of the thread.|The product it is about is shown.| |
|10.4|**Buyer:** look for a message from MPX.|A platform message appears in the thread explaining how the conversation works.| |
|10.5|**Exporter:** open the Chats tab.|The new enquiry is listed, marked unread (bold, with a count).| |
|10.6|**Exporter:** check the Chats tab icon.|It carries a **number badge** for unread conversations.| |
|10.7|**Exporter:** open the thread and reply.|The reply sends.| |
|10.8|**Buyer:** watch the open thread (do not refresh).|The reply arrives **by itself** within a few seconds.| |
|10.9|Send several messages both ways.|Messages stay **in time order, oldest at top**. Times are correct.| |
|10.10|**Buyer:** turn off the network, send a message.|It shows as failed **on that message**, with a way to retry. The app does not freeze.| |
|10.11|Turn the network back on and retry.|It sends.| |
|10.12|Look for a way to attach a photo or file.|**There is none.** Chat is text only.| |

---

## 11. Push notifications 🆕

**Both phones. Both must have allowed notifications when first asked.**

| # | Step | Expected result | P/F |
|---|---|---|---|
|11.1|On first sign-in on each phone, Android asks to allow notifications.|Allow on both. (If you already refused: Android Settings → Apps → MPX Global → Notifications → allow, then sign out and in again.)| |
|11.2|**Close the app completely** on the exporter phone (swipe it away).| | |
|11.3|**Buyer:** send a new enquiry on a product of that exporter.|**Exporter phone shows a notification:** "New enquiry — <company> enquired about <product>".| |
|11.4|**Exporter:** tap that notification.|The app opens **directly in that chat thread** — not on Home.| |
|11.5|**Exporter:** close the app again. **Buyer:** send a chat message in the same thread.|A notification arrives for the new message.| |
|11.6|**Exporter:** open the app first, leave it on Home, then have the buyer send another message.|A notification appears **while the app is open**.| |
|11.7|Check the notification text.|It says **who** and **what product** — **no prices and no message contents.**| |
|11.8|**Exporter:** sign out. **Buyer:** send another message.|**No notification arrives** on the signed-out phone.| |

🔴 **KNOWN GAP:** notifications exist for **new enquiries and new chat messages only**.
Verification decisions, account alerts, an in-app notification centre and WhatsApp are not built
yet. Profile → Notifications correctly shows "Coming soon".

---

## 12. Exporter — catalogue and the listing limits

Signed in as the **exporter** (unverified at this point).

| # | Step | Expected result | P/F |
|---|---|---|---|
|12.1|Look at the exporter Home.|Company name, a prompt to get verified, unread enquiries, and counts of Live / Draft / Hidden products.| |
|12.2|Add a product: pick a category, fill name, description, price, minimum order quantity, unit, and specs.|It saves as a **draft**.| |
|12.3|Add photos from the **camera**, then from the **gallery**.|Both work. Photos appear on the product.| |
|12.4|Publish the draft.|It becomes **Live**.| |
|12.5|Publish products until you have **3 live**.|All 3 publish.| |
|12.6|Try to publish a 4th.|Refused: `"Unverified sellers can have 3 live products. Complete verification to list more."`| |
|12.7|Create drafts until you have **10**.|All 10 save.| |
|12.8|Try to create an 11th draft.|Refused: `"Draft limit reached (10). Publish or delete a draft, or complete verification."`| |
|12.9|Hide a live product, then check the counts on Home.|Counts update correctly (Live down by one, Hidden up by one).| |
|12.10|Edit a product's price and save.|The change shows on the product, and on the buyer's phone after a refresh.| |
|12.11|On the **buyer** phone, search for a **draft** product by name.|**It does not appear.** Only live products are public.| |

---

## 13. Exporter — verification (KYC)

| # | Step | Expected result | P/F |
|---|---|---|---|
|13.1|Open the verification section from Home or Profile.|It explains what is needed.| |
|13.2|Upload a document (photo or file).|It uploads and shows as submitted.| |
|13.3|Check the status shown.|It says the review is pending. **No tick yet.**| |
|13.4|Ask the owner to **approve** it from the admin panel.|Your status becomes verified and a **tick appears next to your company name**.| |
|13.5|Now try publishing a 4th product.|**It publishes.** The limits are gone.| |
|13.6|Check Home again.|The listing-limit meter is **completely gone** — not greyed out.| |
|13.7|On the **buyer** phone, find this company.|A green tick appears next to its name.| |

---

## 14. Company profile

| # | Step | Expected result | P/F |
|---|---|---|---|
|14.1|**Exporter:** open the company profile and add a logo and a description.|Both save.| |
|14.2|Preview your public page.|Logo and description appear as a buyer would see them.| |
|14.3|Change the **company name** (a verified account).|It warns that the tick will be withheld until re-approval, and the status drops back to submitted.| |
|14.4|**Buyer:** check that company.|**The tick is gone** until it is approved again.| |

---

## 15. Profile, sessions, sign out

| # | Step | Expected result | P/F |
|---|---|---|---|
|15.1|Open Profile on both roles.|Name, company, and links that work.| |
|15.2|Look at the **Notifications** row.|🔴 **KNOWN GAP** — it shows "Coming soon". Correct for now.| |
|15.3|Sign out.|You return to the welcome screen.| |
|15.4|Force-close and reopen.|You are **still signed out** — it does not restore the old session.| |
|15.5|Sign in again.|Works, and your data (products, saved items, chats) is all still there.| |

---

## 16. Bug report log

Copy any FAIL row here. One row per bug.

| # | Section & step | What you did | What you expected | What actually happened | Screenshot | Phone / Android version |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |

**Never put a real password, OTP code or full mobile number in this table.**

---

## 17. Things that are NOT built yet — do not test, do not report

These are scheduled work, not defects.

- **Quotations and price negotiation** — no quote can be created or accepted anywhere.
- **Orders, payments, shipping** — nothing takes money. There is no cart or checkout.
- **Ratings and reviews** — no star ratings anywhere.
- **Notifications beyond enquiries and chat messages** — no verification alerts, no account
  reminders, no in-app notification centre, no WhatsApp.
- **Marketing or promotional notifications.**
- **Registering as an exporter from inside a buyer's session** — tapping it says "Coming soon".
  Exporter signup works from the signed-out welcome screen.
- **Recent searches** and **suggestions while typing.**
- **Employee/admin features** — those live in the web panel, not this app.
