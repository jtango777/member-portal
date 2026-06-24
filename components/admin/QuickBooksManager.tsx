'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle2, Link2Off, RefreshCw } from 'lucide-react'

interface LocationStatus {
  location_id: string
  location_name: string
  connected: boolean
  needs_reconnect: boolean
  realm_id: string | null
}

export default function QuickBooksManager() {
  const [statuses, setStatuses] = useState<LocationStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function fetchStatuses() {
    const res = await fetch('/api/qb/status')
    if (res.ok) setStatuses(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchStatuses() }, [])

  async function handleConnect(locationId: string) {
    window.location.href = `/api/qb/connect?location_id=${locationId}`
  }

  async function handleDisconnect(locationId: string) {
    if (!confirm('Disconnect this location from QuickBooks? Sales receipts will stop syncing until reconnected.')) return

    setActionLoading(locationId)
    const res = await fetch('/api/qb/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId }),
    })

    if (res.ok) await fetchStatuses()
    setActionLoading(null)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">QuickBooks</h1>
        <p className="text-gray-500">Loading connection status...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">QuickBooks</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage QuickBooks connections for each location. Sales receipts are automatically created when external bookings are paid.
        </p>
      </div>

      <div className="space-y-3">
        {statuses.map(loc => (
          <div
            key={loc.location_id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-5 py-4"
          >
            <div className="flex items-center gap-3">
              {loc.connected && !loc.needs_reconnect && (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
              {loc.connected && loc.needs_reconnect && (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              {!loc.connected && (
                <Link2Off className="h-5 w-5 text-gray-400" />
              )}
              <div>
                <p className="font-medium">{loc.location_name}</p>
                {loc.connected && !loc.needs_reconnect && (
                  <p className="text-sm text-gray-500">Connected · Realm {loc.realm_id}</p>
                )}
                {loc.connected && loc.needs_reconnect && (
                  <p className="text-sm text-amber-600">Connection expired — reconnect required</p>
                )}
                {!loc.connected && (
                  <p className="text-sm text-gray-400">Not connected</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {(loc.needs_reconnect || !loc.connected) && (
                <button
                  onClick={() => handleConnect(loc.location_id)}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <RefreshCw className="mr-1.5 inline h-4 w-4" />
                  {loc.needs_reconnect ? 'Reconnect' : 'Connect'}
                </button>
              )}
              {loc.connected && (
                <button
                  onClick={() => handleDisconnect(loc.location_id)}
                  disabled={actionLoading === loc.location_id}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {actionLoading === loc.location_id ? 'Disconnecting...' : 'Disconnect'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
