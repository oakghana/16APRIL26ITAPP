'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useNotification } from '@/hooks/use-notification-sound'
import { formatDisplayDate } from '@/lib/utils'
import { Bell, Loader2, Send, InfoIcon, Pencil, RefreshCw } from 'lucide-react'

interface AdminBroadcastPanelProps {
  currentUserId: string
  currentUserName: string
  currentUserRole: string
  locations?: Array<{ code: string; name: string }>
}

interface SentNotification {
  id: string
  title: string
  message: string
  target_role: string
  target_location_name: string | null
  notification_type: string
  sent_by_name: string
  created_at: string
}

const ROLE_OPTIONS = [
  { value: 'all_staff', label: 'All Staff' },
  { value: 'it_staff', label: 'IT Staff' },
  { value: 'service_desk_staff', label: 'Service Desk Staff' },
  { value: 'service_desk_head', label: 'Service Desk Head' },
  { value: 'it_head', label: 'IT Head' },
  { value: 'staff', label: 'Regular Staff' },
  { value: 'user', label: 'All Users' },
]

const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map((role) => [role.value, role.label]))

const NOTIFICATION_TYPES = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'maintenance', label: 'Maintenance' },
]

const TYPE_COLORS: Record<string, string> = {
  urgent: 'bg-red-500',
  warning: 'bg-amber-500',
  maintenance: 'bg-blue-500',
  info: 'bg-green-500',
}

export const AdminBroadcastPanel: React.FC<AdminBroadcastPanelProps> = ({
  currentUserId,
  currentUserName,
  currentUserRole,
  locations = [],
}) => {
  const { toast } = useToast()
  const { showNotification } = useNotification()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [sentNotifications, setSentNotifications] = useState<SentNotification[]>([])
  const [editingNotif, setEditingNotif] = useState<SentNotification | null>(null)

  const isAdminOnly = ["admin", "it_head", "regional_it_head"].includes(currentUserRole)

  // Form states
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetRole, setTargetRole] = useState('all_staff')
  const [targetLocation, setTargetLocation] = useState('')
  const [notificationType, setNotificationType] = useState('info')

  useEffect(() => {
    if (isAdminOnly) fetchSentNotifications()
  }, [isAdminOnly])

  const fetchSentNotifications = async () => {
    try {
      const res = await fetch(`/api/service-tickets/notify?userId=${currentUserId}&userRole=${currentUserRole}`)
      if (res.ok) {
        const result = await res.json()
        setSentNotifications(result.notifications || [])
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const openNewDialog = () => {
    setEditingNotif(null)
    setTitle('')
    setMessage('')
    setTargetRole('all_staff')
    setTargetLocation('')
    setNotificationType('info')
    setDialogOpen(true)
  }

  // Double-click opens the notification for editing
  const handleDoubleClick = (notif: SentNotification) => {
    setEditingNotif(notif)
    setTitle(notif.title)
    setMessage(notif.message)
    setTargetRole(notif.target_role)
    setTargetLocation(notif.target_location_name || '')
    setNotificationType(notif.notification_type || 'info')
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: 'Validation Error', description: 'Please enter a notification title', variant: 'destructive' })
      return
    }
    if (!message.trim()) {
      toast({ title: 'Validation Error', description: 'Please enter a notification message', variant: 'destructive' })
      return
    }

    setIsLoading(true)
    try {
      const isEdit = !!editingNotif
      const url = '/api/service-tickets/notify'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEdit ? { id: editingNotif.id } : {}),
          title,
          message,
          targetRole,
          targetLocation: targetLocation || null,
          sentBy: currentUserId,
          sentByName: currentUserName,
          notificationType,
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to send notification')

      await showNotification({
        title: isEdit ? 'Notification Updated & Rebroadcast' : 'Broadcast Sent',
        description: result.message || `Notification sent to ${targetRole} users`,
        type: 'success',
        sound: true,
      })

      setDialogOpen(false)
      setEditingNotif(null)
      fetchSentNotifications()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to send notification', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  if (!isAdminOnly) return null

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-green-200/50 bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Broadcast Center
              </CardTitle>
              <CardDescription>
                Send notifications to IT staff, service desk, and users by role
              </CardDescription>
            </div>
            <Button
              onClick={openNewDialog}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <Send className="mr-2 h-4 w-4" />
              New Notification
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Recent Notifications */}
      {sentNotifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Notifications</CardTitle>
            <CardDescription className="flex items-center gap-1 text-xs text-muted-foreground">
              <Pencil className="h-3 w-3" />
              Double-click any notification to edit and rebroadcast it
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {sentNotifications.slice(0, 20).map((notif) => (
                <div
                  key={notif.id}
                  onDoubleClick={() => handleDoubleClick(notif)}
                  title="Double-click to edit and rebroadcast"
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer select-none group"
                >
                  <div
                    className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${TYPE_COLORS[notif.notification_type] ?? 'bg-green-500'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{notif.title}</p>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notif.message}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {ROLE_LABELS[notif.target_role] || notif.target_role}
                      </Badge>
                      {notif.target_location_name && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {notif.target_location_name}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 capitalize border-0 ${
                          notif.notification_type === 'urgent' ? 'text-red-600 bg-red-50 dark:bg-red-950/40' :
                          notif.notification_type === 'warning' ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' :
                          notif.notification_type === 'maintenance' ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' :
                          'text-green-600 bg-green-50 dark:bg-green-950/40'
                        }`}
                      >
                        {notif.notification_type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {formatDisplayDate(notif.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingNotif(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingNotif ? (
                <><RefreshCw className="h-4 w-4" /> Edit &amp; Rebroadcast Notification</>
              ) : (
                <><Send className="h-4 w-4" /> Send Broadcast Notification</>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingNotif
                ? 'Update the message below. All users with the selected role will receive a fresh copy.'
                : 'All users with the selected role will receive this notification in their Messages inbox.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Info banner */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <InfoIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Notifications will appear in each recipient&apos;s <strong>Messages</strong> inbox immediately after sending.
              </p>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <Label htmlFor="title">Notification Title</Label>
              <input
                id="title"
                type="text"
                placeholder="e.g., System Maintenance Notice"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* Message */}
            <div className="space-y-1">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Enter your notification message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
              />
            </div>

            {/* Notification Type */}
            <div className="space-y-1">
              <Label>Notification Type</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {NOTIFICATION_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setNotificationType(type.value)}
                    className={`p-2 rounded-lg border text-sm font-medium transition-colors ${
                      notificationType === type.value
                        ? 'bg-green-100 border-green-500 text-green-900 dark:bg-green-900/40 dark:border-green-400 dark:text-green-100'
                        : 'bg-background border-border hover:bg-secondary'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Role */}
            <div className="space-y-1">
              <Label htmlFor="target-role">Send To (Role)</Label>
              <select
                id="target-role"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Location */}
            {locations.length > 0 && (
              <div className="space-y-1">
                <Label htmlFor="target-location">Target Location (Optional)</Label>
                <select
                  id="target-location"
                  value={targetLocation}
                  onChange={(e) => setTargetLocation(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="">All Locations</option>
                  {locations.map((loc) => (
                    <option key={loc.code} value={loc.code}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => { setDialogOpen(false); setEditingNotif(null) }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingNotif ? (
                <><RefreshCw className="mr-2 h-4 w-4" /> Update &amp; Rebroadcast</>
              ) : (
                <><Send className="mr-2 h-4 w-4" /> Send Notification</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
