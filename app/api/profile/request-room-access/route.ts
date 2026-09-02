import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendRoomAccessRequestEmail, sendSystemAlert } from '@/lib/email'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { requested } = await request.json()

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, room_access_requested_at')
    .eq('id', user.id)
    .single()

  const alreadyRequested = !!profile?.room_access_requested_at

  // Don't erase a prior request just because they clicked "No thanks" this time —
  // the prompt reappears every visit until they actually get access.
  const update: { room_access_prompted: boolean; room_access_requested_at?: string } = { room_access_prompted: true }
  if (requested && !alreadyRequested) update.room_access_requested_at = new Date().toISOString()

  const { error } = await admin
    .from('profiles')
    .update(update)
    .eq('id', user.id)

  if (error) {
    console.error('[profile/request-room-access] error:', error.message)
    return NextResponse.json({ error: 'Failed to save your response.' }, { status: 500 })
  }

  // Only email staff the first time — not on every repeat "Yes" click across visits
  if (requested && !alreadyRequested && profile) {
    try {
      await sendRoomAccessRequestEmail({ name: profile.full_name, email: user.email ?? '' })
    } catch (err) {
      console.error('[profile/request-room-access] email failed:', err)
      await sendSystemAlert('Room access request email failed', {
        user_id: user.id, name: profile.full_name, error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({ ok: true })
}
