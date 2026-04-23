"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Printer, Copy, AlertTriangle, CheckCircle2, Droplets, Search, Link2, Download } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { DataPagination } from "@/components/ui/data-pagination"
import { useToast } from "@/hooks/use-toast"

type TonerMatch = {
  id: string
  name: string
  category: string
  location: string
  quantity: number
  reorderLevel: number
}

type TonerCatalogItem = {
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
  tonerModel?: string
  hasAssociatedToners?: boolean
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
  tonerCatalog: TonerCatalogItem[]
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
  onAssociate,
}: {
  device: TonerDevice
  expanded: boolean
  onToggle: () => void
  onAssociate: () => void
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
              {!device.hasAssociatedToners && (
                <Badge variant="outline" className="border-red-300 text-red-700">
                  No Toner Mapping
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              SN: {device.serialNumber} • Asset: {device.assetTag} • Assigned: {device.assignedTo}
            </p>
            <p className="text-sm">
              Toner Type: <span className="font-medium">{device.tonerType}</span>
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onToggle}>
              {expanded ? "Hide Toner Details" : "Check Toner Need"}
            </Button>
            <Button size="sm" onClick={onAssociate} className="bg-blue-600 hover:bg-blue-700">
              <Link2 className="h-4 w-4 mr-1" />
              Associate Toner
            </Button>
          </div>
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
                No associated toner stock item matched this device. Use "Associate Toner" to map a toner type.
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
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [data, setData] = useState<TonerResponse | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<string>("all")
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [associateOpen, setAssociateOpen] = useState(false)
  const [associateDevice, setAssociateDevice] = useState<TonerDevice | null>(null)
  const [associateSearch, setAssociateSearch] = useState("")
  const [selectedCatalogName, setSelectedCatalogName] = useState("")
  const [manualTonerType, setManualTonerType] = useState("")
  const [manualTonerModel, setManualTonerModel] = useState("")
  const [savingAssociation, setSavingAssociation] = useState(false)

  const locations = data?.locations || []
  const tonerCatalog = data?.tonerCatalog || []
  const summary = data?.summary

  const loadData = useCallback(async () => {
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
  }, [user?.role])

  useEffect(() => {
    loadData()
  }, [loadData])

  const visibleLocations = useMemo(() => {
    if (selectedLocation === "all") return locations
    return locations.filter((loc) => loc.location === selectedLocation)
  }, [locations, selectedLocation])

  const visibleDevicesAll = useMemo(() => {
    const flattened = visibleLocations.flatMap((loc) => [...loc.printers, ...loc.photocopiers])
    const q = searchTerm.trim().toLowerCase()
    if (!q) return flattened

    return flattened.filter((device) => {
      const tonerNames = device.matchedToners.map((toner) => toner.name).join(" ").toLowerCase()
      const blob = `${device.brand} ${device.model} ${device.serialNumber} ${device.assetTag} ${device.tonerType} ${device.location} ${tonerNames}`.toLowerCase()
      return blob.includes(q)
    })
  }, [visibleLocations, searchTerm])

  const totalDevices = visibleDevicesAll.length
  const totalPages = Math.max(1, Math.ceil(totalDevices / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedDevices = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return visibleDevicesAll.slice(start, start + pageSize)
  }, [visibleDevicesAll, safePage, pageSize])

  useEffect(() => {
    setPage(1)
  }, [selectedLocation, searchTerm, pageSize])

  const openAssociate = (device: TonerDevice) => {
    setAssociateDevice(device)
    setAssociateOpen(true)
    setAssociateSearch("")
    setSelectedCatalogName("")
    setManualTonerType(device.tonerType !== "Not Set" ? device.tonerType : "")
    setManualTonerModel(device.tonerModel || "")
  }

  const locationScopedCatalog = useMemo(() => {
    if (!associateDevice) return []
    const q = associateSearch.trim().toLowerCase()
    const scoped = tonerCatalog.filter((item) => item.location === associateDevice.location || item.location === "Central Stores")
    if (!q) return scoped
    return scoped.filter((item) => (`${item.name} ${item.category} ${item.location}`).toLowerCase().includes(q))
  }, [tonerCatalog, associateDevice, associateSearch])

  const handleSaveAssociation = async () => {
    if (!associateDevice || !user) return

    const finalTonerType = selectedCatalogName || manualTonerType.trim()
    const finalTonerModel = manualTonerModel.trim()

    if (!finalTonerType) {
      toast({
        title: "Toner type required",
        description: "Select from catalog or enter toner type manually.",
        variant: "destructive",
      })
      return
    }

    setSavingAssociation(true)
    try {
      const response = await fetch("/api/devices/associate-toner", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: associateDevice.id,
          tonerType: finalTonerType,
          tonerModel: finalTonerModel || null,
          userId: user.id,
          userRole: user.role,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to associate toner")
      }

      toast({
        title: "Toner associated",
        description: `Updated ${associateDevice.brand} ${associateDevice.model} toner mapping successfully.`,
      })
      setAssociateOpen(false)
      await loadData()
    } catch (e: any) {
      toast({
        title: "Association failed",
        description: e.message || "Unable to save toner association",
        variant: "destructive",
      })
    } finally {
      setSavingAssociation(false)
    }
  }

  const exportBreakdownCsv = () => {
    const rows: string[][] = []

    rows.push([
      "Location",
      "Device Type",
      "Brand",
      "Model",
      "Serial Number",
      "Asset Tag",
      "Assigned To",
      "Toner Type",
      "Toner Model",
      "Location Toner Qty",
      "Global Toner Qty",
      "Reorder Level",
      "Signal",
      "Associated Toners",
    ])

    visibleLocations.forEach((locationGroup) => {
      const allDevices = [...locationGroup.printers, ...locationGroup.photocopiers]
      allDevices.forEach((device) => {
        rows.push([
          locationGroup.location,
          device.deviceType,
          device.brand,
          device.model,
          device.serialNumber,
          device.assetTag,
          device.assignedTo,
          device.tonerType,
          device.tonerModel || "",
          String(device.tonerSignal.locationQty),
          String(device.tonerSignal.globalQty),
          String(device.tonerSignal.reorderLevel),
          device.tonerSignal.status,
          device.matchedToners.map((t) => `${t.name} (${t.location}, qty:${t.quantity})`).join(" | "),
        ])
      })
    })

    const csv = rows
      .map((row) => row.map((cell) => {
        const value = String(cell ?? "")
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `printer-photocopier-toner-breakdown-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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

  return (
    <div className="space-y-4">
      <Card className="border-emerald-200">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-emerald-600" />
                Printer & Photocopier Toner Intelligence
              </CardTitle>
              <CardDescription>
                Detailed location breakdown, smart toner status, and mapping tools for missing associations.
              </CardDescription>
            </div>
            <Button onClick={exportBreakdownCsv} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export Breakdown CSV
            </Button>
          </div>
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-1">
              <Label className="text-xs text-muted-foreground">Location</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
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
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Search devices and toner mappings</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search printer/copier, toner type, serial, location..."
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="devices" className="space-y-3">
        <TabsList>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="location-groups">Location Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-3">
          {totalDevices === 0 ? (
            <Card>
              <CardContent className="p-6 text-muted-foreground">No printer or photocopier devices found for this filter.</CardContent>
            </Card>
          ) : (
            <>
              {pagedDevices.map((device) => (
                <DeviceRow
                  key={device.id}
                  device={device}
                  expanded={expandedDeviceId === device.id}
                  onToggle={() => setExpandedDeviceId(expandedDeviceId === device.id ? null : device.id)}
                  onAssociate={() => openAssociate(device)}
                />
              ))}
              <DataPagination
                currentPage={safePage}
                totalItems={totalDevices}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                itemLabel="printer/copier devices"
              />
            </>
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
              <CardContent className="space-y-4">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-md border p-3">
                    <p className="font-medium mb-2">Printers ({loc.printers.length})</p>
                    {loc.printers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No printers in this location.</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {loc.printers.map((d) => (
                          <li key={d.id}>{d.brand} {d.model} ({d.serialNumber})</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-md border p-3">
                    <p className="font-medium mb-2">Photocopiers ({loc.photocopiers.length})</p>
                    {loc.photocopiers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No photocopiers in this location.</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {loc.photocopiers.map((d) => (
                          <li key={d.id}>{d.brand} {d.model} ({d.serialNumber})</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={associateOpen} onOpenChange={setAssociateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Associate Toner Type</DialogTitle>
          </DialogHeader>

          {associateDevice && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Device: <strong className="text-foreground">{associateDevice.brand} {associateDevice.model}</strong> • {associateDevice.location}
              </div>

              <div className="space-y-2">
                <Label>Search toner catalog in app</Label>
                <Input
                  value={associateSearch}
                  onChange={(e) => setAssociateSearch(e.target.value)}
                  placeholder="Type toner name, category, or location"
                />
              </div>

              <div className="space-y-2">
                <Label>Select matching toner from catalog</Label>
                <Select value={selectedCatalogName} onValueChange={setSelectedCatalogName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose associated toner" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationScopedCatalog.map((item) => (
                      <SelectItem key={`${item.id}-${item.location}`} value={item.name}>
                        {item.name} • {item.location} • Qty {item.quantity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Manual Toner Type (optional)</Label>
                  <Input
                    value={manualTonerType}
                    onChange={(e) => setManualTonerType(e.target.value)}
                    placeholder="e.g., CF217, 85A, TN-2420"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Manual Toner Model/Brand (optional)</Label>
                  <Input
                    value={manualTonerModel}
                    onChange={(e) => setManualTonerModel(e.target.value)}
                    placeholder="e.g., HP LaserJet 85A"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssociateOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAssociation} disabled={savingAssociation}>
              {savingAssociation ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Association
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
