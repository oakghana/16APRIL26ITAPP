"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import {
  FileText,
  Download,
  Users,
  Headphones,
  Clock,
  CheckCircle,
  AlertTriangle,
  Filter,
  Shield,
  Loader2,
  TrendingUp,
  MapPin,
  Cpu,
  Wrench,
  RefreshCw,
  Activity,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { canSeeAllLocations, getCanonicalLocationName } from "@/lib/location-filter"
import { createClient } from "@/supabase/supabase-client"
import { LOCATIONS } from "@/lib/locations"
import { generateITReportPDF } from "@/lib/it-report-pdf"

interface ReportData {
  location: string
  totalTickets: number
  resolvedTickets: number
  pendingTickets: number
  avgResolutionTime: number
  staffCount: number
  deviceCount: number
  repairRequests: number
  satisfactionScore: number
}

interface TimeSeriesData {
  date: string
  tickets: number
  repairs: number
  satisfaction: number
}

interface CategoryData {
  category: string
  count: number
  percentage: number
  color: string
}

export function ITReportsDashboard() {
  const { user } = useAuth()
  const [reportData, setReportData] = useState<ReportData[]>([])
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([])
  const [categoryData, setCategoryData] = useState<CategoryData[]>([])
  const [selectedLocation, setSelectedLocation] = useState(
    user && user.role === "regional_it_head" ? user.location : "all",
  )
  const [dateRange, setDateRange] = useState("30")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [availableLocations, setAvailableLocations] = useState<string[]>([])

  // Fetch real data from database
  const fetchReportData = useCallback(async () => {
    if (!user) return
    
    setIsLoading(true)
    const supabase = createClient()
    
    try {
      // Calculate date range
      const daysAgo = parseInt(dateRange)
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - daysAgo)
      const startDateStr = startDate.toISOString()
      
      // Get unique locations from devices
      const { data: deviceLocations } = await supabase
        .from("devices")
        .select("location")
        .not("location", "is", null)
      
      const uniqueLocations = [...new Set(deviceLocations?.map(d => getCanonicalLocationName(d.location)).filter(Boolean) || [])].sort()
      setAvailableLocations(uniqueLocations)
      
      // Filter locations based on user role
      let locationsToQuery = uniqueLocations
      if (user.role === "regional_it_head" && user.location) {
        locationsToQuery = [user.location]
      }
      
      // Build report data for each location
      const reportDataPromises = locationsToQuery.map(async (location) => {
        // Get service tickets for this location
        let ticketQuery = supabase
          .from("service_tickets")
          .select("id, status, created_at, resolved_at, category")
          .gte("created_at", startDateStr)
          .ilike("location", location)
        
        const { data: tickets } = await ticketQuery
        
        const totalTickets = tickets?.length || 0
        const resolvedTickets = tickets?.filter(t => t.status === "resolved" || t.status === "closed").length || 0
        const pendingTickets = tickets?.filter(t => t.status !== "resolved" && t.status !== "closed").length || 0
        
        // Calculate average resolution time (in hours)
        const resolvedWithTime = tickets?.filter(t => t.resolved_at && t.created_at) || []
        let avgResolutionTime = 0
        if (resolvedWithTime.length > 0) {
          const totalHours = resolvedWithTime.reduce((acc, t) => {
            const created = new Date(t.created_at).getTime()
            const resolved = new Date(t.resolved_at).getTime()
            return acc + (resolved - created) / (1000 * 60 * 60)
          }, 0)
          avgResolutionTime = totalHours / resolvedWithTime.length
        }
        
        // Get staff count for this location
        const { count: staffCount } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .ilike("location", location)
          .in("role", ["it_staff", "regional_it_head", "service_desk_accra", "service_desk_kumasi", "service_desk_takoradi", "service_desk_tema", "service_desk_sunyani", "service_desk_cape_coast"])
        
        // Get device count for this location
        const { count: deviceCount } = await supabase
          .from("devices")
          .select("*", { count: "exact", head: true })
          .ilike("location", location)
        
        // Get repair requests for this location
        const { count: repairRequests } = await supabase
          .from("repair_requests")
          .select("*", { count: "exact", head: true })
          .gte("created_at", startDateStr)
          .ilike("location", location)
        
        return {
          location,
          totalTickets,
          resolvedTickets,
          pendingTickets,
          avgResolutionTime: Math.round(avgResolutionTime * 10) / 10,
          staffCount: staffCount || 0,
          deviceCount: deviceCount || 0,
          repairRequests: repairRequests || 0,
          satisfactionScore: 0, // No satisfaction tracking implemented yet
        }
      })
      
      const reportResults = await Promise.all(reportDataPromises)
      setReportData(reportResults.filter(r => r.totalTickets > 0 || r.deviceCount > 0 || r.staffCount > 0))
      
      // Build time series data (weekly aggregation)
      const weeks: TimeSeriesData[] = []
      for (let i = Math.min(8, Math.ceil(daysAgo / 7)); i >= 0; i--) {
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - (i * 7))
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 7)
        
        let ticketQuery = supabase
          .from("service_tickets")
          .select("id", { count: "exact", head: true })
          .gte("created_at", weekStart.toISOString())
          .lt("created_at", weekEnd.toISOString())
        
        if (user.role === "regional_it_head" && user.location) {
          ticketQuery = ticketQuery.ilike("location", user.location)
        }
        
        const { count: ticketCount } = await ticketQuery
        
        let repairQuery = supabase
          .from("repair_requests")
          .select("id", { count: "exact", head: true })
          .gte("created_at", weekStart.toISOString())
          .lt("created_at", weekEnd.toISOString())
        
        if (user.role === "regional_it_head" && user.location) {
          repairQuery = repairQuery.ilike("location", user.location)
        }
        
        const { count: repairCount } = await repairQuery
        
        weeks.push({
          date: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          tickets: ticketCount || 0,
          repairs: repairCount || 0,
          satisfaction: 0,
        })
      }
      setTimeSeriesData(weeks)
      
      // Build category data from ticket categories
      let categoryQuery = supabase
        .from("service_tickets")
        .select("category")
        .gte("created_at", startDateStr)
        .not("category", "is", null)
      
      if (user.role === "regional_it_head" && user.location) {
        categoryQuery = categoryQuery.ilike("location", user.location)
      }
      
      const { data: categoryTickets } = await categoryQuery
      
      const categoryCounts: Record<string, number> = {}
      categoryTickets?.forEach(t => {
        if (t.category) {
          categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1
        }
      })
      
      const categoryColors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"]
      const totalCategoryTickets = Object.values(categoryCounts).reduce((a, b) => a + b, 0)
      
      const categoryDataResult: CategoryData[] = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)
        .map(([category, count], index) => ({
          category,
          count,
          percentage: totalCategoryTickets > 0 ? Math.round((count / totalCategoryTickets) * 100) : 0,
          color: categoryColors[index % categoryColors.length],
        }))
      
      setCategoryData(categoryDataResult)
      
    } catch (error) {
      console.error("Error fetching report data:", error)
    } finally {
      setIsLoading(false)
    }
  }, [user, dateRange])

  useEffect(() => {
    fetchReportData()
  }, [fetchReportData])

  // Role-based access control - only IT Heads, Regional IT Heads, and Admins can access IT Reports
  const AccessDeniedComponent = () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-red-600">
            <Shield className="h-6 w-6" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            You don't have permission to view IT Reports. This feature is only available to IT Heads, Regional IT Heads,
            and System Administrators.
          </p>
          <Button variant="outline" onClick={() => window.history.back()} className="w-full">
            Go Back
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  if (!user || !["it_head", "regional_it_head", "admin"].includes(user.role)) {
    return <AccessDeniedComponent />
  }

  const generateReport = async () => {
    setIsGenerating(true)
    try {
      await generateITReportPDF({
        title: "IT OPERATIONS REPORT",
        dateRange: dateRangeLabel[dateRange] || `Last ${dateRange} days`,
        generatedBy: user?.name || user?.full_name || "Unknown",
        location: selectedLocation,
        reportData: filteredReportData,
        categoryData,
        timeSeriesData,
        totalStats,
      })
    } catch (err) {
      console.error("PDF generation failed:", err)
    } finally {
      setIsGenerating(false)
    }
  }

  const filteredReportData =
    selectedLocation === "all" ? reportData : reportData.filter((item) => item.location.toLowerCase() === selectedLocation.toLowerCase())

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-green-600" />
          <p className="text-muted-foreground font-medium">Loading report data...</p>
        </div>
      </div>
    )
  }

  const totalStats = filteredReportData.reduce(
    (acc, curr) => ({
      totalTickets: acc.totalTickets + curr.totalTickets,
      resolvedTickets: acc.resolvedTickets + curr.resolvedTickets,
      pendingTickets: acc.pendingTickets + curr.pendingTickets,
      avgResolutionTime: acc.avgResolutionTime + curr.avgResolutionTime,
      staffCount: acc.staffCount + curr.staffCount,
      deviceCount: acc.deviceCount + curr.deviceCount,
      repairRequests: acc.repairRequests + curr.repairRequests,
      avgSatisfactionScore: acc.avgSatisfactionScore + curr.satisfactionScore,
    }),
    { totalTickets: 0, resolvedTickets: 0, pendingTickets: 0, avgResolutionTime: 0, staffCount: 0, deviceCount: 0, repairRequests: 0, avgSatisfactionScore: 0 },
  )

  const locationCount = filteredReportData.length
  if (locationCount > 0) {
    totalStats.avgResolutionTime = totalStats.avgResolutionTime / locationCount
    totalStats.avgSatisfactionScore = totalStats.avgSatisfactionScore / locationCount
  }

  const resolutionRate =
    totalStats.totalTickets > 0 ? Math.round((totalStats.resolvedTickets / totalStats.totalTickets) * 100) : 0

  const dateRangeLabel: Record<string, string> = {
    "7": "Last 7 days",
    "30": "Last 30 days",
    "90": "Last 90 days",
    "180": "Last 6 months",
    "365": "Last 12 months",
  }

  const KPICard = ({
    icon: Icon, label, value, sub, colorClass, borderClass,
  }: {
    icon: React.ElementType
    label: string
    value: string | number
    sub?: string
    colorClass: string
    borderClass: string
  }) => (
    <Card className={`border-l-4 ${borderClass} shadow-sm hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
            <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-gray-100">
            <Icon className={`h-5 w-5 ${colorClass}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-800 via-green-700 to-yellow-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-4 -right-4 w-40 h-40 rounded-full bg-white" />
          <div className="absolute bottom-2 left-10 w-24 h-24 rounded-full bg-yellow-300" />
        </div>
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg">
              <FileText className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">IT Operations Report</h1>
              <p className="text-green-100 text-sm mt-0.5">
                Quality Control Company Limited — Information Technology Department
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className="bg-white/20 text-white border-white/30 text-xs">
                  <Activity className="h-3 w-3 mr-1" />
                  Live Data
                </Badge>
                <Badge className="bg-yellow-400/30 text-yellow-100 border-yellow-400/40 text-xs">
                  {dateRangeLabel[dateRange] || `Last ${dateRange} days`}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchReportData}
              disabled={isLoading}
              className="bg-white/10 text-white border-white/30 hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={generateReport}
              disabled={isGenerating || filteredReportData.length === 0}
              className="bg-white text-green-800 hover:bg-green-50 font-semibold shadow-md"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isGenerating ? "Generating PDF..." : "Download PDF Report"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Report Configuration ─────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-green-600" />
            Report Configuration
          </CardTitle>
          <CardDescription>Adjust filters to focus the report scope</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
                Location
              </Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger className="h-9">
                  <MapPin className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canSeeAllLocations(user) && <SelectItem value="all">All Locations</SelectItem>}
                  {availableLocations.map((loc) => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                  {availableLocations.length === 0 &&
                    LOCATIONS.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
                Date Range
              </Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="h-9">
                  <Clock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="180">Last 6 months</SelectItem>
                  <SelectItem value="365">Last 12 months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={generateReport}
                disabled={isGenerating || filteredReportData.length === 0}
                className="w-full h-9 bg-green-700 hover:bg-green-800 text-white"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                {isGenerating ? "Generating..." : "Export PDF"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard icon={Headphones} label="Total Tickets" value={totalStats.totalTickets} colorClass="text-blue-600" borderClass="border-l-blue-500" />
        <KPICard icon={CheckCircle} label="Resolved" value={totalStats.resolvedTickets} sub={`${resolutionRate}% rate`} colorClass="text-green-600" borderClass="border-l-green-500" />
        <KPICard icon={AlertTriangle} label="Pending" value={totalStats.pendingTickets} colorClass="text-orange-600" borderClass="border-l-orange-500" />
        <KPICard icon={Clock} label="Avg Resolution" value={`${totalStats.avgResolutionTime.toFixed(1)}h`} sub="per ticket" colorClass="text-purple-600" borderClass="border-l-purple-500" />
        <KPICard icon={Cpu} label="Devices" value={totalStats.deviceCount} colorClass="text-yellow-600" borderClass="border-l-yellow-500" />
        <KPICard icon={Wrench} label="Repairs" value={totalStats.repairRequests} colorClass="text-red-600" borderClass="border-l-red-500" />
      </div>

      {/* ── Resolution Rate Banner ───────────────────────────────────────── */}
      <div className={`rounded-xl p-4 flex items-center justify-between flex-wrap gap-4 ${resolutionRate >= 75 ? "bg-green-50 border border-green-200" : resolutionRate >= 50 ? "bg-yellow-50 border border-yellow-200" : "bg-red-50 border border-red-200"}`}>
        <div className="flex items-center gap-3">
          <TrendingUp className={`h-5 w-5 ${resolutionRate >= 75 ? "text-green-600" : resolutionRate >= 50 ? "text-yellow-600" : "text-red-600"}`} />
          <div>
            <p className="font-semibold text-sm">Overall Ticket Resolution Rate</p>
            <p className="text-xs text-muted-foreground">Based on {totalStats.totalTickets} total tickets in the selected period</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-48 h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${resolutionRate >= 75 ? "bg-green-500" : resolutionRate >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
              style={{ width: `${resolutionRate}%` }}
            />
          </div>
          <span className={`text-2xl font-bold ${resolutionRate >= 75 ? "text-green-700" : resolutionRate >= 50 ? "text-yellow-700" : "text-red-700"}`}>
            {resolutionRate}%
          </span>
        </div>
      </div>

      {/* ── Charts Row ───────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Performance by Location</CardTitle>
            <CardDescription className="text-xs">Resolved vs. pending tickets per location</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={filteredReportData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="location" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e5e7eb" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="resolvedTickets" fill="#10b981" name="Resolved" radius={[3, 3, 0, 0]} />
                <Bar dataKey="pendingTickets" fill="#f59e0b" name="Pending" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Weekly Activity Trend</CardTitle>
            <CardDescription className="text-xs">Ticket and repair volume over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={timeSeriesData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e5e7eb" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="tickets" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} name="Tickets" />
                <Line type="monotone" dataKey="repairs" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} name="Repairs" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Category Analysis ────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-5">
        <Card className="lg:col-span-3 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Issue Category Breakdown</CardTitle>
            <CardDescription className="text-xs">Top categories by ticket volume</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No category data for this period.</div>
            ) : (
              <div className="space-y-3">
                {categoryData.map((cat, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm flex-1 font-medium truncate">{cat.category}</span>
                    <div className="flex-1 max-w-[120px]">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }} />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right">{cat.count} tickets</span>
                    <Badge variant="outline" className="text-xs w-12 justify-center" style={{ borderColor: cat.color, color: cat.color }}>
                      {cat.percentage}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Category Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="count">
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Location Details Table ───────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-600" />
                Location Performance Details
              </CardTitle>
              <CardDescription className="text-xs">Comprehensive metrics across all locations</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">{filteredReportData.length} location{filteredReportData.length !== 1 ? "s" : ""}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-3 pl-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Location</th>
                  <th className="text-center p-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Staff</th>
                  <th className="text-center p-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Devices</th>
                  <th className="text-center p-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Tickets</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Resolution Rate</th>
                  <th className="text-center p-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Avg Time</th>
                  <th className="text-center p-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Repairs</th>
                  <th className="text-center p-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredReportData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground">
                      No data available for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredReportData.map((loc, index) => {
                    const rate = loc.totalTickets > 0 ? Math.round((loc.resolvedTickets / loc.totalTickets) * 100) : 0
                    const rateColor = rate >= 75 ? "text-green-700 bg-green-50" : rate >= 50 ? "text-yellow-700 bg-yellow-50" : "text-red-700 bg-red-50"
                    const barColor = rate >= 75 ? "bg-green-500" : rate >= 50 ? "bg-yellow-500" : "bg-red-500"
                    return (
                      <tr key={index} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 pl-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-600" />
                            <span className="font-semibold">{loc.location}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{loc.staffCount}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">{loc.deviceCount}</td>
                        <td className="p-3 text-center font-semibold">{loc.totalTickets}</td>
                        <td className="p-3">
                          {loc.totalTickets > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${rate}%` }} />
                              </div>
                              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${rateColor}`}>{rate}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No tickets</span>
                          )}
                        </td>
                        <td className="p-3 text-center text-sm">{loc.avgResolutionTime}h</td>
                        <td className="p-3 text-center">{loc.repairRequests}</td>
                        <td className="p-3 text-center">
                          <Badge
                            variant="outline"
                            className={`text-xs ${rate >= 75 ? "border-green-300 text-green-700 bg-green-50" : rate >= 50 ? "border-yellow-300 text-yellow-700 bg-yellow-50" : "border-red-300 text-red-700 bg-red-50"}`}
                          >
                            {rate >= 75 ? "On Track" : rate >= 50 ? "Monitor" : "At Risk"}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              {filteredReportData.length > 1 && (
                <tfoot>
                  <tr className="bg-muted/60 border-t-2">
                    <td className="p-3 pl-4 font-bold text-xs uppercase tracking-wide">Totals / Averages</td>
                    <td className="p-3 text-center font-bold">{totalStats.staffCount}</td>
                    <td className="p-3 text-center font-bold">{totalStats.deviceCount}</td>
                    <td className="p-3 text-center font-bold">{totalStats.totalTickets}</td>
                    <td className="p-3">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${resolutionRate >= 75 ? "text-green-700 bg-green-100" : resolutionRate >= 50 ? "text-yellow-700 bg-yellow-100" : "text-red-700 bg-red-100"}`}>
                        {resolutionRate}%
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold">{totalStats.avgResolutionTime.toFixed(1)}h</td>
                    <td className="p-3 text-center font-bold">{totalStats.repairRequests}</td>
                    <td className="p-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
