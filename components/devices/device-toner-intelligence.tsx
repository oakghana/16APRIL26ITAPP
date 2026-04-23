"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Printer, Copy, AlertTriangle, CheckCircle2, Droplets } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

type TonerMatch = {
  id: string
  name: string
  category: string
  location: string
  quantity: number
  reorderLevel: number
}

type TonerSignal = {
  locationQty: number
  globalQty: number
  reorderLevel: number
  status: "ok" | "low" | "needs_now"
  needsTonerNow: boolean
}

type TonerDevice = {
  id: string
  deviceType: string
  brand: string
  model: string
  serialNumber: string
  assetTag: string
  location: string
  status: string
  assignedTo: string
  tonerType: string
  monthlyPrintVolume: number
  tonerYield: number
  matchedToners: TonerMatch[]
  tonerSignal: TonerSignal
}

type LocationGroup = {
  location: string
  printers: TonerDevice[]
  photocopiers: TonerDevice[]
  totalDevices: number
  needsNow: number
  lowStock: number
}

type TonerResponse = {
  success: boolean
  summary: {
    totalLocations: number
    totalDevices: number
    totalPrinters: number
    totalPhotocopiers: number
    totalNeedsNow: number
    totalLowStock: number
  }
  locations: LocationGroup[]
}

function signalBadge(signal: TonerSignal) {
  if (signal.status === "needs_now") {
    return <Badge variant="destructive">Needs Toner Now</Badge>
  }
  if (signal.status === "low") {
    return <Badge className="bg-amber-600">Low Toner</Badge>
  }
  return <Badge className="bg-emerald-600">Toner OK</Badge>
}

function DeviceRow({
  device,
  expanded,
  onToggle,
}: {
  device: TonerDevice
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <Card className="border">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {device.deviceType.toLowerCase() === "photocopier" ? (
                <Copy className="h-4 w-4 text-violet-600" />
              ) : (
                <Printer className="h-4 w-4 text-blue-600" />
              )}
              <p className="font-semibold">{device.brand} {device.model}</p>
              {signalBadge(device.tonerSignal)}
            </div>
            <p className="text-sm text-muted-foreground">
              SN: {device.serialNumber} • Asset: {device.assetTag} • Assigned: {device.assignedTo}
            </p>
            <p className="text-sm">
              Toner Type: <span className="font-medium">{device.tonerType}</span>
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={onToggle}>
            {expanded ? "Hide Toner Details" : "Check Toner Need"}
          </Button>
        </div>

        {expanded && (
          <div className="mt-4 rounded-lg border bg-muted/40 p-3 space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Location Toner Qty</p>
                <p className="text-lg font-bold">{device.tonerSignal.locationQty}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Global Toner Qty</p>
                <p className="text-lg font-bold">{device.tonerSignal.globalQty}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Reorder Level</p>
                <p className="text-lg font-bold">{device.tonerSignal.reorderLevel}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Smart Signal</p>
                <div className="pt-1">{signalBadge(device.tonerSignal)}</div>
              </div>
            </div>

            {device.matchedToners.length === 0 ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                No associated toner stock item matched this device. Update toner type/model on the device or add stock item mapping.
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">Associated Toners</p>
                {device.matchedToners.map((toner) => (
                  <div key={toner.id} className="flex flex-wrap items-center justify-between rounded-md border bg-background p-2 text-sm gap-2">
                    <div>
                      <span className="font-medium">{toner.name}</span>
                      <span className="text-muted-foreground"> • {toner.category} • {toner.location}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>Qty: <strong>{toner.quantity}</strong></span>
                      <span>Reorder: <strong>{toner.reorderLevel}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function DeviceTonerIntelligence() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [data, setData] = useState<TonerResponse | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<string>("all")
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!user?.role) return
      setLoading(true)
      setError("")

      try {
        const response = await fetch(`/api/devices/toner-intelligence?userRole=${encodeURIComponent(user.role)}`)
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || "Failed to load toner intelligence")
        }
        setData(result)
      } catch (e: any) {
        setError(e.message || "Failed to load toner intelligence")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.role])

  if (user?.role !== "admin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Printer & Photocopier Toner Intelligence</CardTitle>
          <CardDescription>This section is restricted to Admin users.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
        </CardContent>
      </Card>
    )
  }

  const locations = data?.locations || []
  const summary = data?.summary

  const visibleLocations = useMemo(() => {
    if (selectedLocation === "all") return locations
    return locations.filter((loc) => loc.location === selectedLocation)
  }, [locations, selectedLocation])

  const visibleDevices = visibleLocations.flatMap((loc) => [...loc.printers, ...loc.photocopiers])

  return (
    <div className="space-y-4">
      <Card className="border-emerald-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-emerald-600" />
            Printer & Photocopier Toner Intelligence
          </CardTitle>
          <CardDescription>
            Grouped by location and toner-mapped device. Click "Check Toner Need" on any device for smart stock signal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Locations</p>
              <p className="text-2xl font-bold">{summary?.totalLocations || 0}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Devices</p>
              <p className="text-2xl font-bold">{summary?.totalDevices || 0}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Printers</p>
              <p className="text-2xl font-bold">{summary?.totalPrinters || 0}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Photocopiers</p>
              <p className="text-2xl font-bold">{summary?.totalPhotocopiers || 0}</p>
            </div>
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-700">Need Toner Now</p>
              <p className="text-2xl font-bold text-red-700">{summary?.totalNeedsNow || 0}</p>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-700">Low Toner</p>
              <p className="text-2xl font-bold text-amber-700">{summary?.totalLowStock || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">Filter by location or view whole app toner view</div>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-full md:w-[260px]">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Whole App (All Locations)</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.location} value={loc.location}>{loc.location}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="devices" className="space-y-3">
        <TabsList>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="location-groups">Location Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-3">
          {visibleDevices.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-muted-foreground">No printer or photocopier devices found for this location filter.</CardContent>
            </Card>
          ) : (
            visibleDevices.map((device) => (
              <DeviceRow
                key={device.id}
                device={device}
                expanded={expandedDeviceId === device.id}
                onToggle={() => setExpandedDeviceId(expandedDeviceId === device.id ? null : device.id)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="location-groups" className="space-y-3">
          {visibleLocations.map((loc) => (
            <Card key={loc.location}>
              <CardHeader>
                <CardTitle className="text-lg">{loc.location}</CardTitle>
                <CardDescription>
                  {loc.totalDevices} devices • {loc.printers.length} printers • {loc.photocopiers.length} photocopiers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2">
                  {loc.needsNow > 0 ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> {loc.needsNow} Need Toner Now
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-600 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> No urgent toner need
                    </Badge>
                  )}
                  {loc.lowStock > 0 && <Badge className="bg-amber-600">{loc.lowStock} Low Toner</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
