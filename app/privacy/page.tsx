export const metadata = { title: 'Privacy Policy — BizHaus' }

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-gray-700">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: June 24, 2026</p>

      <p className="mb-6">
        BizHaus (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the room reservation platform at betarooms.bizhaus.com. This policy describes how we collect, use, and protect your information when you use our services.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">Information we collect</h2>
      <p className="mb-4">We collect information you provide directly when using our platform:</p>
      <ul className="list-disc pl-6 space-y-2 mb-6">
        <li><strong>Account information:</strong> name, email address, and password for registered members.</li>
        <li><strong>Booking information:</strong> name, email address, phone number, and company name for external room bookings.</li>
        <li><strong>Payment information:</strong> payment card details are collected and processed by Stripe. We do not store full card numbers on our servers.</li>
        <li><strong>Usage data:</strong> reservation history, room preferences, and booking patterns.</li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">How we use your information</h2>
      <ul className="list-disc pl-6 space-y-2 mb-6">
        <li>Process and confirm room reservations.</li>
        <li>Send transactional emails (booking confirmations, cancellations, receipts, and account invitations).</li>
        <li>Process payments through Stripe.</li>
        <li>Create financial records in QuickBooks Online for completed transactions.</li>
        <li>Manage member accounts and company hour allotments.</li>
        <li>Generate internal reports on room utilization and revenue.</li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">Third-party services</h2>
      <p className="mb-4">We use the following third-party services to operate our platform:</p>
      <ul className="list-disc pl-6 space-y-2 mb-6">
        <li><strong>Supabase:</strong> database hosting and user authentication.</li>
        <li><strong>Stripe:</strong> payment processing. Stripe&apos;s privacy policy applies to payment data they handle.</li>
        <li><strong>QuickBooks Online (Intuit):</strong> financial record-keeping. Customer name, email, phone, and transaction details are shared with QuickBooks to create sales receipts.</li>
        <li><strong>Resend:</strong> transactional email delivery.</li>
        <li><strong>Vercel:</strong> application hosting.</li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">Data shared with QuickBooks</h2>
      <p className="mb-6">
        When an external booking payment is completed, we share the following information with QuickBooks Online to create a sales receipt: customer name, email address, phone number, room booked, booking date and time, and payment amount. This data is used solely for financial record-keeping purposes.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">Data security</h2>
      <p className="mb-6">
        We use industry-standard security measures to protect your information, including HTTPS encryption for all data in transit, secure authentication, and access controls. Payment information is handled entirely by Stripe and never stored on our servers.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">Data retention</h2>
      <p className="mb-6">
        We retain your account and booking information for as long as your account is active or as needed to provide our services. You may request deletion of your account by contacting us.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">Contact</h2>
      <p className="mb-6">
        If you have questions about this privacy policy or your data, contact us at{' '}
        <a href="mailto:info@bizhaus.com" className="text-blue-600 hover:underline">info@bizhaus.com</a>.
      </p>
    </div>
  )
}
