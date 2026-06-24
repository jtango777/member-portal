import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendInviteEmail } from '@/lib/email'
import { generateToken } from '@/lib/utils'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const admin = createAdminClient()

  // Find everyone who has never been invited (no token, not yet accepted)
  const { data: uninvited, error } = await admin
    .from('permitted_emails')
    .select('id, email, company_id')
    .is('accepted_at', null)
    .is('invite_token', null)

  if (error) {
    console.error('[invites/send-all] error:', error.message)
    return NextResponse.json({ error: 'Failed to load uninvited members.' }, { status: 500 })
  }
  if (!uninvited?.length) return NextResponse.json({ sent: 0, failed: 0 })

  let sent = 0
  let failed = 0

  // Process in batches of 10 to avoid overwhelming Resend
  const batchSize = 10
  for (let i = 0; i < uninvited.length; i += batchSize) {
    const batch = uninvited.slice(i, i + batchSize)
    await Promise.allSettled(
      batch.map(async (member) => {
        try {
          const token = generateToken()
          await admin.from('permitted_emails').update({
            invite_token: token,
            invited_at:   new Date().toISOString(),
          }).eq('id', member.id)
          await sendInviteEmail(member.email, token)
          sent++
        } catch {
          failed++
        }
      })
    )
  }

  return NextResponse.json({ sent, failed })
}
