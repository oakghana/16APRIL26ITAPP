"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { downloadCSV, exportToPDF } from "@/lib/export-utils"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts"
import {
  Download,
  Clock,
  DollarSign,
  Wrench,
  CheckCircle,
  AlertTriangle,
  Building2,
  BarChart3,
  Filter,
  RefreshCw,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import { canSeeAllLocations } from "@/lib/location-filter"
import { generateRepairReportPDF } from "@/lib/it-report-pdf"

interface RepairReport {
  period: string
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  overdueTasks: number
  totalCost: number
  avgRepairTime: number
  serviceProviderPerformance: {
    name: string
    tasksCompleted: number
    avgRepairTime: number
    totalCost: number
    rating: number
  }[]
  deviceTypes: {
    type: string
    count: number
    cost: number
    avgRepairTime: number
  }[]
  priorityBreakdown: {
    priority: string
    count: number
    avgResolutionTime: number
  }[]
  monthlyTrends: {
    month: string
    tasks: number
    cost: number
    completionRate: number
  }[]
  topIssues: {
    issue: string
    frequency: number
    avgCost: number
  }[]
}

interface ServiceProviderStats {
  id: string
  name: string
  company: string
  tasksAssigned: number
  tasksCompleted: number
  avgRepairTime: number
  totalCost: number
  completionRate: number
  rating: number
  onTimeDelivery: number
  recentTasks: {
    taskNumber: string
    deviceType: string
    status: string
    cost: number
    completedDate?: string
  }[]
}

export function ITHeadRepairReports() {
  const { user } = useAuth()
  const supabase = createClient()
  const [reportPeriod, setReportPeriod] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly")
  const [selectedProvider, setSelectedProvider] = useState<string>("all")
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  })
  const [currentReport, setCurrentReport] = useState<RepairReport>({
    period: "",
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    overdueTasks: 0,
    totalCost: 0,
    avgRepairTime: 0,
    serviceProviderPerformance: [],
    deviceTypes: [],
    priorityBreakdown: [],
    monthlyTrends: [],
    topIssues: [],
  })
  const [providerStats, setProviderStats] = useState<ServiceProviderStats[]>([])
  const [loading, setLoading] = useState(false)
  const [reports, setReports] = useState<any[]>([]) // Declare the reports variable
  const [activeReportTab, setActiveReportTab] = useState<
    "overview" | "trends" | "providers" | "devices" | "issues" | "summary"
  >("overview")

  useEffect(() => {
    generateReports()
  }, [reportPeriod, dateRange, selectedProvider, user])

  const generateReports = async () => {
    if (!user) return

    setLoading(true)
    console.log("[v0] Generating repair reports from database...")

    try {
      let query = supabase
        .from("repair_requests")
        .select("*")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end)

      if (!canSeeAllLocations(user) && user.location) {
        query = query.ilike("location", user.location)
      }

      const { data: repairs, error } = await query

      if (error) {
        console.error("[v0] Error loading repairs:", error)
        setLoading(false)
        return
      }

      console.log("[v0] Loaded repairs for report:", repairs?.length || 0)

      const totalTasks = repairs?.length || 0
      const completedTasks = repairs?.filter((r) => r.status === "completed").length || 0
      const inProgressTasks =
        repairs?.filter((r) => ["approved", "in_transit", "with_provider"].includes(r.status)).length || 0
      const overdueTasks =
        repairs?.filter((r) => {
          if (r.estimated_completion && r.status !== "completed") {
            return new Date(r.estimated_completion) < new Date()
          }
          return false
        }).length || 0

      const totalCost = repairs?.reduce((sum, r) => sum + (r.cost || 0), 0) || 0

      // Calculate average repair time for completed tasks
      const completedRepairs =
        repairs?.filter((r) => r.status === "completed" && r.approved_date && r.estimated_completion) || []
      const avgRepairTime =
        completedRepairs.length > 0
          ? completedRepairs.reduce((sum, r) => {
              const days =
                Math.abs(new Date(r.estimated_completion!).getTime() - new Date(r.approved_date!).getTime()) /
                (1000 * 60 * 60 * 24)
              return sum + days
            }, 0) / completedRepairs.length
          : 0

      setCurrentReport({
        period: `${new Date(dateRange.start).toLocaleDateString()} - ${new Date(dateRange.end).toLocaleDateString()}`,
        totalTasks,
        completedTasks,
        inProgressTasks,
        overdueTasks,
        totalCost,
        avgRepairTime,
        serviceProviderPerformance: [],
        deviceTypes: [],
        priorityBreakdown: [],
        monthlyTrends: [],
        topIssues: [],
      })

      // Fetch service providers from profiles table (users with service_provider role)
      const { data: providers, error: providerError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, location")
        .eq("role", "service_provider")
        .eq("status", "approved")

      if (!providerError && providers) {
        setProviderStats(
          providers.map((p) => ({
            ...p,
            recentTasks: [],
          })),
        )
      }

      setReports(repairs) // Set the reports variable
    } catch (error) {
      console.error("[v0] Error generating reports:", error)
    } finally {
      setLoading(false)
    }
  }

  const COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#f97316", "#06b6d4"]

  const exportReport = async () => {
    setLoading(true)
    try {
      await generateRepairReportPDF({
        dateRange,
        generatedBy: user?.name || user?.full_name || "Unknown",
        period: currentReport.period,
        totalTasks: currentReport.totalTasks,
        completedTasks: currentReport.completedTasks,
        inProgressTasks: currentReport.inProgressTasks,
        overdueTasks: currentReport.overdueTasks,
        totalCost: currentReport.totalCost,
        avgRepairTime: currentReport.avgRepairTime,
        repairs: reports,
      })
    } catch (err) {
      console.error("PDF generation failed:", err)
    } finally {
      setLoading(false)
    }
  }

  const formatDateValue = (value?: string) => {
    if (!value) return "-"
    try {
      return new Date(value).toLocaleDateString()
    } catch {
      return value
    }
  }

  const summaryHeaders = [
    "Task Number",
    "Device",
    "Problem / Diagnosis",
    "Report Date",
    "Status",
    "Work Done / Notes",
  ]

  const summaryRows = reports.map((repair) => {
    const deviceName =
      repair.device_name ||
      repair.device?.device_name ||
      repair.device?.assetTag ||
      repair.device?.serialNumber ||
      repair.device?.type ||
      repair.device?.brand ||
      "Unknown"

    const issue = repair.issue_description || repair.description || "-"
    const notes = repair.repair_notes || repair.notes || repair.service_provider_notes || "-"

    return [
      repair.task_number || repair.taskNumber || repair.id || "-",
      deviceName,
      issue,
      formatDateValue(repair.created_at || repair.createdAt),
      repair.status || "-",
      notes,
    ]
  })

  const exportSummaryPDF = async () => {
    if (reports.length === 0) return
    setLoading(true)
    try {
      await exportToPDF({
        title: "Repair Summary Report",
        fileName: "repair-summary-report",
        headers: summaryHeaders,
        rows: summaryRows,
      })
    } catch (error) {
      console.error("Failed to export repair summary PDF:", error)
    } finally {
      setLoading(false)
    }
  }

  const exportSummaryExcel = () => {
    if (reports.length === 0) return
    downloadCSV({
      title: "Repair Summary Report",
      fileName: "repair-summary-report",
      headers: summaryHeaders,
      rows: summaryRows,
    })
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-4 -right-4 w-40 h-40 rounded-full bg-white" />
          <div className="absolute bottom-2 left-10 w-24 h-24 rounded-full bg-indigo-300" />
        </div>
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg">
              <BarChart3 className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Repair Analytics & Reports</h1>
              <p className="text-blue-100 text-sm mt-0.5">
                Quality Control Company Limited — Repair & Maintenance Division
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className="bg-white/20 text-white border-white/30 text-xs">
                  <Wrench className="h-3 w-3 mr-1" />
                  Live Data
                </Badge>
                <Badge className="bg-indigo-400/30 text-indigo-100 border-indigo-400/40 text-xs">
                  {currentReport.period || "Current Period"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={generateReports}
              disabled={loading}
              className="bg-white/10 text-white border-white/30 hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={exportReport}
              disabled={loading}
              className="bg-white text-blue-800 hover:bg-blue-50 font-semibold shadow-md"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {loading ? "Generating PDF..." : "Download PDF Report"}
            </Button>
          </div>
        </div>
      </div>

      {/* Report Configuration */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-blue-600" />
            Report Configuration
          </CardTitle>
          <CardDescription>Adjust filters to focus the report scope</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">Report Period</Label>
              <Select value={reportPeriod} onValueChange={(value) => setReportPeriod(value as any)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">Service Provider</Label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  {providerStats.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                className="h-9"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">End Date</Label>
              <Input
                id="endDate"
                type="date"
                className="h-9"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Total Tasks</p>
                <p className="text-3xl font-bold text-blue-600">{currentReport.totalTasks}</p>
                <p className="text-xs text-muted-foreground mt-1">{currentReport.period || "Current period"}</p>
              </div>
              <div className="p-2 rounded-lg bg-gray-100"><Wrench className="h-5 w-5 text-blue-600" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Completed</p>
                <p className="text-3xl font-bold text-green-600">{currentReport.completedTasks}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentReport.totalTasks > 0
                    ? `${((currentReport.completedTasks / currentReport.totalTasks) * 100).toFixed(1)}% rate`
                    : "0% rate"}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-gray-100"><CheckCircle className="h-5 w-5 text-green-600" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">In Progress</p>
                <p className="text-3xl font-bold text-orange-600">{currentReport.inProgressTasks}</p>
                <p className="text-xs text-muted-foreground mt-1">Active repairs</p>
              </div>
              <div className="p-2 rounded-lg bg-gray-100"><Clock className="h-5 w-5 text-orange-600" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Overdue</p>
                <p className="text-3xl font-bold text-red-600">{currentReport.overdueTasks}</p>
                <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
              </div>
              <div className="p-2 rounded-lg bg-gray-100"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Total Cost</p>
                <p className="text-2xl font-bold text-purple-600">
                  GHS {currentReport.totalCost.toLocaleString("en-GH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Avg: GHS {currentReport.totalTasks > 0 ? (currentReport.totalCost / currentReport.totalTasks).toFixed(0) : "0"}/task
                </p>
              </div>
              <div className="p-2 rounded-lg bg-gray-100"><DollarSign className="h-5 w-5 text-purple-600" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-teal-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Avg Repair Time</p>
                <p className="text-3xl font-bold text-teal-600">{currentReport.avgRepairTime.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground mt-1">days per repair</p>
              </div>
              <div className="p-2 rounded-lg bg-gray-100"><BarChart3 className="h-5 w-5 text-teal-600" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics */}
      <Tabs value={activeReportTab} onValueChange={setActiveReportTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="providers">Service Providers</TabsTrigger>
          <TabsTrigger value="devices">Device Analysis</TabsTrigger>
          <TabsTrigger value="issues">Issue Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Task Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Completed", value: currentReport.completedTasks, color: "#10b981" },
                        { name: "In Progress", value: currentReport.inProgressTasks, color: "#f59e0b" },
                        { name: "Overdue", value: currentReport.overdueTasks, color: "#ef4444" },
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                    >
                      {[
                        { name: "Completed", value: currentReport.completedTasks, color: "#10b981" },
                        { name: "In Progress", value: currentReport.inProgressTasks, color: "#f59e0b" },
                        { name: "Overdue", value: currentReport.overdueTasks, color: "#ef4444" },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Priority Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={currentReport.priorityBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="priority" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Service Provider Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={currentReport.serviceProviderPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="tasks" orientation="left" />
                  <YAxis yAxisId="cost" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="tasks" dataKey="tasksCompleted" fill="#3b82f6" name="Tasks Completed" />
                  <Bar yAxisId="cost" dataKey="totalCost" fill="#10b981" name="Total Cost (GHS)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Repair Summary</CardTitle>
                <CardDescription>Full task list with device, issue, report date, status, and repair notes.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportSummaryExcel}
                  disabled={reports.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
                <Button
                  size="sm"
                  onClick={exportSummaryPDF}
                  disabled={reports.length === 0 || loading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <p className="text-sm text-muted-foreground">No repair summary rows available for the selected filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-full border border-slate-200">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Problem</TableHead>
                        <TableHead>Reported</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Work Done / Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.map((repair, index) => (
                        <TableRow key={repair.id || repair.task_number || index}>
                          <TableCell className="font-medium">
                            {repair.task_number || repair.taskNumber || repair.id || "-"}
                          </TableCell>
                          <TableCell>
                            {repair.device_name || repair.device?.device_name || repair.device?.assetTag || repair.device?.serialNumber || repair.device?.type || "-"}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm">
                            {repair.issue_description || repair.description || "-"}
                          </TableCell>
                          <TableCell>{formatDateValue(repair.created_at || repair.createdAt)}</TableCell>
                          <TableCell>{repair.status || "-"}</TableCell>
                          <TableCell className="max-w-xs truncate text-sm">
                            {repair.repair_notes || repair.notes || repair.service_provider_notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          {reportPeriod === "monthly" || reportPeriod === "yearly" ? (
            <Card>
              <CardHeader>
                <CardTitle>Monthly Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={currentReport.monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="tasks" orientation="left" />
                    <YAxis yAxisId="cost" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="tasks" type="monotone" dataKey="tasks" stroke="#3b82f6" name="Tasks" />
                    <Line yAxisId="cost" type="monotone" dataKey="cost" stroke="#10b981" name="Cost (GHS)" />
                    <Line
                      yAxisId="tasks"
                      type="monotone"
                      dataKey="completionRate"
                      stroke="#f59e0b"
                      name="Completion Rate %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Historical Data</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={reports}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="created_at" /> {/* Use 'created_at' as dataKey */}
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="status" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Status" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Average Repair Time Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={reports}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="created_at" /> {/* Use 'created_at' as dataKey */}
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="avgRepairTime" stroke="#8b5cf6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={reports}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="created_at" /> {/* Use 'created_at' as dataKey */}
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="cost" stroke="#06b6d4" fill="#06b6d4" name="Cost (GHS)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="providers" className="space-y-6">
          <div className="grid gap-6">
            {providerStats.map((provider) => (
              <Card key={provider.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {provider.name}
                      </CardTitle>
                      <CardDescription>{provider.company}</CardDescription>
                    </div>
                    <Badge
                      className={
                        provider.completionRate >= 90 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      ⭐ {provider.rating}/5.0
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-4 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="font-semibold">Performance Metrics</Label>
                        <div className="space-y-2 mt-2">
                          <div className="flex justify-between text-sm">
                            <span>Tasks Assigned:</span>
                            <span className="font-medium">{provider.tasksAssigned}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Tasks Completed:</span>
                            <span className="font-medium">{provider.tasksCompleted}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Completion Rate:</span>
                            <span className="font-medium">{(provider.completionRate || 0).toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>On-time Delivery:</span>
                            <span className="font-medium">{(provider.onTimeDelivery || 0).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label className="font-semibold">Time & Cost</Label>
                        <div className="space-y-2 mt-2">
                          <div className="flex justify-between text-sm">
                            <span>Avg Repair Time:</span>
                            <span className="font-medium">{(provider.avgRepairTime || 0).toFixed(1)} days</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Total Cost:</span>
                            <span className="font-medium">GHS {(provider.totalCost || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Avg Cost per Task:</span>
                            <span className="font-medium">
                              GHS {provider.tasksCompleted > 0 ? ((provider.totalCost || 0) / provider.tasksCompleted).toFixed(0) : "0"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <Label className="font-semibold">Recent Tasks</Label>
                      <div className="space-y-2 mt-2">
                        {provider.recentTasks.map((task, index) => (
                          <div key={index} className="flex items-center justify-between text-sm bg-muted p-2 rounded">
                            <div>
                              <span className="font-medium">{task.taskNumber}</span>
                              <span className="text-muted-foreground ml-2">• {task.deviceType}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                size="sm"
                                className={
                                  task.status === "completed"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-orange-100 text-orange-800"
                                }
                              >
                                {task.status}
                              </Badge>
                              <span className="font-medium">GHS {task.cost}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="devices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Device Type Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={currentReport.deviceTypes}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis yAxisId="count" orientation="left" />
                  <YAxis yAxisId="cost" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="count" dataKey="count" fill="#3b82f6" name="Repair Count" />
                  <Bar yAxisId="cost" dataKey="cost" fill="#10b981" name="Total Cost (GHS)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Repair Distribution by Device Type</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={currentReport.deviceTypes} cx="50%" cy="50%" outerRadius={100} dataKey="count">
                      {currentReport.deviceTypes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Average Repair Time by Device</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {currentReport.deviceTypes.map((device, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{device.type}</span>
                        <span>{(device.avgRepairTime || 0).toFixed(1)} days</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${((device.avgRepairTime || 0) / 6) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="issues" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Issues by Frequency</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={currentReport.topIssues}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="issue" />
                  <YAxis yAxisId="frequency" orientation="left" />
                  <YAxis yAxisId="cost" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="frequency" dataKey="frequency" fill="#ef4444" name="Frequency" />
                  <Bar yAxisId="cost" dataKey="avgCost" fill="#f59e0b" name="Avg Cost (GHS)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Issue Analysis Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentReport.topIssues.map((issue, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{issue.issue}</p>
                      <p className="text-sm text-muted-foreground">
                        {issue.frequency} occurrences • Avg cost: GHS {issue.avgCost}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        Total Impact: GHS {((issue.frequency || 0) * (issue.avgCost || 0)).toLocaleString()}
                      </p>
                      <Badge variant="outline">
                        {currentReport.totalTasks > 0 ? ((issue.frequency / currentReport.totalTasks) * 100).toFixed(1) : "0"}% of all issues
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
