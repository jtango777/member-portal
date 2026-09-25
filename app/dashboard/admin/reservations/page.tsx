import { redirect } from 'next/navigation'

// Bookings moved into the Conference Rooms page as its first tab
// (Caroline, 2026-09-25). Kept so old links and bookmarks still land
// somewhere sensible.
export default function AdminReservationsPage() {
  redirect('/dashboard/admin/rooms')
}
