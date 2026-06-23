import { createClient } from '@/lib/supabase/server'
import { Users, Building2, CalendarDays, Clock, UserCheck, Mail, Globe, DollarSign, TrendingUp, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { calcHoursUsed, getMonthBounds, formatMonthYear } from '@/lib/utils'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

async function getStats() {
  const supabase = await createClient()
  const now = new Date()
  const { start, end } = getMonthBounds(now)

  const [
    { count: totalMembers },
    { count: totalCompanies },
    { count: activeMembers },
    { count: invitedMembers },
    { count: notInvited },
    { count: monthlyReservations },
    { data: monthlyHoursData },
    { count: monthlyExternalBookings },
    { data: externalBookingsThisMonth },
    { count: totalExternalBookings },
    { data: recentExternalBookings },
  ] = await Promise.all([
    supabase.from('permitted_emails').select('*', { count: 'exact', head: true }),
    supabase.from('companies').select('*', { count: 'exact', head: true }),
    supabase.from('permitted_emails').select('*', { count: 'exact', head: true }).not('accepted_at', 'is', null),
    supabase.from('permitted_emails').select('*', { count: 'exact', head: true }).not('invite_token', 'is', null).is('accepted_at', null),
    supabase.from('permitted_emails').select('*', { count: 'exact', head: true }).is('invite_token', null).is('accepted_at', null),
    supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('is_external_booking', false).gte('start_time', start).lte('start_time', end),
    supabase.from('reservations').select('start_time, end_time').eq('is_external_booking', false).gte('start_time', start).lte('start_time', end),
    supabase.from('external_bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed').gte('created_at', start).lte('created_at', end),
    supabase.from('external_bookings').select('start_time, end_time, rooms(price_per_hour)').eq('status', 'confirmed').gte('created_at', start).lte('created_at', end),
    supabase.from('external_bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
    supabase.from('external_bookings').select('id, external_name, external_email, company_name, start_time, end_time, status, created_at, rooms(name, external_name, locations(name))').order('created_at', { ascending: false }).limit(5),
  ])

  const hoursThisMonth = calcHoursUsed(monthlyHoursData ?? [])

  let externalRevenueThisMonth = 0
  for (const b of externalBookingsThisMonth ?? []) {
    const hours = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3_600_000
    const room = b.rooms as { price_per_hour: number } | null
    externalRevenueThisMonth += hours * (room?.price_per_hour ?? 0)
  }

  return {
    totalMembers: totalMembers ?? 0,
    totalCompanies: totalCompanies ?? 0,
    activeMembers: activeMembers ?? 0,
    invitedMembers: invitedMembers ?? 0,
    notInvited: notInvited ?? 0,
    monthlyReservations: monthlyReservations ?? 0,
    hoursThisMonth,
    monthlyExternalBookings: monthlyExternalBookings ?? 0,
    externalRevenueThisMonth,
    totalExternalBookings: totalExternalBookings ?? 0,
    recentExternalBookings: recentExternalBookings ?? [],
    month: now,
  }
}

function StatCard({ label, value, icon, href, color, sub }: {
  label: string; value: number | string; icon: React.ReactNode; href?: string; color: string; sub?: string
}) {
  const inner = (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 ${href ? 'hover:border-gray-300 hover:shadow-sm transition-all' : ''}`}>
      <div className={`rounded-lg p-2.5 flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function StatusBar({ active, invited, notInvited, total }: { active: number; invited: number; notInvited: number; total: number }) {
  if (total === 0) return null
  const activePct = (active / total) * 100
  const invitedPct = (invited / total) * 100
  const pendingPct = (notInvited / total) * 100

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Member Status</h3>
        <Link href="/dashboard/admin/members" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
          Manage members →
        </Link>
      </div>
      <div className="h-3 rounded-full overflow-hidden flex gap-px mb-4">
        {activePct > 0 && <div className="bg-green-500 rounded-l-full transition-all" style={{ width: `${activePct}%` }} />}
        {invitedPct > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${invitedPct}%` }} />}
        {pendingPct > 0 && <div className="bg-gray-200 rounded-r-full transition-all" style={{ width: `${pendingPct}%` }} />}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /><span className="font-semibold">{active}</span> <span className="text-gray-500">active ({activePct.toFixed(0)}%)</span></span>
        <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="font-semibold">{invited}</span> <span className="text-gray-500">awaiting signup ({invitedPct.toFixed(0)}%)</span></span>
        <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-gray-300" /><span className="font-semibold">{notInvited}</span> <span className="text-gray-500">not yet invited ({pendingPct.toFixed(0)}%)</span></span>
      </div>
    </div>
  )
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })
}

export default async function AdminHomePage() {
  const stats = await getStats()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">BizHaus Command Center</h1>
        <p className="text-sm text-gray-500 mt-0.5">{formatMonthYear(stats.month)} overview</p>
      </div>

      {/* ── Internal Bookings ─────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <CalendarDays size={15} className="text-blue-600" /> Internal (Members)
          </h2>
          <Link href="/dashboard/admin/reservations" className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Members"
            value={stats.totalMembers}
            icon={<Users size={18} className="text-blue-600" />}
            color="bg-blue-50"
            href="/dashboard/admin/members"
          />
          <StatCard
            label="Active Members"
            value={stats.activeMembers}
            icon={<UserCheck size={18} className="text-green-600" />}
            color="bg-green-50"
            href="/dashboard/admin/members"
          />
          <StatCard
            label="Reservations This Month"
            value={stats.monthlyReservations}
            icon={<CalendarDays size={18} className="text-slate-600" />}
            color="bg-slate-50"
            href="/dashboard/admin/reservations"
          />
          <StatCard
            label="Hours Booked"
            value={stats.hoursThisMonth === 0 ? '0h' : `${stats.hoursThisMonth.toFixed(1)}h`}
            icon={<Clock size={18} className="text-slate-600" />}
            color="bg-slate-50"
            href="/dashboard/admin/time-usage"
          />
        </div>
        <div className="mt-4">
          <StatusBar
            active={stats.activeMembers}
            invited={stats.invitedMembers}
            notInvited={stats.notInvited}
            total={stats.totalMembers}
          />
        </div>
      </section>

      {/* ── External Bookings ─────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <Globe size={15} className="text-emerald-600" /> External (Public Bookings)
          </h2>
          <Link href="/dashboard/admin/external-bookings" className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Bookings This Month"
            value={stats.monthlyExternalBookings}
            icon={<Globe size={18} className="text-emerald-600" />}
            color="bg-emerald-50"
            href="/dashboard/admin/external-bookings"
          />
          <StatCard
            label="Revenue This Month"
            value={`$${stats.externalRevenueThisMonth.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            icon={<DollarSign size={18} className="text-emerald-600" />}
            color="bg-emerald-50"
          />
          <StatCard
            label="Total Bookings (All Time)"
            value={stats.totalExternalBookings}
            icon={<TrendingUp size={18} className="text-emerald-600" />}
            color="bg-emerald-50"
            href="/dashboard/admin/external-bookings"
          />
          <StatCard
            label="Companies"
            value={stats.totalCompanies}
            icon={<Building2 size={18} className="text-purple-600" />}
            color="bg-purple-50"
            href="/dashboard/admin/companies"
          />
        </div>

        {/* Recent external bookings */}
        {stats.recentExternalBookings.length > 0 && (
          <div className="mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Recent External Bookings</h3>
              <Link href="/dashboard/admin/external-bookings" className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {stats.recentExternalBookings.map((b: any) => {
                const room = b.rooms as { name: string; external_name: string | null; locations: { name: string } | null } | null
                const roomLabel = room?.external_name ?? room?.name ?? 'Room'
                const locationLabel = room?.locations?.name ?? ''
                const statusColor = b.status === 'confirmed' ? 'text-green-600 bg-green-50' : b.status === 'pending' ? 'text-amber-600 bg-amber-50' : 'text-red-500 bg-red-50'

                return (
                  <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{b.external_name}{b.company_name ? ` · ${b.company_name}` : ''}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {roomLabel} — {locationLabel} · {format(new Date(b.start_time), 'MMM d')} · {formatTime(b.start_time)} – {formatTime(b.end_time)}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor}`}>
                      {b.status}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
