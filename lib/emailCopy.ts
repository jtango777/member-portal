// The words in customer-facing emails, editable from the admin dashboard.
//
// Deliberately NOT the HTML. These emails are hand-built with inline styles
// because email clients are hostile, and one stray character would send every
// confirmation out broken, discovered via customers. So the structure, the
// logo, the booking details table and the door code all stay in code, and
// what is editable is a short list of named plain-text lines
// (Caroline, 2026-10-01).
//
// Every field has a default here. An empty override means "use the default",
// so Reset is just clearing the box.

export type CopyField = {
  key: string
  label: string
  /** Shown under the input, says what the line is for and which tags work. */
  hint?: string
  /** A longer box for paragraphs. */
  multiline?: boolean
  /** How tall that box should be. */
  rows?: number
  /**
   * For a template with variants: the only version of the email this line
   * appears in. The editor uses it to switch the preview to that version
   * when you start typing, because editing a box that is invisible in the
   * preview beside it reads as the editor being broken (Caroline,
   * 2026-10-01).
   */
  onlyIn?: string
  default: string
}

export type CopyProduct = 'day_pass' | 'rooms'

export type CopyTemplate = {
  id: string
  /** Which product's emails this belongs to, so the screen can split them. */
  product: CopyProduct
  name: string
  description: string
  /**
   * Some emails go out in more than one version depending on what happened,
   * and one preview cannot show both: editing the credit wording did nothing
   * visible while the preview was rendering the refunded version (Caroline,
   * 2026-10-01).
   */
  variants?: { id: string; label: string }[]
  fields: CopyField[]
}

// {firstName}, {location} and the rest are filled in when the email is sent.
// Anything not listed in a field's hint is left alone, so a stray brace in
// someone's copy cannot break the send.
export const EMAIL_TEMPLATES: CopyTemplate[] = [
  {
    id: 'day_pass_confirmation',
    product: 'day_pass',
    name: 'Day pass confirmation — El Segundo & Costa Mesa',
    description: 'Sent the moment someone buys a day pass at a location with someone on the front desk. Marina del Rey has its own version below.',
    fields: [
      {
        key: 'day_pass_confirmation.subject',
        label: 'Subject line',
        hint: 'Tags: {location}, {date}',
        default: 'Your BizHaus Day Pass — {location}, {date}',
      },
      {
        key: 'day_pass_confirmation.body',
        label: 'Message',
        hint: 'Leave a blank line between paragraphs. Tags: {firstName}, {location}, {date}',
        multiline: true,
        rows: 6,
        default: [
          "Thanks for booking a day pass with BizHaus! We're looking forward to having you at our **{location}** location.",
          "We'll be there at **9:00am** to help you get set up when you arrive, just check in with us at the front desk.",
        ].join('\n\n'),
      },
    ],
  },
  {
    id: 'marina_confirmation',
    product: 'day_pass',
    name: 'Day pass confirmation — Marina del Rey',
    description: 'Marina is a satellite space with nobody at the desk in the morning, so it gets its own confirmation with the door code and everything else needed to let yourself in.',
    fields: [
      {
        key: 'marina_confirmation.intro',
        label: 'Opening',
        hint: 'Leave a blank line between paragraphs.',
        multiline: true,
        rows: 5,
        default: "We look forward to having you at BizHaus today!\n\nOur Marina del Rey location is a satellite space, so a team member won't be there until the afternoon. Here's what you need to get in and get set up.",
      },
      {
        key: 'marina_confirmation.details',
        label: 'Arrival details',
        hint: 'One per line, written as "Heading: what it says". Tags: {doorCode}, {address}. Keep {doorCode} so the code only ever has to be changed in one place.',
        multiline: true,
        rows: 10,
        default: [
          'WiFi Password: bizhauswifi',
          "Building Access: BizHaus MDR is located at {address}. Your day pass code for today is **#{doorCode}**, it's the same code for both the building and Suite C215.",
          'Parking: Visitor parking out front is limited to 2 hours. Street parking is available nearby, or park in the AMC structure next door.',
          'Restrooms: Down the hallway, keys hang next to each door (pink bear for women, blue bear for men).',
          'Printers: Search for &ldquo;BizHaus Printer&rdquo; on the network. Our policy: please be kind to trees and print only when you have to!',
          'Kitchen: Enjoy the Nespresso and purified water. Just place used cups and dishes in the dishwasher.',
        ].join('\n'),
      },
      {
        key: 'marina_confirmation.desks',
        label: 'Open desk areas',
        hint: 'The line above the three photos.',
        multiline: true,
        default: "feel free to set up wherever's comfortable.",
      },
    ],
  },
  {
    id: 'day_pass_cancellation',
    product: 'day_pass',
    name: 'Day pass cancellation',
    // One version only. A cancelled day pass is always refunded to the
    // card, so there is nothing to switch between; the staff option to
    // hold one as credit went with this (Caroline, 2026-11-20).
    description: 'Sent when a day pass is cancelled, whether by the customer or by staff. The money always goes back to the card.',
    fields: [
      {
        key: 'day_pass_cancellation.refunded_note',
        label: 'Note about the refund',
        multiline: true,
        default: 'Refunds usually show up on your statement within 5 to 10 business days, depending on your bank.',
      },
      {
        key: 'day_pass_cancellation.signoff',
        label: 'Closing line',
        multiline: true,
        default: 'Plans change, we get it. Whenever you’re ready to come in, you can book another day pass.',
      },
    ],
  },
  {
    id: 'room_receipt',
    product: 'rooms',
    name: 'Room booking receipt — El Segundo & Costa Mesa',
    description: 'Sent to the customer after a conference room booking is paid for. Marina del Rey gets this same receipt with an arrival section added; see below.',
    fields: [
      {
        key: 'room_receipt.subject',
        label: 'Subject line',
        hint: 'Tags: {room}, {date}',
        default: 'BizHaus Receipt — {room} on {date}',
      },
      {
        key: 'room_receipt.intro',
        label: 'Opening line',
        hint: 'Tags: {firstName}, {room}, {location}',
        multiline: true,
        default: 'Your booking is confirmed. Here are the details and your receipt.',
      },
    ],
  },
  {
    id: 'marina_room_access',
    product: 'rooms',
    name: 'Room booking receipt — Marina del Rey',
    description: 'Marina is a satellite space with nobody at the desk in the morning, so a room booking there needs the door code and the way in, exactly as a day pass does. The preview shows the whole email. Its subject and opening line are shared with the receipt above; the lines below are the part only Marina gets.',
    fields: [
      {
        key: 'marina_room_access.heading',
        label: 'Heading',
        default: 'Getting in',
      },
      {
        key: 'marina_room_access.intro',
        label: 'Opening',
        hint: 'Leave a blank line between paragraphs.',
        multiline: true,
        rows: 4,
        default: "Marina del Rey is a satellite space, so there may be nobody at the desk when you arrive. Here is how to let yourself in.",
      },
      {
        key: 'marina_room_access.details',
        label: 'Arrival details',
        hint: 'One per line, written as "Heading: what it says". Tags: {doorCode}, {address}. Keep {doorCode} so the code only ever has to be changed in one place.',
        multiline: true,
        rows: 8,
        // Ordered the way somebody actually arrives: in the door, up the
        // stairs, into the room, and out again at the end. Taken from the
        // email Joe used to send conference room guests by hand, which
        // had several things this did not: pressing # before the code,
        // which stairs, which room, the thermostat, and the green button
        // you need to get back out (Caroline, 2026-11-20).
        default: [
          'Building Access: BizHaus MDR is at {address}. Press # first, then **{doorCode}**, to unlock the main door. Take the first set of stairs on your right up to Suite C215, which the same code opens.',
          'Your Room: The conference room is the first room on your left as you come in.',
          'Parking: The guest lot out front is limited to 2 hours. Street parking is available nearby, or use the AMC structure next door.',
          'WiFi Password: bizhauswifi',
          'Air Conditioning: The thermostat for the conference room is on the same wall as the printer.',
          'Restrooms: In the hallway, with the keys hanging next to the door (pink bear for the ladies\u2019 room, blue bear for the men\u2019s).',
          'Kitchen: Help yourself to the Nespresso and the purified water. Mugs and glasses are in the cabinets above the machines, and used ones go in the dishwasher.',
          'Printer: Search for &ldquo;BizHaus Printer&rdquo; on the network. Our policy: please be kind to trees and print only when you have to!',
          'Leaving: Press the green button on the inside to unlock the door.',
        ].join('\n'),
      },
    ],
  },
  {
    id: 'room_cancellation',
    product: 'rooms',
    name: 'Room booking cancellation',
    // One version only. A cancelled room is always held as credit, never
    // refunded, so there is nothing to switch between
    // (Caroline, 2026-11-20).
    description: 'Sent when a conference room booking is cancelled, by the customer before the 9 PM cutoff or by staff. The money is always held as credit against the cancellation code, never refunded.',
    fields: [
      {
        key: 'room_cancellation.credited_note',
        label: 'Note about the credit',
        // The credit is not a balance anywhere and cannot be spent online,
        // so this sentence is the only record of it. It has to name the
        // amount and the number they will be asked for on the phone
        // (Caroline, 2026-11-20).
        hint: 'Tags: {amount}, {confirmation}. This is the only place the credit is written down, so keep both.',
        multiline: true,
        rows: 4,
        default: "We're holding **{amount}** as credit toward a future booking. Your cancellation code is **{confirmation}**. Whenever you're ready to use it, call or email us with that code and we'll put it toward your new date. Credit can't be applied online.",
      },
    ],
  },
]

export const ALL_COPY_FIELDS: CopyField[] = EMAIL_TEMPLATES.flatMap(t => t.fields)

export const DEFAULT_COPY: Record<string, string> = Object.fromEntries(
  ALL_COPY_FIELDS.map(f => [f.key, f.default])
)

/**
 * Blank-line-separated text into paragraphs. Lets staff write a message as
 * a message rather than filling in one box per sentence (Caroline,
 * 2026-10-01).
 */
export function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map(t => t.trim()).filter(Boolean)
}

/**
 * One bullet per line, written "Heading: what it says". A line with no colon
 * becomes a bullet with no heading rather than being dropped, so a stray
 * line never silently disappears from an email.
 */
export function bulletLines(text: string): { label: string; text: string }[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const at = line.indexOf(':')
      if (at === -1) return { label: '', text: line }
      return { label: line.slice(0, at).trim(), text: line.slice(at + 1).trim() }
    })
}

/**
 * **bold** becomes bold. Staff should be writing an email, not HTML, and
 * <strong> tags in the editing box made it look like code (Caroline,
 * 2026-10-01). Raw HTML still passes through untouched, so anything saved
 * before this keeps working.
 */
export function emphasise(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

/** Fill {tags} from the values given. Unknown braces are left untouched. */
export function fillTags(text: string, values: Record<string, string | undefined>): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole)
}
