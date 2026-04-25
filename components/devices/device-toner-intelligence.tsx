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
import { Loader2, Printer, Copy, AlertTriangle, CheckCircle2, Droplets, Search, Link2, Download, BarChart3 } from "lucide-react"
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

type SimilarMappingSuggestion = {
  sourceDeviceId: string
  sourceLabel: string
  tonerType: string
  tonerModel: string
  score: number
}

function normalizeToken(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim()
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

  const executiveSummary = useMemo(() => {
    const allVisibleDevices = visibleLocations.flatMap((loc) => [...loc.printers, ...loc.photocopiers])

    const uniquePrinterModels = new Set(
      allVisibleDevices
        .map((d) => `${d.brand} ${d.model}`.trim())
        .filter(Boolean)
    )

    const uniqueTonerTypes = new Set(
      allVisibleDevices
        .map((d) => (d.tonerType || "").trim())
        .filter((v) => v && v.toLowerCase() !== "not set")
    )

    const tonerTypesByLocation = visibleLocations.map((loc) => {
      const locDevices = [...loc.printers, ...loc.photocopiers]
      const printerTypeCounts: Record<string, number> = {}

      locDevices.forEach((d) => {
        const modelKey = `${d.brand} ${d.model}`.trim() || "Unknown"
        printerTypeCounts[modelKey] = (printerTypeCounts[modelKey] || 0) + 1
      })

      const deviceTonerTypes = Array.from(
        new Set(
          locDevices
            .map((d) => (d.tonerType || "").trim())
            .filter((v) => v && v.toLowerCase() !== "not set")
        )
      )

      const tonerBreakdown = deviceTonerTypes
        .map((tonerType) => {
          const tonerToken = normalizeToken(tonerType)
          const matchingCatalog = tonerCatalog.filter((item) => {
            const blob = normalizeToken(`${item.name} ${item.category}`)
            return blob.includes(tonerToken) || tonerToken.includes(blob)
          })

          const locationQty = matchingCatalog
            .filter((item) => item.location === loc.location)
            .reduce((sum, item) => sum + item.quantity, 0)

          const globalQty = matchingCatalog.reduce((sum, item) => sum + item.quantity, 0)
          const printersUsing = locDevices.filter((d) => normalizeToken(d.tonerType) === tonerToken).length

          return {
            tonerType,
            locationQty,
            globalQty,
            printersUsing,
          }
        })
        .sort((a, b) => a.tonerType.localeCompare(b.tonerType))

      const printerTypes = Object.entries(printerTypeCounts)
        .map(([model, count]) => ({ model, count }))
        .sort((a, b) => b.count - a.count)

      return {
        location: loc.location,
        totalDevices: loc.totalDevices,
        totalPrinters: loc.printers.length,
        totalPhotocopiers: loc.photocopiers.length,
        needsNow: loc.needsNow,
        lowStock: loc.lowStock,
        printerTypes,
        tonerBreakdown,
      }
    })

    return {
      totalLocations: visibleLocations.length,
      totalDevices: allVisibleDevices.length,
      totalPrinters: allVisibleDevices.filter((d) => d.deviceType.toLowerCase() === "printer").length,
      totalPhotocopiers: allVisibleDevices.filter((d) => d.deviceType.toLowerCase() === "photocopier").length,
      uniquePrinterModels: uniquePrinterModels.size,
      uniqueTonerTypes: uniqueTonerTypes.size,
      tonerTypesByLocation,
    }
  }, [visibleLocations, tonerCatalog])

  const executiveCharts = useMemo(() => {
    const topLocations = executiveSummary.tonerTypesByLocation
      .map((loc) => ({
        location: loc.location,
        printers: loc.totalPrinters,
        photocopiers: loc.totalPhotocopiers,
        total: loc.totalPrinters + loc.totalPhotocopiers,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)

    const tonerQtyMap = new Map<string, number>()
    tonerCatalog.forEach((item) => {
      const key = (item.name || "Unknown").trim() || "Unknown"
      tonerQtyMap.set(key, (tonerQtyMap.get(key) || 0) + Number(item.quantity || 0))
    })

    const topToners = Array.from(tonerQtyMap.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)

    const maxLocationTotal = Math.max(...topLocations.map((x) => x.total), 1)
    const maxTonerQty = Math.max(...topToners.map((x) => x.qty), 1)

    return { topLocations, topToners, maxLocationTotal, maxTonerQty }
  }, [executiveSummary.tonerTypesByLocation, tonerCatalog])

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

  const similarMappingSuggestions = useMemo<SimilarMappingSuggestion[]>(() => {
    if (!associateDevice) return []

    const allDevices = locations.flatMap((loc) => [...loc.printers, ...loc.photocopiers])

    const candidates = allDevices
      .filter((d) => d.id !== associateDevice.id)
      .filter((d) => d.hasAssociatedToners || (d.tonerType && d.tonerType.toLowerCase() !== "not set"))
      .map((d) => {
        let score = 0

        if ((d.brand || "").toLowerCase() === (associateDevice.brand || "").toLowerCase()) score += 3
        if ((d.model || "").toLowerCase() === (associateDevice.model || "").toLowerCase()) score += 4
        if ((d.deviceType || "").toLowerCase() === (associateDevice.deviceType || "").toLowerCase()) score += 1
        if ((d.location || "").toLowerCase() === (associateDevice.location || "").toLowerCase()) score += 1

        const targetModel = normalizeToken(associateDevice.model)
        const candModel = normalizeToken(d.model)
        if (targetModel && candModel && (targetModel.includes(candModel) || candModel.includes(targetModel))) {
          score += 2
        }

        return {
          sourceDeviceId: d.id,
          sourceLabel: `${d.brand} ${d.model} (${d.location})`,
          tonerType: d.tonerType || "",
          tonerModel: d.tonerModel || "",
          score,
        }
      })
      .filter((x) => x.score > 0 && x.tonerType && x.tonerType.toLowerCase() !== "not set")
      .sort((a, b) => b.score - a.score)

    const dedup = new Map<string, SimilarMappingSuggestion>()
    candidates.forEach((c) => {
      const key = `${normalizeToken(c.tonerType)}|${normalizeToken(c.tonerModel)}`
      if (!dedup.has(key)) dedup.set(key, c)
    })

    return Array.from(dedup.values()).slice(0, 5)
  }, [associateDevice, locations])

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

  const exportExecutiveSummaryCsv = () => {
    const rows: string[][] = []
    rows.push(["Executive Summary", ""])
    rows.push(["Generated At", new Date().toLocaleString()])
    rows.push(["Locations", String(executiveSummary.totalLocations)])
    rows.push(["Devices", String(executiveSummary.totalDevices)])
    rows.push(["Printers", String(executiveSummary.totalPrinters)])
    rows.push(["Photocopiers", String(executiveSummary.totalPhotocopiers)])
    rows.push(["Unique Printer Models", String(executiveSummary.uniquePrinterModels)])
    rows.push(["Unique Toner Types", String(executiveSummary.uniqueTonerTypes)])
    rows.push([])

    rows.push(["By Location", "", "", "", ""])
    rows.push(["Location", "Total Devices", "Printers", "Photocopiers", "Low/Urgent"])
    executiveSummary.tonerTypesByLocation.forEach((loc) => {
      rows.push([
        loc.location,
        String(loc.totalDevices),
        String(loc.totalPrinters),
        String(loc.totalPhotocopiers),
        `${loc.lowStock}/${loc.needsNow}`,
      ])
    })
    rows.push([])

    rows.push(["Location", "Printer Model", "Count", "Toner Type", "Qty in Location", "Qty in All Locations", "Printers Using"])
    executiveSummary.tonerTypesByLocation.forEach((loc) => {
      if (loc.printerTypes.length === 0 && loc.tonerBreakdown.length === 0) {
        rows.push([loc.location, "", "0", "", "0", "0", "0"])
        return
      }

      const maxLen = Math.max(loc.printerTypes.length, loc.tonerBreakdown.length)
      for (let i = 0; i < maxLen; i++) {
        const p = loc.printerTypes[i]
        const t = loc.tonerBreakdown[i]
        rows.push([
          i === 0 ? loc.location : "",
          p?.model || "",
          p ? String(p.count) : "",
          t?.tonerType || "",
          t ? String(t.locationQty) : "",
          t ? String(t.globalQty) : "",
          t ? String(t.printersUsing) : "",
        ])
      }
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
    a.download = `printer-toner-executive-summary-${new Date().toISOString().split("T")[0]}.csv`
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
          <TabsTrigger value="executive-summary">Executive Summary</TabsTrigger>
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

        <TabsContent value="executive-summary" className="space-y-3">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Executive Summary and Metrics</CardTitle>
                  <CardDescription>
                    Printer types, toner types, and toner quantities across all locations with location-level breakdown.
                  </CardDescription>
                </div>
                <Button onClick={exportExecutiveSummaryCsv} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Executive CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Locations</p>
                  <p className="text-2xl font-bold">{executiveSummary.totalLocations}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Devices</p>
                  <p className="text-2xl font-bold">{executiveSummary.totalDevices}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Printers</p>
                  <p className="text-2xl font-bold">{executiveSummary.totalPrinters}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Photocopiers</p>
                  <p className="text-2xl font-bold">{executiveSummary.totalPhotocopiers}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Printer Models</p>
                  <p className="text-2xl font-bold">{executiveSummary.uniquePrinterModels}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Toner Types</p>
                  <p className="text-2xl font-bold">{executiveSummary.uniqueTonerTypes}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-sky-600" />
                Visual Metrics Snapshot
              </CardTitle>
              <CardDescription>
                Quick view of top locations by printer volume and top toner types by total stock quantity.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-md border p-3">
                  <p className="mb-3 font-medium">Top Locations by Printer/Copier Count</p>
                  <div className="space-y-2">
                    {executiveCharts.topLocations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No location data.</p>
                    ) : (
                      executiveCharts.topLocations.map((item) => {
                        const width = Math.max(8, Math.round((item.total / executiveCharts.maxLocationTotal) * 100))
                        return (
                          <div key={`loc-chart-${item.location}`}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="truncate pr-2">{item.location}</span>
                              <span className="font-medium">{item.total}</span>
                            </div>
                            <div className="h-2 w-full rounded bg-muted">
                              <div className="h-2 rounded bg-sky-600" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                <div className="rounded-md border p-3">
                  <p className="mb-3 font-medium">Top Toner Types by Quantity (All Locations)</p>
                  <div className="space-y-2">
                    {executiveCharts.topToners.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No toner inventory data.</p>
                    ) : (
                      executiveCharts.topToners.map((item) => {
                        const width = Math.max(8, Math.round((item.qty / executiveCharts.maxTonerQty) * 100))
                        return (
                          <div key={`toner-chart-${item.name}`}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="truncate pr-2">{item.name}</span>
                              <span className="font-medium">{item.qty}</span>
                            </div>
                            <div className="h-2 w-full rounded bg-muted">
                              <div className="h-2 rounded bg-emerald-600" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {executiveSummary.tonerTypesByLocation.map((loc) => (
            <Card key={`exec-${loc.location}`}>
              <CardHeader>
                <CardTitle className="text-lg">{loc.location}</CardTitle>
                <CardDescription>
                  {loc.totalDevices} devices | {loc.totalPrinters} printers | {loc.totalPhotocopiers} photocopiers | {loc.needsNow} urgent | {loc.lowStock} low stock
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <p className="mb-2 font-medium">Printer Type Breakdown</p>
                    {loc.printerTypes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No printer/photocopier types found.</p>
                    ) : (
                      <div className="space-y-2">
                        {loc.printerTypes.map((item) => (
                          <div key={`${loc.location}-${item.model}`} className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1 text-sm">
                            <span className="truncate pr-2">{item.model}</span>
                            <Badge variant="secondary">{item.count}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-md border p-3">
                    <p className="mb-2 font-medium">Toner Breakdown</p>
                    {loc.tonerBreakdown.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No toner type mapped in this location.</p>
                    ) : (
                      <div className="space-y-2">
                        {loc.tonerBreakdown.map((t) => (
                          <div key={`${loc.location}-${t.tonerType}`} className="rounded-md bg-muted/40 p-2 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium truncate">{t.tonerType}</span>
                              <Badge variant="outline">{t.printersUsing} printer(s)</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Qty in {loc.location}: {t.locationQty} | Qty in all locations: {t.globalQty}
                            </p>
                          </div>
                        ))}
                      </div>
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

              {associateDevice && !associateDevice.hasAssociatedToners && (
                <div className="space-y-2">
                  <Label>Suggested from similar printers/copiers</Label>
                  {similarMappingSuggestions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No close device mapping found yet. Use catalog search or manual toner type.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {similarMappingSuggestions.map((s) => (
                        <button
                          key={`${s.sourceDeviceId}-${s.tonerType}-${s.tonerModel}`}
                          type="button"
                          onClick={() => {
                            setSelectedCatalogName("")
                            setManualTonerType(s.tonerType)
                            setManualTonerModel(s.tonerModel)
                          }}
                          className="w-full rounded-md border bg-muted/40 px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">{s.tonerType}{s.tonerModel ? ` • ${s.tonerModel}` : ""}</span>
                            <Badge variant="outline">match {s.score}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground truncate">From: {s.sourceLabel}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
