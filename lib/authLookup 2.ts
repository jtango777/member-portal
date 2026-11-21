import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

// Finding a login by email address.
//
// Supabase's admin API has no get-user-by-email, only a paged list, so the
// rest of this codebase reaches for listUsers({ perPage: 1000 }) and indexes
// the result. That works today (229 users) and quietly stops working at
// 1001. This pages properly instead, so the lookups that decide whether
// someone can sign up don't start answering "no login" for whoever lands on
// page two.
export async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string
): Promise<{ id: string; email: string } | null> {
  const target = email.toLowerCase().trim()
  const perPage = 1000

  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error('[authLookup] listUsers error:', error.message)
      return null
    }
    const users = data?.users ?? []
    const hit = users.find(u => u.email?.toLowerCase() === target)
    if (hit) return { id: hit.id, email: hit.email! }
    if (users.length < perPage) return null
  }
  return null
}

/**
 * True when this email and password really are someone's login.
 *
 * Used where an existing login is about to be attached to something new and
 * there is no emailed token to prove the person owns the address. Checking
 * the password they typed is what keeps that from being "type anyone's email
 * address and take their account over".
 *
 * Deliberately a throwaway anon client: no cookies, no session kept, so
 * verifying a password here never signs anybody into anything.
 */
export async function passwordMatches(email: string, password: string): Promise<boolean> {
  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data, error } = await anon.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  })
  if (data?.session) await anon.auth.signOut()
  return !error && !!data?.user
}
