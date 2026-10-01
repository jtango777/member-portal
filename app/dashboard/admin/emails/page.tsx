import EmailCopyManager from '@/components/admin/EmailCopyManager'

export const dynamic = 'force-dynamic'

// The wording of customer-facing emails. Gated to admins at the layout
// level, same as the rest of the dashboard.
export default function EmailTemplatesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Email Templates</h1>
        <p className="text-sm text-gray-500 mt-0.5">What customers read in confirmation and cancellation emails.</p>
      </div>
      <EmailCopyManager />
    </div>
  )
}
