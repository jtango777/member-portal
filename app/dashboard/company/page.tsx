import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CompanyMembersManager from '@/components/CompanyMembersManager'

export const dynamic = 'force-dynamic'

export default async function MyCompanyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, is_company_admin, company_id, companies(name)')
    .eq('id', user.id)
    .single()

  if (!profile || (!profile.is_admin && !profile.is_company_admin) || !profile.company_id) {
    redirect('/dashboard')
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto">
        <CompanyMembersManager companyName={(profile.companies as any)?.name ?? 'My Company'} />
      </div>
    </div>
  )
}
