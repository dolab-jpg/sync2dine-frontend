import { Link } from 'react-router';
import LegalPageShell from './LegalPageShell';

export default function CancellationRefundsPage() {
  return (
    <LegalPageShell title="Cancellation & refunds">
      <h2>Weekly billing</h2>
      <p>
        Weekly subscriptions renew automatically each week until cancelled. Cancel from your account settings or by
        written notice before the next billing date. Access continues until the end of the paid week; no partial-week
        refunds unless required by law.
      </p>
      <h2>Annual prepay</h2>
      <p>
        Annual prepay covers twelve months from payment. Early cancellation does not automatically refund unused months
        unless we agree otherwise or law requires. You may downgrade at renewal.
      </p>
      <h2>Launch pricing</h2>
      <p>
        Launch rates (40% off standard weekly, 50% annual prepay discount) apply at signup and continue for your active
        subscription while the launch programme remains in force. If we change standard fares, your launch rate is
        protected for the duration stated at checkout.
      </p>
      <h2>Overage &amp; usage</h2>
      <p>
        Usage beyond included minutes or tokens is billed in arrears per the{' '}
        <Link to="/legal/fair-use-and-fares" className="text-s2d-teal-deep underline">
          fare schedule
        </Link>
        . Overage charges already incurred are non-refundable.
      </p>
      <h2>Refunds</h2>
      <ul>
        <li>Duplicate or erroneous charges: contact support within 14 days for correction.</li>
        <li>Material service outage attributable to us: credit or refund at our discretion.</li>
        <li>Chargebacks without contacting us first may result in account suspension.</li>
      </ul>
      <h2>How to cancel</h2>
      <p>
        Email the address on your invoice or use in-app billing settings. Cancellation is effective from the next billing
        cycle after we confirm receipt.
      </p>
    </LegalPageShell>
  );
}
