import { Megaphone } from 'lucide-react'

type Props = {
  message: string
  // Radix's Dialog.Title/Dialog.Description (for a11y wiring) — each caller
  // passes its own Dialog.Root's versions in, since those are tied to the
  // specific dialog instance and can't be shared across two separate roots.
  TitleAs: React.ElementType
  DescriptionAs: React.ElementType
}

// The actual announcement content — shared between the member-facing popup
// (AnnouncementPopup) and the admin preview (AnnouncementPreviewDialog) so
// what an admin previews can never visually drift from what members see.
export default function AnnouncementCard({ message, TitleAs, DescriptionAs }: Props) {
  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <Megaphone size={20} className="text-blue-600" />
        <TitleAs className="text-sm font-semibold text-gray-900">Announcement</TitleAs>
      </div>
      <DescriptionAs className="text-sm text-gray-600 whitespace-pre-wrap">
        {message || <span className="text-gray-300">Nothing written yet.</span>}
      </DescriptionAs>
    </>
  )
}
