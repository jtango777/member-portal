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

type MarkResult =
  | { ok: true; matched: true }
  | { ok: true; matched: false } // no Pipedrive contact found for this email — not an error
  | { ok: false; error: string }

export async function markCurrentMemberInPipedrive(email: string): Promise<MarkResult> {
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
      body: JSON.stringify({ [CURRENT_MEMBER_FIELD_KEY]: CURRENT_MEMBER_YES_OPTION_ID }),
    })
    const updateData = await updateRes.json()
    if (!updateData.success) return { ok: false, error: updateData.error ?? 'Pipedrive update failed' }

    return { ok: true, matched: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
