import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'BizHaus <noreply@bizhaus.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const STAFF_EMAIL = process.env.STAFF_NOTIFICATION_EMAIL ?? 'hello@bizhaus.com'

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

function emailWrapper(content: string) {
  return `
    <div style="font-family:${FONT};background:#f1f5f9;padding:40px 16px;min-height:100vh;">
      <div style="max-width:520px;margin:0 auto;">
        <!-- Header -->
        <div style="background:#0f172a;border-radius:10px 10px 0 0;padding:24px 32px;">
          <span style="color:white;font-size:20px;font-weight:700;letter-spacing:-0.3px;">BizHaus</span>
          <span style="color:#94a3b8;font-size:13px;margin-left:10px;">Member Portal</span>
        </div>
        <!-- Body -->
        <div style="background:#ffffff;padding:32px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none;">
          ${content}
        </div>
        <!-- Footer -->
        <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:20px;">
          BizHaus · Member Portal
        </p>
      </div>
    </div>
  `
}

export async function sendInviteEmail(to: string, token: string) {
  const link = `${APP_URL}/setup-account?token=${token}`
  await resend.emails.send({
    from: FROM,
    to,
    subject: "You're invited to the BizHaus Member Portal",
    html: emailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 8px;font-size:22px;font-weight:700;">You're invited!</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 24px;">You've been given access to the BizHaus Member Portal — book rooms, connect with the community, and more. Click below to set up your account.</p>
      <a href="${link}" style="display:inline-block;background:#2563eb;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:24px;">Set Up My Account →</a>
      <p style="color:#94a3b8;font-size:13px;margin:0;border-top:1px solid #f1f5f9;padding-top:20px;">This link expires in 7 days. If you weren't expecting this, you can safely ignore it.</p>
    `),
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
    html: emailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 20px;font-size:22px;font-weight:700;">Reservation Confirmed ✓</h2>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Meeting</td><td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.title}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Room</td><td style="padding:10px 14px;color:#1e293b;">${details.room} — ${details.location}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Date</td><td style="padding:10px 14px;color:#1e293b;">${details.date}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Time</td><td style="padding:10px 14px;color:#1e293b;">${details.time}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Booked by</td><td style="padding:10px 14px;color:#1e293b;">${details.booker}</td></tr>
      </table>
      <p style="color:#94a3b8;font-size:13px;margin:0;border-top:1px solid #f1f5f9;padding-top:20px;">Need to cancel? Log in to BizHaus and cancel from the calendar — at least 24 hours before your reservation.</p>
    `),
  })
}

export async function sendExternalBookingReceipt(
  to: string,
  details: {
    confirmationNumber: string
    room: string
    location: string
    date: string
    time: string
    guestName: string
    amountPaid: string
    cardLast4: string | null
    cardBrand: string | null
    paymentDate: string
  }
) {
  const cardLine = details.cardLast4
    ? `${(details.cardBrand ?? 'Card').charAt(0).toUpperCase() + (details.cardBrand ?? 'card').slice(1)} ending in ${details.cardLast4}`
    : 'Card on file'

  await resend.emails.send({
    from: FROM,
    to,
    subject: `BizHaus Receipt — ${details.room} on ${details.date}`,
    html: emailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 4px;font-size:22px;font-weight:700;">Booking Confirmed ✓</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 24px;">Confirmation #${details.confirmationNumber}</p>

      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr>
          <td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Guest</td>
          <td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.guestName}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Room</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.room} — ${details.location}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Date</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.date}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Time</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.time}</td>
        </tr>
      </table>

      <h3 style="color:#0f172a;margin:0 0 12px;font-size:15px;font-weight:700;">Payment Receipt</h3>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr>
          <td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Amount</td>
          <td style="padding:10px 14px;font-weight:700;color:#0f172a;">${details.amountPaid}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Paid with</td>
          <td style="padding:10px 14px;color:#1e293b;">${cardLine}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Date</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.paymentDate}</td>
        </tr>
      </table>

      <p style="color:#94a3b8;font-size:13px;margin:0;border-top:1px solid #f1f5f9;padding-top:20px;">
        <strong style="color:#64748b;">Cancellation policy:</strong> Bookings are non-refundable. To inquire about credit toward a future booking, contact us at
        <a href="mailto:hello@bizhaus.com" style="color:#2563eb;text-decoration:none;">hello@bizhaus.com</a>.
      </p>
    `),
  })
}

export async function sendDayPassConfirmation(
  to: string,
  details: {
    confirmationNumber: string
    location: string
    date: string
    guestName: string
    amountPaid: string
    cardLast4: string | null
    cardBrand: string | null
    paymentDate: string
  }
) {
  const cardLine = details.cardLast4
    ? `${(details.cardBrand ?? 'Card').charAt(0).toUpperCase() + (details.cardBrand ?? 'card').slice(1)} ending in ${details.cardLast4}`
    : 'Card on file'

  await resend.emails.send({
    from: FROM,
    to,
    subject: `BizHaus Day Pass Receipt — ${details.location} on ${details.date}`,
    html: emailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 4px;font-size:22px;font-weight:700;">Day Pass Confirmed ✓</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 24px;">Confirmation #${details.confirmationNumber}</p>

      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr>
          <td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Guest</td>
          <td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.guestName}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Location</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.location}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Date</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.date}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Time</td>
          <td style="padding:10px 14px;color:#1e293b;">9:00am – 5:00pm</td>
        </tr>
      </table>

      <h3 style="color:#0f172a;margin:0 0 12px;font-size:15px;font-weight:700;">Payment Receipt</h3>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr>
          <td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Amount</td>
          <td style="padding:10px 14px;font-weight:700;color:#0f172a;">${details.amountPaid}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Paid with</td>
          <td style="padding:10px 14px;color:#1e293b;">${cardLine}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Date</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.paymentDate}</td>
        </tr>
      </table>

      <p style="color:#94a3b8;font-size:13px;margin:0;border-top:1px solid #f1f5f9;padding-top:20px;">
        <strong style="color:#64748b;">Cancellation policy:</strong> Reservations may be canceled for a full refund until 12:00am (midnight) the night before your reservation date. Contact us at
        <a href="mailto:hello@bizhaus.com" style="color:#2563eb;text-decoration:none;">hello@bizhaus.com</a>.
      </p>
    `),
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
    html: emailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 8px;font-size:22px;font-weight:700;">Reservation Cancelled</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 20px;">The following reservation has been cancelled:</p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Meeting</td><td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.title}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Room</td><td style="padding:10px 14px;color:#1e293b;">${details.room} — ${details.location}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Date</td><td style="padding:10px 14px;color:#1e293b;">${details.date}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Time</td><td style="padding:10px 14px;color:#1e293b;">${details.time}</td></tr>
      </table>
      <p style="color:#94a3b8;font-size:13px;margin:0;border-top:1px solid #f1f5f9;padding-top:20px;">Questions? Contact your BizHaus admin.</p>
    `),
  })
}

export async function sendRoomAccessGrantedEmail(to: string, name: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "You're set up to book rooms",
    html: emailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 8px;font-size:22px;font-weight:700;">You're all set, ${name}!</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 24px;">Your BizHaus admin just gave you access to book conference rooms. Click below to check availability and reserve a room.</p>
      <a href="${APP_URL}/dashboard/rooms" style="display:inline-block;background:#2563eb;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;">Book a Room →</a>
    `),
  })
}

export async function sendCancellationRequestEmail(
  details: { name: string; email: string; title: string; room: string; location: string; date: string; time: string }
) {
  await resend.emails.send({
    from: FROM,
    to: STAFF_EMAIL,
    subject: `Cancellation request (within 12h): ${details.title}`,
    html: emailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 8px;font-size:22px;font-weight:700;">Cancellation requested</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 24px;">This reservation starts within 12 hours, so ${details.name} couldn't cancel it themselves — please review and cancel it in Admin if appropriate.</p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Requested by</td><td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.name} (${details.email})</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Meeting</td><td style="padding:10px 14px;color:#1e293b;">${details.title}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Room</td><td style="padding:10px 14px;color:#1e293b;">${details.room} — ${details.location}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Date</td><td style="padding:10px 14px;color:#1e293b;">${details.date}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Time</td><td style="padding:10px 14px;color:#1e293b;">${details.time}</td></tr>
      </table>
      <a href="${APP_URL}/dashboard/admin/reservations" style="display:inline-block;background:#2563eb;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;">Open Reservations →</a>
    `),
  })
}

export async function sendFeedbackNotificationEmail(
  details: { name: string; email: string; category: string; message: string }
) {
  await resend.emails.send({
    from: FROM,
    to: STAFF_EMAIL,
    subject: `New feedback (${details.category}): ${details.name}`,
    html: emailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 8px;font-size:22px;font-weight:700;">New feedback submitted</h2>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">From</td><td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.name} (${details.email})</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Category</td><td style="padding:10px 14px;color:#1e293b;">${details.category}</td></tr>
      </table>
      <p style="color:#475569;line-height:1.6;margin:0 0 24px;white-space:pre-wrap;background:#f8fafc;border-radius:7px;padding:14px;">${details.message}</p>
      <a href="${APP_URL}/dashboard/admin/feedback" style="display:inline-block;background:#2563eb;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;">View Feedback →</a>
    `),
  })
}

export async function sendRoomAccessRequestEmail(details: { name: string; email: string }) {
  await resend.emails.send({
    from: FROM,
    to: STAFF_EMAIL,
    subject: `Room access requested: ${details.name}`,
    html: emailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 8px;font-size:22px;font-weight:700;">Room access requested</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 24px;">A member portal user has requested access to book rooms. Activate them by assigning a company and hours allotment in Members.</p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Name</td><td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.name}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Email</td><td style="padding:10px 14px;color:#1e293b;">${details.email}</td></tr>
      </table>
      <a href="${APP_URL}/dashboard/admin/members" style="display:inline-block;background:#2563eb;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;">Open Members →</a>
    `),
  })
}
