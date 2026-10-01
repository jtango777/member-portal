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
  default: string
}

export type CopyProduct = 'day_pass' | 'rooms'

export type CopyTemplate = {
  id: string
  /** Which product's emails this belongs to, so the screen can split them. */
  product: CopyProduct
  name: string
  description: string
  fields: CopyField[]
}

// {firstName}, {location} and the rest are filled in when the email is sent.
// Anything not listed in a field's hint is left alone, so a stray brace in
// someone's copy cannot break the send.
export const EMAIL_TEMPLATES: CopyTemplate[] = [
  {
    id: 'day_pass_confirmation',
    product: 'day_pass',
    name: 'Day pass confirmation',
    description: 'Sent the moment someone buys a day pass. Marina del Rey gets its own version with the door code.',
    fields: [
      {
        key: 'day_pass_confirmation.subject',
        label: 'Subject line',
        hint: 'Tags: {location}, {date}',
        default: 'Your BizHaus Day Pass — {location}, {date}',
      },
      {
        key: 'day_pass_confirmation.intro',
        label: 'Opening line',
        hint: 'Tags: {firstName}, {location}',
        multiline: true,
        default: "Thanks for booking a day pass with BizHaus! We're looking forward to having you at our <strong>{location}</strong> location.",
      },
      {
        key: 'day_pass_confirmation.arrival',
        label: 'What to do on arrival',
        hint: 'Shown on every location except Marina del Rey, which has its own door code wording.',
        multiline: true,
        default: "We'll be there at <strong>9:00am</strong> to help you get set up when you arrive, just check in with us at the front desk.",
      },
    ],
  },
  {
    id: 'marina_confirmation',
    product: 'day_pass',
    name: 'Day pass confirmation — Marina del Rey',
    description: 'Marina is a satellite space with nobody at the desk in the morning, so its confirmation carries the door code and everything else someone needs to let themselves in and get set up.',
    fields: [
      {
        key: 'marina_confirmation.intro',
        label: 'Opening line',
        multiline: true,
        default: 'We look forward to having you at BizHaus today!',
      },
      {
        key: 'marina_confirmation.preamble',
        label: 'Why these instructions are here',
        multiline: true,
        default: "Our Marina del Rey location is a satellite space, so a team member won't be there until the afternoon. Here's what you need to get in and get set up.",
      },
      {
        key: 'marina_confirmation.wifi',
        label: 'WiFi password',
        default: 'bizhauswifi',
      },
      {
        key: 'marina_confirmation.building_access',
        label: 'Building access',
        hint: 'Tags: {doorCode}, {address}. Keep {doorCode} so the code only ever has to be changed in one place.',
        multiline: true,
        default: "BizHaus MDR is located at {address}. Your day pass code for today is <strong>#{doorCode}</strong>, it's the same code for both the building and Suite C215.",
      },
      {
        key: 'marina_confirmation.parking',
        label: 'Parking',
        multiline: true,
        default: 'Visitor parking out front is limited to 2 hours. Street parking is available nearby, or park in the AMC structure next door.',
      },
      {
        key: 'marina_confirmation.restrooms',
        label: 'Restrooms',
        multiline: true,
        default: 'Down the hallway, keys hang next to each door (pink bear for women, blue bear for men).',
      },
      {
        key: 'marina_confirmation.printers',
        label: 'Printers',
        multiline: true,
        default: 'Search for &ldquo;BizHaus Printer&rdquo; on the network. Our policy: please be kind to trees and print only when you have to!',
      },
      {
        key: 'marina_confirmation.kitchen',
        label: 'Kitchen',
        multiline: true,
        default: 'Enjoy the Nespresso and purified water. Just place used cups and dishes in the dishwasher.',
      },
      {
        key: 'marina_confirmation.desks',
        label: 'Open desk areas',
        hint: 'The line above the three photos of the desk areas.',
        multiline: true,
        default: "feel free to set up wherever's comfortable.",
      },
    ],
  },
  {
    id: 'day_pass_cancellation',
    product: 'day_pass',
    name: 'Day pass cancellation',
    description: 'Sent when a day pass is cancelled, whether by the customer or by staff. The refunded and credited versions differ.',
    fields: [
      {
        key: 'day_pass_cancellation.refunded_note',
        label: 'Note when the money is refunded',
        multiline: true,
        default: 'Refunds usually show up on your statement within 5 to 10 business days, depending on your bank.',
      },
      {
        key: 'day_pass_cancellation.credited_note',
        label: 'Note when the money is held as credit',
        multiline: true,
        default: "Just reply to this email when you know the day you'd like instead, and we'll apply the credit to it.",
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
    name: 'Room booking receipt',
    description: 'Sent to the customer after a conference room booking is paid for.',
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
    id: 'room_cancellation',
    product: 'rooms',
    name: 'Room booking cancellation',
    description: 'Sent when staff cancel a conference room booking. Rooms are sold non-refundable, so the credit version is the usual one.',
    fields: [
      {
        key: 'room_cancellation.refunded_note',
        label: 'Note when the money is refunded',
        hint: 'Tags: {amount}',
        multiline: true,
        default: "We've refunded <strong>{amount}</strong> to your original payment method. It usually shows up within 5 to 10 business days, depending on your bank.",
      },
      {
        key: 'room_cancellation.credited_note',
        label: 'Note when the money is held as credit',
        hint: 'Tags: {amount}',
        multiline: true,
        default: "We're holding <strong>{amount}</strong> toward a future booking. Just reply to this email when you know the day and time you'd like instead.",
      },
    ],
  },
]

export const ALL_COPY_FIELDS: CopyField[] = EMAIL_TEMPLATES.flatMap(t => t.fields)

export const DEFAULT_COPY: Record<string, string> = Object.fromEntries(
  ALL_COPY_FIELDS.map(f => [f.key, f.default])
)

/** Fill {tags} from the values given. Unknown braces are left untouched. */
export function fillTags(text: string, values: Record<string, string | undefined>): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole)
}
