import QuickBooksManager from '@/components/admin/QuickBooksManager'
import QbBankAccounts from '@/components/admin/QbBankAccounts'

export const dynamic = 'force-dynamic'

export default function QuickBooksPage() {
  return (
    <>
      <QuickBooksManager />
      <QbBankAccounts />
    </>
  )
}
