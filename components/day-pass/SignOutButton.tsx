'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/day-pass')
    router.refresh()
  }

  return (
    // Icon before the label, same as the member portal's sign out in
    // components/Nav.tsx, so the two sides of the product agree
    // (Caroline, 2026-09-30).
    <button
      onClick={handleSignOut}
      title="Sign out"
      className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
    >
      <LogOut size={13} />
      Sign out
    </button>
  )
}
