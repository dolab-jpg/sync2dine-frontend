import LegalPageShell from './LegalPageShell';

export default function AcceptableUsePage() {
  return (
    <LegalPageShell title="Acceptable use">
      <p>You must not use Sync2Dine to:</p>
      <ul>
        <li>Break UK law or encourage unlawful activity.</li>
        <li>Harass, threaten, or discriminate against callers, staff, or third parties.</li>
        <li>Send spam, fraudulent orders, or misrepresent your venue.</li>
        <li>Attempt to bypass usage limits, fare controls, or security measures.</li>
        <li>Reverse engineer, scrape, or overload our systems without written permission.</li>
        <li>Process special-category data via Judie without a lawful basis and appropriate safeguards.</li>
      </ul>
      <h2>AI &amp; calls</h2>
      <p>
        Judie must identify as an AI assistant where required. You are responsible for menu accuracy, allergen information
        provided to callers, and honouring orders and bookings Judie captures. Monitor live calls where safety or
        high-value orders require human oversight.
      </p>
      <h2>Atmosphere</h2>
      <p>
        Audio and messaging must respect PRS/PPL or equivalent licensing for public performance where applicable. Do not
        broadcast content you do not have rights to use.
      </p>
      <h2>Enforcement</h2>
      <p>
        We may suspend or terminate service for material breach, illegal use, or repeated fair-use violations. See{' '}
        cancellation terms for refund implications.
      </p>
    </LegalPageShell>
  );
}
