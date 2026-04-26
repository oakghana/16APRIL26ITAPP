"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth-context"
import { formatDisplayDateTime } from "@/lib/utils"
import { RefreshCw, Search } from "lucide-react"

type RequestItem = {
  id: string
  formType: string
  requestNumber: string
  summary: string
  status: string
  createdAt: string
  assignedTo?: string
}

type ApiResponse = {
  success: boolean
  requests: RequestItem[]
}

function normalizeStatus(status?: string | null) {
  return (status || "").trim().toLowerCase()
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const s = normalizeStatus(status)
  if (s.includes("reject") || s === "not_recommended") return "destructive"
  if (s === "completed" || s === "issued" || s === "resolved" || s === "confirmed_working") return "default"
  if (s.includes("pending") || s === "draft" || s === "assigned" || s === "in_progress" || s === "awaiting_user_confirmation") {
    return "secondary"
  }
  return "outline"
}

function toLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function getCurrentOwner(status: string, formType: string, assignedTo?: string) {
  const s = normalizeStatus(status)

  if (s === "draft") return "You (Submit Request)"
  if (s === "rejected" || s === "not_recommended") return "Closed"
  if (s === "completed" || s === "issued" || s === "resolved" || s === "confirmed_working") return "Completed"
  if (s === "awaiting_user_confirmation") return "You (Confirm Completion)"
  if (s === "assigned" || s === "in_progress") return assignedTo || "Assigned IT Staff"

  if (s === "pending_dept_head" || s === "pending_department_head" || s === "pending_hod" || s === "pending") {
    return "Department Head"
  }

  if (s === "pending_service_desk" || s === "pending_it_office_use") {
    return "IT Service Desk"
  }

  if (s === "pending_it_head" || s === "pending_manager") {
    return formType === "password-reset" || formType === "account-unlock" || formType === "software-access"
      ? "IT Manager"
      : "IT Head"
  }

  if (s === "pending_admin") return "Admin"
  if (s === "pending_store") return "Store Team"

  return "In Review"
}

export function MyITFormsRequests() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [requests, setRequests] = useState<RequestItem[]>([])

  const loadRequests = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        userId: user.id,
        userName: user.full_name || user.name || "",
        userEmail: user.email || "",
      })
      const response = await fetch(`/api/it-forms/my-all-requests?${params.toString()}`)
      const data: ApiResponse = response.ok ? await response.json() : { success: false, requests: [] }
      setRequests(data.requests || [])
    } catch {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [user?.id])

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return requests
    return requests.filter((item) => {
      return (
        item.requestNumber.toLowerCase().includes(q) ||
        item.formType.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q)
      )
    })
  }, [requests, search])

  const total = filteredRequests.length
  const pending = filteredRequests.filter((r) => {
    const s = normalizeStatus(r.status)
    return !(s === "completed" || s === "issued" || s === "resolved" || s === "confirmed_working" || s.includes("reject") || s === "not_recommended")
  }).length
  const completed = filteredRequests.filter((r) => {
    const s = normalizeStatus(r.status)
    return s === "completed" || s === "issued" || s === "resolved" || s === "confirmed_working"
  }).length

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-stone-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">My IT Form Requests</h1>
            <p className="text-sm text-muted-foreground">Track all your IT forms and see who currently needs to act on each request.</p>
          </div>
          <Button variant="outline" onClick={loadRequests} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">In Progress</p>
            <p className="text-2xl font-semibold">{pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-2xl font-semibold">{completed}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request Tracker</CardTitle>
          <CardDescription>Search by request number, form type, status, or details.</CardDescription>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search requests"
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading your requests...</p>
          ) : filteredRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No IT form requests found for your account.</p>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((item) => (
                <div key={`${item.formType}-${item.id}`} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{item.requestNumber}</p>
                      <p className="text-xs text-muted-foreground">{toLabel(item.formType)}</p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(item.status)}>{toLabel(item.status)}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{item.summary || "No details provided"}</p>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>Created: {formatDisplayDateTime(item.createdAt)}</p>
                    <p>Current Owner: {getCurrentOwner(item.status, item.formType, item.assignedTo)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
