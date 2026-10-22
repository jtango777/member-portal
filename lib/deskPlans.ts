// Floor plans for desk assignments (Admin -> Labs).
//
// Positions are in pixels of the plan's image, so they line up whatever size
// the image is drawn at. The image is a crop of BizHaus South Bay - Main
// Building Floor Plan.pdf around the pods, rendered at 6px per PDF point;
// re-render at the same crop and scale if the plan changes, or every seat
// below moves (Joe, 2026-10-21).

export const DESK_NAME_MAX = 10

// x, y: where the seat's name box is centred.
export type DeskSeat = { id: string; x: number; y: number }
export type DeskPod  = { number: number; seats: DeskSeat[] }
export type DeskPlan = { id: string; title: string; width: number; height: number; pods: DeskPod[] }

// A pod is two columns of chairs, one each side of its table, given here by
// where the chairs are. Seats number across then down: 1 top left, 2 top
// right, 3 next row left, and so on.
//
// Each seat's box is centred a little outside its chair, away from the
// table: in the four-desk pods the two chairs in a row are too close for two
// boxes centred on them to clear each other.
const OUTSET = 10
function pod(number: number, [left, right]: [number, number], rows: number[]): DeskPod {
  return {
    number,
    seats: rows.flatMap((y, row) => [
      { id: `${number}-${row * 2 + 1}`, x: left - OUTSET,  y },
      { id: `${number}-${row * 2 + 2}`, x: right + OUTSET, y },
    ]),
  }
}

export const EL_SEGUNDO_MAIN: DeskPlan = {
  id: 'el-segundo-main',
  title: 'El Segundo · Main building',
  width: 1584,
  height: 1038,
  pods: [
    pod(201, [122, 272],   [135, 275, 420]),
    pod(202, [482, 620],   [125, 262]),
    pod(203, [962, 1100],  [125, 262]),
    pod(204, [1308, 1458], [135, 275, 420]),
    pod(205, [482, 620],   [445, 580]),
    pod(206, [962, 1100],  [445, 580]),
    pod(207, [122, 272],   [605, 750, 890]),
    pod(208, [482, 620],   [765, 906]),
    pod(209, [962, 1100],  [765, 906]),
    pod(210, [1308, 1458], [605, 750, 890]),
  ],
}

export const DESK_PLANS: Record<string, DeskPlan> = { [EL_SEGUNDO_MAIN.id]: EL_SEGUNDO_MAIN }

export function isDeskOnPlan(planId: string, desk: string): boolean {
  return !!DESK_PLANS[planId]?.pods.some(p => p.seats.some(s => s.id === desk))
}
