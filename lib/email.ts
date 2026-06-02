import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'BizHaus <noreply@bizhaus.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function sendInviteEmail(to: string, token: string) {
  const link = `${APP_URL}/setup-account?token=${token}`
  await resend.emails.send({
    from: FROM,
    to,
    subject: "You're invited to BizHaus",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#0f172a;">Welcome to BizHaus</h2>
        <p>You've been invited to the BizHaus room reservation system. Click the link below to set up your account.</p>
        <a href="${link}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0;">Set Up My Account</a>
        <p style="color:#64748b;font-size:14px;">This link will expire in 7 days. If you didn't expect this invite, you can ignore this email.</p>
      </div>
    `,
  })
}

export async function sendConfirmationEmail(
  to: string,
  details: { title: string; room: string; location: string; date: string; time: string; booker: string }
) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Reservation confirmed: ${details.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#0f172a;">Reservation Confirmed</h2>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Meeting</td><td style="padding:8px 0;font-weight:600;">${details.title}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Room</td><td style="padding:8px 0;">${details.room} — ${details.location}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Date</td><td style="padding:8px 0;">${details.date}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Time</td><td style="padding:8px 0;">${details.time}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Booked by</td><td style="padding:8px 0;">${details.booker}</td></tr>
        </table>
        <p style="color:#64748b;font-size:14px;">To cancel, log in to BizHaus and cancel from the calendar view.</p>
      </div>
    `,
  })
}

export async function sendCancellationEmail(
  to: string,
  details: { title: string; room: string; location: string; date: string; time: string }
) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Reservation cancelled: ${details.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#0f172a;">Reservation Cancelled</h2>
        <p>The following reservation has been cancelled:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Meeting</td><td style="padding:8px 0;font-weight:600;">${details.title}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Room</td><td style="padding:8px 0;">${details.room} — ${details.location}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Date</td><td style="padding:8px 0;">${details.date}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Time</td><td style="padding:8px 0;">${details.time}</td></tr>
        </table>
      </div>
    `,
  })
}
