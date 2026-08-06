import { cache } from 'react'
import { createClient } from './server'
import type { Profile } from '@/types'

// Wrapped in React's cache() so that no matter how many layouts/pages in a
// single request call these (dashboard layout, admin layout, the page
// itself), the actual network round-trip to Supabase only happens once per
// request instead of once per caller.

export const getAuthedUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const getAuthedProfile = cache(async () => {
  const user = await getAuthedUser()
  if (!user) return null
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, companies(*), membership_types(*)')
    .eq('id', user.id)
    .single()
  return profile as Profile | null
})
