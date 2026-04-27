"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Monitor, Wrench, Users, Clock, AlertTriangle, MapPin, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface SystemStats {
  totalDevices: number
  activeRepairs: number
  totalUsers: number
  serviceProviders: number
  avgRepairTime: number
  pendingApprovals: number
}

interface RegionalStat {
  region: string
  devices: number
  repairs: number
  users: number
}

export function SystemOverview() {
  const [loading, setLoading] = useState(true)
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalDevices: 0,
    activeRepairs: 0,
    totalUsers: 0,
    serviceProviders: 0,
    avgRepairTime: 0,
    pendingApprovals: 0,
  })
  const [regionalStats, setRegionalStats] = useState<RegionalStat[]>([])

  useEffect(() => {
    loadSystemStats()
  }, [])

  const loadSystemStats = async () => {
    try {
      const supabase = createClient()

      const [devicesResult, repairsResult, usersResult, providersResult, pendingUsersResult] = await Promise.all([
        supabase.from("devices").select("id", { count: "exact", head: true }),
        supabase.from("repair_requests").select("id", { count: "exact", head: true }).eq("status", "in_repair"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("service_providers").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ])

      // Calculate average repair time from completed repairs
      const { data: completedRepairs } = await supabase
        .from("repair_requests")
        .select("created_at, completion_date")
        .eq("status", "completed")
        .not("completed_date", "is", null)
        .limit(50)

      let avgRepairDays = 0
      if (completedRepairs && completedRepairs.length > 0) {
        const validDurations = completedRepairs
          .map((repair) => {
            if (!repair.created_at || !repair.completion_date) return null

            const start = new Date(repair.created_at).getTime()
            const end = new Date(repair.completion_date).getTime()

            if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
              return null
            }

            return (end - start) / (1000 * 60 * 60 * 24)
          })
          .filter((value): value is number => value !== null)

        avgRepairDays = validDurations.length > 0
          ? validDurations.reduce((sum, days) => sum + days, 0) / validDurations.length
          : 0
      }

      // Fetch regional statistics
      const locations = ["Head Office", "Accra", "Kumasi", "Kaase Inland Port", "Swedru/CR", "Takoradi"]
      const regionalData: RegionalStat[] = []

      for (const location of locations) {
        const [devicesCount, repairsCount, usersCount] = await Promise.all([
          supabase.from("devices").select("id", { count: "exact", head: true }).ilike("location", location),
          supabase
            .from("repair_requests")
            .select("id", { count: "exact", head: true })
            .or(`location.ilike.%${location}%,requester_location.ilike.%${location}%`)
            .eq("status", "in_repair"),
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .ilike("location", location)
            .eq("status", "approved"),
        ])

        regionalData.push({
          region: location,
          devices: devicesCount.count || 0,
          repairs: repairsCount.count || 0,
          users: usersCount.count || 0,
        })
      }

      setSystemStats({
        totalDevices: devicesResult.count || 0,
        activeRepairs: repairsResult.count || 0,
        totalUsers: usersResult.count || 0,
        serviceProviders: providersResult.count || 0,
        avgRepairTime: Number.parseFloat(avgRepairDays.toFixed(1)),
        pendingApprovals: pendingUsersResult.count || 0,
      })

      setRegionalStats(regionalData.filter((r) => r.devices > 0 || r.repairs > 0 || r.users > 0))
    } catch (error) {
      console.error("[v0] Error loading system stats:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.totalDevices}</div>
            <p className="text-xs text-muted-foreground">Registered in system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Repairs</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.activeRepairs}</div>
            <p className="text-xs text-muted-foreground">Currently in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Active accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Repair Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemStats.avgRepairTime > 0 ? `${systemStats.avgRepairTime}d` : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">Average completion time</p>
          </CardContent>
        </Card>
      </div>

      {/* Regional Overview */}
      {regionalStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Regional Overview</CardTitle>
            <CardDescription>Device and repair statistics by location</CardDescription>
          </CardHeader>
          <CardContent>
            {regionalStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No regional data available</p>
            ) : (
              <div className="space-y-4">
                {regionalStats.map((region) => (
                  <div key={region.region} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <MapPin className="h-5 w-5 text-primary" />
                      <div>
                        <h4 className="font-medium">{region.region}</h4>
                        <p className="text-sm text-muted-foreground">{region.users} users</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6 text-sm">
                      <div className="text-center">
                        <p className="font-medium">{region.devices}</p>
                        <p className="text-muted-foreground">Devices</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">{region.repairs}</p>
                        <p className="text-muted-foreground">Active Repairs</p>
                      </div>
                      <Badge
                        variant={region.repairs > 5 ? "destructive" : region.repairs > 2 ? "secondary" : "default"}
                      >
                        {region.repairs > 5 ? "High Load" : region.repairs > 2 ? "Moderate" : "Normal"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending Approvals Alert */}
      {systemStats.pendingApprovals > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <CardHeader>
            <CardTitle className="text-orange-900 dark:text-orange-100 flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Pending User Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-800 dark:text-orange-200">
              There {systemStats.pendingApprovals === 1 ? "is" : "are"} <strong>{systemStats.pendingApprovals}</strong>{" "}
              user account{systemStats.pendingApprovals === 1 ? "" : "s"} pending approval. Please review and approve or
              reject these requests in the Users tab.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
