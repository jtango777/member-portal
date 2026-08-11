import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Persists the "add your photo" reminder dismissal so it never shows again
// for this member, instead of just for the current browser session.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_prompt_dismissed: true })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
