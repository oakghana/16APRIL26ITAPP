"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, PlayCircle, Send, Shield } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { formatDisplayDateTime } from "@/lib/utils"
import { isITDDepartment } from "@/lib/department-options"

type PasswordResetRequest = {
  id: string
  request_number: string
  staff_name: string
  requester_location?: string | null
  system_name: string
  other_system_name?: string | null
  account_identifier: string
  issue_summary: string
  urgency: "low" | "medium" | "high" | "critical"
  status: "assigned" | "in_progress" | "awaiting_user_confirmation" | "completed" | "reopened" | "pending_manager" | "rejected"
  assigned_to?: string | null
  assigned_to_id?: string | null
  work_notes?: string | null
  updated_at: string
  created_at: string
}

export function PasswordResetWorkQueue() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [requests, setRequests] = useState<PasswordResetRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<"manager" | "active" | "waiting" | "history">("active")
  const [selected, setSelected] = useState<PasswordResetRequest | null>(null)
  const [notes, setNotes] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [action, setAction] = useState<"start" | "submit">("start")

  const canUse = useMemo(() => {
    const role = user?.role || ""
    const isITDeptHead = role === "department_head" && isITDDepartment(user?.department)
    return ["admin", "it_head", "it_staff", "regional_it_head"].includes(role) || isITDeptHead
  }, [user?.role, user?.department])

  const canManageQueue = useMemo(() => {
    const role = user?.role || ""
    const isITDeptHead = role === "department_head" && isITDDepartment(user?.department)
    return ["admin", "it_head"].includes(role) || isITDeptHead
  }, [user?.role, user?.department])

  const loadRequests = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        viewerId: user.id,
        status: "all",
      })

      if (user.role === "it_staff" || user.role === "regional_it_head") {
        params.set("assigneeId", user.id)
      }

      const response = await fetch(`/api/it-forms/password-reset?${params.toString()}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to load password reset work queue")
      setRequests(data.requests || [])
    } catch (error: any) {
      toast({
        title: "Load failed",
        description: error.message || "Could not load password reset queue",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [user?.id, user?.role])

  useEffect(() => {
    if (canManageQueue) {
      setTab("manager")
    }
  }, [canManageQueue])

  const filtered = requests.filter((row) => {
    const normalized = search.toLowerCase().trim()
    if (!normalized) return true
    return (
      row.request_number.toLowerCase().includes(normalized) ||
      row.staff_name.toLowerCase().includes(normalized) ||
      row.system_name.toLowerCase().includes(normalized) ||
      row.account_identifier.toLowerCase().includes(normalized)
    )
  })

  const managerRows = filtered.filter((r) => ["pending_manager", "reopened"].includes(r.status))
  const activeRows = filtered.filter((r) => ["assigned", "in_progress"].includes(r.status))
  const waitingRows = filtered.filter((r) => r.status === "awaiting_user_confirmation")
  const historyRows = filtered.filter((r) => ["completed", "rejected"].includes(r.status))

  const rows = tab === "manager" ? managerRows : tab === "active" ? activeRows : tab === "waiting" ? waitingRows : historyRows

  const openAction = (row: PasswordResetRequest, nextAction: "start" | "submit") => {
    setSelected(row)
    setAction(nextAction)
    setNotes("")
    setDialogOpen(true)
  }

  const submitAction = async () => {
    if (!selected || !user?.id) return
    if (action === "submit" && !notes.trim()) {
      toast({ title: "Work notes required", description: "Please provide reset completion notes.", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        requestId: selected.id,
        action: action === "start" ? "assignee_start" : "assignee_submit",
        actorId: user.id,
        actorName: user.full_name || user.email || "IT Staff",
        actorRole: user.role,
        actorDepartment: user.department,
        actorLocation: user.location,
        notes: action === "submit" ? notes : undefined,
      }

      const response = await fetch("/api/it-forms/password-reset", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to update request")

      toast({
        title: action === "start" ? "Work started" : "Submitted for requester confirmation",
        description: action === "start"
          ? `${selected.request_number} moved to In Progress.`
          : `${selected.request_number} is now awaiting requester confirmation.`,
      })

      setDialogOpen(false)
      setSelected(null)
      setNotes("")
      loadRequests()
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message || "Unable to update request", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  if (!canUse) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Password Reset Work Queue</CardTitle>
          <CardDescription>This section is available to IT teams only.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-600" />
            Password Reset Work Queue
          </CardTitle>
          <CardDescription>
            Process password reset jobs assigned by IT manager and submit completed work for requester confirmation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by request number, requester, system, or account"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-lg"
            />
            <Button variant="outline" size="sm" onClick={loadRequests}>Refresh</Button>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              {canManageQueue && <TabsTrigger value="manager">Manager Queue ({managerRows.length})</TabsTrigger>}
              <TabsTrigger value="active">Active ({activeRows.length})</TabsTrigger>
              <TabsTrigger value="waiting">Awaiting User ({waitingRows.length})</TabsTrigger>
              <TabsTrigger value="history">History ({historyRows.length})</TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-4 space-y-3">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
              ) : rows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  No requests found
                </div>
              ) : (
                rows.map((row) => (
                  <div key={row.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{row.request_number}</span>
                        <Badge variant="outline">{row.system_name === "Other" ? row.other_system_name || "Other" : row.system_name}</Badge>
                        <Badge variant={row.status === "completed" ? "secondary" : row.status === "awaiting_user_confirmation" ? "default" : "outline"}>{row.status.replace(/_/g, " ")}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">Updated {formatDisplayDateTime(row.updated_at)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Requester: {row.staff_name} • Account: {row.account_identifier}</p>
                    <p className="text-sm">{row.issue_summary}</p>

                    <div className="flex gap-2 flex-wrap">
                      {tab === "manager" && (
                        <Button size="sm" variant="outline" disabled>
                          Awaiting IT Manager Assignment
                        </Button>
                      )}
                      {(row.status === "assigned" || row.status === "reopened") && (
                        <Button size="sm" onClick={() => openAction(row, "start")}>
                          <PlayCircle className="h-4 w-4 mr-1" /> Start Work
                        </Button>
                      )}
                      {(row.status === "in_progress" || row.status === "assigned" || row.status === "reopened") && (
                        <Button size="sm" variant="default" onClick={() => openAction(row, "submit")}>
                          <Send className="h-4 w-4 mr-1" /> Submit For Confirmation
                        </Button>
                      )}
                      {row.status === "awaiting_user_confirmation" && (
                        <Button size="sm" variant="secondary" disabled>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Waiting for requester
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action === "start" ? "Start Password Reset Work" : "Submit Completion"}</DialogTitle>
            <DialogDescription>{selected?.request_number}</DialogDescription>
          </DialogHeader>

          {action === "submit" && (
            <div className="space-y-2">
              <Label>Work Notes *</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Summarize changes made and where the user should sign in"
                className="min-h-24"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitAction} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {action === "start" ? "Start" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
