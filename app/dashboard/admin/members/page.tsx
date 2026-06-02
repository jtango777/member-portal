import { createClient } from '@/lib/supabase/server'
import MembersManager from '@/components/admin/MembersManager'

export const dynamic = 'force-dynamic'

export default async function MembersPage() {
  const supabase = await createClient()

  const [{ data: members }, { data: companies }] = await Promise.all([
    supabase.from('permitted_emails').select('*, companies(id, name)').order('invited_at', { ascending: false }),
    supabase.from('companies').select('*').order('name'),
  ])

  return <MembersManager members={members ?? []} companies={companies ?? []} />
}
