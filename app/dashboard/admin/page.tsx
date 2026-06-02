import { createClient } from '@/lib/supabase/server'
import { Users, Building2, CalendarDays, Clock, UserCheck, Mail, UserX } from 'lucide-react'
import Link from 'next/link'
import { calcHoursUsed, getMonthBounds, formatMonthYear } from '@/lib/utils'

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
  ] = await Promise.all([
    supabase.from('permitted_emails').select('*', { count: 'exact', head: true }),
    supabase.from('companies').select('*', { count: 'exact', head: true }),
    supabase.from('permitted_emails').select('*', { count: 'exact', head: true }).not('accepted_at', 'is', null),
    supabase.from('permitted_emails').select('*', { count: 'exact', head: true }).not('invite_token', 'is', null).is('accepted_at', null),
    supabase.from('permitted_emails').select('*', { count: 'exact', head: true }).is('invite_token', null).is('accepted_at', null),
    supabase.from('reservations').select('*', { count: 'exact', head: true }).gte('start_time', start).lte('start_time', end),
    supabase.from('reservations').select('start_time, end_time').gte('start_time', start).lte('start_time', end),
  ])

  const hoursThisMonth = calcHoursUsed(monthlyHoursData ?? [])

  return {
    totalMembers:        totalMembers        ?? 0,
    totalCompanies:      totalCompanies      ?? 0,
    activeMembers:       activeMembers       ?? 0,
    invitedMembers:      invitedMembers      ?? 0,
    notInvited:          notInvited          ?? 0,
    monthlyReservations: monthlyReservations ?? 0,
    hoursThisMonth,
    month: now,
  }
}

type StatCardProps = {
  label: string
  value: number | string
  icon: React.ReactNode
  href?: string
  color: string
}

function StatCard({ label, value, icon, href, color }: StatCardProps) {
  const inner = (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 ${href ? 'hover:border-gray-300 hover:shadow-sm transition-all' : ''}`}>
      <div className={`rounded-lg p-2.5 flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

type StatusBarProps = {
  active: number
  invited: number
  notInvited: number
  total: number
}

function StatusBar({ active, invited, notInvited, total }: StatusBarProps) {
  if (total === 0) return null
  const activePct   = (active   / total) * 100
  const invitedPct  = (invited  / total) * 100
  const pendingPct  = (notInvited / total) * 100

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Member Status Breakdown</h2>
        <Link href="/dashboard/admin/members" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
          Manage members →
        </Link>
      </div>

      {/* Stacked bar */}
      <div className="h-3 rounded-full overflow-hidden flex gap-px mb-4">
        {activePct  > 0 && <div className="bg-green-500 rounded-l-full transition-all" style={{ width: `${activePct}%`  }} />}
        {invitedPct > 0 && <div className="bg-amber-400 transition-all"              style={{ width: `${invitedPct}%` }} />}
        {pendingPct > 0 && <div className="bg-gray-200 rounded-r-full transition-all" style={{ width: `${pendingPct}%` }} />}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
          <span className="text-sm text-gray-700">
            <span className="font-semibold">{active}</span>
            <span className="text-gray-500"> active ({activePct.toFixed(0)}%)</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
          <span className="text-sm text-gray-700">
            <span className="font-semibold">{invited}</span>
            <span className="text-gray-500"> invited, awaiting signup ({invitedPct.toFixed(0)}%)</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-300 flex-shrink-0" />
          <span className="text-sm text-gray-700">
            <span className="font-semibold">{notInvited}</span>
            <span className="text-gray-500"> not yet invited ({pendingPct.toFixed(0)}%)</span>
          </span>
        </div>
      </div>
    </div>
  )
}

export default async function AdminHomePage() {
  const stats = await getStats()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Overview of members, companies, and activity.</p>
      </div>

      {/* Top stat cards */}
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
          label="Companies"
          value={stats.totalCompanies}
          icon={<Building2 size={18} className="text-purple-600" />}
          color="bg-purple-50"
          href="/dashboard/admin/companies"
        />
        <StatCard
          label="Awaiting Invite"
          value={stats.invitedMembers + stats.notInvited}
          icon={<Mail size={18} className="text-amber-600" />}
          color="bg-amber-50"
          href="/dashboard/admin/members"
        />
      </div>

      {/* Status breakdown bar */}
      <StatusBar
        active={stats.activeMembers}
        invited={stats.invitedMembers}
        notInvited={stats.notInvited}
        total={stats.totalMembers}
      />

      {/* This month's activity */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Activity — {formatMonthYear(stats.month)}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Reservations This Month"
            value={stats.monthlyReservations}
            icon={<CalendarDays size={18} className="text-slate-600" />}
            color="bg-slate-50"
            href="/dashboard/admin/reservations"
          />
          <StatCard
            label="Hours Booked This Month"
            value={stats.hoursThisMonth === 0 ? '0h' : `${stats.hoursThisMonth.toFixed(1)}h`}
            icon={<Clock size={18} className="text-slate-600" />}
            color="bg-slate-50"
            href="/dashboard/admin/time-usage"
          />
        </div>
      </div>
    </div>
  )
}
