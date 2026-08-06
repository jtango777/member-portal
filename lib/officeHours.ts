import { createAdminClient } from '@/lib/supabase/server'

const HOURS_PER_PERSON = 6

async function getPrivateOfficeTypeId(admin: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const { data } = await admin.from('membership_types').select('id').ilike('name', 'Private Office').maybeSingle()
  return data?.id ?? null
}

// If the given company is currently on the "Private Office" tier, recalculates
// its monthly_hours_allotment as 6 hours × current headcount — active
// registered members plus pending (not-yet-accepted) invites, so a new
// hire's hours are ready before they even set up their account — and writes
// it back. No-op for every other tier, so manually-set custom numbers on
// non-office companies are never touched by this.
//
// Call this after anything that can change a Private Office company's
// headcount: adding/removing a member, moving someone in/out of the company,
// archiving a member, or switching a company onto/off the Private Office tier.
export async function recalcOfficeHours(companyId: string | null | undefined) {
  if (!companyId) return
  const admin = createAdminClient()

  const { data: company } = await admin.from('companies').select('membership_type_id').eq('id', companyId).maybeSingle()
  if (!company) return

  const privateOfficeId = await getPrivateOfficeTypeId(admin)
  if (!privateOfficeId || company.membership_type_id !== privateOfficeId) return

  const [{ count: activeCount }, { count: pendingCount }] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true),
    admin.from('permitted_emails').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true).is('accepted_at', null),
  ])

  const headcount = (activeCount ?? 0) + (pendingCount ?? 0)
  await admin.from('companies').update({ monthly_hours_allotment: headcount * HOURS_PER_PERSON }).eq('id', companyId)
}
