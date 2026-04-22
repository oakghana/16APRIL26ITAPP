"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { createClient } from "@/lib/supabase/client"
import {
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  Search,
  Download,
  BarChart3,
  Activity,
  Target,
  Calendar,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { getCanonicalLocationName } from "@/lib/location-filter"

interface ITStaffMember {
  id: string
  name: string
  email: string
  location: string
  avatar?: string
  joinDate: string
  totalTasksAssigned: number
  completedTasks: number
  inProgressTasks: number
  pendingTasks: number
  averageCompletionTime: number // in hours
  performanceScore: number // 0-100
  currentWorkload: "low" | "medium" | "high" | "overloaded"
  lastActivity: string
  specializations: string[]
  monthlyStats: {
    month: string
    tasksCompleted: number
    averageRating: number
  }[]
}

interface TaskSummary {
  id: string
  title: string
  type: "repair" | "service_desk"
  priority: "low" | "medium" | "high" | "critical"
  status: "assigned" | "in_progress" | "completed" | "on_hold"
  assignedTo: string
  dueDate: string
  progress: number
}

export function ITStaffWorkStatus() {
  const { user } = useAuth()
  const [staffMembers, setStaffMembers] = useState<ITStaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMember, setSelectedMember] = useState<ITStaffMember | null>(null)
  const [recentTasks, setRecentTasks] = useState<TaskSummary[]>([])
  const [selectedStaff, setSelectedStaff] = useState<string>("all")
  const [locationFilter, setLocationFilter] = useState<string>("all")
  const [workloadFilter, setWorkloadFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [timeRange, setTimeRange] = useState("30") // days
  const [dbLocations, setDbLocations] = useState<{ code: string; name: string }[]>([])
  const supabase = createClient()

  useEffect(() => {
    loadStaffMembers()
    loadLocations()
  }, [])

  const loadLocations = async () => {
    try {
      const res = await fetch("/api/admin/lookup-data?type=locations")
      if (res.ok) {
        const data = await res.json()
        const activeLocations = data
          .filter((loc: any) => loc.is_active)
          .map((loc: any) => ({
            code: getCanonicalLocationName(loc.code),
            name: getCanonicalLocationName(loc.name),
          }))
        // Deduplicate by canonical code
        const seen = new Set<string>()
        const deduped = activeLocations.filter((loc: { code: string }) => {
          if (seen.has(loc.code)) return false
          seen.add(loc.code)
          return true
        })
        setDbLocations(deduped)
      }
    } catch (error) {
      console.error("Error loading locations:", error)
    }
  }

  const loadStaffMembers = async () => {
    try {
      setLoading(true)

      // Fetch via API (uses service-role key, bypasses RLS)
      const userRole = user?.role || "it_head"
      const res = await fetch(`/api/staff/list?userRole=${userRole}`)
      if (!res.ok) {
        console.error("Error loading IT staff:", await res.text())
        setStaffMembers([])
        return
      }
      const listData = await res.json()
      let profiles: any[] = listData.staff || []

      // For regional IT head, filter by their location
      if (user && user.role === "regional_it_head" && user.location) {
        const canonicalUserLocation = getCanonicalLocationName(user.location)
        profiles = profiles.filter((p: any) => {
          if (!p.location) return false
          return getCanonicalLocationName(p.location) === canonicalUserLocation
        })
      }

      // Fetch task data for each staff member
      const staffWithTasks: ITStaffMember[] = await Promise.all(
        (profiles || []).map(async (profile) => {
          // Fetch repair requests assigned to this staff
          const { data: repairData } = await supabase
            .from("repair_requests")
            .select("id, status, created_at, updated_at")
            .eq("assigned_to", profile.id)

          const staffName = (profile.name || profile.email || "").toLowerCase().trim()

          // Fetch service tickets assigned to this staff (match by id or assigned name)
          const { data: ticketData } = await supabase
            .from("service_tickets")
            .select("id, status, created_at, updated_at, assigned_to, assigned_to_name, resolved_at, completed_at")
            .or(`assigned_to.eq.${profile.id},assigned_to_name.ilike.%${staffName}%`)

          const repairs = repairData || []
          const tickets = ticketData || []
          const allTasks = [...repairs, ...tickets]

          // Calculate task statistics
          const completedStatuses = ["completed", "closed", "resolved", "repaired", "awaiting_confirmation"]
          const inProgressStatuses = ["in_progress", "in_repair", "assigned", "diagnosing", "with_provider", "in_transit", "awaiting_parts", "on_hold"]
          
          const completedTasks = allTasks.filter(t => completedStatuses.includes(t.status?.toLowerCase() || '')).length
          const inProgressTasks = allTasks.filter(t => inProgressStatuses.includes(t.status?.toLowerCase() || '')).length
          const pendingTasks = allTasks.filter(t => ['pending', 'new', 'open'].includes(t.status?.toLowerCase() || '')).length
          const totalTasks = allTasks.length

          // Calculate performance score based on completion rate
          const performanceScore = totalTasks > 0 
            ? Math.round((completedTasks / totalTasks) * 100) 
            : 0

          // Determine workload
          let currentWorkload: "low" | "medium" | "high" | "overloaded" = "low"
          const activeTasks = inProgressTasks + pendingTasks
          if (activeTasks > 10) currentWorkload = "overloaded"
          else if (activeTasks > 7) currentWorkload = "high"
          else if (activeTasks > 3) currentWorkload = "medium"

          const completionDurationsHours = allTasks
            .filter((task) => completedStatuses.includes((task.status || "").toLowerCase()))
            .map((task) => {
              const created = new Date(task.created_at)
              const endedAt = new Date(task.completed_at || task.resolved_at || task.updated_at)
              if (Number.isNaN(created.getTime()) || Number.isNaN(endedAt.getTime())) return null
              const hours = (endedAt.getTime() - created.getTime()) / (1000 * 60 * 60)
              return hours >= 0 ? hours : null
            })
            .filter((v): v is number => v !== null)

          const avgCompletionTime =
            completionDurationsHours.length > 0
              ? Math.round(completionDurationsHours.reduce((sum, h) => sum + h, 0) / completionDurationsHours.length)
              : 0

          return {
            id: profile.id,
            name: profile.name || profile.email,
            email: profile.email,
            location: profile.location || 'Unknown',
            joinDate: new Date().toISOString(),
            totalTasksAssigned: totalTasks,
            completedTasks,
            inProgressTasks,
            pendingTasks,
            averageCompletionTime: avgCompletionTime,
            performanceScore,
            currentWorkload,
            lastActivity: new Date().toISOString(),
            specializations: profile.role === 'it_head' ? ['Management', 'Strategy'] 
              : profile.role === 'regional_it_head' ? ['Regional Support', 'Coordination']
              : ['Hardware', 'Software'],
            monthlyStats: [],
          }
        })
      )

      setStaffMembers(staffWithTasks)
      
      // Load recent tasks
      await loadRecentTasks()
    } catch (error) {
      console.error("Error loading IT staff:", error)
      setStaffMembers([])
    } finally {
      setLoading(false)
    }
  }

  const loadRecentTasks = async () => {
    try {
      // Fetch recent repair requests
      const { data: repairs } = await supabase
        .from("repair_requests")
        .select(`
          id,
          issue_type,
          status,
          priority,
          assigned_to,
          created_at,
          updated_at,
          profiles:assigned_to (full_name)
        `)
        .order("created_at", { ascending: false })
        .limit(5)

      // Fetch recent service tickets
      const { data: tickets } = await supabase
        .from("service_tickets")
        .select(`
          id,
          title,
          status,
          priority,
          assigned_to,
          created_at,
          updated_at,
          profiles:assigned_to (full_name)
        `)
        .order("created_at", { ascending: false })
        .limit(5)

      const recentTasksList: TaskSummary[] = [
        ...(repairs || []).map((r: any) => ({
          id: r.id,
          title: r.issue_type || 'Repair Request',
          type: 'repair' as const,
          priority: (r.priority || 'medium') as "low" | "medium" | "high" | "critical",
          status: mapStatus(r.status),
          assignedTo: r.profiles?.full_name || 'Unassigned',
          dueDate: new Date(new Date(r.created_at).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          progress: getProgressFromStatus(r.status),
        })),
        ...(tickets || []).map((t: any) => ({
          id: t.id,
          title: t.title || 'Service Ticket',
          type: 'service_desk' as const,
          priority: (t.priority || 'medium') as "low" | "medium" | "high" | "critical",
          status: mapStatus(t.status),
          assignedTo: t.profiles?.full_name || 'Unassigned',
          dueDate: new Date(new Date(t.created_at).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          progress: getProgressFromStatus(t.status),
        })),
      ].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()).slice(0, 10)

      setRecentTasks(recentTasksList)
    } catch (error) {
      console.error("Error loading recent tasks:", error)
    }
  }

  const mapStatus = (status: string): "assigned" | "in_progress" | "completed" | "on_hold" => {
    const s = status?.toLowerCase() || ''
    if (['completed', 'closed', 'resolved', 'repaired'].includes(s)) return 'completed'
    if (['in_progress', 'in_repair', 'diagnosing', 'awaiting_parts'].includes(s)) return 'in_progress'
    if (['on_hold', 'pending_parts'].includes(s)) return 'on_hold'
    return 'assigned'
  }

  const getProgressFromStatus = (status: string): number => {
    const s = status?.toLowerCase() || ''
    if (['completed', 'closed', 'resolved', 'repaired'].includes(s)) return 100
    if (['in_repair', 'diagnosing'].includes(s)) return 60
    if (['in_progress', 'awaiting_parts'].includes(s)) return 40
    if (['assigned'].includes(s)) return 10
    return 0
  }

  const filteredStaff = staffMembers.filter((staff) => {
    let matches = true

    if (locationFilter !== "all" && getCanonicalLocationName(staff.location) !== locationFilter) {
      matches = false
    }

    if (workloadFilter !== "all" && staff.currentWorkload !== workloadFilter) {
      matches = false
    }

    if (searchQuery && !staff.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      matches = false
    }

    return matches
  })

  const getWorkloadColor = (workload: string) => {
    switch (workload) {
      case "low":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300"
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300"
      case "overloaded":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300"
    }
  }

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return "text-green-600"
    if (score >= 80) return "text-yellow-600"
    if (score >= 70) return "text-orange-600"
    return "text-red-600"
  }

  const calculateTeamStats = () => {
    const totalStaff = staffMembers.length
    const totalTasks = staffMembers.reduce((sum, staff) => sum + staff.totalTasksAssigned, 0)
    const completedTasks = staffMembers.reduce((sum, staff) => sum + staff.completedTasks, 0)
    const inProgressTasks = staffMembers.reduce((sum, staff) => sum + staff.inProgressTasks, 0)
    const avgPerformance = totalStaff > 0 
      ? staffMembers.reduce((sum, staff) => sum + staff.performanceScore, 0) / totalStaff
      : 0

    return {
      totalStaff,
      totalTasks,
      completedTasks,
      inProgressTasks,
      avgPerformance: Math.round(avgPerformance) || 0,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    }
  }

  const teamStats = calculateTeamStats()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-600 to-yellow-600 flex items-center justify-center shadow-lg">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">IT Staff Work Status</h1>
            <p className="text-muted-foreground">
              Monitor and manage IT staff work status across all locations • QCC Regional Overview
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button variant="default" size="sm" onClick={() => window.location.href = '/dashboard/staff-performance-report'}>
            <Target className="h-4 w-4 mr-2" />
            View Performance Metrics
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Quality Control Company Ltd.
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Staff
            </CardTitle>
            <div className="text-2xl font-bold">{teamStats.totalStaff}</div>
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Total Tasks
            </CardTitle>
            <div className="text-2xl font-bold">{teamStats.totalTasks}</div>
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Completed
            </CardTitle>
            <div className="text-2xl font-bold">{teamStats.completedTasks}</div>
            <p className="text-xs text-muted-foreground">{teamStats.completionRate}% completion rate</p>
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              In Progress
            </CardTitle>
            <div className="text-2xl font-bold">{teamStats.inProgressTasks}</div>
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Avg Productivity
            </CardTitle>
            <div className="text-2xl font-bold">{teamStats.avgPerformance}%</div>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search" className="sr-only">
                Search staff
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="search"
                  placeholder="Search staff by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {dbLocations.map((loc) => (
                    <SelectItem key={loc.code} value={loc.name}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={workloadFilter} onValueChange={setWorkloadFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Workload" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workloads</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="overloaded">Overloaded</SelectItem>
                </SelectContent>
              </Select>

              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6">
        {loading ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-muted-foreground">Loading staff members...</CardContent>
          </Card>
        ) : staffMembers.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No IT staff members found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStaff.map((staff) => (
              <Card
                key={staff.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedMember(staff)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={staff.avatar || "/placeholder.svg"} />
                        <AvatarFallback className="bg-gradient-to-br from-green-500 to-yellow-500 text-white font-semibold">
                          {staff.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{staff.name}</CardTitle>
                        <CardDescription className="text-sm">
                          {staff.email} • {getCanonicalLocationName(staff.location)}
                        </CardDescription>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={getWorkloadColor(staff.currentWorkload)}>
                            {staff.currentWorkload} workload
                          </Badge>
                          <span className={cn("text-sm font-semibold", getPerformanceColor(staff.performanceScore))}>
                            {staff.performanceScore}% productivity
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-green-600">{staff.completedTasks}</div>
                      <div className="text-xs text-muted-foreground">Completed</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-blue-600">{staff.inProgressTasks}</div>
                      <div className="text-xs text-muted-foreground">In Progress</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-orange-600">{staff.pendingTasks}</div>
                      <div className="text-xs text-muted-foreground">Pending</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Task Completion Rate</span>
                      <span className="font-medium">
                        {staff.totalTasksAssigned > 0 
                          ? Math.round((staff.completedTasks / staff.totalTasksAssigned) * 100) 
                          : 0}%
                      </span>
                    </div>
                    <Progress 
                      value={staff.totalTasksAssigned > 0 
                        ? (staff.completedTasks / staff.totalTasksAssigned) * 100 
                        : 0} 
                      className="h-2" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Avg Completion Time
                      </div>
                      <div className="font-medium">{staff.averageCompletionTime}h</div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Last Activity
                      </div>
                      <div className="font-medium">{new Date(staff.lastActivity).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Specializations</div>
                    <div className="flex gap-2 flex-wrap">
                      {staff.specializations.map((spec, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {spec}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Recent Task Activity
            </CardTitle>
            <CardDescription>Latest task assignments and updates across all IT staff</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{task.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {task.type.replace("_", " ")}
                      </Badge>
                      <Badge
                        className={
                          task.priority === "critical"
                            ? "bg-red-100 text-red-800"
                            : task.priority === "high"
                              ? "bg-orange-100 text-orange-800"
                              : task.priority === "medium"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-blue-100 text-blue-800"
                        }
                      >
                        {task.priority}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Assigned to {task.assignedTo} • Due: {new Date(task.dueDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-medium">{task.progress}%</div>
                      <Progress value={task.progress} className="w-20 h-1" />
                    </div>
                    <Badge
                      className={
                        task.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : task.status === "in_progress"
                            ? "bg-blue-100 text-blue-800"
                            : task.status === "assigned"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {task.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
