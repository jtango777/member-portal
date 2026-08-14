import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendFeedbackNotificationEmail } from '@/lib/email'

const CATEGORIES = ['Bug', 'Idea', 'Question', 'Other']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { category, message } = await request.json()
  if (!CATEGORIES.includes(category)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  if (!message || !message.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 400 })

  const { error } = await supabase.from('feedback').insert({
    profile_id: user.id,
    category,
    message: message.trim(),
  })

  if (error) return NextResponse.json({ error: 'Failed to submit feedback.' }, { status: 500 })

  try {
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    await sendFeedbackNotificationEmail({
      name:     profile?.full_name ?? 'A member',
      email:    user.email ?? '',
      category,
      message:  message.trim(),
    })
  } catch (err) {
    console.error('[feedback] notification email failed:', err)
    // Feedback is already saved — don't fail the request over the email.
  }

  return NextResponse.json({ ok: true })
}
