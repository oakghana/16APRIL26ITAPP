"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import {
  Wifi, TrendingDown, TrendingUp, CheckCircle2, AlertTriangle,
  Clock, ChevronDown, ChevronUp, Eye, ThumbsUp, Filter, Trash2
} from "lucide-react"

interface WeeklyReport {
  id: string
  week_start_date: string
  week_end_date: string
  week_number: number
  year: number
  submitted_by: string
  submitted_by_name: string
  location: string
  region: string
  overall_status: string
  uptime_percentage: number | null
  primary_isp: string
  primary_isp_status: string
  backup_isp: string
  backup_isp_status: string
  downtime_incidents: number
  downtime_total_hours: number
  users_affected: number
  departments_affected: string[]
  issues_reported: string
  resolutions_taken: string
  escalated_to_head_office: boolean
  avg_download_speed_mbps: number | null
  avg_upload_speed_mbps: number | null
  status: string
  submitted_at: string | null
  acknowledged_by_name: string | null
  acknowledged_at: string | null
  acknowledgement_notes: string | null
  planned_maintenance: string
  additional_notes: string
}

const STATUS_BADGE: Record<string, string> = {
  operational: "bg-green-100 text-green-800 border-green-200",
  degraded: "bg-yellow-100 text-yellow-800 border-yellow-200",
  outage: "bg-red-100 text-red-800 border-red-200",
  maintenance: "bg-blue-100 text-blue-800 border-blue-200",
}

const REPORT_STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-green-100 text-green-800",
  acknowledged: "bg-blue-100 text-blue-800",
}

function StatusIcon({ status }: { status: string }) {
  if (status === "operational") return <CheckCircle2 className="h-4 w-4 text-green-600" />
  if (status === "degraded") return <TrendingDown className="h-4 w-4 text-yellow-600" />
  if (status === "outage") return <AlertTriangle className="h-4 w-4 text-red-600" />
  return <Clock className="h-4 w-4 text-blue-600" />
}

export default function WeeklyReportsAdminView() {
  const { user } = useAuth()
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [acknowledgeId, setAcknowledgeId] = useState<string | null>(null)
  const [ackNotes, setAckNotes] = useState("")
  const [ackLoading, setAckLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString())
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterLocation, setFilterLocation] = useState("all")

  const loadReports = useCallback(async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      const params = new URLSearchParams({
        userId: user.id,
        role: user.role,
        year: filterYear,
        limit: "100",
      })
      if (filterStatus !== "all") params.set("status", filterStatus)
      const res = await fetch(`/api/weekly-internet-reports?${params}`)
      const data = await res.json()
      if (data.reports) setReports(data.reports)
    } catch (e) {
      toast.error("Failed to load reports")
    } finally {
      setLoading(false)
    }
  }, [user?.id, user?.role, filterYear, filterStatus])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const handleAcknowledge = async () => {
    if (!acknowledgeId || !user?.id) return
    setAckLoading(true)
    try {
      const res = await fetch("/api/weekly-internet-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: acknowledgeId,
          acknowledged_by: user.id,
          acknowledged_by_name: user.full_name || user.email,
          acknowledgement_notes: ackNotes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Report acknowledged successfully")
      setAcknowledgeId(null)
      setAckNotes("")
      loadReports()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to acknowledge report")
    } finally {
      setAckLoading(false)
    }
  }

  const handleDeleteReport = async () => {
    if (!deleteId || !user?.id) return

    setDeleteLoading(true)
    try {
      const params = new URLSearchParams({
        id: deleteId,
        requestedBy: user.id,
        requestedByRole: user.role,
      })

      const res = await fetch(`/api/weekly-internet-reports?${params.toString()}`, {
        method: "DELETE",
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Failed to delete report")

      toast.success("Weekly report deleted")
      if (expandedId === deleteId) {
        setExpandedId(null)
      }
      setDeleteId(null)
      loadReports()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete report")
    } finally {
      setDeleteLoading(false)
    }
  }

  // Unique locations for filter
  const locations = Array.from(new Set(reports.map(r => r.location).filter(Boolean)))

  const filteredReports = filterLocation === "all"
    ? reports
    : reports.filter(r => r.location === filterLocation)

  const stats = {
    total: filteredReports.length,
    submitted: filteredReports.filter(r => r.status === "submitted" || r.status === "acknowledged").length,
    acknowledged: filteredReports.filter(r => r.status === "acknowledged").length,
    escalated: filteredReports.filter(r => r.escalated_to_head_office).length,
    avgUptime: filteredReports.filter(r => r.uptime_percentage != null).length > 0
      ? (filteredReports.reduce((s, r) => s + (r.uptime_percentage ?? 0), 0) / filteredReports.filter(r => r.uptime_percentage != null).length).toFixed(1)
      : "N/A",
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Reports</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-600">{stats.submitted}</div>
            <div className="text-xs text-muted-foreground mt-1">Submitted</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-blue-600">{stats.acknowledged}</div>
            <div className="text-xs text-muted-foreground mt-1">Acknowledged</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{stats.avgUptime}{stats.avgUptime !== "N/A" ? "%" : ""}</div>
            <div className="text-xs text-muted-foreground mt-1">Avg Uptime</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Year</Label>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-24 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2025, 2026, 2027].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {locations.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Location</Label>
            <Select value={filterLocation} onValueChange={setFilterLocation}>
              <SelectTrigger className="w-40 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map(l => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={loadReports} className="h-8">
          <Filter className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading reports...</div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No weekly internet reports found for the selected filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <Card key={report.id} className="overflow-hidden">
              {/* Report header row */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusIcon status={report.overall_status} />
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">
                      {report.submitted_by_name}
                      {report.location && (
                        <span className="text-muted-foreground font-normal"> · {report.location}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Week {report.week_number} / {report.year}
                      {report.submitted_at && (
                        <> · Submitted {new Date(report.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {report.escalated_to_head_office && (
                    <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Escalated</Badge>
                  )}
                  <Badge className={`text-xs ${STATUS_BADGE[report.overall_status] || "bg-gray-100 text-gray-700"}`}>
                    {report.overall_status}
                  </Badge>
                  <Badge className={`text-xs ${REPORT_STATUS_BADGE[report.status] || "bg-gray-100 text-gray-700"}`}>
                    {report.status}
                  </Badge>
                  {report.uptime_percentage != null && (
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {report.uptime_percentage}% uptime
                    </span>
                  )}
                  {expandedId === report.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === report.id && (
                <div className="border-t p-4 space-y-4 bg-muted/10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">ISP Details</div>
                      <div>{report.primary_isp || "N/A"} ({report.primary_isp_status})</div>
                      {report.backup_isp && <div className="text-muted-foreground text-xs">Backup: {report.backup_isp} ({report.backup_isp_status})</div>}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Downtime</div>
                      <div>{report.downtime_incidents} incident{report.downtime_incidents !== 1 ? "s" : ""}, {report.downtime_total_hours}h total</div>
                      <div className="text-xs text-muted-foreground">{report.users_affected} users affected</div>
                    </div>
                    {(report.avg_download_speed_mbps != null || report.avg_upload_speed_mbps != null) && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Speed</div>
                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-3 w-3 text-blue-500" />
                          <span>{report.avg_download_speed_mbps ?? "?"} Mbps down</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-3 w-3 text-green-500" />
                          <span>{report.avg_upload_speed_mbps ?? "?"} Mbps up</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {report.departments_affected?.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Departments Affected</div>
                      <div className="flex flex-wrap gap-1">
                        {report.departments_affected.map((d) => (
                          <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {report.issues_reported && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Issues Reported</div>
                      <p className="text-sm whitespace-pre-line">{report.issues_reported}</p>
                    </div>
                  )}
                  {report.resolutions_taken && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Resolutions</div>
                      <p className="text-sm whitespace-pre-line">{report.resolutions_taken}</p>
                    </div>
                  )}
                  {report.planned_maintenance && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Planned Maintenance</div>
                      <p className="text-sm">{report.planned_maintenance}</p>
                    </div>
                  )}
                  {report.acknowledged_at && (
                    <div className="text-xs text-muted-foreground border-t pt-3">
                      Acknowledged by {report.acknowledged_by_name} on{" "}
                      {new Date(report.acknowledged_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      {report.acknowledgement_notes && ` — "${report.acknowledgement_notes}"`}
                    </div>
                  )}

                  {/* Acknowledge button */}
                  {report.status === "submitted" && (user?.role === "admin" || user?.role === "it_head") && (
                    <div className="pt-2">
                      <Dialog open={acknowledgeId === report.id} onOpenChange={(open) => {
                        if (!open) { setAcknowledgeId(null); setAckNotes("") }
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => setAcknowledgeId(report.id)}
                          >
                            <ThumbsUp className="h-4 w-4 mr-1.5" />
                            Acknowledge Report
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Acknowledge Weekly Report</DialogTitle>
                            <DialogDescription>
                              Acknowledging {report.submitted_by_name}&apos;s report for week {report.week_number}/{report.year}.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3 py-2">
                            <Label>Notes (optional)</Label>
                            <Textarea
                              placeholder="Any feedback or notes for the submitter..."
                              value={ackNotes}
                              onChange={(e) => setAckNotes(e.target.value)}
                              rows={3}
                            />
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => { setAcknowledgeId(null); setAckNotes("") }}>
                              Cancel
                            </Button>
                            <Button onClick={handleAcknowledge} disabled={ackLoading}>
                              {ackLoading ? "Acknowledging..." : "Acknowledge"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}

                  {user?.role === "admin" && (
                    <div className="pt-2">
                      <Dialog open={deleteId === report.id} onOpenChange={(open) => {
                        if (!open) {
                          setDeleteId(null)
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteId(report.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1.5" />
                            Delete Report
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Delete Weekly Report</DialogTitle>
                            <DialogDescription>
                              This will permanently remove {report.submitted_by_name}&apos;s report for week {report.week_number}/{report.year}.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            Use this only for irrelevant or incorrect reports. This action cannot be undone.
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteId(null)}>
                              Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleDeleteReport} disabled={deleteLoading}>
                              {deleteLoading ? "Deleting..." : "Delete Report"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
