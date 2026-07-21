import LegalPageShell from './LegalPageShell';

export default function CookiesPage() {
  return (
    <LegalPageShell title="Cookie policy">
      <p>
        Sync2Dine uses cookies and similar technologies on our marketing site, checkout flow, and signed-in application.
      </p>
      <h2>Strictly necessary</h2>
      <ul>
        <li>Authentication session cookies when you sign in.</li>
        <li>Security and load-balancing cookies.</li>
        <li>
          <code className="rounded bg-slate-100 px-1">localStorage</code> key{' '}
          <code className="rounded bg-slate-100 px-1">s2d_start_checkout_draft</code> to save your checkout progress
          locally until payment.
        </li>
      </ul>
      <h2>Functional</h2>
      <ul>
        <li>Language and UI preferences.</li>
        <li>Organisation context for staff users.</li>
      </ul>
      <h2>Analytics</h2>
      <p>
        We may use privacy-conscious analytics on public pages to understand pricing funnel performance. Where consent is
        required, we will ask before setting non-essential cookies.
      </p>
      <h2>Managing cookies</h2>
      <p>
        You can block cookies in your browser settings; some features (sign-in, checkout draft restore) may not work
        without them.
      </p>
    </LegalPageShell>
  );
}
