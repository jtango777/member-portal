// Floor plans for desk assignments (Admin -> Labs).
//
// Positions and sizes are in pixels of the plan's image, so they line up
// whatever size the image is drawn at. If a plan's image is re-rendered at a
// different size, every seat on it moves (Joe, 2026-10-21).

export const DESK_NAME_MAX = 10

// x, y: where the seat's name box is centred. w, h override the plan's box
// size where neighbours are close. `vertical` turns the box to read bottom
// to top, for names the plan wrote sideways. `label` names the seat (the id
// when not given) and is the faint text an empty box shows, unless
// `placeholder` says otherwise ('' for none).
export type DeskSeat = {
  id: string; x: number; y: number; w?: number; h?: number
  vertical?: boolean; label?: string; placeholder?: string
}

export type DeskPlan = {
  id: string          // stored on every desk_assignments row; never change it
  slug: string        // the page's address under /dashboard/admin/labs
  title: string
  summary: string     // one line for the Labs index
  imageAlt: string
  width: number
  height: number
  boxW: number        // default box size, image pixels
  boxH: number
  fontPx: number
  minWidth: number    // narrowest the map is drawn before it scrolls
  boxTone?: 'white' | 'yellow'  // yellow stands out on a busy plan
  exportable?: boolean          // shows an Export button that downloads a JPG
  seats: DeskSeat[]
  labels?: PlanLabel[]
}

// Text drawn over the plan as real type, for a plan whose printed lettering
// was too low-resolution to stay sharp when enlarged; the lettering is
// erased from its image. Centred on x, y; size is the font size and both are
// in image pixels. rotate is in degrees, negative turning anticlockwise.
export type PlanLabel = { text: string; x: number; y: number; size: number; rotate?: number }

// ── El Segundo ────────────────────────────────────────────────────────────
// A crop of BizHaus South Bay - Main Building Floor Plan.pdf around pods
// 201-210, rendered at 6px per PDF point.
//
// A pod is two columns of chairs, one each side of its table, given here by
// where the chairs are. Seats number across then down: 1 top left, 2 top
// right, 3 next row left, and so on. Each box is centred a little outside its
// chair, away from the table: in the four-desk pods the two chairs in a row
// are too close for two boxes centred on them to clear each other.
const OUTSET = 10
function pod(number: number, [left, right]: [number, number], rows: number[]): DeskSeat[] {
  return rows.flatMap((y, row) => [
    { id: `${number}-${row * 2 + 1}`, x: left - OUTSET,  y },
    { id: `${number}-${row * 2 + 2}`, x: right + OUTSET, y },
  ])
}

export const EL_SEGUNDO_MAIN: DeskPlan = {
  id: 'el-segundo-main',
  slug: 'el-segundo',
  title: 'El Segundo Dedicated Desk Seating Chart',
  summary: 'Pods 201–210 in the main building, 48 desks.',
  imageAlt: 'Floor plan of pods 201–210, El Segundo main building',
  width: 1584,
  height: 1038,
  boxW: 139,
  boxH: 35,
  fontPx: 12,
  minWidth: 960,
  seats: [
    ...pod(201, [122, 272],   [135, 275, 420]),
    ...pod(202, [482, 620],   [125, 262]),
    ...pod(203, [962, 1100],  [125, 262]),
    ...pod(204, [1308, 1458], [135, 275, 420]),
    ...pod(205, [482, 620],   [445, 580]),
    ...pod(206, [962, 1100],  [445, 580]),
    ...pod(207, [122, 272],   [605, 750, 890]),
    ...pod(208, [482, 620],   [765, 906]),
    ...pod(209, [962, 1100],  [765, 906]),
    ...pod(210, [1308, 1458], [605, 750, 890]),
  ],
}

// ── Marina del Rey ────────────────────────────────────────────────────────
// Joe's annotated plan with the red names, and desks B1-B7, taken out
// (2026-10-22). Every box
// sits where a red name was; migration 060 fills them with those names. The
// names written sideways get sideways boxes.
//
// Every box is the same size (Joe, 2026-10-22), set by the tightest spot:
// C1-C3 along the north wall are 30px apart, so a box is 28px long. Longer
// names shrink their text to fit rather than the box growing. A few boxes
// sit a pixel or two off their red name so neighbours keep a gap.
export const MARINA_DEL_REY: DeskPlan = {
  id: 'marina-del-rey',
  slug: 'marina-del-rey',
  title: 'Marina del Rey Seating Chart',
  summary: 'Desks, offices and open seating across the whole floor.',
  imageAlt: 'Floor plan of BizHaus Marina del Rey',
  width: 796,
  height: 530,
  boxW: 28,
  boxH: 15,
  fontPx: 11,
  minWidth: 1100,
  boxTone: 'yellow',
  exportable: true,
  seats: [
    // North wall desks
    { id: 'c1',  x: 99,  y: 92,  label: 'C1' },
    { id: 'c2',  x: 129, y: 92,  label: 'C2' },
    { id: 'c3',  x: 159, y: 92,  label: 'C3' },
    { id: 'c14', x: 266, y: 94,  label: 'C14' },
    { id: 'a1',  x: 297, y: 94,  label: 'A1' },
    { id: 'b8',  x: 301, y: 131, vertical: true, label: 'B8' },
    { id: 'c15', x: 264, y: 166, label: 'C15' },
    { id: 'a2',  x: 297, y: 166, label: 'A2' },   // in line with A1 above
    // West wall desks, top to bottom: one column, each box centred on its
    // desk. The desks run 105-228 in four equal steps of about 31.
    { id: 'c7', x: 80, y: 120, vertical: true, label: 'C7' },
    { id: 'c6', x: 80, y: 151, vertical: true, label: 'C6' },
    { id: 'c5', x: 80, y: 182, vertical: true, label: 'C5' },
    { id: 'c4', x: 80, y: 213, vertical: true, label: 'C4' },
    // Middle island, left side then right side, top to bottom. The left
    // column sits level with the right one.
    { id: 'mid-l-1', x: 130, y: 154, vertical: true, label: 'Desk' },
    { id: 'mid-l-2', x: 130, y: 187, vertical: true, label: 'Desk' },
    { id: 'mid-l-3', x: 130, y: 218, vertical: true, label: 'Desk' },
    { id: 'mid-r-1', x: 182, y: 154, vertical: true, label: 'Desk' },
    { id: 'mid-r-2', x: 182, y: 187, vertical: true, label: 'Desk' },
    { id: 'mid-r-3', x: 182, y: 218, vertical: true, label: 'Desk' },
    // Offices
    { id: 'office-2',   x: 408, y: 27,  label: 'Office 2' },
    { id: 'office-3',   x: 484, y: 26,  label: 'Office 3' },
    { id: 'office-4-1', x: 625, y: 105, label: 'Office 4' },
    { id: 'office-4-2', x: 624, y: 164, label: 'Office 4' },
    { id: 'office-5-1', x: 584, y: 269, label: 'Office 5' },
    { id: 'office-5-2', x: 624, y: 269, label: 'Office 5' },
    { id: 'office-6-1', x: 585, y: 300, label: 'Office 6' },
    { id: 'office-6-2', x: 624, y: 300, label: 'Office 6' },
    { id: 'office-6-3', x: 565, y: 351, label: 'Office 6' },
    { id: 'office-6-4', x: 612, y: 356, label: 'Office 6' },
    { id: 'office-8',   x: 401, y: 255, label: 'Office 8' },
    // Room 7, which held desks B1-B7 until they were taken off the plan
    // (Joe, 2026-10-22). The ids keep the old name; they're stored on rows.
    { id: 'b-north', x: 637, y: 416, label: 'Room 7' },
    { id: 'b-south', x: 642, y: 458, label: 'Room 7' },
    // Lobby / open desks: two rows of four (Joe, 2026-10-22). The plan named
    // six people; 7 and 8 start empty. Empty lobby boxes show no hint, the
    // room's own label being right above them.
    { id: 'lobby-1', x: 379, y: 446, label: 'Lobby', placeholder: '' },
    { id: 'lobby-2', x: 413, y: 446, label: 'Lobby', placeholder: '' },
    { id: 'lobby-3', x: 447, y: 446, label: 'Lobby', placeholder: '' },
    { id: 'lobby-4', x: 481, y: 446, label: 'Lobby', placeholder: '' },
    { id: 'lobby-5', x: 379, y: 464, label: 'Lobby', placeholder: '' },
    { id: 'lobby-6', x: 413, y: 464, label: 'Lobby', placeholder: '' },
    { id: 'lobby-7', x: 447, y: 464, label: 'Lobby', placeholder: '' },
    { id: 'lobby-8', x: 481, y: 464, label: 'Lobby', placeholder: '' },
  ],
  // The plan's own lettering, redrawn sharp (Joe, 2026-10-22). Positions
  // measured from the original image; sizes set so each label fills about
  // the same space in Arial as it did in the plan's narrower typeface.
  labels: [
    ...([['C1', 101], ['C2', 132.5], ['C3', 163], ['C14', 265.5], ['A1', 315]] as const)
      .map(([text, x]) => ({ text, x, y: 77, size: 11 })),
    { text: 'B8',  x: 319.5, y: 128,   size: 11 },
    { text: 'C15', x: 267.5, y: 183.5, size: 11 },
    { text: 'A2',  x: 315,   y: 183.5, size: 11 },
    ...([['C7', 63.75, 120.5], ['C6', 63.75, 152.5], ['C5', 63.75, 183.25], ['C4', 63.75, 215],
         ['C10', 146.75, 153.75], ['C9', 146.75, 185], ['C8', 146.75, 215.75],
         ['C13', 164.25, 153.75], ['C12', 164.25, 185], ['C11', 164.25, 215.75]] as const)
      .map(([text, x, y]) => ({ text, x, y, size: 11, rotate: -90 })),
    { text: 'Phone\nBooth', x: 195.4, y: 83.1, size: 6, rotate: -41 },
    { text: 'Phone\nBooth', x: 226.7, y: 83.1, size: 6, rotate: -41 },
    // Room numbers. The conference room was 7 on the plan and is now 9, and
    // the former B room (Neill, Danny) is 7 (Joe, 2026-10-22).
    ...([['1', 352.7, 111], ['2', 411.7, 55], ['3', 481, 55], ['4', 604.3, 136],
         ['5', 605, 242.7], ['6', 604.3, 327.7], ['9', 414.3, 327.7], ['8', 414.3, 271.7],
         ['7', 592, 437]] as const)
      .map(([text, x, y]) => ({ text, x, y, size: 15 })),
    // Room names all share Kitchen's size (Joe, 2026-10-22).
    { text: 'Living Room',        x: 452.3, y: 177.3, size: 14 },
    { text: 'Conf Room',          x: 419,   y: 344,   size: 14 },
    { text: 'Kitchen',            x: 329.3, y: 292.3, size: 14, rotate: 90 },
    { text: 'Lobby / Open Desks', x: 429.5, y: 418.75, size: 14 },
  ],
}

export const DESK_PLAN_LIST: DeskPlan[] = [EL_SEGUNDO_MAIN, MARINA_DEL_REY]
export const DESK_PLANS: Record<string, DeskPlan> = Object.fromEntries(DESK_PLAN_LIST.map(p => [p.id, p]))
export const deskPlanBySlug = (slug: string) => DESK_PLAN_LIST.find(p => p.slug === slug)

export function isDeskOnPlan(planId: string, desk: string): boolean {
  return !!DESK_PLANS[planId]?.seats.some(s => s.id === desk)
}
