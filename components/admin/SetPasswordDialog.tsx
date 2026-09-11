'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import PasswordInput from '@/components/PasswordInput'
import { PASSWORD_REQUIREMENTS_TEXT } from '@/lib/password'

type Props = {
  member: { user_id: string; name: string } | null
  onOpenChange: (open: boolean) => void
}

export default function SetPasswordDialog({ member, onOpenChange }: Props) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  function close() {
    onOpenChange(false)
    setPassword('')
  }

  async function handleSave() {
    if (!member) return
    setSaving(true)
    const res = await fetch('/api/admin/members/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: member.user_id, password }),
    })
    if (res.ok) {
      toast.success(`Password set for ${member.name}`)
      close()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to set password')
    }
    setSaving(false)
  }

  return (
    <Dialog.Root open={!!member} onOpenChange={v => { if (!v) close() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 data-[state=open]:opacity-100 data-[state=closed]:opacity-0" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm transition-all duration-200 data-[state=open]:opacity-100 data-[state=open]:scale-100 data-[state=closed]:opacity-0 data-[state=closed]:scale-95">
            <div className="flex items-center justify-between mb-1">
              <Dialog.Title className="text-sm font-semibold text-gray-900">
                Set password for {member?.name}
              </Dialog.Title>
              <Dialog.Close className="text-gray-400 hover:text-gray-600"><X size={16} /></Dialog.Close>
            </div>
            <Dialog.Description className="text-sm text-gray-500 mb-4">
              This replaces their current password immediately — they'll need to be told the new one to sign in.
            </Dialog.Description>

            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" placeholder="At least 8 characters" />
            <p className="text-xs text-gray-400 mt-1 mb-5">{PASSWORD_REQUIREMENTS_TEXT}</p>

            <div className="flex justify-end gap-2">
              <Dialog.Close className="text-sm text-gray-500 hover:text-gray-700 font-medium px-3 py-2">
                Cancel
              </Dialog.Close>
              <button onClick={handleSave} disabled={saving || !password}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                {saving ? 'Saving…' : 'Set Password'}
              </button>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
