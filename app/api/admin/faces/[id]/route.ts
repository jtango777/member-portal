import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { unmarkCurrentMemberInPipedrive } from '@/lib/pipedrive'

// Remove a face from Faces.
//
// Directory-only photos are deleted outright — there's no account or
// invite attached to those at all, nothing else to archive.
//
// Pending invites and real member accounts both get a genuine archive now
// (is_active: false + Pipedrive unmarked), not just their photo cleared.
// Before 2026-09-10 this only hid a pending person's photo and left their
// invite fully intact, and even for real accounts it never actually
// blocked login — someone archived here could still use the whole portal
// normally, just invisible to staff. Caught right before the mass invite
// made "most Faces entries are real accounts" the common case instead of
// the rare one.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: caller } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!caller?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const admin = createAdminClient()

  // Matches the Members page dialog's own default — checked unless the
  // caller explicitly says otherwise, so a request with no body (or a
  // non-JSON one) still unmarks in Pipedrive by default.
  const { unmarkInPipedrive = true } = await request.json().catch(() => ({}))

  if (source === 'directory') {
    const { error } = await admin.from('directory_photos').delete().eq('id', id)
    if (error) return NextResponse.json({ error: 'Failed to delete photo.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (source === 'pending') {
    const { data: pe, error } = await admin.from('permitted_emails').update({ is_active: false }).eq('id', id).select('email').single()
    if (error) return NextResponse.json({ error: 'Failed to archive invite.' }, { status: 500 })

    let pipedriveMatched: boolean | null = null
    if (pe?.email && unmarkInPipedrive) {
      const result = await unmarkCurrentMemberInPipedrive(pe.email)
      if (!result.ok) console.error('[admin/faces] Pipedrive unmark failed:', result.error)
      else pipedriveMatched = result.matched
    }

    return NextResponse.json({ ok: true, pipedriveMatched })
  }

  if (source === 'profile') {
    const { data: profile, error } = await admin.from('profiles').update({ is_active: false }).eq('id', id).select('id').single()
    if (error) return NextResponse.json({ error: 'Failed to archive member.' }, { status: 500 })

    // Also flag permitted_emails so they land on the same archived-members list.
    const { data: { user: authUser } } = await admin.auth.admin.getUserById(id)
    let pipedriveMatched: boolean | null = null
    if (authUser?.email && unmarkInPipedrive) {
      await admin.from('permitted_emails').update({ is_active: false }).eq('email', authUser.email)
      const result = await unmarkCurrentMemberInPipedrive(authUser.email)
      if (!result.ok) console.error('[admin/faces] Pipedrive unmark failed:', result.error)
      else pipedriveMatched = result.matched
    } else if (authUser?.email) {
      await admin.from('permitted_emails').update({ is_active: false }).eq('email', authUser.email)
    }

    return NextResponse.json({ ok: true, id: profile.id, pipedriveMatched })
  }

  return NextResponse.json({ error: 'source must be "profile", "pending", or "directory"' }, { status: 400 })
}
