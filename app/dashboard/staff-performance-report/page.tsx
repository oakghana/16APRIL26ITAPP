"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Trophy, Medal, Award, TrendingUp, Clock, CheckCircle, Download,
  RefreshCw, Search, BarChart2, Users, Star, Zap, Target, Activity,
  MapPin, Mail, ChevronUp, ChevronDown
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell
} from "recharts"

interface ProductivityMetrics {
  staffId: string
  staffName: string
  email: string
  location: string
  role: string
  totalTasksAssigned: number
  completedTasks: number
  onTimeCompletions: number
  averageCompletionDays: number
  completionRate: number
  onTimeRate: number
  productivityScore: number
  speedBonus: number
  activityBonus: number
  activityActions: number
  storeIssuances: number
  serviceDeskDispatches: number
  officeUseProcesses: number
  lastStoreIssuanceAt: string | null
  rank: number
  grading: "Excellent" | "Good" | "Average" | "Below Average" | "Poor"
}

const GRADE_COLORS: Record<string, { bg: string; text: string; badge: string; hex: string }> = {
  Excellent: { bg: "bg-emerald-50 dark:bg-emerald-950/20", text: "text-emerald-700 dark:text-emerald-300", badge: "bg-emerald-600", hex: "#16a34a" },
  Good:      { bg: "bg-blue-50 dark:bg-blue-950/20",     text: "text-blue-700 dark:text-blue-300",     badge: "bg-blue-600",     hex: "#2563eb" },
  Average:   { bg: "bg-amber-50 dark:bg-amber-950/20",   text: "text-amber-700 dark:text-amber-300",   badge: "bg-amber-600",    hex: "#d97706" },
  "Below Average": { bg: "bg-orange-50 dark:bg-orange-950/20", text: "text-orange-700 dark:text-orange-300", badge: "bg-orange-600", hex: "#ea580c" },
  Poor:      { bg: "bg-red-50 dark:bg-red-950/20",       text: "text-red-700 dark:text-red-300",       badge: "bg-red-600",      hex: "#dc2626" },
}

const ROLE_LABELS: Record<string, string> = {
  it_staff: "IT Staff",
  it_head: "IT Head",
  regional_it_head: "Regional IT Head",
  it_store_head: "Store Head",
  service_desk_head: "Service Desk",
}

const PERIOD_OPTIONS = [
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
]

function getDateRange(period: string) {
  const now = new Date()
  if (period === "month") return { startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), endDate: now.toISOString() }
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3)
    return { startDate: new Date(now.getFullYear(), q * 3, 1).toISOString(), endDate: now.toISOString() }
  }
  return { startDate: new Date(now.getFullYear(), 0, 1).toISOString(), endDate: now.toISOString() }
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 shadow-md shrink-0">
      <Trophy className="h-4 w-4 text-white" />
    </div>
  )
  if (rank === 2) return (
    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 shadow-md shrink-0">
      <Medal className="h-4 w-4 text-white" />
    </div>
  )
  if (rank === 3) return (
    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 shadow-md shrink-0">
      <Award className="h-4 w-4 text-white" />
    </div>
  )
  return (
    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted text-muted-foreground font-bold text-sm shrink-0">
      {rank}
    </div>
  )
}

function GradeBadge({ grading }: { grading: string }) {
  const cfg = GRADE_COLORS[grading] ?? GRADE_COLORS.Poor
  return <Badge className={cn(cfg.badge, "text-white text-[11px] font-bold px-2.5 py-0.5")}>{grading}</Badge>
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs tabular-nums w-8 text-right font-medium">{value}</span>
    </div>
  )
}

// Top-3 podium card
function PodiumCard({ metric, height }: { metric: ProductivityMetrics; height: string }) {
  const cfg = GRADE_COLORS[metric.grading] ?? GRADE_COLORS.Poor
  const isFirst = metric.rank === 1
  return (
    <div className={cn(
      "flex flex-col items-center gap-2 rounded-2xl border px-4 pt-4 pb-5 transition-shadow hover:shadow-lg",
      cfg.bg, isFirst ? "shadow-md ring-2 ring-amber-300 dark:ring-amber-700" : "shadow-sm"
    )} style={{ minHeight: height }}>
      <RankBadge rank={metric.rank} />
      <div className={cn("w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black shadow-inner border-2", cfg.bg, cfg.text, "border-current/20")}>
        {(metric.staffName || "?")[0].toUpperCase()}
      </div>
      <div className="text-center">
        <p className="font-bold text-sm leading-tight line-clamp-2">{metric.staffName}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{ROLE_LABELS[metric.role] ?? metric.role}</p>
      </div>
      <div className={cn("rounded-xl px-4 py-2 text-center", cfg.bg)}>
        <p className={cn("text-3xl font-black tabular-nums leading-none", cfg.text)}>{metric.productivityScore}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">pts</p>
      </div>
      <GradeBadge grading={metric.grading} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-center w-full mt-1">
        <div>
          <p className="text-xs font-bold">{metric.completionRate}%</p>
          <p className="text-[10px] text-muted-foreground">Done</p>
        </div>
        <div>
          <p className="text-xs font-bold">{metric.onTimeRate}%</p>
          <p className="text-[10px] text-muted-foreground">On-Time</p>
        </div>
      </div>
    </div>
  )
}

// Summary stat card
function SummaryCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-black tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="p-2.5 rounded-xl shrink-0" style={{ backgroundColor: color + "22" }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function StaffPerformanceReport() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState<ProductivityMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("year")
  const [locationFilter, setLocationFilter] = useState("all")
  const [locations, setLocations] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<keyof ProductivityMetrics>("rank")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const isAdmin = ["admin", "it_head"].includes(user?.role || "")

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => { if (d.success) setLocations(d.locations) })
      .catch(() => {})
  }, [])

  const loadMetrics = async () => {
    setLoading(true)
    try {
      const { startDate, endDate } = getDateRange(period)
      const params = new URLSearchParams({ startDate, endDate })
      if (locationFilter !== "all") params.append("location", locationFilter)
      const res = await fetch(`/api/staff/productivity-metrics?${params}`)
      const data = await res.json()
      if (data.success) setMetrics(data.metrics)
    } catch (e) {
      console.error("[v0] Error loading metrics:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMetrics() }, [period, locationFilter])

  const exportCSV = () => {
    const rows = [
      ["Rank", "Name", "Email", "Location", "Role", "Tasks", "Completed", "On-Time", "Avg Days",
        "Completion %", "On-Time %", "Store Issues", "Dispatches", "Office-Use", "Activity Bonus", "Score", "Grade"],
      ...metrics.map((m) => [
        m.rank, m.staffName, m.email, m.location, ROLE_LABELS[m.role] ?? m.role,
        m.totalTasksAssigned, m.completedTasks, m.onTimeCompletions, m.averageCompletionDays,
        m.completionRate, m.onTimeRate,
        m.storeIssuances || 0, m.serviceDeskDispatches || 0, m.officeUseProcesses || 0,
        m.activityBonus || 0, m.productivityScore, m.grading,
      ]),
    ]
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n")
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: `performance-report-${new Date().toISOString().split("T")[0]}.csv`,
    })
    a.click()
  }

  const filteredMetrics = useMemo(() => {
    let list = [...metrics]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((m) =>
        m.staffName?.toLowerCase().includes(q) ||
        m.location?.toLowerCase().includes(q) ||
        m.role?.toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => {
      const av = a[sortField] as any
      const bv = b[sortField] as any
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })
    return list
  }, [metrics, search, sortField, sortDir])

  const topThree = metrics.slice(0, 3)
  const maxScore = metrics.reduce((m, x) => Math.max(m, x.productivityScore), 1)

  // Grade distribution
  const gradeDistData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of metrics) counts[m.grading] = (counts[m.grading] || 0) + 1
    return Object.entries(counts).map(([name, value]) => ({ name, value, fill: GRADE_COLORS[name]?.hex ?? "#888" }))
  }, [metrics])

  // Top 10 chart data
  const chartData = useMemo(() => metrics.slice(0, 10).map((m) => ({
    name: (m.staffName || "").split(" ")[0],
    score: m.productivityScore,
    completion: m.completionRate,
    fill: GRADE_COLORS[m.grading]?.hex ?? "#888",
  })), [metrics])

  const toggleSort = (field: keyof ProductivityMetrics) => {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("desc") }
  }

  function SortIcon({ field }: { field: keyof ProductivityMetrics }) {
    if (sortField !== field) return <ChevronUp className="h-3 w-3 opacity-30" />
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-primary" />
      : <ChevronDown className="h-3 w-3 text-primary" />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-background to-slate-50 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── Hero header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                <BarChart2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">IT Performance Leaderboard</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Productivity rankings for IT teams, Store Heads &amp; Service Desk
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={loadMetrics} disabled={loading} className="gap-1.5">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={loading || !metrics.length} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Period tabs */}
          <div className="flex rounded-xl overflow-hidden border bg-muted/40 shrink-0">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={cn(
                  "px-4 py-2 text-xs font-semibold transition-colors",
                  period === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Location */}
          {locations.length > 0 && (
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full sm:w-48 h-9 text-xs">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-9 h-9 text-xs"
              placeholder="Search staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            </div>
            <p className="text-muted-foreground font-medium animate-pulse">Loading performance data...</p>
          </div>
        ) : metrics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Users className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-semibold text-muted-foreground">No performance data found</p>
            <p className="text-sm text-muted-foreground">Try adjusting the filters or date range.</p>
          </div>
        ) : (
          <>
            {/* ── Summary cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCard icon={Users} label="Total Staff" value={metrics.length} sub="measured" color="#6366f1" />
              <SummaryCard
                icon={Star}
                label="Avg Score"
                value={Math.round(metrics.reduce((s, m) => s + m.productivityScore, 0) / metrics.length)}
                sub="out of 100+"
                color="#f59e0b"
              />
              <SummaryCard
                icon={CheckCircle}
                label="Avg Completion"
                value={`${Math.round(metrics.reduce((s, m) => s + m.completionRate, 0) / metrics.length)}%`}
                sub="task done rate"
                color="#16a34a"
              />
              <SummaryCard
                icon={Clock}
                label="Avg On-Time"
                value={`${Math.round(metrics.reduce((s, m) => s + m.onTimeRate, 0) / metrics.length)}%`}
                sub="on-time rate"
                color="#2563eb"
              />
            </div>

            {/* ── Podium ── */}
            {topThree.length >= 2 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Trophy className="h-5 w-5 text-amber-500" /> Top Performers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-center gap-4 flex-wrap sm:flex-nowrap">
                    {topThree[1] && <div className="flex-1 max-w-[180px]"><PodiumCard metric={topThree[1]} height="220px" /></div>}
                    {topThree[0] && <div className="flex-1 max-w-[200px]"><PodiumCard metric={topThree[0]} height="260px" /></div>}
                    {topThree[2] && <div className="flex-1 max-w-[180px]"><PodiumCard metric={topThree[2]} height="200px" /></div>}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Score bar chart */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Top 10 Productivity Scores</CardTitle>
                </CardHeader>
                <CardContent className="px-2">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: "12px" }}
                        formatter={(v: any) => [`${v} pts`, "Score"]}
                      />
                      <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {chartData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Grade distribution */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Grade Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {gradeDistData.map((g) => (
                    <div key={g.name} className="flex items-center gap-2">
                      <span className="text-xs w-24 shrink-0 font-medium">{g.name}</span>
                      <div className="flex-1 h-5 bg-muted/40 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                          style={{ width: `${Math.round((g.value / metrics.length) * 100)}%`, backgroundColor: g.fill }}
                        >
                          <span className="text-[10px] text-white font-bold">{g.value}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* ── Leaderboard table ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-5 w-5 text-primary" />
                    Full Leaderboard
                    <Badge variant="secondary" className="text-xs">{filteredMetrics.length} staff</Badge>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-12">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Staff</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("productivityScore")}>
                          <span className="flex items-center justify-center gap-1">Score <SortIcon field="productivityScore" /></span>
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("completionRate")}>
                          <span className="flex items-center justify-center gap-1">Completion% <SortIcon field="completionRate" /></span>
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("onTimeRate")}>
                          <span className="flex items-center justify-center gap-1">On-Time% <SortIcon field="onTimeRate" /></span>
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tasks</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avg Days</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredMetrics.map((m) => {
                        const cfg = GRADE_COLORS[m.grading] ?? GRADE_COLORS.Poor
                        return (
                          <tr key={m.staffId} className={cn("hover:bg-muted/30 transition-colors", m.rank <= 3 && "bg-amber-50/30 dark:bg-amber-950/10")}>
                            <td className="px-4 py-3">
                              <RankBadge rank={m.rank} />
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-semibold leading-tight">{m.staffName}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />{m.location || "—"}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">{ROLE_LABELS[m.role] ?? m.role}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={cn("text-xl font-black tabular-nums", cfg.text)}>{m.productivityScore}</span>
                              <div className="mt-1 mx-auto w-20">
                                <Progress value={Math.min(100, m.productivityScore)} className="h-1.5" />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <MiniBar value={m.completionRate} max={100} color={cfg.hex} />
                            </td>
                            <td className="px-4 py-3">
                              <MiniBar value={m.onTimeRate} max={100} color={cfg.hex} />
                            </td>
                            <td className="px-4 py-3 text-center tabular-nums">
                              <span className="font-semibold">{m.completedTasks}</span>
                              <span className="text-muted-foreground text-xs">/{m.totalTasksAssigned}</span>
                            </td>
                            <td className="px-4 py-3 text-center tabular-nums text-sm font-medium">
                              {m.averageCompletionDays}d
                            </td>
                            <td className="px-4 py-3 text-center">
                              <GradeBadge grading={m.grading} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="md:hidden divide-y divide-border">
                  {filteredMetrics.map((m) => {
                    const cfg = GRADE_COLORS[m.grading] ?? GRADE_COLORS.Poor
                    return (
                      <div key={m.staffId} className={cn("p-4 space-y-3", m.rank <= 3 && "bg-amber-50/30 dark:bg-amber-950/10")}>
                        <div className="flex items-center gap-3">
                          <RankBadge rank={m.rank} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold leading-tight truncate">{m.staffName}</p>
                            <p className="text-xs text-muted-foreground">{m.location} · {ROLE_LABELS[m.role] ?? m.role}</p>
                          </div>
                          <div className="text-right">
                            <p className={cn("text-2xl font-black tabular-nums", cfg.text)}>{m.productivityScore}</p>
                            <GradeBadge grading={m.grading} />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-lg bg-muted/40 p-2 text-center">
                            <p className="text-sm font-bold">{m.completionRate}%</p>
                            <p className="text-[10px] text-muted-foreground">Done</p>
                          </div>
                          <div className="rounded-lg bg-muted/40 p-2 text-center">
                            <p className="text-sm font-bold">{m.onTimeRate}%</p>
                            <p className="text-[10px] text-muted-foreground">On-Time</p>
                          </div>
                          <div className="rounded-lg bg-muted/40 p-2 text-center">
                            <p className="text-sm font-bold">{m.completedTasks}/{m.totalTasksAssigned}</p>
                            <p className="text-[10px] text-muted-foreground">Tasks</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* ── Scoring methodology ── */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Target className="h-4 w-4 text-primary" /> Scoring Methodology
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div className="space-y-1.5">
                    <p className="font-semibold text-foreground text-sm">Score Formula</p>
                    <ul className="space-y-1">
                      <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500 shrink-0" /> 45% — Task completion rate</li>
                      <li className="flex items-center gap-2"><Clock className="h-3 w-3 text-blue-500 shrink-0" /> 12% — On-time completion rate</li>
                      <li className="flex items-center gap-2"><Zap className="h-3 w-3 text-amber-500 shrink-0" /> Speed bonus (up to 20 pts)</li>
                      <li className="flex items-center gap-2"><TrendingUp className="h-3 w-3 text-purple-500 shrink-0" /> Volume bonus (up to 30 pts)</li>
                      <li className="flex items-center gap-2"><Activity className="h-3 w-3 text-indigo-500 shrink-0" /> Activity bonus (up to 30 pts)</li>
                    </ul>
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-semibold text-foreground text-sm">Grade Thresholds</p>
                    <div className="space-y-1">
                      {[
                        { grade: "Excellent", range: "≥ 90 pts", color: GRADE_COLORS.Excellent },
                        { grade: "Good", range: "75 – 89 pts", color: GRADE_COLORS.Good },
                        { grade: "Average", range: "55 – 74 pts", color: GRADE_COLORS.Average },
                        { grade: "Below Average", range: "35 – 54 pts", color: GRADE_COLORS["Below Average"] },
                        { grade: "Poor", range: "< 35 pts", color: GRADE_COLORS.Poor },
                      ].map(({ grade, range, color }) => (
                        <div key={grade} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color.hex }} />
                          <span className="font-medium text-foreground">{grade}</span>
                          <span className="text-muted-foreground">{range}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
