"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Award, ExternalLink, Clock, CheckCircle, Target, TrendingUp, Star, Zap } from "lucide-react"
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
}

export function StaffProductivityWidget() {
  const { user } = useAuth()
  const router = useRouter()
  const [productivity, setProductivity] = useState<ProductivityData | null>(null)
  const [loading, setLoading] = useState(true)

  // Show for IT and operational heads whose work is measured in the productivity engine
  const isITStaff = ["it_staff", "it_head", "regional_it_head", "it_store_head", "service_desk_head"].includes(user?.role || "")

  useEffect(() => {
    if (!isITStaff || !user) return

    const loadProductivity = async () => {
      try {
        const response = await fetch(`/api/staff/my-productivity?staffId=${user.id}`)
        const data = await response.json()

        if (data.success) {
          setProductivity(data.metrics)
        }
      } catch (error) {
        console.error("[v0] Error loading productivity metrics:", error)
      } finally {
        setLoading(false)
      }
    }

    loadProductivity()
  }, [user, isITStaff])

  if (!isITStaff) return null

  const getGradingConfig = (grading: string) => {
    switch (grading) {
      case "Excellent":
        return {
          badgeBg: "bg-green-600",
          borderColor: "border-green-500",
          gradientFrom: "from-green-50 dark:from-green-950/30",
          gradientTo: "to-emerald-50 dark:to-emerald-950/20",
          scoreBg: "bg-green-100 dark:bg-green-900/40 border-green-200 dark:border-green-800",
          scoreText: "text-green-700 dark:text-green-300",
          message: "Outstanding work! You're one of the top performers.",
          icon: <Star className="h-5 w-5 text-green-600" />,
        }
      case "Good":
        return {
          badgeBg: "bg-blue-600",
          borderColor: "border-blue-500",
          gradientFrom: "from-blue-50 dark:from-blue-950/30",
          gradientTo: "to-indigo-50 dark:to-indigo-950/20",
          scoreBg: "bg-blue-100 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800",
          scoreText: "text-blue-700 dark:text-blue-300",
          message: "Great performance! Keep pushing to reach Excellent.",
          icon: <TrendingUp className="h-5 w-5 text-blue-600" />,
        }
      case "Average":
        return {
          badgeBg: "bg-yellow-600",
          borderColor: "border-yellow-500",
          gradientFrom: "from-yellow-50 dark:from-yellow-950/30",
          gradientTo: "to-amber-50 dark:to-amber-950/20",
          scoreBg: "bg-yellow-100 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800",
          scoreText: "text-yellow-700 dark:text-yellow-300",
          message: "You're doing okay. Focus on completing tasks on time to improve.",
          icon: <Target className="h-5 w-5 text-yellow-600" />,
        }
      case "Below Average":
        return {
          badgeBg: "bg-orange-600",
          borderColor: "border-orange-500",
          gradientFrom: "from-orange-50 dark:from-orange-950/30",
          gradientTo: "to-red-50 dark:to-red-950/20",
          scoreBg: "bg-orange-100 dark:bg-orange-900/40 border-orange-200 dark:border-orange-800",
          scoreText: "text-orange-700 dark:text-orange-300",
          message: "Attention needed. Please review your pending tasks and speed up completions.",
          icon: <Zap className="h-5 w-5 text-orange-600" />,
        }
      default: // Poor
        return {
          badgeBg: "bg-red-600",
          borderColor: "border-red-500",
          gradientFrom: "from-red-50 dark:from-red-950/30",
          gradientTo: "to-rose-50 dark:to-rose-950/20",
          scoreBg: "bg-red-100 dark:bg-red-900/40 border-red-200 dark:border-red-800",
          scoreText: "text-red-700 dark:text-red-300",
          message: "Urgent: Your performance score requires immediate improvement. Speak with your IT Head.",
          icon: <Clock className="h-5 w-5 text-red-600" />,
        }
    }
  }

  // Show skeleton while loading
  if (loading) {
    return (
      <Card className="border-l-4 border-l-blue-400 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardContent className="p-5">
          <div className="flex items-center justify-between animate-pulse">
            <div className="space-y-2">
              <div className="h-4 w-48 bg-muted rounded" />
              <div className="h-3 w-32 bg-muted rounded" />
            </div>
            <div className="h-10 w-28 bg-muted rounded-full" />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted rounded-lg" />)}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!productivity) return null

  const config = getGradingConfig(productivity.grading)

  return (
    <Card className={cn(
      "border-l-4 bg-gradient-to-br w-full",
      config.borderColor,
      config.gradientFrom,
      config.gradientTo,
    )}>
      <CardContent className="p-5">
        {/* Top row: title + grade badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/60 dark:bg-white/10 rounded-lg shadow-sm">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">My Performance Score</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                {config.icon}
                {config.message}
              </p>
            </div>
          </div>
          <Badge className={cn(config.badgeBg, "text-white text-sm px-4 py-1.5 font-bold shrink-0 shadow-sm")}>
            {productivity.grading}
          </Badge>
        </div>

        {/* Score + progress bar */}
        <div className={cn("rounded-xl p-4 border mb-4", config.scoreBg)}>
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Productivity Score</p>
              <p className={cn("text-5xl font-black leading-none mt-1", config.scoreText)}>
                {productivity.productivityScore}
              </p>
              <p className="text-xs text-muted-foreground mt-1">out of 100+</p>
            </div>
            {productivity.rank && (
              <div className="text-right">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your Rank</p>
                <div className="flex items-center gap-1 justify-end mt-1">
                  {productivity.rank <= 3 && <Award className="h-5 w-5 text-yellow-500" />}
                  <p className={cn("text-3xl font-black", config.scoreText)}>#{productivity.rank}</p>
                </div>
                <p className="text-xs text-muted-foreground">of {productivity.totalStaff} staff</p>
              </div>
            )}
          </div>
          <Progress 
            value={Math.min(100, productivity.productivityScore)} 
            className="h-2.5 mt-3"
          />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white/50 dark:bg-white/5 rounded-lg p-3 border border-white/20">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
              <span className="text-xs text-muted-foreground font-medium">Completion</span>
            </div>
            <p className="text-xl font-bold">{productivity.completionRate}%</p>
            <p className="text-xs text-muted-foreground">{productivity.completedTasks}/{productivity.totalTasksAssigned} tasks</p>
          </div>

          <div className="bg-white/50 dark:bg-white/5 rounded-lg p-3 border border-white/20">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs text-muted-foreground font-medium">On-Time</span>
            </div>
            <p className="text-xl font-bold">{productivity.onTimeRate}%</p>
            <p className="text-xs text-muted-foreground">{productivity.onTimeCompletions} on-time</p>
          </div>

          <div className="bg-white/50 dark:bg-white/5 rounded-lg p-3 border border-white/20">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="h-3.5 w-3.5 text-yellow-600" />
              <span className="text-xs text-muted-foreground font-medium">Avg Speed</span>
            </div>
            <p className="text-xl font-bold">{productivity.averageCompletionDays}d</p>
            <p className="text-xs text-muted-foreground">avg completion</p>
          </div>

          <div className="bg-white/50 dark:bg-white/5 rounded-lg p-3 border border-white/20">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="h-3.5 w-3.5 text-purple-600" />
              <span className="text-xs text-muted-foreground font-medium">Total Tasks</span>
            </div>
            <p className="text-xl font-bold">{productivity.totalTasksAssigned}</p>
            <p className="text-xs text-muted-foreground">assigned to you</p>
          </div>
        </div>

        {/* Action button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20"
          onClick={() => router.push('/dashboard/staff-performance-report')}
        >
          <ExternalLink className="h-4 w-4" />
          View Full Performance Report & Rankings
        </Button>
      </CardContent>
    </Card>
  )
}
