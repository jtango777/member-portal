import { createClient } from '@/lib/supabase/server'
import { Users, CalendarDays, Clock, Globe, DollarSign, TrendingUp, ArrowRight } from 'lucide-react'
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

function formatPacificTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })
}

export default async function AdminHomePage() {
  const stats = await getStats()
  const activePct = stats.totalMembers > 0 ? ((stats.activeMembers / stats.totalMembers) * 100).toFixed(0) : '0'

  return (
    <div className="space-y-6">
      {/* ── Hero banner ──────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
        <p className="text-slate-400 text-sm font-medium">{formatMonthYear(stats.month)}</p>
        <h1 className="text-2xl font-bold mt-1">Welcome back, Caroline</h1>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-5">
          <div>
            <p className="text-3xl font-bold">{stats.monthlyReservations + stats.monthlyExternalBookings}</p>
            <p className="text-slate-400 text-sm mt-0.5">Bookings this month</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-emerald-400">${stats.externalRevenueThisMonth.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            <p className="text-slate-400 text-sm mt-0.5">External revenue</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{stats.hoursThisMonth === 0 ? '0' : stats.hoursThisMonth.toFixed(1)}h</p>
            <p className="text-slate-400 text-sm mt-0.5">Hours booked</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{stats.activeMembers}<span className="text-lg text-slate-500">/{stats.totalMembers}</span></p>
            <p className="text-slate-400 text-sm mt-0.5">Active members ({activePct}%)</p>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: Internal */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Internal</h2>
            <Link href="/dashboard/admin/reservations" className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
              All reservations <ArrowRight size={11} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link href="/dashboard/admin/members" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 rounded-lg p-2"><Users size={16} className="text-blue-600" /></div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalMembers}</p>
                  <p className="text-xs text-gray-500">Members</p>
                </div>
              </div>
            </Link>
            <Link href="/dashboard/admin/reservations" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all">
              <div className="flex items-center gap-3">
                <div className="bg-slate-50 rounded-lg p-2"><CalendarDays size={16} className="text-slate-600" /></div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.monthlyReservations}</p>
                  <p className="text-xs text-gray-500">Reservations</p>
                </div>
              </div>
            </Link>
          </div>

          {/* Member status bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900">Member Status</p>
              <Link href="/dashboard/admin/members" className="text-xs text-blue-600 font-medium">Manage →</Link>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden flex gap-px mb-3">
              {stats.activeMembers > 0 && <div className="bg-green-500 rounded-l-full" style={{ width: `${(stats.activeMembers / stats.totalMembers) * 100}%` }} />}
              {stats.invitedMembers > 0 && <div className="bg-amber-400" style={{ width: `${(stats.invitedMembers / stats.totalMembers) * 100}%` }} />}
              {stats.notInvited > 0 && <div className="bg-gray-200 rounded-r-full" style={{ width: `${(stats.notInvited / stats.totalMembers) * 100}%` }} />}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />{stats.activeMembers} active</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" />{stats.invitedMembers} pending</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300" />{stats.notInvited} not invited</span>
            </div>
          </div>
        </div>

        {/* Right: External */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">External</h2>
            <Link href="/dashboard/admin/external-bookings" className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1">
              All bookings <ArrowRight size={11} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link href="/dashboard/admin/external-bookings" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 rounded-lg p-2"><Globe size={16} className="text-emerald-600" /></div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.monthlyExternalBookings}</p>
                  <p className="text-xs text-gray-500">This month</p>
                </div>
              </div>
            </Link>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 rounded-lg p-2"><DollarSign size={16} className="text-emerald-600" /></div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">${stats.externalRevenueThisMonth.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-gray-500">Revenue</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent bookings feed */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">Recent Bookings</p>
            </div>
            {stats.recentExternalBookings.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">No bookings yet</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {stats.recentExternalBookings.map((b: any) => {
                  const room = b.rooms as { name: string; external_name: string | null; locations: { name: string } | null } | null
                  const roomLabel = room?.external_name ?? room?.name ?? 'Room'
                  const loc = room?.locations?.name ?? ''

                  return (
                    <div key={b.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{b.external_name}</p>
                        <p className="text-xs text-gray-400">{roomLabel} · {loc} · {format(new Date(b.start_time), 'MMM d')}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${b.status === 'confirmed' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                        {b.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
