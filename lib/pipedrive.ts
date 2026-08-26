// Marks a member "Current Member? = Yes" in Pipedrive the moment they're
// added in the portal, so sales/ops don't have to remember to flip that
// switch by hand in a second system.
//
// Field key and "Yes" option id below are specific to BizHaus's Pipedrive
// account (Settings > ... > Custom fields > Person > "Current Member?").
// If that field is ever recreated in Pipedrive, these will need updating —
// look them up again via GET /v1/personFields?api_token=...

const PIPEDRIVE_BASE = 'https://api.pipedrive.com/v1'
const CURRENT_MEMBER_FIELD_KEY = 'e818b68be96ba10d5ac240dd01eb7cb346c43926'
const CURRENT_MEMBER_YES_OPTION_ID = 15

// "Location Desired" and "Membership Type" — corrected/filled in from
// whatever's actually entered in the portal at member setup, so a wrong or
// blank value in Pipedrive (e.g. someone marked CM by mistake) gets fixed
// automatically instead of relying on someone noticing by hand. Field keys
// and option ids looked up via GET /v1/personFields?api_token=... — same
// caveat as CURRENT_MEMBER_FIELD_KEY above if these fields are ever
// recreated in Pipedrive.
const LOCATION_FIELD_KEY = '78e5ccc1ed555c627e17b812d25f2c123a2d917c'
const LOCATION_OPTION_IDS: Record<string, number> = {
  'Marina del Rey': 7,
  'El Segundo': 8,
  'Costa Mesa': 39,
}

const MEMBERSHIP_TYPE_FIELD_KEY = 'a2fb0a634aa5b73dcb429b9ecc01a9d4da25896c'
// Portal's `seating` values map onto Pipedrive's coarser set — Pipedrive
// has no separate option for "Main Building" vs "West Wing", both just
// mean Office there. Pipedrive also has Flex/6Pack options the portal has
// no equivalent for — this sync never sets those, only the 6 below.
const MEMBERSHIP_TYPE_OPTION_IDS: Record<string, number> = {
  'Office': 16,
  'Office - Main Building': 16,
  'Office - West Wing': 16,
  'Dedicated Desk': 22,
  'Open Desk': 23,
  'Virtual': 28,
}

type MarkResult =
  | { ok: true; matched: true }
  | { ok: true; matched: false } // no Pipedrive contact found for this email — not an error
  | { ok: false; error: string }

// Shared by mark/unmark — finds the Pipedrive person id for an email, then
// sets the Current Member? field to whatever value the caller wants.
// `fieldValue` of null clears the field back to "(None)" — Pipedrive doesn't
// have a real "No" option on this field, just "Yes" or unset.
async function setCurrentMemberField(email: string, fieldValue: number | null): Promise<MarkResult> {
  const token = process.env.PIPEDRIVE_API_TOKEN
  if (!token) return { ok: false, error: 'PIPEDRIVE_API_TOKEN not configured' }

  const trimmedEmail = email.trim().toLowerCase()
  if (!trimmedEmail) return { ok: false, error: 'No email provided' }

  try {
    const searchRes = await fetch(
      `${PIPEDRIVE_BASE}/persons/search?term=${encodeURIComponent(trimmedEmail)}&fields=email&exact_match=true&api_token=${token}`
    )
    const searchData = await searchRes.json()
    if (!searchData.success) return { ok: false, error: searchData.error ?? 'Pipedrive search failed' }

    const personId: number | undefined = searchData.data?.items?.[0]?.item?.id
    if (!personId) return { ok: true, matched: false }

    const updateRes = await fetch(`${PIPEDRIVE_BASE}/persons/${personId}?api_token=${token}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [CURRENT_MEMBER_FIELD_KEY]: fieldValue }),
    })
    const updateData = await updateRes.json()
    if (!updateData.success) return { ok: false, error: updateData.error ?? 'Pipedrive update failed' }

    return { ok: true, matched: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function markCurrentMemberInPipedrive(email: string): Promise<MarkResult> {
  return setCurrentMemberField(email, CURRENT_MEMBER_YES_OPTION_ID)
}

// Clears Current Member? back to "(None)" — used when archiving a member,
// so Pipedrive doesn't keep showing someone as current after they're gone.
export async function unmarkCurrentMemberInPipedrive(email: string): Promise<MarkResult> {
  return setCurrentMemberField(email, null)
}

// Silently corrects Location Desired and Membership Type in Pipedrive to
// match whatever was actually entered for this person in the portal at
// setup — this is a one-way overwrite (portal → Pipedrive), so it only
// ever fixes Pipedrive toward what staff just entered, never the other way.
// Only sets a field when the portal actually has a value for it; a blank
// field in the portal leaves that field in Pipedrive untouched, since
// there's nothing to correct it with.
export async function syncLocationAndSeatingToPipedrive(
  email: string,
  details: { locationName: string | null; seating: string | null }
): Promise<MarkResult> {
  const token = process.env.PIPEDRIVE_API_TOKEN
  if (!token) return { ok: false, error: 'PIPEDRIVE_API_TOKEN not configured' }

  const trimmedEmail = email.trim().toLowerCase()
  if (!trimmedEmail) return { ok: false, error: 'No email provided' }

  const fields: Record<string, number> = {}
  if (details.locationName && LOCATION_OPTION_IDS[details.locationName] !== undefined) {
    fields[LOCATION_FIELD_KEY] = LOCATION_OPTION_IDS[details.locationName]
  }
  if (details.seating && MEMBERSHIP_TYPE_OPTION_IDS[details.seating] !== undefined) {
    fields[MEMBERSHIP_TYPE_FIELD_KEY] = MEMBERSHIP_TYPE_OPTION_IDS[details.seating]
  }
  // Nothing to correct — don't bother searching Pipedrive at all.
  if (Object.keys(fields).length === 0) return { ok: true, matched: false }

  try {
    const searchRes = await fetch(
      `${PIPEDRIVE_BASE}/persons/search?term=${encodeURIComponent(trimmedEmail)}&fields=email&exact_match=true&api_token=${token}`
    )
    const searchData = await searchRes.json()
    if (!searchData.success) return { ok: false, error: searchData.error ?? 'Pipedrive search failed' }

    const personId: number | undefined = searchData.data?.items?.[0]?.item?.id
    if (!personId) return { ok: true, matched: false }

    const updateRes = await fetch(`${PIPEDRIVE_BASE}/persons/${personId}?api_token=${token}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    const updateData = await updateRes.json()
    if (!updateData.success) return { ok: false, error: updateData.error ?? 'Pipedrive update failed' }

    return { ok: true, matched: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
