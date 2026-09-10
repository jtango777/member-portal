import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { extractLinkedinUsername } from '@/lib/linkedin'

// Narrow sibling of PATCH /api/user/settings, just for LinkedIn — used by
// the "Add your photo" onboarding prompt, which offers LinkedIn alongside
// the photo but shouldn't touch anything else on the profile. Reusing the
// settings route directly would work for linkedin_username itself, but that
// route recomputes full_name from whatever first/last name it's given, and
// the onboarding dialog never has those — a call with just linkedin_username
// would blank the member's name out.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { linkedin_username } = await request.json()

  let linkedinUsername: string | null = null
  if (typeof linkedin_username === 'string' && linkedin_username.trim()) {
    linkedinUsername = extractLinkedinUsername(linkedin_username)
    if (!linkedinUsername) {
      return NextResponse.json({ error: 'That doesn\'t look like a valid LinkedIn username.' }, { status: 400 })
    }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ linkedin_username: linkedinUsername })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
