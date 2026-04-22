"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import {
  Wifi, AlertTriangle, CheckCircle2, Clock, FileText,
  Send, Save, Calendar, Activity, TrendingDown, Users, Bell,
  Paperclip, Upload, X, ImageIcon
} from "lucide-react"

interface WeeklyReport {
  id?: string
  week_start_date: string
  week_end_date: string
  week_number: number
  year: number
  overall_status: string
  uptime_percentage: string
  primary_isp: string
  primary_isp_status: string
  primary_isp_notes: string
  backup_isp: string
  backup_isp_status: string
  backup_isp_notes: string
  downtime_incidents: string
  downtime_total_hours: string
  downtime_details: string
  users_affected: string
  departments_affected: string
  issues_reported: string
  resolutions_taken: string
  escalated_to_head_office: boolean
  escalation_details: string
  avg_download_speed_mbps: string
  avg_upload_speed_mbps: string
  speed_test_tool: string
  planned_maintenance: string
  maintenance_window: string
  additional_notes: string
  attachments: string[]
  status?: string
}

function getMondayOfCurrentWeek(): string {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(today.setDate(diff))
  return monday.toISOString().split("T")[0]
}

function getFridayOfCurrentWeek(): string {
  const monday = new Date(getMondayOfCurrentWeek())
  monday.setDate(monday.getDate() + 4)
  return monday.toISOString().split("T")[0]
}

function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function isFriday(): boolean {
  return new Date().getDay() === 5
}

function daysUntilFriday(): number {
  const today = new Date().getDay()
  if (today === 5) return 0
  return today < 5 ? 5 - today : 7 - today + 5
}

const emptyReport = (): WeeklyReport => ({
  week_start_date: getMondayOfCurrentWeek(),
  week_end_date: getFridayOfCurrentWeek(),
  week_number: getWeekNumber(getMondayOfCurrentWeek()),
  year: new Date().getFullYear(),
  overall_status: "operational",
  uptime_percentage: "",
  primary_isp: "",
  primary_isp_status: "operational",
  primary_isp_notes: "",
  backup_isp: "",
  backup_isp_status: "operational",
  backup_isp_notes: "",
  downtime_incidents: "0",
  downtime_total_hours: "0",
  downtime_details: "",
  users_affected: "0",
  departments_affected: "",
  issues_reported: "",
  resolutions_taken: "",
  escalated_to_head_office: false,
  escalation_details: "",
  avg_download_speed_mbps: "",
  avg_upload_speed_mbps: "",
  speed_test_tool: "",
  planned_maintenance: "",
  maintenance_window: "",
  additional_notes: "",
  attachments: [],
})

const STATUS_OPTIONS = [
  { value: "operational", label: "Fully Operational", color: "bg-green-100 text-green-800" },
  { value: "degraded", label: "Degraded Performance", color: "bg-yellow-100 text-yellow-800" },
  { value: "outage", label: "Partial Outage", color: "bg-orange-100 text-orange-800" },
  { value: "maintenance", label: "Under Maintenance", color: "bg-blue-100 text-blue-800" },
]

export default function WeeklyInternetReportForm() {
  const { user } = useAuth()
  const [form, setForm] = useState<WeeklyReport>(emptyReport())
  const [loading, setLoading] = useState(false)
  const [existingReport, setExistingReport] = useState<WeeklyReport | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(true)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const friday = isFriday()
  const daysLeft = daysUntilFriday()

  const loadExistingReport = useCallback(async () => {
    if (!user?.id) return
    try {
      setLoadingExisting(true)
      const res = await fetch(
        `/api/weekly-internet-reports?userId=${user.id}&role=regional_it_head&limit=1`
      )
      const data = await res.json()
      if (data.reports?.length > 0) {
        const report = data.reports[0]
        // Only pre-fill if it's for the current week
        if (report.week_start_date === getMondayOfCurrentWeek()) {
          setExistingReport(report)
          setForm({
            ...emptyReport(),
            ...report,
            downtime_incidents: String(report.downtime_incidents ?? 0),
            downtime_total_hours: String(report.downtime_total_hours ?? 0),
            users_affected: String(report.users_affected ?? 0),
            uptime_percentage: String(report.uptime_percentage ?? ""),
            avg_download_speed_mbps: String(report.avg_download_speed_mbps ?? ""),
            avg_upload_speed_mbps: String(report.avg_upload_speed_mbps ?? ""),
            departments_affected: (report.departments_affected || []).join(", "),
          })
        }
      }
    } catch (e) {
      console.error("Failed to load existing report", e)
    } finally {
      setLoadingExisting(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadExistingReport()
  }, [loadExistingReport])

  const handleChange = (field: keyof WeeklyReport, value: string | boolean | string[]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadingFiles(true)
    const uploaded: string[] = []
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("folder", "weekly-reports")
        const res = await fetch("/api/upload-attachment", { method: "POST", body: formData })
        const data = await res.json()
        if (res.ok && data.url) {
          uploaded.push(data.url)
        } else {
          toast.error(`Failed to upload ${file.name}: ${data.error || "Unknown error"}`)
        }
      }
      if (uploaded.length > 0) {
        setForm(prev => ({ ...prev, attachments: [...(prev.attachments || []), ...uploaded] }))
        toast.success(`${uploaded.length} file(s) uploaded`)
      }
    } finally {
      setUploadingFiles(false)
    }
  }

  const removeAttachment = (url: string) => {
    setForm(prev => ({ ...prev, attachments: (prev.attachments || []).filter(a => a !== url) }))
  }

  const handleSubmit = async (submitStatus: "draft" | "submitted") => {
    if (!user?.id) return
    setLoading(true)
    try {
      const payload = {
        ...form,
        submitted_by: user.id,
        submitted_by_name: user.full_name || user.email,
        location: user.location || "",
        region: user.region || "",
        downtime_incidents: parseInt(form.downtime_incidents) || 0,
        downtime_total_hours: parseFloat(form.downtime_total_hours) || 0,
        users_affected: parseInt(form.users_affected) || 0,
        uptime_percentage: form.uptime_percentage ? parseFloat(form.uptime_percentage) : null,
        avg_download_speed_mbps: form.avg_download_speed_mbps ? parseFloat(form.avg_download_speed_mbps) : null,
        avg_upload_speed_mbps: form.avg_upload_speed_mbps ? parseFloat(form.avg_upload_speed_mbps) : null,
        departments_affected: form.departments_affected
          ? form.departments_affected.split(",").map(s => s.trim()).filter(Boolean)
          : [],
        status: submitStatus,
      }

      const res = await fetch("/api/weekly-internet-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save report")

      toast.success(
        submitStatus === "submitted"
          ? "Weekly report submitted successfully! Admin and IT Head have been notified."
          : "Draft saved successfully."
      )
      setExistingReport(data.report)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save report")
    } finally {
      setLoading(false)
    }
  }

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Friday Prompt Banner */}
      {friday ? (
        <div className="rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/20 p-4 flex items-start gap-3">
          <Bell className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-orange-800 dark:text-orange-300">
              It&apos;s Friday — Weekly Report Due Today!
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-400 mt-0.5">
              Please complete and submit your weekly internet services report before end of business today.
            </p>
          </div>
        </div>
      ) : daysLeft <= 2 ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 p-4 flex items-start gap-3">
          <Clock className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-yellow-800 dark:text-yellow-300">
              Weekly Report Due in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-0.5">
              Your weekly internet services report is due this Friday. You can save a draft now and submit later.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4 flex items-start gap-3">
          <Calendar className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-blue-800 dark:text-blue-300">
              Weekly Report — Due Every Friday
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-0.5">
              Submit your weekly internet services report each Friday. {daysLeft} day{daysLeft !== 1 ? "s" : ""} until next due date.
            </p>
          </div>
        </div>
      )}

      {/* Existing report status */}
      {existingReport && (
        <div className="rounded-lg border bg-muted/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              Week {existingReport.week_number}/{existingReport.year} report exists
            </span>
            <Badge
              className={
                existingReport.status === "submitted"
                  ? "bg-green-100 text-green-800"
                  : existingReport.status === "acknowledged"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-800"
              }
            >
              {existingReport.status}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {existingReport.status === "submitted" ? "Submitted — editing will update the report" : "Draft — fill in and submit"}
          </span>
        </div>
      )}

      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Weekly Internet Services Report
          </CardTitle>
          <CardDescription>
            Week {form.week_number} / {form.year} &nbsp;·&nbsp;
            {new Date(form.week_start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
            {new Date(form.week_end_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            &nbsp;·&nbsp; {user?.location}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Status */}
          <div className="space-y-2">
            <Label>Overall Internet Service Status *</Label>
            <Select
              value={form.overall_status}
              onValueChange={(v) => handleChange("overall_status", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>
                      {s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Weekly Uptime % (e.g. 98.5)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="e.g. 99.5"
              value={form.uptime_percentage}
              onChange={(e) => handleChange("uptime_percentage", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ISP Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            ISP Provider Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary ISP</Label>
              <Input
                placeholder="e.g. MTN, Vodafone, Surfline"
                value={form.primary_isp}
                onChange={(e) => handleChange("primary_isp", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Primary ISP Status</Label>
              <Select value={form.primary_isp_status} onValueChange={(v) => handleChange("primary_isp_status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Primary ISP Notes</Label>
            <Textarea
              placeholder="Any issues or observations about the primary ISP..."
              value={form.primary_isp_notes}
              onChange={(e) => handleChange("primary_isp_notes", e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Backup ISP (if any)</Label>
              <Input
                placeholder="e.g. Airtel, Glo"
                value={form.backup_isp}
                onChange={(e) => handleChange("backup_isp", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Backup ISP Status</Label>
              <Select value={form.backup_isp_status} onValueChange={(v) => handleChange("backup_isp_status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Backup ISP Notes</Label>
            <Textarea
              placeholder="Any issues or observations about the backup ISP..."
              value={form.backup_isp_notes}
              onChange={(e) => handleChange("backup_isp_notes", e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Downtime / Incidents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-600" />
            Downtime & Incidents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Number of Downtime Incidents</Label>
              <Input
                type="number"
                min="0"
                value={form.downtime_incidents}
                onChange={(e) => handleChange("downtime_incidents", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Total Downtime Hours</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={form.downtime_total_hours}
                onChange={(e) => handleChange("downtime_total_hours", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Users Affected</Label>
              <Input
                type="number"
                min="0"
                value={form.users_affected}
                onChange={(e) => handleChange("users_affected", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Departments Affected (comma-separated)</Label>
            <Input
              placeholder="e.g. Finance, HR, Operations"
              value={form.departments_affected}
              onChange={(e) => handleChange("departments_affected", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Downtime Details</Label>
            <Textarea
              placeholder="Describe what happened, when, and duration of each incident..."
              value={form.downtime_details}
              onChange={(e) => handleChange("downtime_details", e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Issues & Resolutions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            Issues & Resolutions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Issues Reported This Week</Label>
            <Textarea
              placeholder="List all internet-related issues reported by users or observed by IT staff..."
              value={form.issues_reported}
              onChange={(e) => handleChange("issues_reported", e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Resolutions / Actions Taken</Label>
            <Textarea
              placeholder="Describe what was done to resolve each issue..."
              value={form.resolutions_taken}
              onChange={(e) => handleChange("resolutions_taken", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="escalated"
                checked={form.escalated_to_head_office}
                onChange={(e) => handleChange("escalated_to_head_office", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="escalated" className="cursor-pointer">
                Escalated to Head Office
              </Label>
            </div>
            {form.escalated_to_head_office && (
              <Textarea
                placeholder="Describe what was escalated and to whom..."
                value={form.escalation_details}
                onChange={(e) => handleChange("escalation_details", e.target.value)}
                rows={2}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Speed / Quality */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Speed & Quality Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Avg Download Speed (Mbps)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g. 50.5"
                value={form.avg_download_speed_mbps}
                onChange={(e) => handleChange("avg_download_speed_mbps", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Avg Upload Speed (Mbps)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g. 20.0"
                value={form.avg_upload_speed_mbps}
                onChange={(e) => handleChange("avg_upload_speed_mbps", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Speed Test Tool Used</Label>
              <Input
                placeholder="e.g. Speedtest.net, Fast.com"
                value={form.speed_test_tool}
                onChange={(e) => handleChange("speed_test_tool", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attachments / File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-indigo-600" />
            Attachments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <Textarea
              placeholder="Any other relevant information..."
              value={form.additional_notes}
              onChange={(e) => handleChange("additional_notes", e.target.value)}
              rows={3}
            />
          </div>
          {/* Upload area */}
          <div
            className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files) }}
            onClick={() => document.getElementById("attachment-input")?.click()}
          >
            <input
              id="attachment-input"
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            {uploadingFiles ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8 animate-bounce" />
                <span className="text-sm">Uploading...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
                <span className="text-sm font-medium">Click or drag files here to upload</span>
                <span className="text-xs">Images, PDF, Word, Excel — max 10 MB each</span>
              </div>
            )}
          </div>
          {/* Uploaded file list */}
          {(form.attachments || []).length > 0 && (
            <div className="space-y-2">
              {(form.attachments || []).map((url) => {
                const fileName = url.split("/").pop()?.replace(/^\d+_/, "") || url
                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)
                return (
                  <div key={url} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                    {isImage ? (
                      <img src={url} alt={fileName} className="h-10 w-10 object-cover rounded" />
                    ) : (
                      <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                    )}
                    <a href={url} target="_blank" rel="noreferrer" className="flex-1 text-sm truncate text-primary hover:underline">
                      {fileName}
                    </a>
                    <button type="button" onClick={() => removeAttachment(url)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pb-8">
        <Button
          variant="outline"
          onClick={() => handleSubmit("draft")}
          disabled={loading}
          className="flex-1"
        >
          <Save className="h-4 w-4 mr-2" />
          Save as Draft
        </Button>
        <Button
          onClick={() => handleSubmit("submitted")}
          disabled={loading}
          className="flex-1 bg-primary"
        >
          <Send className="h-4 w-4 mr-2" />
          {loading ? "Submitting..." : "Submit Weekly Report"}
        </Button>
      </div>
    </div>
  )
}
