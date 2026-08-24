import { Link, useLocation } from 'react-router-dom';

import { useCanonical } from '../../lib/seo.js';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';

/**
 * `/terms` and `/privacy` — one component, two documents.
 *
 * 🔴 WHY THESE EXIST AS REAL PAGES (2026-08-23): the signup fine print has said
 * "you agree to our Terms of Service and Privacy Policy" since 2026-08-03 with
 * nothing behind it. Asking someone to agree to a document you do not publish is
 * the one dead link on this site that is a legal problem rather than a UX one.
 *
 * 🔴 THE CONTENT IS DESCRIPTIVE, NOT ASPIRATIONAL. Every statement below was
 * checked against the code, and nothing is claimed that the platform does not
 * actually do:
 *   - the third parties named are the ones in `package.json` and actually called
 *     (Cloudinary, OpenAI, Firebase, an SMTP provider) — no others are listed;
 *   - **self-service account deletion is NOT implemented**, so this says to ask
 *     us rather than granting a right the product cannot honour;
 *   - **no automatic retention/expiry exists** (no TTL index on any collection),
 *     so no retention period is promised;
 *   - it does not claim GDPR/DPDP/CCPA compliance, certification, or a lawful
 *     basis analysis — those are the owner's counsel's call, not the code's.
 *
 * ⚠️ INTERIM TEXT — THE CLIENT SUPPLIES THE FINAL DOCUMENTS (owner, 2026-08-23).
 * These are not "our documents awaiting review"; they are a placeholder so that
 * nobody is asked to agree to a document that does not exist, and they will be
 * REPLACED WHOLESALE by the client's own Terms and Privacy Policy. Not legal
 * advice, not reviewed by a lawyer. The visible notice on each page says so —
 * remove it in the same change that publishes the client's text.
 *
 * 🔴 WHEN THE CLIENT'S DOCUMENTS ARRIVE, CHECK THEM AGAINST THE SOFTWARE before
 * publishing. A template privacy policy routinely promises things this platform
 * does not do, and publishing those is a false statement rather than
 * boilerplate. The three that will almost certainly appear:
 *   - "you can delete your account at any time" — there is NO self-service
 *     deletion, only a manual request;
 *   - "we keep your data for N months" — there is NO TTL on any collection and
 *     nothing expires automatically;
 *   - "we are GDPR/DPDP compliant" — nothing in the system asserts this.
 * Either the document describes the behaviour, or the software changes to match
 * it. Do not publish a mismatch. Logged in `docs/UiWebNotes.md`.
 */

const UPDATED = '23 August 2026';

/* --------------------------------- pieces --------------------------------- */

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mt-10 text-lg font-extrabold tracking-tight text-ink-900">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-700">{children}</div>
    </section>
  );
}

function Bullets({ items }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

/* ---------------------------------- terms --------------------------------- */

function Terms() {
  return (
    <>
      <Section id="what" title="1. What MPX Global is">
        <p>
          MPX Global is a business-to-business marketplace where international buyers discover
          Indian exporters, view their catalogues, send enquiries and talk to them directly.
        </p>
        <p>
          <strong>We are a discovery and communication platform, not a party to your trade.</strong>{' '}
          We do not sell the goods or services listed, do not hold or transfer payment between you,
          and are not a party to any contract you form with another member. Any order, price,
          delivery term, inspection or dispute is between the buyer and the seller.
        </p>
      </Section>

      <Section id="accounts" title="2. Accounts">
        <p>
          You need an account to send enquiries, chat or list. Buyer and exporter accounts are
          separate; the same email address or mobile number may hold one of each, but never two of
          the same kind. You are responsible for keeping your password and your one-time codes to
          yourself, and for everything done through your account.
        </p>
        <p>
          A buyer account works in full from the moment it is created. An exporter&apos;s public
          profile is visible from signup too — verification adds a tick, it is not a gate.
        </p>
      </Section>

      <Section id="verification" title="3. Verification and the verified tick">
        <p>
          An exporter may submit business documents for review. A member of our team reads them and
          decides — the tick is never automatic. If we grant it, the tick appears on the
          company&apos;s public profile and on its listings.
        </p>
        <p>
          <strong>The tick means our team checked documents on a date. It is not a guarantee</strong>{' '}
          of the quality, legality, availability or fitness of anything listed, of the
          company&apos;s conduct, or of the outcome of a deal. You are responsible for your own due
          diligence before entering into a transaction.
        </p>
        <p>
          We may ask for further documents at any time, and we may withdraw a verification if we
          have reason to. We tell the company why when we do.
        </p>
      </Section>

      <Section id="listings" title="4. Listings and content">
        <p>
          If you list, you are responsible for what you publish: that you may legally offer it,
          that your description, specifications, pricing and minimum order quantity are accurate,
          and that you hold the rights to the images you upload.
        </p>
        <p>An unverified exporter may keep a limited number of live listings. Verification lifts that limit.</p>
        <p>You must not use MPX Global to:</p>
        <Bullets
          items={[
            'offer anything whose sale or export is unlawful, or which you are not entitled to sell',
            'impersonate another business or misrepresent who you are',
            'upload documents that are not genuinely yours',
            'harvest other members’ details, or use the platform to send unsolicited marketing',
            'attempt to bypass, probe or overload the platform’s security or rate limits',
          ]}
        />
        <p>
          We may take down a listing or suspend an account that breaches these terms. Where we take
          a listing down, the seller can see that it was taken down and why.
        </p>
      </Section>

      <Section id="messages" title="5. Enquiries and messages">
        <p>
          Enquiries and chat happen on the platform so both sides have a record. Messages between a
          buyer and a seller are stored and may be reviewed by authorised staff where necessary to
          investigate a report, a suspected breach, or a safety or fraud concern. Every such access
          is recorded.
        </p>
        <p>Keep contact and negotiation on the platform — moving off it removes the record that protects both sides.</p>
      </Section>

      <Section id="ai" title="6. AI-assisted search">
        <p>
          You can describe what you need in plain language and the platform will interpret it to
          find matching listings. The interpretation is automated and can be wrong or incomplete;
          treat results as suggestions, not advice. Search text you type is sent to our AI provider
          to produce that interpretation (see the Privacy Policy).
        </p>
        <p>Use of AI search may be limited per account or per day so the service stays available to everyone.</p>
      </Section>

      <Section id="availability" title="7. Availability">
        <p>
          We work to keep the platform running but do not promise uninterrupted service. We may
          change, suspend or withdraw features, and we may carry out maintenance that makes the
          platform briefly unavailable.
        </p>
      </Section>

      <Section id="liability" title="8. Our responsibility">
        <p>
          Because we are not a party to your trade, we are not responsible for the acts or omissions
          of any member, for the goods or services transacted, or for any loss arising from a deal
          you enter into through the platform. Nothing here limits liability that cannot be limited
          by law.
        </p>
      </Section>

      <Section id="ending" title="9. Ending your use">
        <p>
          You may stop using MPX Global at any time. We may suspend or close an account that
          breaches these terms, that we are required to act on, or that is being used to harm other
          members. Where we can, we tell you why.
        </p>
      </Section>

      <Section id="changes" title="10. Changes to these terms">
        <p>
          We may update these terms. The date at the top shows when they last changed, and continuing
          to use the platform after a change means you accept the updated terms.
        </p>
      </Section>

      <Section id="contact-terms" title="11. Contact">
        <p>
          Questions about these terms should go to the contact address published by MPX Global.
        </p>
      </Section>
    </>
  );
}

/* --------------------------------- privacy -------------------------------- */

function Privacy() {
  return (
    <>
      <Section id="collect" title="1. What we collect">
        <p>
          <strong>When you create an account:</strong> your name, email address, mobile number and a
          password. We never store the password itself — only a hash of it.
        </p>
        <p>
          <strong>About your company:</strong> company name, country, registered address, entity
          type, and — for exporters — a logo and description you choose to publish.
        </p>
        <p>
          <strong>If you submit verification documents:</strong> the business documents you upload
          for review.
        </p>
        <p>
          <strong>What you publish and send:</strong> your listings, the enquiries you send or
          receive, and your chat messages.
        </p>
        <p>
          <strong>Technical records:</strong> for actions that matter — verification decisions,
          administrative changes, document access — we record who did it, when, and the IP address
          and browser or app identifier the request came from. If you allow notifications, we store
          the push token for that device so we can deliver them.
        </p>
      </Section>

      <Section id="use" title="2. What we use it for">
        <Bullets
          items={[
            'running your account, signing you in, and verifying your email and mobile with one-time codes',
            'showing your company and listings to buyers — for exporters this is the point of the platform',
            'reviewing verification documents and deciding whether to grant the tick',
            'delivering enquiries, chat messages and the notifications you have enabled',
            'interpreting your AI search text so we can find matching listings',
            'keeping the platform safe: investigating reports, abuse, fraud and breaches of the terms',
            'keeping a record of consequential actions, so decisions can be accounted for',
          ]}
        />
      </Section>

      <Section id="public" title="3. What is public, and what is never public">
        <p>
          <strong>Public:</strong> an exporter&apos;s company name, country, logo, description,
          whether it is verified, and its live listings. This is visible to anyone, including people
          who are not signed in and search engines.
        </p>
        <p>
          <strong>Never public:</strong> your verification documents, your email address and phone
          number, your exact street address, your internal verification status or the reason for any
          decision, and everything in your enquiries and chats. A buyer&apos;s company profile is not
          published at all.
        </p>
        <p>
          Public pages carry a verified tick or nothing — we never publish that a company is
          unverified, was rejected, or why.
        </p>
      </Section>

      <Section id="documents" title="4. How verification documents are handled">
        <p>
          Uploaded documents are stored privately and are not served from a public address. Staff
          who review them need a specific permission and open each document through a link that
          expires shortly after it is issued. Every access is recorded against the person who made
          it. Documents are never sent to another member, and never shown on any public page.
        </p>
      </Section>

      <Section id="sharing" title="5. Who else processes your data">
        <p>We use a small number of service providers to run the platform:</p>
        <Bullets
          items={[
            'Cloudinary — stores images and uploaded documents',
            'OpenAI — receives the text of an AI search so it can be interpreted; we do not send your account details, contact details or documents with it',
            'Google Firebase Cloud Messaging — delivers push notifications to your device',
            'an email delivery provider — sends one-time codes and notification emails',
          ]}
        />
        <p>
          Our database and cache run on our own server rather than a managed cloud database. We do
          not sell your personal data, and we do not share it for advertising.
        </p>
        <p>
          We may disclose information where the law requires it, or where it is necessary to
          investigate a serious safety, fraud or security concern.
        </p>
      </Section>

      <Section id="international" title="6. Where your data goes">
        <p>
          MPX Global connects buyers outside India with sellers in India, so information you publish
          is by design visible internationally, and the providers above may process data outside
          your country.
        </p>
      </Section>

      <Section id="retention" title="7. How long we keep it">
        <p>
          We keep your account, company, listing and message data for as long as your account exists
          and while we need it to run the platform and to account for decisions we have made.
        </p>
        <p>
          <strong>
            We do not currently delete this automatically after a fixed period, and there is no
            self-service account deletion.
          </strong>{' '}
          To ask for your account and data to be removed, contact us and we will do it manually —
          except where we have to retain a record, for example of a verification decision.
        </p>
      </Section>

      <Section id="rights" title="8. Your choices">
        <Bullets
          items={[
            'you can view and edit your own company profile at any time; changes to details we verified are reviewed before they go live',
            'you can turn notifications off in your device settings — the platform keeps working',
            'you can ask us for a copy of your data, or to correct or delete it, using the contact address below',
          ]}
        />
      </Section>

      <Section id="security" title="9. Security">
        <p>
          Traffic is encrypted in transit. Passwords are hashed, sign-in is protected by one-time
          codes, and consequential actions are recorded. Verification documents are stored privately
          and every staff access to them is logged. No system is perfectly secure, and we do not
          claim otherwise — if a breach affects you, we will tell you what we know.
        </p>
      </Section>

      <Section id="children" title="10. Children">
        <p>MPX Global is a platform for businesses and is not intended for anyone under 18.</p>
      </Section>

      <Section id="contact-privacy" title="11. Contact">
        <p>
          To ask about this policy, request a copy of your data, or ask for it to be corrected or
          deleted, use the contact address published by MPX Global.
        </p>
      </Section>
    </>
  );
}

/* ---------------------------------- page ---------------------------------- */

export function Legal() {
  const { pathname } = useLocation();
  const isPrivacy = pathname === '/privacy';
  useCanonical(isPrivacy ? '/privacy' : '/terms');

  return (
    <div className="bg-white text-ink-900">
      <PublicHeader />

      <main className="w-full px-4 py-10 sm:px-6 sm:py-14 lg:px-10 xl:px-16">
        <div className="mx-auto max-w-3xl">
          <nav aria-label="Legal documents" className="mb-8 flex gap-2 text-sm">
            <Link
              to="/terms"
              aria-current={!isPrivacy ? 'page' : undefined}
              className={`rounded-xl px-4 py-2 font-semibold ${
                !isPrivacy ? 'bg-primary-800 text-white' : 'text-ink-600 hover:bg-surface-subtle'
              }`}
            >
              Terms of Service
            </Link>
            <Link
              to="/privacy"
              aria-current={isPrivacy ? 'page' : undefined}
              className={`rounded-xl px-4 py-2 font-semibold ${
                isPrivacy ? 'bg-primary-800 text-white' : 'text-ink-600 hover:bg-surface-subtle'
              }`}
            >
              Privacy Policy
            </Link>
          </nav>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
          </h1>
          <p className="mt-2 text-sm text-ink-600">Last updated {UPDATED}</p>

          {/* ⚠️ Remove this in the same change that publishes the client's own
              document (owner decision 2026-08-23 — the client supplies the final
              text; this is a placeholder so nobody is asked to agree to a
              document that does not exist). */}
          <p className="mt-6 rounded-xl border border-warning-200 bg-warning-50 p-4 text-[13px] leading-relaxed text-warning-800">
            <strong>Interim document.</strong> This accurately describes how the platform works
            today and stands in until MPX Global&apos;s final {isPrivacy ? 'privacy policy' : 'terms'}{' '}
            are published. It has not been reviewed by a lawyer.
          </p>

          {isPrivacy ? <Privacy /> : <Terms />}

          <p className="mt-12 border-t border-surface-border pt-6 text-sm text-ink-600">
            {isPrivacy ? (
              <>
                See also our{' '}
                <Link to="/terms" className="font-semibold text-primary-700 hover:underline">
                  Terms of Service
                </Link>
                .
              </>
            ) : (
              <>
                See also our{' '}
                <Link to="/privacy" className="font-semibold text-primary-700 hover:underline">
                  Privacy Policy
                </Link>
                .
              </>
            )}
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
