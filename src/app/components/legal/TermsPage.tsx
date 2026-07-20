import { Link } from 'react-router';
import LegalPageShell from './LegalPageShell';
import { FARE_SCHEDULE_VERSION, SAAS_PACKAGES, SAAS_PACKAGE_IDS } from '../../engine/saas/saasPackages';

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of service">
      <p>
        These terms govern your use of Sync2Dine software and related services (Judie phone AI, Atmosphere venue audio,
        and bundled Complete packages). By starting checkout or paying an invoice you agree to these terms and the documents
        linked below.
      </p>
      <h2>Service</h2>
      <p>
        Sync2Dine provides cloud software for restaurants including AI call handling, order and booking capture, optional
        outbound calling, and venue audio/training features depending on your selected package. We may update features;
        material changes will be communicated in advance where reasonably practicable.
      </p>
      <h2>Billing</h2>
      <p>
        Fees follow the fare schedule in force at signup ({FARE_SCHEDULE_VERSION}). Weekly subscriptions renew each week;
        annual prepay covers twelve months from payment. Usage beyond included minutes or tokens is billed as overage per the{' '}
        <Link to="/legal/fair-use-and-fares" className="text-s2d-teal-deep underline">
          Fair use &amp; fares
        </Link>{' '}
        schedule. Additional sites are billed per site at the rates published on pricing.
      </p>
      <h2>Your responsibilities</h2>
      <ul>
        <li>Provide accurate venue and contact details and keep login credentials secure.</li>
        <li>Ensure staff use the service lawfully and in line with our Acceptable Use policy.</li>
        <li>Maintain any integrations (telephony, POS, delivery hubs) you connect.</li>
      </ul>
      <h2>Related policies</h2>
      <ul>
        <li>
          <Link to="/legal/privacy" className="text-s2d-teal-deep underline">
            Privacy policy
          </Link>
        </li>
        <li>
          <Link to="/legal/acceptable-use" className="text-s2d-teal-deep underline">
            Acceptable use
          </Link>
        </li>
        <li>
          <Link to="/legal/cancellation-refunds" className="text-s2d-teal-deep underline">
            Cancellation &amp; refunds
          </Link>
        </li>
      </ul>
      <h2>Liability</h2>
      <p>
        To the fullest extent permitted by law, Sync2Dine is not liable for indirect or consequential loss. Our aggregate
        liability for any claim relating to the service in a twelve-month period is limited to the fees you paid in that
        period. Nothing excludes liability for death, personal injury caused by negligence, or fraud.
      </p>
      <h2>Package reference</h2>
      <p>Commercial package names at {FARE_SCHEDULE_VERSION}:</p>
      <ul>
        {SAAS_PACKAGE_IDS.map((id) => (
          <li key={id}>{SAAS_PACKAGES[id].name}</li>
        ))}
      </ul>
    </LegalPageShell>
  );
}
