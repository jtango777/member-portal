export type Location = {
  id: string
  name: string
  slug: string
}

export type Room = {
  id: string
  location_id: string
  name: string
  capacity: number
  sort_order: number
  external_name: string | null
  price_per_hour: number | null
  external_bookable: boolean
  description: string | null
  features: string[]
}

export type MembershipType = {
  id: string
  name: string
  hours_per_month: number | null
  sort_order: number
  created_at: string
}

export type Company = {
  id: string
  name: string
  monthly_hours_allotment: number
  membership_type_id: string | null
  created_at: string
  membership_types?: MembershipType | null
}

export type Profile = {
  id: string
  company_id: string | null
  full_name: string
  is_admin: boolean
  created_at: string
  companies?: Company
}

export type PermittedEmail = {
  id: string
  email: string
  company_id: string
  invite_token: string | null
  invited_at: string
  accepted_at: string | null
  companies?: Company
}

export type Reservation = {
  id: string
  room_id: string
  user_id: string
  company_id: string
  title: string
  notes: string | null
  start_time: string
  end_time: string
  created_at: string
  recurrence_group_id: string | null
  is_admin_block: boolean
  profiles?: Profile
  companies?: Company
  rooms?: Room
}

export type HourSummary = {
  company: Company
  hours_used: number
  hours_remaining: number
}
