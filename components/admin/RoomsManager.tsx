'use client'

import { useState } from 'react'
import { Location, Room } from '@/types'
import { Plus, Trash2, Edit2, Check, X, AlertTriangle } from 'lucide-react'
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
  const [deleteTarget, setDeleteTarget] = useState<{ room: Room; upcomingCount: number } | null>(null)
  const [loadingDelete, setLoadingDelete] = useState<string | null>(null)
  const [deleting, setDeleting]   = useState(false)

  async function refreshRooms() {
    const res = await fetch('/api/rooms')
    setRooms(await res.json())
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

  async function handleDeleteClick(room: Room) {
    setLoadingDelete(room.id)
    const res = await fetch(`/api/admin/rooms/${room.id}`)
    const data = await res.json()
    setLoadingDelete(null)
    setDeleteTarget({ room, upcomingCount: data.upcoming_reservations ?? 0 })
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/admin/rooms/${deleteTarget.room.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(`"${deleteTarget.room.name}" removed`)
      setDeleteTarget(null)
      await refreshRooms()
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Failed to delete room')
    }
    setDeleting(false)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Internal Conference Rooms</h1>
          <p className="text-sm text-gray-500 mt-0.5">Rooms available to BizHaus members on the internal booking calendar. Add, remove, or edit room names and capacities.</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
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
                  <span className="w-20 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Capacity</span>
                  <span className="w-40" />
                </div>
                {/* Rows */}
                {locRooms.map(room => (
                  <div key={room.id} className="flex items-center border-b border-gray-100 last:border-0 hover:bg-gray-50 px-4 py-3">
                    <div className="flex-1">
                      {editing?.id === room.id ? (
                        <input value={editing.name} onChange={e => setEditing(v => v ? { ...v, name: e.target.value } : v)}
                          className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-xs" />
                      ) : (
                        <span className="font-medium text-gray-900">{room.name}</span>
                      )}
                    </div>
                    <div className="w-20 text-center">
                      {editing?.id === room.id ? (
                        <input type="number" min="1" value={editing.capacity}
                          onChange={e => setEditing(v => v ? { ...v, capacity: e.target.value } : v)}
                          className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-16 text-center" />
                      ) : (
                        <span className="text-gray-600">{room.capacity}</span>
                      )}
                    </div>
                    <div className="w-40 flex items-center justify-end gap-2">
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
                          <button onClick={() => setEditing({ id: room.id, name: room.name, capacity: String(room.capacity) })}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                            <Edit2 size={12} /> Edit
                          </button>
                          <button onClick={() => handleDeleteClick(room)} disabled={loadingDelete === room.id}
                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-40">
                            <Trash2 size={12} /> {loadingDelete === room.id ? '…' : 'Remove'}
                          </button>
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

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900">Remove "{deleteTarget.room.name}"?</h3>
                {deleteTarget.upcomingCount > 0 ? (
                  <p className="text-sm text-red-600 mt-1">
                    This room has <strong>{deleteTarget.upcomingCount} upcoming reservation{deleteTarget.upcomingCount !== 1 ? 's' : ''}</strong> that will also be deleted.
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">This room has no upcoming reservations.</p>
                )}
                <p className="text-sm text-gray-500 mt-1">This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancel</button>
              <button onClick={handleDeleteConfirm} disabled={deleting}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                {deleting ? 'Removing…' : 'Yes, remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
