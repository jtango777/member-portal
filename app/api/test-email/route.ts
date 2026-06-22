import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function GET() {
  const key = process.env.RESEND_API_KEY
  if (!key) return NextResponse.json({ error: 'RESEND_API_KEY not set' })

  try {
    const resend = new Resend(key)
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'BizHaus <noreply@bizhaus.com>',
      to: 'caroline@bizhaus.com',
      subject: 'Vercel Email Test',
      html: '<p>If you see this, email works from Vercel!</p>',
    })
    return NextResponse.json({ ok: true, result })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) })
  }
}
