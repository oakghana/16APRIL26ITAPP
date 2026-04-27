"use client"


"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Award, ExternalLink, Clock, CheckCircle, Target, TrendingUp, Star, Zap,
  Users, UserCheck, AlertCircle, Trophy, ChevronUp, BarChart2, Activity,
  Package, Headphones, FileCheck, Mail
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface ProductivityData {
  totalTasksAssigned: number
  completedTasks: number
  onTimeCompletions: number
  averageCompletionDays: number
  completionRate: number
  onTimeRate: number
  productivityScore: number
  rank: number | null
  totalStaff: number
  grading: "Excellent" | "Good" | "Average" | "Below Average" | "Poor"
  activityBonus?: number
  activityActions?: number
  storeIssuances?: number
  serviceDeskDispatches?: number
  officeUseProcesses?: number
}

interface HODInfo {
  name: string
  email: string
  department?: string
}

// Circular score ring SVG
function ScoreRing({
  score,
  size = 96,
  strokeWidth = 8,
  color,
}: {
  score: number
  size?: number
  strokeWidth?: number
  color: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(100, score)
  const offset = circumference - (pct / 100) * circumference
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/20"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  )
}

const GRADE_CONFIG = {
  Excellent: {
    color: "#16a34a",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    accent: "border-l-emerald-500",
    badge: "bg-emerald-600",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "from-emerald-400 to-green-600",
    statBg: "bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900",
    message: "Outstanding! You're a top performer.",
    icon: Star,
  },
  Good: {
    color: "#2563eb",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    accent: "border-l-blue-500",
    badge: "bg-blue-600",
    text: "text-blue-700 dark:text-blue-300",
    ring: "from-blue-400 to-indigo-600",
    statBg: "bg-blue-50/80 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900",
    message: "Great work! Push to reach Excellent.",
    icon: TrendingUp,
  },
  Average: {
    color: "#d97706",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    accent: "border-l-amber-500",
    badge: "bg-amber-600",
    text: "text-amber-700 dark:text-amber-300",
    ring: "from-amber-400 to-yellow-500",
    statBg: "bg-amber-50/80 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900",
    message: "On track — keep closing tasks on time.",
    icon: Target,
  },
  "Below Average": {
    color: "#ea580c",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-800",
    accent: "border-l-orange-500",
    badge: "bg-orange-600",
    text: "text-orange-700 dark:text-orange-300",
    ring: "from-orange-400 to-red-500",
    statBg: "bg-orange-50/80 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900",
    message: "Attention needed — review pending tasks.",
    icon: Zap,
  },
  Poor: {
    color: "#dc2626",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    accent: "border-l-red-500",
    badge: "bg-red-600",
    text: "text-red-700 dark:text-red-300",
    ring: "from-red-400 to-rose-600",
    statBg: "bg-red-50/80 dark:bg-red-950/20 border-red-100 dark:border-red-900",
    message: "Urgent: Speak with your IT Head immediately.",
    icon: Clock,
  },
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  bg,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  bg: string
}) {
  return (
    <div className={cn("rounded-xl p-3 border flex flex-col gap-1 min-w-0", bg)}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</span>
      </div>
      <p className="text-2xl font-black leading-none tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
    </div>
  )
}

export function StaffProductivityWidget() {
  const { user } = useAuth()
  const router = useRouter()
  const [productivity, setProductivity] = useState<ProductivityData | null>(null)
  const [hod, setHod] = useState<HODInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const MEASURED_ROLES = ["it_staff", "it_head", "regional_it_head", "it_store_head", "service_desk_head"]
  const isITStaff = MEASURED_ROLES.includes(user?.role || "")
  const showHOD = user?.role === "it_staff" || user?.role === "regional_it_head"

  useEffect(() => {
    if (!isITStaff || !user) return

    const loadAll = async () => {
      try {
        const [prodRes, hodRes] = await Promise.all([
          fetch(`/api/staff/my-productivity?staffId=${user.id}`),
          showHOD ? fetch(`/api/staff/my-hod?userId=${user.id}`) : Promise.resolve(null),
        ])

        const prodData = await prodRes.json()
        if (prodData.success) setProductivity(prodData.metrics)

        if (hodRes) {
          const hodData = await hodRes.json()
          setHod(hodData.hod || null)
        }
      } catch (err) {
        console.error("[v0] Error loading productivity widget:", err)
      } finally {
        setLoading(false)
      }
    }

    loadAll()
  }, [user?.id, isITStaff, showHOD])

  if (!isITStaff) return null

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden animate-pulse">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-5 w-48 bg-muted rounded-lg" />
              <div className="h-3.5 w-32 bg-muted rounded-lg" />
            </div>
            <div className="h-10 w-24 bg-muted rounded-full" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-muted rounded-xl" />)}
          </div>
          <div className="h-10 bg-muted rounded-xl" />
        </div>
      </div>
    )
  }

  if (!productivity) return null

  const cfg = GRADE_CONFIG[productivity.grading] ?? GRADE_CONFIG.Poor
  const GradeIcon = cfg.icon
  const rankLabel = productivity.rank
    ? `#${productivity.rank} of ${productivity.totalStaff}`
    : null

  return (
    <div className={cn(
      "rounded-2xl border-l-4 border border-border bg-card shadow-sm overflow-hidden",
      cfg.accent,
      cfg.bg,
      cfg.border,
    )}>
      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Score ring + numbers */}
          <div className="relative shrink-0 mx-auto sm:mx-0">
            <ScoreRing score={productivity.productivityScore} size={96} strokeWidth={8} color={cfg.color} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-2xl font-black leading-none tabular-nums", cfg.text)}>
                {productivity.productivityScore}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium mt-0.5">/ 100+</span>
            </div>
          </div>

          {/* Title + badge + rank */}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-base leading-tight">My Performance</span>
              <Badge className={cn(cfg.badge, "text-white text-xs px-3 py-1 font-bold shadow-sm gap-1 flex items-center")}>
                <GradeIcon className="h-3 w-3" />
                {productivity.grading}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">{cfg.message}</p>

            {/* Rank + completion % chips */}
            <div className="flex flex-wrap gap-2 mt-1">
              {rankLabel && (
                <div className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border", cfg.statBg)}>
                  <Trophy className="h-3.5 w-3.5 text-amber-500" />
                  <span>Rank {rankLabel}</span>
                </div>
              )}
              <div className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border", cfg.statBg)}>
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                <span>{productivity.completionRate}% Completion</span>
              </div>
              <div className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border", cfg.statBg)}>
                <Clock className="h-3.5 w-3.5 text-blue-500" />
                <span>{productivity.onTimeRate}% On-Time</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Productivity Score</span>
            <span className={cn("text-[11px] font-bold", cfg.text)}>{productivity.productivityScore} pts</span>
          </div>
          <Progress value={Math.min(100, productivity.productivityScore)} className="h-2" />
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="px-5 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatTile icon={Activity} label="Tasks" value={productivity.totalTasksAssigned} sub="total assigned" bg={cfg.statBg} />
        <StatTile icon={CheckCircle} label="Done" value={productivity.completedTasks} sub={`${productivity.completionRate}% rate`} bg={cfg.statBg} />
        <StatTile icon={Clock} label="On-Time" value={`${productivity.onTimeRate}%`} sub={`${productivity.onTimeCompletions} tasks`} bg={cfg.statBg} />
        <StatTile icon={BarChart2} label="Avg Days" value={`${productivity.averageCompletionDays}d`} sub="per task" bg={cfg.statBg} />
      </div>

      {/* ── Activity row (store head / service desk / office-use) ── */}
      {(productivity.activityActions ?? 0) > 0 && (
        <div className="px-5 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Activity Metrics</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {user?.role === "it_store_head" && (
              <StatTile icon={Package} label="Store Issues" value={productivity.storeIssuances ?? 0} sub="items issued" bg={cfg.statBg} />
            )}
            {user?.role === "service_desk_head" && (
              <StatTile icon={Headphones} label="Dispatches" value={productivity.serviceDeskDispatches ?? 0} sub="tickets" bg={cfg.statBg} />
            )}
            <StatTile icon={FileCheck} label="IT Office-Use" value={productivity.officeUseProcesses ?? 0} sub="forms processed" bg={cfg.statBg} />
            <StatTile icon={ChevronUp} label="Activity Bonus" value={`+${productivity.activityBonus ?? 0}`} sub="pts to score" bg={cfg.statBg} />
          </div>
        </div>
      )}

      {/* ── HOD Badge (IT Staff + Regional IT Head) ── */}
      {showHOD && (
        <div className="mx-5 mb-4 rounded-xl border overflow-hidden">
          {hod ? (
            <div className="flex items-center gap-3 bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 px-4 py-3">
              <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/50 p-2 shrink-0">
                <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Your IT Head</p>
                <p className="font-bold text-sm text-emerald-800 dark:text-emerald-200 truncate">{hod.name}</p>
                {hod.email && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    {hod.email}
                  </p>
                )}
              </div>
              <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 shrink-0">Linked</Badge>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 px-4 py-3">
              <div className="rounded-full bg-amber-100 dark:bg-amber-900/50 p-2 shrink-0">
                <AlertCircle className="h-4 w-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">IT Head Link</p>
                <p className="font-semibold text-sm text-amber-800 dark:text-amber-200">Not linked to an IT Head</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">Contact your admin to link your profile</p>
              </div>
              <Badge className="bg-amber-500 text-white text-[10px] px-2 py-0.5 shrink-0">Unlinked</Badge>
            </div>
          )}
        </div>
      )}

      {/* ── Footer CTA ── */}
      <div className="px-5 pb-5">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 font-semibold hover:bg-white/80 dark:hover:bg-white/10 transition-colors"
          onClick={() => router.push("/dashboard/staff-performance-report")}
        >
          <BarChart2 className="h-4 w-4" />
          View Full Leaderboard & Rankings
          <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-60" />
        </Button>
      </div>
    </div>
  )
}
    </Card>
  )
}
