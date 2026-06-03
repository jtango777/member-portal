import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import CancelButton from '@/components/CancelButton'

export const dynamic = 'force-dynamic'

export default async function MyReservationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: reservations } = await supabase
    .from('reservations')
    .select('*, rooms(name, locations(name))')
    .eq('user_id', user.id)
    .order('start_time', { ascending: false })

  const now = new Date()
  const upcoming = (reservations ?? []).filter(r => new Date(r.start_time) >= now)
  const past     = (reservations ?? []).filter(r => new Date(r.start_time) <  now)

  function ReservationRow({ r }: { r: any }) {
    const start    = new Date(r.start_time)
    const end      = new Date(r.end_time)
    const isToday  = start.toDateString() === now.toDateString()
    const isFuture = start > now
    const canCancel = isFuture && !isToday

    return (
      <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
        <td className="px-4 py-3 font-medium text-gray-900">{r.title}</td>
        <td className="px-4 py-3 text-gray-600">{r.rooms?.name}</td>
        <td className="px-4 py-3 text-gray-500 text-xs">{r.rooms?.locations?.name}</td>
        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
          {format(start, 'MMM d, yyyy')}
          <span className="block text-xs text-gray-400">
            {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-500 text-xs">
          {((end.getTime() - start.getTime()) / 3600000).toFixed(1)}h
        </td>
        {canCancel && (
          <td className="px-4 py-3 text-right">
            <CancelButton reservationId={r.id} />
          </td>
        )}
        {!canCancel && <td className="px-4 py-3" />}
      </tr>
    )
  }

  function Table({ rows }: { rows: any[] }) {
    if (rows.length === 0) return null
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Title', 'Room', 'Location', 'Date & Time', 'Duration', ''].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => <ReservationRow key={r.id} r={r} />)}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Reservations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your upcoming and past bookings.</p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Upcoming ({upcoming.length})</h2>
          {upcoming.length === 0
            ? <p className="text-sm text-gray-400">No upcoming reservations.</p>
            : <Table rows={upcoming} />}
        </div>

        {past.length > 0 && (
          <details>
            <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-600 select-none mb-2">
              Past reservations ({past.length})
            </summary>
            <Table rows={past} />
          </details>
        )}
      </div>
    </div>
  )
}
