import { AUTH_EMAIL_SENDER, CONTROLLER_NAME } from "./identity.ts";
import { Controller, LegalPage, Mailto, SubprocessorTable } from "./LegalPage.tsx";
import { signInEmailStatement } from "./subprocessors.ts";

/**
 * The customer-facing data processing agreement (D-013, D-053): the UK/EU GDPR Article 28(3)
 * terms, in plain English. Draft until IN_FORCE (identity.ts); questions for the reviewing lawyer
 * are in legal/README.md.
 */
export function Dpa() {
  return (
    <LegalPage
      title="Data processing agreement"
      lede="The terms on which we handle personal data for your organisation. It forms part of your agreement to use the service, and applies automatically — there is nothing to sign."
    >
      <h2>1. Who is who</h2>
      <p>
        "<strong>You</strong>" are the organisation using the service, and the controller of the
        personal data in what you upload. "<strong>We</strong>" are <Controller />, the processor.
        "<strong>Customer personal data</strong>" is any personal data in your organisation's
        documents, product details, compliance facts and invitations. "<strong>Data protection
        law</strong>" means the UK GDPR, the Data Protection Act 2018 and the EU GDPR, whichever
        applies.
      </p>

      <h2>2. What we process</h2>
      <dl>
        <dt>Subject matter and purpose</dt>
        <dd>Storing your compliance documents and product details, reading documents to extract
          compliance fields, checking them against the requirements for your markets, and building
          your technical file. Nothing else.</dd>
        <dt>Duration</dt>
        <dd>For as long as your organisation uses the service, then until deletion under
          section 8.</dd>
        <dt>People concerned</dt>
        <dd>Your staff who use the service; people named in your documents and product details,
          such as responsible persons, manufacturers' and suppliers' contacts, and signatories.</dd>
        <dt>Kinds of personal data</dt>
        <dd>Names, business postal addresses, business email addresses and phone numbers,
          signatures, job titles, and registration numbers. You will not upload special-category
          data (health, beliefs and the like) or criminal-offence data; the service has no use for
          it.</dd>
      </dl>

      <h2>3. Your instructions</h2>
      <p>
        We process customer personal data only on your documented instructions. Using the service
        as designed, and this agreement, are those instructions. If we are ever required by law to
        do otherwise we will tell you first, unless the law forbids it. If we believe an
        instruction breaks data protection law we will tell you and need not follow it.
      </p>

      <h2>4. Confidentiality</h2>
      <p>
        Only {CONTROLLER_NAME} has access to customer personal data. Anyone given access in future
        will be bound by a written duty of confidentiality first.
      </p>

      <h2>5. Security</h2>
      <p>We maintain at least these measures, and will not weaken them:</p>
      <ul className="list">
        <li>Separation of each organisation's data enforced by the database itself (row-level
          security), with automated tests that prove one organisation cannot read another's
          data.</li>
        <li>Encryption in transit (TLS) and at rest.</li>
        <li>Stored data kept in the European Union; uploaded files in Cloudflare's EU
          jurisdiction.</li>
        <li>Sign-in by single-use emailed link; roles within your organisation (owner, admin,
          member, viewer) that limit who can change what.</li>
        <li>Server credentials held only on the server; the build refuses to publish a version
          that would expose one to browsers.</li>
        <li>A change history of your organisation's data that no user can alter.</li>
        <li>Documents are sent to the AI provider only when our own rules cannot read them, and
          without account or organisation details.</li>
      </ul>

      <h2>6. Sub-processors</h2>
      <p>
        You authorise the sub-processors below. Each is bound by a written agreement giving data
        protection obligations at least as strict as ours. We remain responsible to you for them.
      </p>
      <SubprocessorTable />
      <p>{signInEmailStatement(AUTH_EMAIL_SENDER)}</p>
      <p>
        Before adding or replacing a sub-processor we will email your organisation's owners at
        least 30 days ahead. If you object on reasonable data-protection grounds and we cannot
        resolve it, you may end your use of the service and we will delete your data under
        section 8.
      </p>

      <h2>7. Transfers outside the UK and EU</h2>
      <p>
        Customer personal data is stored in the EU. It is transferred outside the UK and EU in two
        cases: when a document is sent to Anthropic in the United States to be read, and when we
        access it to operate the service, since we are based outside the UK and the EU. The first
        is covered by Anthropic's data processing addendum, which includes the EU standard
        contractual clauses and the UK addendum. For the second, the EU standard contractual
        clauses (module two, controller to processor) and the UK addendum apply between you and
        us, and are incorporated into this agreement by reference.
      </p>

      <h2>8. Deletion and return</h2>
      <p>
        When you close your organisation, or ask us to, we will first offer you an export of your
        data, then delete all customer personal data — files, records and change history — within
        30 days, and confirm in writing when it is done. Copies in providers' backups expire within
        7 days of deletion, and anything sent to Anthropic within 30 days. A single document
        deleted inside the service is deleted from storage straight away; the change history's
        record of it, including the fields read from it, is deleted when your organisation is.
      </p>

      <h2>9. Helping you</h2>
      <p>
        We will help you, as far as we reasonably can, to answer requests from people exercising
        their data protection rights, and with your security, breach-notification, impact
        assessment and consultation duties. If a person contacts us directly about customer
        personal data, we will pass the request to you promptly and not answer it ourselves unless
        you ask us to.
      </p>

      <h2>10. Personal data breaches</h2>
      <p>
        We will tell your organisation's owners without undue delay, and in any case within 48
        hours of becoming aware of a breach affecting customer personal data, with what we know
        of its nature, likely consequences and the measures taken — and update you as we learn
        more.
      </p>

      <h2>11. Audits</h2>
      <p>
        We will make available the information you need to show that this agreement is being
        followed, and answer reasonable written questions about it. Where that is not enough, you
        or an auditor bound by confidentiality may inspect our compliance, on reasonable notice,
        at your cost, no more than once a year unless a breach or a regulator requires it.
      </p>

      <h2>12. Contact</h2>
      <p>
        Everything under this agreement: <Mailto />.
      </p>
    </LegalPage>
  );
}
