import { createClient } from '@/lib/supabase/server'
import MembersManager from '@/components/admin/MembersManager'

export const dynamic = 'force-dynamic'

export default async function MembersPage() {
  const supabase = await createClient()
  const [{ data: companies }, { data: membershipTypes }] = await Promise.all([
    supabase.from('companies').select('*').eq('is_active', true).order('name'),
    supabase.from('membership_types').select('*').order('sort_order'),
  ])
  return <MembersManager companies={companies ?? []} membershipTypes={membershipTypes ?? []} />
}
