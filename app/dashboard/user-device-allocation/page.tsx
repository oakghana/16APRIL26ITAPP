"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Monitor, Wrench, Archive, CheckCircle, Download, User, MapPin, Filter, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { getCanonicalLocationName } from "@/lib/location-filter"
import { safeJsonParse, safeStorage } from "@/lib/utils"

interface Device {
  id: string
  device_type: string
  brand: string
  model: string
  serial_number: string
  status: string
  location: string
  assigned_to: string
  purchase_date: string
  warranty_expiry: string
  created_at: string
}

interface UserProfile {
  id: string
  username: string
  full_name: string
  role: string
  location: string
}

interface AllocationStats {
  totalDevices: number
  activeDevices: number
  devicesInRepair: number
  retiredDevices: number
  byDeviceType: Record<string, number>
  byLocation: Record<string, number>
}

export default function UserDeviceAllocationPage() {
  const { user: authUser, loading: authLoading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [stats, setStats] = useState<AllocationStats | null>(null)
  const [selectedUser, setSelectedUser] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const [locationFilter, setLocationFilter] = useState<string>("all")
  const [activeTab, setActiveTab] = useState("overview")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Allowed roles for this page
  const allowedRoles = ["admin", "it_head"]

  useEffect(() => {
    if (!authLoading && authUser && !allowedRoles.includes(authUser.role)) {
      router.push("/dashboard")
    }
  }, [authUser, authLoading, router])

  useEffect(() => {
    if (authUser && allowedRoles.includes(authUser.role)) {
      loadData()
    }
  }, [authUser])

  const loadData = async (userName?: string) => {
    try {
      setLoading(true)
      setError("")

      const userStr = safeStorage.get("qcc_current_user")
      if (!userStr) {
        throw new Error("User not logged in")
      }
      const currentUser = safeJsonParse<any>(userStr, null)
      if (!currentUser) return

      const params = new URLSearchParams({
        requestingUser: currentUser.username,
      })

      if (userName) {
        params.append("userName", userName)
      }

      const url = `/api/devices/user-allocation-summary?${params.toString()}`
      // </CHANGE>

      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load allocation data")
      }

      console.log("[v0] Loaded user allocation data:", data)
      setUsers(data.users || [])
      setDevices(data.devices || [])
      setStats(data.stats || null)
      setSelectedUser(data.selectedUser || "")
    } catch (err: any) {
      console.error("[v0] Error loading allocation data:", err)
      setError(err.message || "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const handleUserSelect = (userName: string) => {
    setSelectedUser(userName)
    loadData(userName)
  }

  const handleSearch = () => {
    if (searchTerm.trim()) {
      loadData(searchTerm.trim())
    }
  }

  const handleReset = () => {
    setSearchTerm("")
    setSelectedUser("")
    loadData()
  }

  const exportToCSV = () => {
    const csvContent = [
      ["Device Type", "Brand", "Model", "Serial Number", "Status", "Location", "Assigned To", "Purchase Date"],
      ...devices.map((d) => [
        d.device_type,
        d.brand,
        d.model,
        d.serial_number,
        d.status,
        d.location,
        d.assigned_to,
        d.purchase_date || "N/A",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `user-device-allocation-${selectedUser || "all"}-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Filter devices by location (compare using canonical names)
  const filteredDevices = locationFilter === "all" 
    ? devices 
    : devices.filter(d => getCanonicalLocationName(d.location) === locationFilter)
  
  // Get unique canonical locations from devices
  const uniqueLocations = [...new Set(devices.map(d => getCanonicalLocationName(d.location)).filter(Boolean))].sort()

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!authUser || !allowedRoles.includes(authUser.role)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">You do not have access to this page.</p>
      </div>
    )
  }

  if (loading && !users.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground ml-2">Loading user device allocation...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Device Allocation Summary</h1>
          <p className="text-muted-foreground">View devices allocated to users across all locations</p>
        </div>
        <Button onClick={exportToCSV} disabled={!devices.length}>
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      {error && (
        <Card className="bg-destructive/10 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* User Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select User</CardTitle>
          <CardDescription>Search or select a user to view their allocated devices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>
            <Button onClick={handleSearch}>Search</Button>
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
          </div>

          <div>
            <Select value={selectedUser} onValueChange={handleUserSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Or select from all users..." />
              </SelectTrigger>
              <SelectContent>
                {filteredUsers.map((user) => (
                  <SelectItem key={user.id} value={user.full_name || user.username}>
                    {user.full_name || user.username} ({user.role}) - {user.location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedUser && (
            <div className="p-4 bg-primary/5 rounded-lg flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <span className="font-medium">Viewing devices for: {selectedUser}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDevices}</div>
              <p className="text-xs text-muted-foreground mt-1">Allocated to {selectedUser || "all users"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeDevices}</div>
              <p className="text-xs text-muted-foreground mt-1">Currently in use</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">In Repair</CardTitle>
              <Wrench className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.devicesInRepair}</div>
              <p className="text-xs text-muted-foreground mt-1">Under maintenance</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Retired</CardTitle>
              <Archive className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.retiredDevices}</div>
              <p className="text-xs text-muted-foreground mt-1">No longer in service</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabbed Content for better organization */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="devices">Allocated Devices</TabsTrigger>
          <TabsTrigger value="by-type">By Device Type</TabsTrigger>
          <TabsTrigger value="by-location">By Location</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {stats && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    Devices by Type
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {Object.entries(stats.byDeviceType).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                        <span className="text-sm capitalize">{type}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Devices by Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {Object.entries(stats.byLocation).map(([location, count]) => (
                      <div key={location} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                        <span className="text-sm">{location}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="devices">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Allocated Devices</CardTitle>
                  <CardDescription>
                    {selectedUser ? `Devices assigned to ${selectedUser}` : "All devices assigned to users in the system"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      {uniqueLocations.map((loc) => (
                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredDevices.length === 0 ? (
                <div className="text-center py-12">
                  <Monitor className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {selectedUser
                      ? `No devices found for ${selectedUser}`
                      : "No devices found. Try selecting a different user or location."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {filteredDevices.map((device) => (
                    <div key={device.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {device.brand} {device.model}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {device.device_type}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Serial: {device.serial_number} | Location: {getCanonicalLocationName(device.location)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Assigned to: <span className="font-medium">{device.assigned_to}</span>
                        </div>
                      </div>
                      <Badge
                        variant={
                          device.status === "active" ? "default" : device.status === "repair" ? "destructive" : "secondary"
                        }
                      >
                        {device.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-type">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Devices by Type
              </CardTitle>
              <CardDescription>Breakdown of all allocated devices by device type</CardDescription>
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(stats.byDeviceType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Monitor className="h-5 w-5 text-primary" />
                        </div>
                        <span className="font-medium capitalize">{type}</span>
                      </div>
                      <Badge variant="secondary" className="text-lg px-3 py-1">{count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-location">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Devices by Location
              </CardTitle>
              <CardDescription>Breakdown of all allocated devices by location</CardDescription>
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(stats.byLocation).map(([location, count]) => (
                    <div key={location} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <MapPin className="h-5 w-5 text-green-600" />
                        </div>
                        <span className="font-medium">{location}</span>
                      </div>
                      <Badge variant="secondary" className="text-lg px-3 py-1">{count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
