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
  // Only used when company_id is null — a plain, freely-editable number of
  // hours for a standalone individual, instead of sharing a company's pool.
  individual_hours_allotment: number | null
  full_name: string
  first_name: string | null
  last_name: string | null
  is_admin: boolean
  created_at: string
  avatar_url: string | null
  default_location_id: string | null
  is_active: boolean
  license_plate: string | null
  seating: string | null
  room_access_prompted: boolean
  room_access_requested_at: string | null
  dismissed_announcement_id: string | null
  welcomed: boolean
  companies?: Company
}

export type PermittedEmail = {
  id: string
  email: string
  company_id: string | null
  individual_hours_allotment: number | null
  seating: string | null
  invite_token: string | null
  invited_at: string
  accepted_at: string | null
  companies?: Company
}

export type Reservation = {
  id: string
  room_id: string
  user_id: string
  company_id: string | null
  title: string
  notes: string | null
  start_time: string
  end_time: string
  created_at: string
  recurrence_group_id: string | null
  is_admin_block: boolean
  historical_email: string | null
  profiles?: Profile
  companies?: Company
  rooms?: Room
}

export type HourSummary = {
  company: Company
  hours_used: number
  hours_remaining: number
}
