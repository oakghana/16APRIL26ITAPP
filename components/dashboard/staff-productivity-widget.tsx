"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Award, ExternalLink, Clock, CheckCircle, Target } from "lucide-react"
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

  // Only show for IT staff roles
  const isITStaff = user?.role === "it_staff" || user?.role === "it_head" || user?.role === "regional_it_head"

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

  if (!isITStaff || loading || !productivity) return null

  const getGradingColor = (grading: string) => {
    switch (grading) {
      case "Excellent":
        return "bg-green-600 hover:bg-green-700"
      case "Good":
        return "bg-blue-600 hover:bg-blue-700"
      case "Average":
        return "bg-yellow-600 hover:bg-yellow-700"
      case "Below Average":
        return "bg-orange-600 hover:bg-orange-700"
      case "Poor":
        return "bg-red-600 hover:bg-red-700"
      default:
        return "bg-gray-600 hover:bg-gray-700"
    }
  }

  return (
    <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-6 w-6 text-blue-600" />
              Your Productivity Metrics
            </CardTitle>
            <CardDescription>Current performance and ranking</CardDescription>
          </div>
          <Badge className={cn(getGradingColor(productivity.grading), "text-base px-4 py-2 font-bold")}>
            {productivity.grading}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Productivity Score - Highlighted */}
        <div className="flex items-center justify-between p-3 bg-blue-100/50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <span className="text-sm font-semibold text-foreground">Productivity Score</span>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-extrabold text-blue-700 dark:text-blue-300">{productivity.productivityScore}</span>
            <span className="text-xs text-muted-foreground">/100+</span>
          </div>
        </div>

        {/* Rank - Highlighted */}
        {productivity.rank && (
          <div className="flex items-center justify-between p-3 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <span className="text-sm font-semibold text-foreground">Your Rank</span>
            <div className="flex items-center gap-2">
              {productivity.rank <= 3 ? (
                <Award className="h-5 w-5 text-yellow-500" />
              ) : null}
              <span className="text-2xl font-extrabold text-amber-700 dark:text-amber-300">
                #{productivity.rank}
              </span>
              <span className="text-sm text-muted-foreground">
                of {productivity.totalStaff}
              </span>
            </div>
          </div>
        )}

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle className="h-3 w-3" />
              <span>Completion Rate</span>
            </div>
            <p className="text-lg font-semibold">{productivity.completionRate}%</p>
            <p className="text-xs text-muted-foreground">
              {productivity.completedTasks}/{productivity.totalTasksAssigned} tasks
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>On-Time Rate</span>
            </div>
            <p className="text-lg font-semibold">{productivity.onTimeRate}%</p>
            <p className="text-xs text-muted-foreground">
              {productivity.onTimeCompletions} on-time
            </p>
          </div>
        </div>

        {/* Average Completion Time */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">Avg Completion Time</span>
          <span className="font-semibold">{productivity.averageCompletionDays} days</span>
        </div>

        {/* View Full Report Button */}
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full gap-2"
          onClick={() => router.push('/dashboard/staff-performance-report')}
        >
          <ExternalLink className="h-4 w-4" />
          View Full Performance Report
        </Button>
      </CardContent>
    </Card>
  )
}
