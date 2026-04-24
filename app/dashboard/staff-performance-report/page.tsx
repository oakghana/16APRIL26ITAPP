"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Trophy, Medal, Award, TrendingUp, Clock, CheckCircle, Download, Calendar } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

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
  rank: number
  grading: "Excellent" | "Good" | "Average" | "Below Average" | "Poor"
}

export default function StaffPerformanceReport() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState<ProductivityMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState("year") // year, quarter, month, custom
  const [locationFilter, setLocationFilter] = useState("all")
  const [locations, setLocations] = useState<string[]>([])
  
  // Calculate date range
  const getDateRange = () => {
    const now = new Date()
    let startDate = new Date(now.getFullYear(), 0, 1) // Start of year
    let endDate = now

    if (dateRange === "quarter") {
      const quarter = Math.floor(now.getMonth() / 3)
      startDate = new Date(now.getFullYear(), quarter * 3, 1)
    } else if (dateRange === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }
  }

  useEffect(() => {
    loadMetrics()
    loadLocations()
  }, [dateRange, locationFilter])

  const loadLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      if (data.success) {
        setLocations(data.locations)
      }
    } catch (error) {
      console.error("Error loading locations:", error)
    }
  }

  const loadMetrics = async () => {
    try {
      setLoading(true)
      const { startDate, endDate } = getDateRange()
      
      const params = new URLSearchParams({
        startDate,
        endDate,
      })

      if (locationFilter !== "all") {
        params.append("location", locationFilter)
      }

      const response = await fetch(`/api/staff/productivity-metrics?${params}`)
      const data = await response.json()

      if (data.success) {
        setMetrics(data.metrics)
      }
    } catch (error) {
      console.error("Error loading productivity metrics:", error)
    } finally {
      setLoading(false)
    }
  }

  const exportReport = () => {
    const csvData = [
      ["Rank", "Name", "Email", "Location", "Total Tasks", "Completed", "On-Time", "Avg Days", "Completion %", "On-Time %", "Score", "Grade"],
      ...metrics.map((m) => [
        m.rank,
        m.staffName,
        m.email,
        m.location,
        m.totalTasksAssigned,
        m.completedTasks,
        m.onTimeCompletions,
        m.averageCompletionDays,
        m.completionRate,
        m.onTimeRate,
        m.productivityScore,
        m.grading,
      ]),
    ]

    const csv = csvData.map((row) => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `staff-performance-report-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const getGradingBadge = (grading: string) => {
    switch (grading) {
      case "Excellent":
        return <Badge className="bg-green-600">Excellent</Badge>
      case "Good":
        return <Badge className="bg-blue-600">Good</Badge>
      case "Average":
        return <Badge className="bg-yellow-600">Average</Badge>
      case "Below Average":
        return <Badge className="bg-orange-600">Below Average</Badge>
      case "Poor":
        return <Badge variant="destructive">Poor</Badge>
      default:
        return <Badge variant="secondary">{grading}</Badge>
    }
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading performance metrics...</p>
        </div>
      </div>
    )
  }

  const topPerformers = metrics.slice(0, 3)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Staff Performance Report</h1>
          <p className="text-muted-foreground">
            Productivity metrics and rankings for IT teams, Store Heads, and Service Desk Heads based on tasks and in-app activities
          </p>
        </div>
        <Button onClick={exportReport} className="gap-2">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>

        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location} value={location}>
                {location}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Top Performers */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Top Performers</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {topPerformers.map((performer) => (
            <Card key={performer.staffId} className="border-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {getRankIcon(performer.rank)}
                    Rank #{performer.rank}
                  </CardTitle>
                  {getGradingBadge(performer.grading)}
                </div>
                <CardDescription>{performer.staffName}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Productivity Score</span>
                  <span className="font-bold text-lg">{performer.productivityScore}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Completion Rate</span>
                  <span className="font-semibold">{performer.completionRate}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">On-Time Rate</span>
                  <span className="font-semibold">{performer.onTimeRate}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Avg Completion</span>
                  <span className="font-semibold">{performer.averageCompletionDays} days</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Full Rankings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Performance Rankings</CardTitle>
          <CardDescription>
            Ranked by productivity score (completion rate × 40% + on-time rate × 25% + speed bonus × 15% + volume bonus up to 30 pts)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Rank</TableHead>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-center">Tasks</TableHead>
                  <TableHead className="text-center">Completed</TableHead>
                  <TableHead className="text-center">On-Time</TableHead>
                  <TableHead className="text-center">Avg Days</TableHead>
                  <TableHead className="text-center">Complete %</TableHead>
                  <TableHead className="text-center">On-Time %</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead>Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map((metric) => (
                  <TableRow key={metric.staffId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getRankIcon(metric.rank)}
                        #{metric.rank}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{metric.staffName}</div>
                        <div className="text-sm text-muted-foreground">{metric.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{metric.location}</TableCell>
                    <TableCell className="text-center">{metric.totalTasksAssigned}</TableCell>
                    <TableCell className="text-center">{metric.completedTasks}</TableCell>
                    <TableCell className="text-center">{metric.onTimeCompletions}</TableCell>
                    <TableCell className="text-center">{metric.averageCompletionDays}</TableCell>
                    <TableCell className="text-center">{metric.completionRate}%</TableCell>
                    <TableCell className="text-center">{metric.onTimeRate}%</TableCell>
                    <TableCell className="text-center">
                      <span className="font-bold text-lg">{metric.productivityScore}</span>
                    </TableCell>
                    <TableCell>{getGradingBadge(metric.grading)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Explanation */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">Scoring Methodology</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <strong>Productivity Score Calculation:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li>40% - Task Completion Rate (completed tasks / total tasks assigned)</li>
              <li>25% - On-Time Completion Rate (tasks completed within expected timeframe)</li>
              <li>15% - Speed Bonus (faster completions earn higher bonus points)</li>
              <li>20% - Volume Bonus (up to 30 points for high task completion volume)</li>
            </ul>
          </div>
          <div>
            <strong>Speed Bonus (weighted at 0.75):</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li>≤3 days average completion: +15 points</li>
              <li>3-5 days average completion: +7.5 points</li>
              <li>5-7 days average completion: +3.75 points</li>
              <li>&gt;7 days average completion: +0 points</li>
            </ul>
          </div>
          <div>
            <strong>Volume Bonus:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li>Staff who complete more tasks receive higher scores</li>
              <li>+0.5 points per completed task (up to 30 bonus points)</li>
              <li>Rewards high-volume workers who handle more assignments</li>
            </ul>
          </div>
          <div>
            <strong>Performance Grading:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li>Excellent: Score ≥90</li>
              <li>Good: Score 75-89</li>
              <li>Average: Score 55-74</li>
              <li>Below Average: Score 35-54</li>
              <li>Poor: Score &lt;35</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
