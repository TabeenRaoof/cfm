import { AUTH_EMAIL_SENDER } from "./identity.ts";
import { Controller, LegalPage, Mailto, SubprocessorTable } from "./LegalPage.tsx";
import { signInEmailStatement } from "./subprocessors.ts";

/**
 * The product's privacy policy (D-013, D-053). Plain English, like the scanner's notice, and
 * limited to what the code does today — every processing activity here maps to a table in
 * supabase/migrations/ or a call in worker/. Draft until IN_FORCE (identity.ts).
 */
export function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy policy"
      lede="Plain English, because a privacy policy nobody reads protects nobody. This covers the signed-in product; the free gap scanner has its own shorter notice."
    >
      <h2>The short version</h2>
      <ul className="list">
        <li>
          We hold what you put into the service — your account email, your organisation, your
          products and the compliance documents you upload — to run the service for you, and for
          nothing else.
        </li>
        <li>Your data is stored in the European Union. One exception is explained below: documents
          our own rules cannot read are read by an AI provider based in the United States.</li>
        <li>We never sell data, never use it for advertising, and never use your documents to
          train AI models — and neither does any provider we use.</li>
        <li>No analytics, advertising or tracking scripts, and the app sets no cookies.</li>
      </ul>

      <h2>Who is responsible</h2>
      <p>
        The service is run by <Controller />. Questions, or any request below: <Mailto />.
      </p>
      <p>
        We are the <strong>controller</strong> for your account — your email address and how you
        use the service. For the documents and product details your organisation uploads, your
        organisation is the controller and we are its <strong>processor</strong>: we handle that
        data only on its instructions, under our <a href="/dpa">data processing agreement</a>. If
        you are named in a document someone uploaded, their organisation is the right first
        contact, but you are welcome to write to us and we will pass your request on and help.
      </p>

      <h2>What we hold, and why</h2>
      <p>
        <strong>Your account.</strong> Your email address, which organisations you belong to and
        in what role, and when you signed in. We need it to let you in and to keep other people
        out. Lawful basis: performing our agreement with you or your organisation. You sign in with
        an emailed link; there is no password for us to store.
      </p>
      <p>
        <strong>Invitations.</strong> When a colleague invites you, we hold your email address and
        the role offered until you accept or the invitation expires after 14 days. Lawful basis:
        the inviting organisation's legitimate interest in adding its own staff.
      </p>
      <p>
        <strong>Your organisation and products.</strong> Organisation name, country, target
        markets, product details (SKU, title, brand, category, barcode, country of manufacture)
        and compliance facts about them. Some of these name people — for example an EU responsible
        person's name, address and contact details. We hold them on your organisation's behalf.
      </p>
      <p>
        <strong>Documents you upload</strong> (currently responsible-person mandates and packaging
        registration certificates), and the fields read from them: names, addresses, registration
        numbers, dates and signatories. These often contain personal data about people outside
        your organisation. We hold them on your organisation's behalf, only to check them against
        the requirements you are tracking and to build your technical file.
      </p>
      <p>
        <strong>Change history.</strong> A record of who changed what and when, so an organisation
        can see how its compliance file came to be. Lawful basis: our and your organisation's
        legitimate interest in an accurate, tamper-evident record.
      </p>
      <p>
        <strong>Cost records.</strong> For each document read automatically, the number of units
        of AI processing it used and what that cost us — no content.
      </p>

      <h2>How documents are read</h2>
      <p>
        Our own rules read each document first, on our servers. Only if they cannot find a field
        is the document sent to our AI provider (below) to read it. The result is then checked by
        our rules again — the AI never decides on its own that a document is acceptable — and
        anything uncertain is marked for a person in your organisation to confirm or correct.
      </p>
      <p>
        This reading produces facts about a document, not decisions about a person. No one is
        profiled, scored or subject to an automated decision with legal or similarly significant
        effect.
      </p>

      <h2>Who else processes data for us</h2>
      <p>
        We use a small number of providers, each bound by a data processing agreement. None may use
        the data for its own purposes.
      </p>
      <SubprocessorTable />
      <p>{signInEmailStatement(AUTH_EMAIL_SENDER)}</p>
      <p>
        We will list any new provider here, and tell customers at least 30 days before one starts
        handling their data.
      </p>

      <h2>Where your data goes</h2>
      <p>
        Data is stored in the EU. It leaves the UK and EU in two cases: when a document is sent to
        Anthropic in the United States to be read, and when the service is operated — we are based
        outside the UK and the EU. Both are covered by the European Commission's standard
        contractual clauses (and, for the UK, the UK addendum to them).
      </p>

      <h2>How long we keep it</h2>
      <ul className="list">
        <li>Your account: until you or your organisation close it.</li>
        <li>An uploaded document: until someone in your organisation deletes it, or the
          organisation is closed. Deleting a document removes the file at once; the change
          history's record of it, including the fields read from it, stays until the organisation
          is closed.</li>
        <li>Everything belonging to an organisation, including its change history: deleted when
          the organisation is closed, within 30 days of the request. Ask us for an export first —
          you may need your technical file for up to ten years, and that duty is yours, not
          ours.</li>
        <li>Deleted data may remain in our providers' backups for up to 7 days, and with Anthropic
          for up to 30 days, before it is gone for good.</li>
      </ul>

      <h2>How we protect it</h2>
      <p>
        Every organisation's data is separated at the database level, not just in the app: a
        member of one organisation cannot read another's data even with a modified browser. Data is
        encrypted in transit and at rest. Server credentials never reach the browser, and the build
        refuses to publish a version that would leak one. Every change is recorded in the change
        history, which no one can edit — it is only ever removed as a whole, when the organisation
        is closed.
      </p>
      <p>
        Your browser keeps your sign-in session in its own storage so you stay signed in. Signing
        out removes it.
      </p>

      <h2>What you can ask us to do</h2>
      <p>
        Under the UK GDPR and the EU GDPR you may ask for a copy of your personal data, ask us to
        correct or delete it, object to or restrict how we use it, and ask for it in a portable
        form. Write to <Mailto />. We will respond within one month. For data your organisation
        uploaded, we will work with your organisation, which decides what happens to it.
      </p>
      <p>
        If you think we have handled your data badly you can complain to a supervisory authority —
        in the UK the Information Commissioner's Office, in the EU the authority for the country
        you live or work in. We would rather you told us first, but it is your right either way.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes materially we will update the date at the top and email the
        owners of every organisation before the change takes effect, rather than changing it
        quietly.
      </p>
    </LegalPage>
  );
}
