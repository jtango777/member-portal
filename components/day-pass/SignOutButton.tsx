'use client'

import { useRouter } from 'next/navigation'
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
    <button onClick={handleSignOut} className="text-sm font-medium text-gray-500 hover:text-gray-700">
      Sign out
    </button>
  )
}
