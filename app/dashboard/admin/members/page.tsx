import { createClient } from '@/lib/supabase/server'
import MembersManager from '@/components/admin/MembersManager'

export const dynamic = 'force-dynamic'

export default async function MembersPage() {
  const supabase = await createClient()
  const { data: companies } = await supabase.from('companies').select('*').order('name')
  return <MembersManager companies={companies ?? []} />
}
