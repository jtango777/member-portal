'use client'

import { useState } from 'react'
import { Location, Room } from '@/types'
import { Plus, Edit2, Check, X, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconAction } from '@/components/admin/AdminTable'
import toast from 'react-hot-toast'

type Props = {
  locations: Location[]
  initialRooms: Room[]
}

type EditState = { id: string; name: string; capacity: string } | null

export default function RoomsManager({ locations, initialRooms }: Props) {
  const [rooms, setRooms]         = useState<Room[]>(initialRooms)
  const [showForm, setShowForm]   = useState(false)
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '')
  const [newName, setNewName]     = useState('')
  const [newCap, setNewCap]       = useState('')
  const [creating, setCreating]   = useState(false)
  const [editing, setEditing]     = useState<EditState>(null)
  const [saving, setSaving]       = useState(false)
  const [toggling, setToggling]   = useState<string | null>(null)

  async function refreshRooms() {
    // includeHidden — this is a management view, it needs to see rooms
    // hidden from the internal calendar too, or there'd be no way to
    // find and un-hide them again.
    const res = await fetch('/api/rooms?includeHidden=true')
    setRooms(await res.json())
  }

  async function handleToggleInternal(room: Room) {
    setToggling(room.id)
    const res = await fetch(`/api/admin/rooms/${room.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ internal_bookable: !room.internal_bookable }),
    })
    if (res.ok) {
      setRooms(prev => prev.map(r => r.id === room.id ? { ...r, internal_bookable: !r.internal_bookable } : r))
      toast.success(room.internal_bookable ? 'Room hidden from internal booking' : 'Room visible on internal booking again')
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Failed to update room')
    }
    setToggling(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    const res = await fetch('/api/admin/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId, name: newName, capacity: parseInt(newCap) }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('Room added')
      setNewName(''); setNewCap(''); setShowForm(false)
      await refreshRooms()
    } else {
      toast.error(data.error ?? 'Failed to add room')
    }
    setCreating(false)
  }

  async function handleSaveEdit() {
    if (!editing) return
    setSaving(true)
    const res = await fetch(`/api/admin/rooms/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editing.name, capacity: parseInt(editing.capacity) }),
    })
    if (res.ok) {
      toast.success('Room updated')
      setEditing(null)
      await refreshRooms()
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Failed to update room')
    }
    setSaving(false)
  }

  const roomsByLocation = locations.map(loc => ({
    location: loc,
    rooms: rooms.filter(r => r.location_id === loc.id).sort((a, b) => a.sort_order - b.sort_order),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">Internal Conference Rooms</h1>
          <p className="text-sm text-gray-500 mt-0.5">Rooms available to BizHaus members on the internal booking calendar. Add or edit room names and capacities, or hide a room temporarily instead of deleting it.</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex-shrink-0 whitespace-nowrap"
        >
          <Plus size={16} /> Add Room
        </button>
      </div>

      {/* Add room form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">New Room</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
              <select value={locationId} onChange={e => setLocationId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Room Name</label>
              <input required value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Small Meeting" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Capacity</label>
              <input type="number" min="1" required value={newCap} onChange={e => setNewCap(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 8" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={creating}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
              {creating ? 'Adding…' : 'Add Room'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancel</button>
          </div>
        </form>
      )}

      {/* Rooms grouped by location */}
      <div className="space-y-4">
        {roomsByLocation.map(({ location, rooms: locRooms }) => (
          <div key={location.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-blue-600">{location.name}</h2>
              <span className="text-xs text-gray-400">{locRooms.length} room{locRooms.length !== 1 ? 's' : ''}</span>
            </div>
            {locRooms.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No rooms yet.</p>
            ) : (
              <div className="text-sm">
                {/* Header */}
                <div className="flex items-center border-b border-gray-100 px-4 py-2.5 bg-gray-50">
                  <span className="flex-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Room</span>
                  <span className="w-64" />
                </div>
                {/* Rows */}
                {locRooms.map(room => (
                  <div key={room.id} className="flex items-center border-b border-gray-100 last:border-0 hover:bg-gray-50 px-4 py-3">
                    <div className="flex-1">
                      {editing?.id === room.id ? (
                        <div className="flex items-center gap-2">
                          <input value={editing.name} onChange={e => setEditing(v => v ? { ...v, name: e.target.value } : v)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-xs" />
                          <input type="number" min="1" value={editing.capacity}
                            onChange={e => setEditing(v => v ? { ...v, capacity: e.target.value } : v)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-16 text-center"
                            title="Capacity" />
                        </div>
                      ) : (
                        <span className="font-medium text-gray-900">
                          {room.name}
                          <span className="text-xs text-gray-400 font-normal ml-2">· {room.capacity} people</span>
                          {!room.internal_bookable && (
                            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Hidden</span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="w-64 flex items-center justify-end gap-2">
                      {editing?.id === room.id ? (
                        <>
                          <button onClick={handleSaveEdit} disabled={saving}
                            className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2.5 py-1.5 rounded-md font-medium">
                            <Check size={12} /> {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={() => setEditing(null)}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                            <X size={12} /> Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Visible is the normal case — a quiet (but lit
                              green, matching the room-access icon pattern
                              on Members) icon, not a badge repeated on every
                              row. Hidden is the exception worth actually
                              noticing, so it keeps a colored badge. Both
                              share one grid cell and cross-fade instead of
                              hard-swapping. */}
                          <div className="relative grid">
                            <div className={cn(
                              'col-start-1 row-start-1 transition-all duration-150',
                              room.internal_bookable ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                            )}>
                              <IconAction
                                icon={Eye}
                                label="Click to hide from internal booking"
                                onClick={() => handleToggleInternal(room)}
                                disabled={toggling === room.id}
                                colorClass="text-green-500 hover:bg-green-50"
                              />
                            </div>
                            <div className={cn(
                              'col-start-1 row-start-1 relative group transition-all duration-150',
                              !room.internal_bookable ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                            )}>
                              <button
                                onClick={() => handleToggleInternal(room)}
                                disabled={toggling === room.id}
                                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-40 whitespace-nowrap"
                              >
                                <EyeOff size={12} /> Hidden
                              </button>
                              <span className="pointer-events-none absolute right-0 bottom-full z-10 mb-1.5 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                                Click to make visible again
                              </span>
                            </div>
                          </div>
                          <IconAction
                            icon={Edit2}
                            label="Edit room"
                            onClick={() => setEditing({ id: room.id, name: room.name, capacity: String(room.capacity) })}
                            colorClass="text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
