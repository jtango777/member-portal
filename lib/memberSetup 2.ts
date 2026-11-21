import { SupabaseClient } from '@supabase/supabase-js'
import { suggestCompanyForEmail } from '@/lib/suggestCompany'

export type PermittedEmailRow = {
  id: string
  email: string
  company_id: string | null
  individual_hours_allotment: number | null
  default_location_id: string | null
  seating: string | null
  avatar_url: string | null
}

/**
 * Everything that turns a login into a portal member: work out the company,
 * honour the company's grants_admin flag, write the profile, mark the invite
 * accepted, and pull their pre-signup bookings across.
 *
 * Lifted out of the two accept routes, which had grown identical copies of
 * all of it. They now also share the harder case below (a login that already
 * exists), and a second hand-copied version of that is exactly how the
 * grants_admin check came to be missing from one route and not the other.
 */
export async function completeMemberSetup({
  admin, userId, invite, firstName, lastName, defaultLocationId, seating,
}: {
  admin: SupabaseClient
  userId: string
  invite: PermittedEmailRow
  firstName: string
  lastName: string
  defaultLocationId?: string | null
  seating?: string | null
}): Promise<void> {
  const companyId = invite.company_id ?? await suggestCompanyForEmail(admin, invite.email, userId)

  let grantsAdmin = false
  if (companyId) {
    const { data: company } = await admin.from('companies').select('grants_admin').eq('id', companyId).single()
    grantsAdmin = company?.grants_admin ?? false
  }

  // upsert, not insert: callers only reach here when there is no profile
  // yet, but a double-submitted form used to fail the second attempt on the
  // primary key and show "Account setup failed" to someone whose account had
  // in fact just been created.
  await admin.from('profiles').upsert({
    id:                  userId,
    company_id:          companyId,
    individual_hours_allotment: invite.individual_hours_allotment ?? null,
    first_name:          firstName.trim(),
    last_name:           lastName.trim(),
    full_name:           `${firstName.trim()} ${lastName.trim()}`.trim(),
    is_admin:            grantsAdmin,
    default_location_id: defaultLocationId ?? invite.default_location_id ?? null,
    avatar_url:          invite.avatar_url ?? null,
    seating:             seating ?? invite.seating ?? null,
  }, { onConflict: 'id' })

  await admin
    .from('permitted_emails')
    .update({ accepted_at: new Date().toISOString(), invite_token: null, company_id: companyId, is_active: true })
    .eq('id', invite.id)

  await admin
    .from('reservations')
    .update({ user_id: userId, historical_email: null })
    .ilike('historical_email', invite.email)
}
