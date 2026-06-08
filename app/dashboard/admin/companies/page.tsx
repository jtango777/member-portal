import { createClient } from '@/lib/supabase/server'
import CompaniesManager from '@/components/admin/CompaniesManager'

export const dynamic = 'force-dynamic'

export default async function CompaniesPage() {
  const supabase = await createClient()
  const [{ data: companies }, { data: membershipTypes }] = await Promise.all([
    supabase.from('companies').select('*, membership_types(*)').order('name'),
    supabase.from('membership_types').select('*').order('sort_order'),
  ])
  return <CompaniesManager companies={companies ?? []} membershipTypes={membershipTypes ?? []} />
}
