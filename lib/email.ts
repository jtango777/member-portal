import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'BizHaus <noreply@bizhaus.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const STAFF_EMAIL = process.env.STAFF_NOTIFICATION_EMAIL ?? 'hello@bizhaus.com'

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

function emailWrapper(content: string) {
  return `
    <div style="font-family:${FONT};background:#f1f5f9;padding:40px 16px;">
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

// Day pass / external booking emails use the site's real green branding
// (#6ec664, pulled from bizhaus.com's own CSS) instead of the member
// portal's dark/blue look — these go to non-members, who never see the
// member portal at all, so the blue "Member Portal" wrapper read as the
// wrong product.
const BOOKING_GREEN = '#6ec664'
// Hosted, not inline base64 — Gmail (and most major email clients) silently
// refuse to render base64 data: URI images in HTML email for security
// reasons. This was inline before 2026-08-31, which meant the logo never
// actually rendered in any real inbox (Caroline caught it via a real staff
// notification email in her own Gmail). File already exists at
// public/brand/bizhaus-logo.png and is served at this exact path.
const LOGO_URL = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/brand/bizhaus-logo.png`


// Location details used by the day-pass letter templates below. Not worth
// its own table yet — mirrors app/day-pass/page.tsx's DAY_PASS_LOCATIONS.
const DAY_PASS_LOCATIONS: Record<string, { phone: string; address: string; isMarina?: boolean }> = {
  'El Segundo': { phone: '(310) 870-1730', address: '1730 E Holly Ave, El Segundo' },
  'Marina del Rey': { phone: '(310) 596-1990', address: '4223 Glencoe Ave Ste C215, Marina del Rey', isMarina: true },
  'Costa Mesa': { phone: '(949) 800-8660', address: '2942 Century Pl, Costa Mesa' },
}

// Letter-style wrapper for the day-pass confirmation email — plainer and
// more personal than the receipt-style bookingEmailWrapper above, per
// Caroline's redesign request (Aug 2026): less "automated," more like a
// real email from the team.
function letterEmailWrapper(content: string) {
  return `
    <div style="font-family:Georgia,'Times New Roman',serif;background:#f1f5f9;padding:40px 16px;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
        <div style="padding:28px 40px 20px;border-bottom:1px solid #eef0ee;">
          <img src="${LOGO_URL}" alt="BizHaus" style="height:22px;width:auto;" />
        </div>
        <div style="padding:36px 40px 40px;">
          ${content}
        </div>
        <div style="background:#fafafa;border-top:1px solid #eef0ee;padding:20px 40px;font-family:${FONT};">
          <p style="margin:0;font-size:12.5px;color:#94a3a0;">© ${new Date().getFullYear()} BizHaus &middot; <a href="mailto:bookings@bizhaus.com" style="color:#3f7a37;">bookings@bizhaus.com</a></p>
        </div>
      </div>
    </div>
  `
}

function bookingEmailWrapper(content: string, badge: string) {
  return `
    <div style="font-family:${FONT};background:#f1f5f9;padding:40px 16px;">
      <div style="max-width:520px;margin:0 auto;">
        <!-- Header -->
        <div style="background:#ffffff;border-radius:10px 10px 0 0;padding:24px 32px;border:1px solid #e2e8f0;border-bottom:none;">
          <img src="${LOGO_URL}" alt="BizHaus" style="height:20px;width:auto;vertical-align:middle;" />
          <span style="background:${BOOKING_GREEN};color:white;font-size:12px;font-weight:700;padding:4px 10px;border-radius:5px;margin-left:10px;">${badge}</span>
        </div>
        <!-- Body -->
        <div style="background:#ffffff;padding:32px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none;">
          ${content}
        </div>
        <!-- Footer -->
        <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:20px;">
          © ${new Date().getFullYear()} BizHaus ·
          <a href="mailto:bookings@bizhaus.com" style="color:#94a3b8;">bookings@bizhaus.com</a>
        </p>
      </div>
    </div>
  `
}

export async function sendInviteEmail(to: string, token: string) {
  const link = `${APP_URL}/setup-account?token=${token}`
  const { error } = await resend.emails.send({
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
  if (error) console.error('[email] Resend error sending invite email:', error)
}

export async function sendConfirmationEmail(
  to: string,
  details: { title: string; room: string; location: string; date: string; time: string; booker: string }
) {
  const { error } = await resend.emails.send({
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
  if (error) console.error('[email] Resend error sending confirmation email:', error)
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

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `BizHaus Receipt — ${details.room} on ${details.date}`,
    html: bookingEmailWrapper(`
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

      <a href="${APP_URL}/day-pass/account" style="display:inline-block;background:#6ec664;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:24px;">View My Reservations →</a>

      <p style="color:#94a3b8;font-size:13px;margin:0;border-top:1px solid #f1f5f9;padding-top:20px;">
        <strong style="color:#64748b;">Cancellation policy:</strong> Bookings are non-refundable. To inquire about credit toward a future booking, contact us at
        <a href="mailto:hello@bizhaus.com" style="color:#4f9645;text-decoration:none;">hello@bizhaus.com</a>.
      </p>
    `, 'Bookings'),
  })
  if (error) console.error('[email] Resend error sending external booking receipt:', error)
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
  const firstName = details.guestName.trim().split(/\s+/)[0] || details.guestName
  const loc = DAY_PASS_LOCATIONS[details.location]

  const html = loc?.isMarina
    ? marinaConfirmationEmail(firstName, details)
    : standardConfirmationEmail(firstName, details, loc)

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Your BizHaus Day Pass — ${details.location}, ${details.date}`,
    html: letterEmailWrapper(html),
  })
  if (error) {
    console.error('[email] Resend error sending day pass confirmation:', error)
  }
  return { data, error }
}

function standardConfirmationEmail(
  firstName: string,
  details: { confirmationNumber: string; location: string; date: string; amountPaid: string },
  loc: { phone: string; address: string } | undefined
) {
  return `
    <p style="font-family:${FONT};font-size:15px;color:#3a3f3a;line-height:1.7;margin:0 0 22px;">Hi ${firstName},</p>
    <p style="font-family:${FONT};font-size:15px;color:#3a3f3a;line-height:1.7;margin:0 0 18px;">
      Thanks for booking a day pass with BizHaus! We're looking forward to having you at our <strong>${details.location}</strong> location.
    </p>
    <p style="font-family:${FONT};font-size:15px;color:#3a3f3a;line-height:1.7;margin:0 0 28px;">
      We'll be there at <strong>9:00am</strong> to help you get set up when you arrive, just check in with us at the front desk.
    </p>

    <table style="border-collapse:collapse;width:100%;margin-bottom:28px;font-family:${FONT};">
      <tr>
        <td style="padding:9px 0;border-top:1px solid #eef0ee;color:#8b948d;font-size:13px;width:120px;">Location</td>
        <td style="padding:9px 0;border-top:1px solid #eef0ee;color:#232823;font-size:13.5px;">${loc ? `${details.location}, ${loc.address}` : details.location}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;border-top:1px solid #eef0ee;color:#8b948d;font-size:13px;">Date</td>
        <td style="padding:9px 0;border-top:1px solid #eef0ee;color:#232823;font-size:13.5px;">${details.date}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;border-top:1px solid #eef0ee;color:#8b948d;font-size:13px;">Time</td>
        <td style="padding:9px 0;border-top:1px solid #eef0ee;color:#232823;font-size:13.5px;">9:00am &ndash; 5:00pm</td>
      </tr>
      <tr>
        <td style="padding:9px 0;border-top:1px solid #eef0ee;border-bottom:1px solid #eef0ee;color:#8b948d;font-size:13px;">Total paid</td>
        <td style="padding:9px 0;border-top:1px solid #eef0ee;border-bottom:1px solid #eef0ee;color:#232823;font-size:13.5px;font-weight:bold;">${details.amountPaid}</td>
      </tr>
    </table>

    <p style="font-family:${FONT};font-size:15px;color:#3a3f3a;line-height:1.7;margin:0 0 6px;">
      Reply to this email if you have any questions${loc ? `, or give us a call at ${loc.phone}` : ''}.
    </p>
    <p style="font-family:${FONT};font-size:15px;color:#3a3f3a;line-height:1.7;margin:24px 0 0;">
      See you soon,<br/>The BizHaus Team
    </p>
    <p style="font-family:${FONT};font-size:12px;color:#b7bdb6;line-height:1.6;margin:20px 0 0;">
      Reference #${details.confirmationNumber} if you need to reach us about this booking.
    </p>
  `
}

function marinaConfirmationEmail(
  firstName: string,
  details: { confirmationNumber: string; date: string }
) {
  const photo = (name: string) => `${APP_URL}/day-pass/${name}`
  const bullet = (label: string, text: string) => `
    <tr>
      <td style="padding:0 0 16px;font-family:${FONT};font-size:14.5px;color:#3a3f3a;line-height:1.65;vertical-align:top;">
        <span style="color:#3f7a37;font-weight:700;">${label}:</span> ${text}
      </td>
    </tr>
  `

  return `
    <p style="font-family:${FONT};font-size:15px;color:#3a3f3a;line-height:1.7;margin:0 0 22px;">Hi ${firstName},</p>
    <p style="font-family:${FONT};font-size:15px;color:#3a3f3a;line-height:1.7;margin:0 0 6px;">
      We look forward to having you at BizHaus today!
    </p>
    <p style="font-family:${FONT};font-size:14px;color:#6b746c;line-height:1.6;margin:0 0 26px;">
      Our Marina del Rey location is a satellite space, so a team member won't be there until the afternoon. Here's what you need to get in and get set up.
    </p>

    <table style="border-collapse:collapse;width:100%;margin-bottom:8px;">
      ${bullet('WiFi Password', 'bizhauswifi')}
      ${bullet('Building Access', "BizHaus MDR is located at 4223 Glencoe Ave, Suite C215, Marina del Rey. Your day pass code for today is <strong>#6192</strong>, it's the same code for both the building and Suite C215.")}
      ${bullet('Parking', 'Visitor parking out front is limited to 2 hours. Street parking is available nearby, or park in the AMC structure next door.')}
      ${bullet('Restrooms', 'Down the hallway, keys hang next to each door (pink bear for women, blue bear for men).')}
      ${bullet('Printers', 'Search for &ldquo;BizHaus Printer&rdquo; on the network. Our policy: please be kind to trees and print only when you have to!')}
      ${bullet('Kitchen', 'Enjoy the Nespresso and purified water. Just place used cups and dishes in the dishwasher.')}
    </table>

    <p style="font-family:${FONT};font-size:14.5px;color:#3a3f3a;line-height:1.65;margin:6px 0 10px;">
      <span style="color:#3f7a37;font-weight:700;">Open desk areas:</span> feel free to set up wherever's comfortable.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:26px;">
      <tr>
        <td style="padding:0 4px 0 0;width:33.33%;"><img src="${photo('marina-desk-1.jpg')}" style="width:100%;height:auto;border-radius:8px;display:block;" alt="Open desk area" /></td>
        <td style="padding:0 4px;width:33.33%;"><img src="${photo('marina-desk-2.jpg')}" style="width:100%;height:auto;border-radius:8px;display:block;" alt="Open desk area" /></td>
        <td style="padding:0 0 0 4px;width:33.33%;"><img src="${photo('marina-desk-3.jpg')}" style="width:100%;height:auto;border-radius:8px;display:block;" alt="Open desk area" /></td>
      </tr>
    </table>

    <table style="border-collapse:collapse;width:100%;margin-bottom:28px;font-family:${FONT};background:#fafbfa;border-radius:8px;">
      <tr><td style="padding:12px 16px;color:#8b948d;font-size:12.5px;">Date</td><td style="padding:12px 16px;color:#232823;font-size:13px;text-align:right;">${details.date}</td></tr>
    </table>

    <p style="font-family:${FONT};font-size:15px;color:#3a3f3a;line-height:1.7;margin:0 0 6px;">
      Reply to this email if you have any questions, or give us a call.
    </p>
    <p style="font-family:${FONT};font-size:15px;color:#3a3f3a;line-height:1.7;margin:24px 0 0;">
      See you soon,<br/>The BizHaus Team
    </p>
    <p style="font-family:${FONT};font-size:12px;color:#b7bdb6;line-height:1.6;margin:20px 0 0;">
      Reference #${details.confirmationNumber} if you need to reach us about this booking.
    </p>
  `
}

export async function sendExternalBookingStaffNotification(
  details: { confirmationNumber: string; guestName: string; guestEmail: string; room: string; location: string; date: string; time: string; amountPaid: string }
) {
  const { error } = await resend.emails.send({
    from: FROM,
    to: STAFF_EMAIL,
    subject: `New room booking: ${details.guestName} — ${details.room}, ${details.location}`,
    html: bookingEmailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 4px;font-size:22px;font-weight:700;">New Room Booking</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 24px;">Confirmation #${details.confirmationNumber}</p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr>
          <td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Guest</td>
          <td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.guestName} (${details.guestEmail})</td>
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
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Amount paid</td>
          <td style="padding:10px 14px;font-weight:700;color:#0f172a;">${details.amountPaid}</td>
        </tr>
      </table>
      <a href="${APP_URL}/dashboard/admin/reservations" style="display:inline-block;background:#6ec664;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;">View Bookings →</a>
    `, 'Bookings'),
  })
  if (error) console.error('[email] Resend error sending external booking staff notification:', error)
}

export async function sendDayPassStaffNotification(
  details: { confirmationNumber: string; guestName: string; guestEmail: string; location: string; date: string; amountPaid: string }
) {
  const { error } = await resend.emails.send({
    from: FROM,
    to: STAFF_EMAIL,
    subject: `New day pass: ${details.guestName} — ${details.location}`,
    html: bookingEmailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 4px;font-size:22px;font-weight:700;">New Day Pass Booked</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 24px;">Confirmation #${details.confirmationNumber}</p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr>
          <td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Guest</td>
          <td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.guestName} (${details.guestEmail})</td>
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
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Amount paid</td>
          <td style="padding:10px 14px;font-weight:700;color:#0f172a;">${details.amountPaid}</td>
        </tr>
      </table>
      <a href="${APP_URL}/dashboard/admin/day-passes" style="display:inline-block;background:#6ec664;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;">View Day Passes →</a>
    `, 'Day Pass'),
  })
  if (error) console.error('[email] Resend error sending day pass staff notification:', error)
}

export async function sendDayPassCancellationStaffNotification(
  details: { confirmationNumber: string; guestName: string; guestEmail: string; location: string; date: string; refundAmount: string }
) {
  const { error } = await resend.emails.send({
    from: FROM,
    to: STAFF_EMAIL,
    subject: `Day pass cancelled: ${details.guestName} — ${details.location}`,
    html: bookingEmailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 4px;font-size:22px;font-weight:700;">Day Pass Cancelled</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 24px;">Confirmation #${details.confirmationNumber}</p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr>
          <td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Guest</td>
          <td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.guestName} (${details.guestEmail})</td>
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
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Refunded</td>
          <td style="padding:10px 14px;font-weight:700;color:#0f172a;">${details.refundAmount}</td>
        </tr>
      </table>
      <a href="${APP_URL}/dashboard/admin/day-passes" style="display:inline-block;background:#6ec664;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;">View Day Passes →</a>
    `, 'Day Pass'),
  })
  if (error) console.error('[email] Resend error sending day pass cancellation staff notification:', error)
}

export async function sendCancellationEmail(
  to: string,
  details: { title: string; room: string; location: string; date: string; time: string }
) {
  const { error } = await resend.emails.send({
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
  if (error) console.error('[email] Resend error sending cancellation email:', error)
}

export async function sendRoomAccessGrantedEmail(to: string, name: string) {
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "You're set up to book rooms",
    html: emailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 8px;font-size:22px;font-weight:700;">You're all set, ${name}!</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 24px;">Your BizHaus admin just gave you access to book conference rooms. Click below to check availability and reserve a room.</p>
      <a href="${APP_URL}/dashboard/rooms" style="display:inline-block;background:#2563eb;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;">Book a Room →</a>
    `),
  })
  if (error) console.error('[email] Resend error sending room access granted email:', error)
}

export async function sendCancellationRequestEmail(
  details: { name: string; email: string; title: string; room: string; location: string; date: string; time: string }
) {
  const { error } = await resend.emails.send({
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
  if (error) console.error('[email] Resend error sending cancellation request email:', error)
}

export async function sendFeedbackNotificationEmail(
  details: { name: string; email: string; category: string; message: string }
) {
  const { error } = await resend.emails.send({
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
  if (error) console.error('[email] Resend error sending feedback notification email:', error)
}

export async function sendRoomAccessRequestEmail(details: { name: string; email: string }) {
  const { error } = await resend.emails.send({
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
  if (error) console.error('[email] Resend error sending room access request email:', error)
}
