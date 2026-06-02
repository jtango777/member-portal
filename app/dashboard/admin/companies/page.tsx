import { createClient } from '@/lib/supabase/server'
import CompaniesManager from '@/components/admin/CompaniesManager'

export const dynamic = 'force-dynamic'

export default async function CompaniesPage() {
  const supabase = await createClient()
  const { data: companies } = await supabase.from('companies').select('*').order('name')
  return <CompaniesManager companies={companies ?? []} />
}
