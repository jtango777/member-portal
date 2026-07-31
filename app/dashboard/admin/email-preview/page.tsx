const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

function EmailWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FONT, background: '#f1f5f9', padding: '40px 16px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ background: '#0f172a', borderRadius: '10px 10px 0 0', padding: '24px 32px' }}>
          <span style={{ color: 'white', fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>BizHaus</span>
          <span style={{ color: '#94a3b8', fontSize: 13, marginLeft: 10 }}>Member Portal</span>
        </div>
        <div style={{ background: '#ffffff', padding: 32, borderRadius: '0 0 10px 10px', border: '1px solid #e2e8f0', borderTop: 'none' }}>
          {children}
        </div>
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 20 }}>
          BizHaus · Member Portal
        </p>
      </div>
    </div>
  )
}

export default function EmailPreviewPage() {
  return (
    <div style={{ fontFamily: FONT, background: '#e2e8f0', minHeight: '100vh', padding: '40px 16px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Preview — Invite</p>
        <div style={{ marginBottom: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#64748b' }}>
          <div><strong>From:</strong> BizHaus &lt;noreply@bizhaus.com&gt;</div>
          <div><strong>Subject:</strong> You're invited to the BizHaus Member Portal</div>
        </div>
        <EmailWrapper>
          <h2 style={{ color: '#0f172a', margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>You're invited!</h2>
          <p style={{ color: '#475569', lineHeight: 1.6, margin: '0 0 24px' }}>You've been given access to the BizHaus Member Portal — book rooms, connect with the community, and more. Click below to set up your account.</p>
          <a href="#" style={{ display: 'inline-block', background: '#2563eb', color: 'white', padding: '13px 28px', borderRadius: 7, textDecoration: 'none', fontWeight: 600, fontSize: 15, marginBottom: 24 }}>Set Up My Account →</a>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0, borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>This link expires in 7 days. If you weren't expecting this, you can safely ignore it.</p>
        </EmailWrapper>

        <p style={{ fontSize: 11, color: '#94a3b8', margin: '40px 0 8px', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Preview — Reservation Confirmation</p>
        <div style={{ marginBottom: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#64748b' }}>
          <div><strong>From:</strong> BizHaus &lt;noreply@bizhaus.com&gt;</div>
          <div><strong>Subject:</strong> Reservation confirmed: Team Standup</div>
        </div>
        <EmailWrapper>
          <h2 style={{ color: '#0f172a', margin: '0 0 20px', fontSize: 22, fontWeight: 700 }}>Reservation Confirmed ✓</h2>
          <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 24, background: '#f8fafc', borderRadius: 7 }}>
            <tbody>
              <tr><td style={{ padding: '10px 14px', color: '#64748b', fontSize: 13, width: 110 }}>Meeting</td><td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>Team Standup</td></tr>
              <tr style={{ borderTop: '1px solid #e2e8f0' }}><td style={{ padding: '10px 14px', color: '#64748b', fontSize: 13 }}>Room</td><td style={{ padding: '10px 14px', color: '#1e293b' }}>Large Conference — El Segundo</td></tr>
              <tr style={{ borderTop: '1px solid #e2e8f0' }}><td style={{ padding: '10px 14px', color: '#64748b', fontSize: 13 }}>Date</td><td style={{ padding: '10px 14px', color: '#1e293b' }}>Wednesday, June 4, 2026</td></tr>
              <tr style={{ borderTop: '1px solid #e2e8f0' }}><td style={{ padding: '10px 14px', color: '#64748b', fontSize: 13 }}>Time</td><td style={{ padding: '10px 14px', color: '#1e293b' }}>10:00 AM – 11:00 AM</td></tr>
              <tr style={{ borderTop: '1px solid #e2e8f0' }}><td style={{ padding: '10px 14px', color: '#64748b', fontSize: 13 }}>Booked by</td><td style={{ padding: '10px 14px', color: '#1e293b' }}>Caroline Smith</td></tr>
            </tbody>
          </table>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0, borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>Need to cancel? Log in to BizHaus and cancel from the calendar — at least 24 hours before your reservation.</p>
        </EmailWrapper>

        <p style={{ fontSize: 11, color: '#94a3b8', margin: '40px 0 8px', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Preview — Cancellation</p>
        <div style={{ marginBottom: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#64748b' }}>
          <div><strong>From:</strong> BizHaus &lt;noreply@bizhaus.com&gt;</div>
          <div><strong>Subject:</strong> Reservation cancelled: Team Standup</div>
        </div>
        <EmailWrapper>
          <h2 style={{ color: '#0f172a', margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>Reservation Cancelled</h2>
          <p style={{ color: '#475569', lineHeight: 1.6, margin: '0 0 20px' }}>The following reservation has been cancelled:</p>
          <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 24, background: '#f8fafc', borderRadius: 7 }}>
            <tbody>
              <tr><td style={{ padding: '10px 14px', color: '#64748b', fontSize: 13, width: 110 }}>Meeting</td><td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>Team Standup</td></tr>
              <tr style={{ borderTop: '1px solid #e2e8f0' }}><td style={{ padding: '10px 14px', color: '#64748b', fontSize: 13 }}>Room</td><td style={{ padding: '10px 14px', color: '#1e293b' }}>Large Conference — El Segundo</td></tr>
              <tr style={{ borderTop: '1px solid #e2e8f0' }}><td style={{ padding: '10px 14px', color: '#64748b', fontSize: 13 }}>Date</td><td style={{ padding: '10px 14px', color: '#1e293b' }}>Wednesday, June 4, 2026</td></tr>
              <tr style={{ borderTop: '1px solid #e2e8f0' }}><td style={{ padding: '10px 14px', color: '#64748b', fontSize: 13 }}>Time</td><td style={{ padding: '10px 14px', color: '#1e293b' }}>10:00 AM – 11:00 AM</td></tr>
            </tbody>
          </table>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0, borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>Questions? Contact your BizHaus admin.</p>
        </EmailWrapper>

        <div style={{ height: 60 }} />
      </div>
    </div>
  )
}
