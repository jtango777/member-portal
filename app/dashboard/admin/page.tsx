import { createClient } from '@/lib/supabase/server'
import { ArrowUpRight, CalendarDays, DollarSign, Clock, Users } from 'lucide-react'
import Link from 'next/link'
import { calcHoursUsed, getMonthBounds, formatMonthYear } from '@/lib/utils'
import { format, subMonths } from 'date-fns'
import DashboardRangePicker from '@/components/admin/DashboardRangePicker'

export const dynamic = 'force-dynamic'

function getRangeLabel(range: string): string {
  if (range === '3m') return 'Last 3 months'
  if (range === '6m') return 'Last 6 months'
  if (range === '12m') return 'Last 12 months'
  return formatMonthYear(new Date())
}

function getRangeBounds(range: string): { start: string; end: string } {
  const now = new Date()
  if (range === '3m') {
    const s = subMonths(now, 3)
    return { start: new Date(s.getFullYear(), s.getMonth(), 1).toISOString(), end: now.toISOString() }
  }
  if (range === '6m') {
    const s = subMonths(now, 6)
    return { start: new Date(s.getFullYear(), s.getMonth(), 1).toISOString(), end: now.toISOString() }
  }
  if (range === '12m') {
    const s = subMonths(now, 12)
    return { start: new Date(s.getFullYear(), s.getMonth(), 1).toISOString(), end: now.toISOString() }
  }
  return getMonthBounds(now)
}

async function getStats(range: string) {
  const supabase = await createClient()
  const now = new Date()
  const { start, end } = getRangeBounds(range)

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

export default async function AdminHomePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range = '1m' } = await searchParams
  const stats = await getStats(range)
  const activePct = stats.totalMembers > 0 ? (stats.activeMembers / stats.totalMembers) * 100 : 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <span className="text-lg font-semibold text-blue-600">{getRangeLabel(range)}</span>
        </div>
        <DashboardRangePicker />
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
        <div className="bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <CalendarDays size={18} className="text-blue-500" />
            </div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Bookings</p>
          </div>
          <p className="text-3xl font-semibold text-gray-900 tabular-nums">{stats.monthlyReservations + stats.monthlyExternalBookings}</p>
          <p className="text-xs text-gray-400 mt-1">{stats.monthlyReservations} internal · {stats.monthlyExternalBookings} external</p>
        </div>
        <div className="bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <DollarSign size={18} className="text-emerald-500" />
            </div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Revenue</p>
          </div>
          <p className="text-3xl font-semibold text-emerald-600 tabular-nums">${stats.externalRevenueThisMonth.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-gray-400 mt-1">external bookings</p>
        </div>
        <div className="bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Clock size={18} className="text-purple-500" />
            </div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Hours booked</p>
          </div>
          <p className="text-3xl font-semibold text-gray-900 tabular-nums">{stats.hoursThisMonth === 0 ? '0' : stats.hoursThisMonth.toFixed(1)}<span className="text-lg text-gray-400">h</span></p>
          <p className="text-xs text-gray-400 mt-1">member reservations</p>
        </div>
        <div className="bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Users size={18} className="text-amber-500" />
            </div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Members</p>
          </div>
          <p className="text-3xl font-semibold text-gray-900 tabular-nums">{stats.activeMembers}<span className="text-lg text-gray-400">/{stats.totalMembers}</span></p>
          <p className="text-xs text-gray-400 mt-1">{activePct.toFixed(0)}% active</p>
        </div>
      </div>

      {/* Two-column content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Members */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Members</h2>
            <Link href="/dashboard/admin/members" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5">
              View <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="p-5 space-y-4">
            {/* Progress bar */}
            <div>
              <div className="h-2 rounded-full overflow-hidden flex gap-px bg-gray-100">
                {activePct > 0 && <div className="bg-emerald-500 rounded-l-full" style={{ width: `${activePct}%` }} />}
                {stats.invitedMembers > 0 && <div className="bg-amber-400" style={{ width: `${(stats.invitedMembers / stats.totalMembers) * 100}%` }} />}
              </div>
            </div>
            {/* Legend */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-semibold text-gray-900 tabular-nums">{stats.activeMembers}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900 tabular-nums">{stats.invitedMembers}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Pending</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900 tabular-nums">{stats.notInvited}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-gray-200" />Not invited</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent external bookings */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Recent Bookings</h2>
            <Link href="/dashboard/admin/external-bookings" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5">
              View <ArrowUpRight size={12} />
            </Link>
          </div>
          {stats.recentExternalBookings.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-300">No bookings yet</div>
          ) : (
            <div>
              {stats.recentExternalBookings.map((b: any, i: number) => {
                const room = b.rooms as { name: string; external_name: string | null; locations: { name: string } | null } | null
                const roomLabel = room?.external_name ?? room?.name ?? ''
                const loc = room?.locations?.name ?? ''

                return (
                  <div key={b.id} className={`px-5 py-3 flex items-center justify-between gap-4 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 truncate">{b.external_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{roomLabel} · {loc} · {format(new Date(b.start_time), 'MMM d')}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
