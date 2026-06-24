export const metadata = { title: 'Terms of Service — BizHaus' }

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-gray-700">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: June 24, 2026</p>

      <p className="mb-6">
        These terms govern your use of the BizHaus room reservation platform at betarooms.bizhaus.com. By using our platform, you agree to these terms.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">Services</h2>
      <p className="mb-6">
        BizHaus provides a room reservation platform for our coworking locations in El Segundo, Marina del Rey, and Costa Mesa, California. The platform allows registered members to book conference rooms using their company&apos;s monthly hour allotment, and allows external users to book rooms with payment.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">Accounts</h2>
      <p className="mb-6">
        Member accounts are created by invitation from a BizHaus administrator. You are responsible for maintaining the confidentiality of your login credentials. External bookings do not require an account.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">Reservations and cancellations</h2>
      <ul className="list-disc pl-6 space-y-2 mb-6">
        <li>Members may cancel or edit reservations up to 24 hours before the start time.</li>
        <li>Reservations within 24 hours of the start time cannot be modified by members. Contact an administrator for assistance.</li>
        <li>External bookings cannot be cancelled through the platform. Contact us to discuss rescheduling to a future booking.</li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">Payments</h2>
      <p className="mb-6">
        External room bookings require payment at the time of booking. Payments are processed securely through Stripe. All prices are listed on the booking platform and are subject to change. A financial record of each transaction is created in QuickBooks Online for our accounting purposes.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">Hour allotments</h2>
      <p className="mb-6">
        Member companies are assigned monthly hour allotments based on their membership type. Hours reset on the first of each month. Unused hours do not roll over. Administrator bookings do not count against company allotments.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">Acceptable use</h2>
      <p className="mb-6">
        You agree to use the platform only for its intended purpose of booking rooms at BizHaus locations. You may not attempt to access other users&apos; accounts, interfere with the platform&apos;s operation, or use the platform for any unlawful purpose.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">Limitation of liability</h2>
      <p className="mb-6">
        BizHaus provides this platform on an &quot;as is&quot; basis. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform. Our total liability is limited to the amount you paid for the specific booking in question.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">Changes to these terms</h2>
      <p className="mb-6">
        We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the updated terms.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">Contact</h2>
      <p className="mb-6">
        Questions about these terms? Contact us at{' '}
        <a href="mailto:info@bizhaus.com" className="text-blue-600 hover:underline">info@bizhaus.com</a>.
      </p>
    </div>
  )
}
