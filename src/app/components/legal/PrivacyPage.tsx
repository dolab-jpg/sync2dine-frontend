import { Link } from 'react-router';
import LegalPageShell from './LegalPageShell';

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy policy">
      <p>
        Sync2Dine (&quot;we&quot;, &quot;us&quot;) processes personal data to provide restaurant software, AI call handling,
        and related support. This policy explains what we collect, why, and your rights under UK GDPR.
      </p>
      <h2>Data we collect</h2>
      <ul>
        <li>
          <strong>Account &amp; venue:</strong> business name, address, contact name, email, phone, billing details.
        </li>
        <li>
          <strong>Call &amp; order data:</strong> recordings, transcripts, caller numbers, orders and bookings captured by
          Judie.
        </li>
        <li>
          <strong>Usage:</strong> minutes, tokens, feature usage, device and browser logs for security and support.
        </li>
        <li>
          <strong>Marketing (optional):</strong> only if you opt in — product updates and offers; you may withdraw consent
          anytime.
        </li>
      </ul>
      <h2>Why we use data</h2>
      <ul>
        <li>Deliver and improve the service (contract performance).</li>
        <li>Billing, fraud prevention, and legal compliance (legitimate interests / legal obligation).</li>
        <li>Marketing with consent where applicable.</li>
      </ul>
      <h2>Sharing</h2>
      <p>
        We use subprocessors for hosting, telephony, AI inference, email, and payments (e.g. Supabase, telephony carriers,
        Stripe). We do not sell personal data. Data may be processed in the UK/EEA or jurisdictions with adequate safeguards.
      </p>
      <h2>Retention</h2>
      <p>
        Account data is kept while you are a customer and for a reasonable period afterward for legal and accounting
        purposes. Call recordings and transcripts follow your organisation settings and our{' '}
        <Link to="/legal/acceptable-use" className="text-s2d-teal-deep underline">
          acceptable use
        </Link>{' '}
        retention defaults.
      </p>
      <h2>Your rights</h2>
      <p>
        You may request access, correction, deletion, restriction, portability, or object to processing. Contact privacy
        via your account manager or the email on your invoice. You may complain to the ICO (ico.org.uk).
      </p>
      <h2>Cookies</h2>
      <p>
        See our{' '}
        <Link to="/legal/cookies" className="text-s2d-teal-deep underline">
          cookie policy
        </Link>{' '}
        for details on site cookies and local storage used for checkout drafts.
      </p>
    </LegalPageShell>
  );
}
