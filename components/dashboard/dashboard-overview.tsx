"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Monitor, Wrench, CheckCircle, AlertTriangle, Clock, Users, Plus, Settings, Calendar } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { getRoleColorScheme } from "@/lib/role-colors"
import { cn } from "@/lib/utils"
import { canSeeAllLocations } from "@/lib/location-filter"
import { StaffProductivityWidget } from "./staff-productivity-widget"
import { IncompleteTasksWidget } from "./incomplete-tasks-widget"
import { UserNotificationsWidget } from "./user-notifications-widget"
import { InitialNotificationsToast } from "@/components/notifications/initial-notifications-toast"
import { WeeklyReportsSummaryWidget } from "./weekly-reports-summary-widget"

export function DashboardOverview() {
  const router = useRouter()
  const { user } = useAuth()
  const [showAlerts, setShowAlerts] = useState(false)
  const roleColors = user?.role ? getRoleColorScheme(user.role) : null
  const [stats, setStats] = useState({
    totalDevices: 0,
    activeRepairs: 0,
    completedRepairs: 0,
    pendingApprovals: 0,
    assignedTasks: 0,
    inProgressTasks: 0,
    completedTasks: 0,
    pendingReview: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return

      const canSeeAll = canSeeAllLocations(user)
      const userLoc = user.location?.trim() || ""

      try {
        // Use API endpoint that bypasses RLS
        const params = new URLSearchParams({
          location: userLoc,
          canSeeAll: String(canSeeAll),
          userRole: user.role || "",
          userId: user.id || "",
        })

        const response = await fetch(`/api/dashboard/stats?${params}`)
        const data = await response.json()

        if (!response.ok) {
          console.error("[v0] Error fetching dashboard stats:", data.error)
          return
        }

        console.log("[v0] Dashboard stats loaded:", data)

        setStats({
          totalDevices: data.totalDevices || 0,
          activeRepairs: data.activeRepairs || 0,
          completedRepairs: data.completedRepairs || 0,
          pendingApprovals: data.pendingApprovals || 0,
          assignedTasks: data.assignedTasks || 0,
          inProgressTasks: data.inProgressTasks || 0,
          completedTasks: data.completedTasks || 0,
          pendingReview: data.pendingReview || 0,
        })
      } catch (error) {
        console.error("Error fetching dashboard stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()

    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [user])

  const handleNewRepairRequest = () => {
    router.push("/dashboard/repairs")
  }

  const handleAddNewDevice = () => {
    router.push("/dashboard/devices")
  }

  const handleManageUsers = () => {
    router.push("/dashboard/admin")
  }

  const handleViewAlerts = () => {
    setShowAlerts(true)
  }

  const alerts = [
    {
      id: 1,
      type: "warning",
      title: "Overdue Repair",
      message: "Dell Laptop #DL-2024-001 repair is overdue by 3 days",
      time: "2 hours ago",
    },
    {
      id: 2,
      type: "info",
      title: "New Service Provider",
      message: "Natland Computers has been added as a service provider",
      time: "1 day ago",
    },
    {
      id: 3,
      type: "success",
      title: "Repair Completed",
      message: "HP Printer #HP-2024-045 repair has been completed",
      time: "2 days ago",
    },
  ]

  const getStats = () => {
    if (user?.role === "it_staff") {
      return [
        {
          title: "Assigned Tasks",
          value: loading ? "..." : stats.assignedTasks.toString(),
          description: "Total repair assignments",
          icon: Wrench,
          trend: "",
        },
        {
          title: "In Progress",
          value: loading ? "..." : stats.inProgressTasks.toString(),
          description: "Currently working on",
          icon: Clock,
          trend: "",
        },
        {
          title: "Completed",
          value: loading ? "..." : stats.completedTasks.toString(),
          description: "This month",
          icon: CheckCircle,
          trend: "",
        },
        {
          title: "Pending Review",
          value: loading ? "..." : stats.pendingReview.toString(),
          description: "Awaiting approval",
          icon: Calendar,
          trend: "",
        },
      ]
    }

    if (user?.role === "it_store_head") {
      return [
        {
          title: "Total Devices",
          value: loading ? "..." : stats.totalDevices.toString(),
          description: "Registered in system",
          icon: Monitor,
          trend: "",
        },
        {
          title: "Pending Requisitions",
          value: loading ? "..." : stats.pendingApprovals.toString(),
          description: "Awaiting processing",
          icon: Clock,
          trend: "",
        },
        {
          title: "Active Repairs",
          value: loading ? "..." : stats.activeRepairs.toString(),
          description: "Currently in progress",
          icon: Wrench,
          trend: "",
        },
        {
          title: "Completed Repairs",
          value: loading ? "..." : stats.completedRepairs.toString(),
          description: "This month",
          icon: CheckCircle,
          trend: "",
        },
      ]
    }

    return [
      {
        title: "Total Devices",
        value: loading ? "..." : stats.totalDevices.toString(),
        description: "Across all regions",
        icon: Monitor,
        trend: "",
      },
      {
        title: "Active Repairs",
        value: loading ? "..." : stats.activeRepairs.toString(),
        description: "Currently in progress",
        icon: Wrench,
        trend: "",
      },
      {
        title: "Completed Repairs",
        value: loading ? "..." : stats.completedRepairs.toString(),
        description: "This month",
        icon: CheckCircle,
        trend: "",
      },
      {
        title: "Pending Approvals",
        value: loading ? "..." : stats.pendingApprovals.toString(),
        description: "Awaiting IT head review",
        icon: Clock,
        trend: "",
      },
    ]
  }

  interface RecentActivity {
    id: string
    type: "repair_request" | "repair_assigned" | "device_transfer" | "repair_in_progress" | "repair_completed"
    device: string
    user: string
    region: string
    status: string
    time: string
  }

  const getRecentActivity = (): RecentActivity[] => {
    return []
  }

  const displayStats = getStats()
  const recentActivity = getRecentActivity()

  return (
    <div className="space-y-6">
      <InitialNotificationsToast />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {user?.role === "it_staff"
              ? "Manage your assigned repair tasks and track progress"
              : "Welcome to the QCC IT Device Tracking System"}
          </p>
        </div>
        {user?.location && !canSeeAllLocations(user) && (
          <Badge variant="outline" className="w-fit text-xs px-3 py-1">
            📍 {user.location}
          </Badge>
        )}
      </div>

      {/* Performance Banner - shown prominently at top for IT staff */}
      {(user?.role === "it_staff" || user?.role === "it_head" || user?.role === "regional_it_head") && (
        <StaffProductivityWidget />
      )}

      {/* Stats Grid - More compact */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {displayStats.map((stat) => (
          <Card key={stat.title} className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.description}</p>
                </div>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* IT Staff Incomplete Tasks Notifications */}
      {(user?.role === "it_staff" || user?.role === "it_head" || user?.role === "regional_it_head") && (
        <IncompleteTasksWidget />
      )}

      {/* Admin-only: Weekly Internet Reports Summary */}
      {user?.role === "admin" && (
        <WeeklyReportsSummaryWidget />
      )}

      {/* User Notifications Widget */}
      <UserNotificationsWidget />

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              {user?.role === "it_staff"
                ? "Latest repair assignments and updates"
                : "Latest device movements and repair requests"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="py-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {(activity.type === "repair_request" || activity.type === "repair_assigned") && (
                        <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                          <Wrench className="h-4 w-4 text-orange-600" />
                        </div>
                      )}
                      {(activity.type === "device_transfer" || activity.type === "repair_in_progress") && (
                        <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                          <Monitor className="h-4 w-4 text-amber-600" />
                        </div>
                      )}
                      {activity.type === "repair_completed" && (
                        <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                          <CheckCircle className="h-4 w-4 text-orange-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{activity.device}</p>
                      <p className="text-sm text-muted-foreground">
                        {activity.user} • {activity.region}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={activity.status === "completed" ? "default" : "secondary"}>
                        {activity.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{activity.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {user?.role === "it_staff" || user?.role === "it_head" || user?.role === "regional_it_head" ? (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start bg-transparent hover:bg-green-50 hover:border-green-200 transition-colors"
                  onClick={() => router.push("/dashboard/repairs")}
                >
                  <Wrench className="h-5 w-5 mr-3 text-green-600" />
                  <span className="text-sm font-medium">View Repair Requests</span>
                </Button>

                <Dialog open={showAlerts} onOpenChange={setShowAlerts}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start bg-transparent hover:bg-green-50 hover:border-green-200 transition-colors"
                      onClick={handleViewAlerts}
                    >
                      <AlertTriangle className="h-5 w-5 mr-3 text-green-600" />
                      <span className="text-sm font-medium">View Notifications</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Repair Notifications</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {alerts.map((alert) => (
                        <div key={alert.id} className="flex items-start space-x-3 p-3 rounded-lg border">
                          <div
                            className={`h-2 w-2 rounded-full mt-2 ${
                              alert.type === "warning"
                                ? "bg-orange-500"
                                : alert.type === "success"
                                  ? "bg-orange-600"
                                  : "bg-amber-500"
                            }`}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{alert.title}</p>
                            <p className="text-xs text-muted-foreground">{alert.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">{alert.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <>
                {/* IT roles quick actions */}
                {(user?.role === "it_staff" ||
                  user?.role === "it_head" ||
                  user?.role === "regional_it_head" ||
                  user?.role === "admin") && (
                  <>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start bg-transparent transition-colors",
                        roleColors
                          ? `hover:${roleColors.background} hover:${roleColors.border}`
                          : "hover:bg-green-50 hover:border-green-200",
                      )}
                      onClick={handleNewRepairRequest}
                    >
                      <Wrench
                        className={cn("h-5 w-5 mr-3", roleColors ? roleColors.textSecondary : "text-green-600")}
                      />
                      <span className="text-sm font-medium">New Repair Request</span>
                    </Button>

                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start bg-transparent transition-colors",
                        roleColors
                          ? `hover:${roleColors.background} hover:${roleColors.border}`
                          : "hover:bg-green-50 hover:border-green-200",
                      )}
                      onClick={handleAddNewDevice}
                    >
                      <Monitor
                        className={cn("h-5 w-5 mr-3", roleColors ? roleColors.textSecondary : "text-green-600")}
                      />
                      <span className="text-sm font-medium">Add New Device</span>
                    </Button>
                  </>
                )}

                {(user?.role === "admin" || user?.role === "it_head" || user?.role === "regional_it_head") && (
                  <Button
                    variant="outline"
                    className="w-full justify-start bg-transparent hover:bg-green-50 hover:border-green-200 transition-colors"
                    onClick={handleManageUsers}
                  >
                    <Users className="h-5 w-5 mr-3 text-green-600" />
                    <span className="text-sm font-medium">Manage Users</span>
                  </Button>
                )}

                {user?.role === "staff" && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-start bg-transparent hover:bg-green-50 hover:border-green-200 transition-colors"
                      onClick={() => router.push("/dashboard/complaints")}
                    >
                      <Plus className="h-5 w-5 mr-3 text-green-600" />
                      <span className="text-sm font-medium">Submit Complaint</span>
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-start bg-transparent hover:bg-green-50 hover:border-green-200 transition-colors"
                      onClick={() => router.push("/dashboard/service-desk")}
                    >
                      <Settings className="h-5 w-5 mr-3 text-green-600" />
                      <span className="text-sm font-medium">My Service Requests</span>
                    </Button>
                  </>
                )}

                {user?.role === "it_store_head" && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-start bg-transparent hover:bg-blue-50 hover:border-blue-200 transition-colors"
                      onClick={() => router.push("/dashboard/store-overview")}
                    >
                      <Monitor className="h-5 w-5 mr-3 text-blue-600" />
                      <span className="text-sm font-medium">View Store Overview</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start bg-transparent hover:bg-blue-50 hover:border-blue-200 transition-colors"
                      onClick={() => router.push("/dashboard/assign-stock")}
                    >
                      <Users className="h-5 w-5 mr-3 text-blue-600" />
                      <span className="text-sm font-medium">Assign Stock to Staff</span>
                    </Button>
                  </>
                )}

                {user?.role === "admin" && (
                  <Button
                    variant="outline"
                    className="w-full justify-start bg-transparent hover:bg-green-50 hover:border-green-200 transition-colors"
                    onClick={() => router.push("/dashboard/system-settings")}
                  >
                    <Settings className="h-5 w-5 mr-3 text-green-600" />
                    <span className="text-sm font-medium">System Settings</span>
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
