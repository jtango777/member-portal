'use client'

import { useState } from 'react'
import { Location, Room } from '@/types'
import { Edit2, Check, X, Globe, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconAction } from '@/components/admin/AdminTable'
import toast from 'react-hot-toast'

type Props = {
  locations: Location[]
  initialRooms: Room[]
}

type EditState = {
  id: string
  external_name: string
  price_per_hour: string
  description: string
  features: string   // comma-separated for editing
} | null

export default function ExternalRoomsManager({ locations, initialRooms }: Props) {
  const [rooms,   setRooms]   = useState<Room[]>(initialRooms)
  const [editing, setEditing] = useState<EditState>(null)
  const [saving,  setSaving]  = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  async function refreshRooms() {
    const res = await fetch('/api/rooms?includeHidden=true')
    setRooms(await res.json())
  }

  async function handleToggleExternal(room: Room) {
    setToggling(room.id)
    const res = await fetch(`/api/admin/rooms/${room.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ external_bookable: !room.external_bookable }),
    })
    if (res.ok) {
      setRooms(prev => prev.map(r => r.id === room.id ? { ...r, external_bookable: !r.external_bookable } : r))
      toast.success(room.external_bookable ? 'Room removed from external booking' : 'Room added to external booking')
    } else {
      toast.error('Failed to update room')
    }
    setToggling(null)
  }

  async function handleSaveEdit() {
    if (!editing) return
    setSaving(true)
    const features = editing.features
      .split(',')
      .map(f => f.trim())
      .filter(Boolean)

    const res = await fetch(`/api/admin/rooms/${editing.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        external_name:  editing.external_name,
        price_per_hour: editing.price_per_hour,
        description:    editing.description,
        features,
      }),
    })
    if (res.ok) {
      toast.success('Room updated')
      setEditing(null)
      await refreshRooms()
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Failed to update')
    }
    setSaving(false)
  }

  const roomsByLocation = locations.map(loc => ({
    location: loc,
    rooms: rooms.filter(r => r.location_id === loc.id).sort((a, b) => a.sort_order - b.sort_order),
  }))

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">External Booking Rooms</h1>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
            <Globe size={11} /> /book
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">Rooms visible to the public on members.bizhaus.com/book. Toggle rooms on or off, set external-facing names and pricing, and add descriptions for customers.</p>
      </div>

      <div className="space-y-4">
        {roomsByLocation.map(({ location, rooms: locRooms }) => (
          <div key={location.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-blue-600">{location.name}</h2>
              <span className="text-xs text-gray-400">{locRooms.length} room{locRooms.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="divide-y divide-gray-100">
              {locRooms.map(room => {
                const isEditing = editing?.id === room.id
                return (
                  <div key={room.id} className="px-4 py-4 space-y-3">
                    {/* Top row: name + toggle */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <span className="font-medium text-gray-900 text-sm">{room.name}</span>
                        <span className="text-xs text-gray-400 ml-2">· {room.capacity} people</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Live is the normal case — a quiet (but lit green)
                            icon, not a badge repeated on every row. Hidden is
                            the exception worth actually noticing, so it keeps
                            a colored badge. Both share one grid cell and
                            cross-fade instead of hard-swapping. */}
                        <div className="relative grid">
                          <div className={cn(
                            'col-start-1 row-start-1 transition-all duration-150',
                            room.external_bookable ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                          )}>
                            <IconAction
                              icon={Globe}
                              label="Click to hide from /book"
                              onClick={() => handleToggleExternal(room)}
                              disabled={toggling === room.id}
                              colorClass="text-green-600 hover:bg-green-50"
                            />
                          </div>
                          <div className={cn(
                            'col-start-1 row-start-1 relative group transition-all duration-150',
                            !room.external_bookable ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                          )}>
                            <button
                              onClick={() => handleToggleExternal(room)}
                              disabled={toggling === room.id}
                              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-colors whitespace-nowrap"
                            >
                              <EyeOff size={12} /> Hidden
                            </button>
                            <span className="pointer-events-none absolute right-0 bottom-full z-10 mb-1.5 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                              Click to make live on /book
                            </span>
                          </div>
                        </div>

                        {/* Edit / Save / Cancel */}
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button onClick={handleSaveEdit} disabled={saving}
                              className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2.5 py-1.5 rounded-md font-medium">
                              <Check size={12} /> {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button onClick={() => setEditing(null)}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                              <X size={12} /> Cancel
                            </button>
                          </div>
                        ) : (
                          <IconAction
                            icon={Edit2}
                            label="Edit details"
                            onClick={() => setEditing({
                              id:            room.id,
                              external_name: room.external_name ?? '',
                              price_per_hour: room.price_per_hour?.toString() ?? '',
                              description:   room.description ?? '',
                              features:      (room.features ?? []).join(', '),
                            })}
                            colorClass="text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          />
                        )}
                      </div>
                    </div>

                    {/* Edit form */}
                    <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isEditing ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                      <div className="overflow-hidden">
                        <div className="space-y-3 bg-gray-50 rounded-lg p-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">External name</label>
                              <input
                                value={editing?.external_name ?? ''}
                                onChange={e => setEditing(v => v ? { ...v, external_name: e.target.value } : v)}
                                placeholder="e.g. Large"
                                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Price per hour ($)</label>
                              <input
                                type="number" min="0" step="5"
                                value={editing?.price_per_hour ?? ''}
                                onChange={e => setEditing(v => v ? { ...v, price_per_hour: e.target.value } : v)}
                                placeholder="e.g. 75"
                                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                            <textarea
                              value={editing?.description ?? ''}
                              onChange={e => setEditing(v => v ? { ...v, description: e.target.value } : v)}
                              rows={3}
                              placeholder="Describe this room for external customers…"
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Features <span className="font-normal text-gray-400">(comma-separated)</span>
                            </label>
                            <input
                              value={editing?.features ?? ''}
                              onChange={e => setEditing(v => v ? { ...v, features: e.target.value } : v)}
                              placeholder="Projector, Whiteboard, Apple TV, Speakerphone"
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Summary when not editing */}
                    {!isEditing && room.external_bookable && (
                      <div className="text-xs text-gray-400 space-y-0.5">
                        {room.external_name && (
                          <p>External name: <span className="text-gray-600 font-medium">{room.external_name}</span></p>
                        )}
                        {room.price_per_hour != null && (
                          <p>Price: <span className="text-gray-600 font-medium">${room.price_per_hour}/hr</span></p>
                        )}
                        {room.description && <p className="text-gray-500 line-clamp-1">{room.description}</p>}
                        {(room.features ?? []).length > 0 && (
                          <p>{room.features.join(' · ')}</p>
                        )}
                        {!room.external_name && !room.description && (
                          <p className="italic">No external details set — click Edit to add.</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
