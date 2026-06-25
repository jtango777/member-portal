import { redirect } from 'next/navigation'

export default function ExternalBookingsPage() {
  redirect('/dashboard/admin/reservations')
}
