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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Printer, Copy, AlertTriangle, CheckCircle2, Droplets, Search, Link2, Download, BarChart3, ChevronDown, ChevronRight, Filter } from "lucide-react"
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
  const [execSearch, setExecSearch] = useState("")
  const [execStatusFilter, setExecStatusFilter] = useState<"all" | "urgent" | "low" | "ok">("all")
  const [execSortField, setExecSortField] = useState<"location" | "devices" | "urgent" | "toners">("location")
  const [execSortDir, setExecSortDir] = useState<"asc" | "desc">("asc")
  const [execExpandedLocation, setExecExpandedLocation] = useState<string | null>(null)

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

  const filteredExecData = useMemo(() => {
    let rows = executiveSummary.tonerTypesByLocation

    if (execSearch.trim()) {
      const q = execSearch.trim().toLowerCase()
      rows = rows.filter(
        (loc) =>
          loc.location.toLowerCase().includes(q) ||
          loc.printerTypes.some((p) => p.model.toLowerCase().includes(q)) ||
          loc.tonerBreakdown.some((t) => t.tonerType.toLowerCase().includes(q))
      )
    }

    if (execStatusFilter === "urgent") rows = rows.filter((loc) => loc.needsNow > 0)
    else if (execStatusFilter === "low") rows = rows.filter((loc) => loc.lowStock > 0)
    else if (execStatusFilter === "ok") rows = rows.filter((loc) => loc.needsNow === 0 && loc.lowStock === 0)

    rows = [...rows].sort((a, b) => {
      let cmp = 0
      if (execSortField === "location") cmp = a.location.localeCompare(b.location)
      else if (execSortField === "devices") cmp = a.totalDevices - b.totalDevices
      else if (execSortField === "urgent") cmp = a.needsNow - b.needsNow
      else if (execSortField === "toners") cmp = a.tonerBreakdown.length - b.tonerBreakdown.length
      return execSortDir === "asc" ? cmp : -cmp
    })

    return rows
  }, [executiveSummary.tonerTypesByLocation, execSearch, execStatusFilter, execSortField, execSortDir])

  const toggleExecSort = (field: typeof execSortField) => {
    if (execSortField === field) setExecSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setExecSortField(field); setExecSortDir("asc") }
  }

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

      let result: any
      const contentType = response.headers.get("content-type")
      
      if (contentType?.includes("application/json")) {
        result = await response.json()
      } else {
        const text = await response.text()
        result = { error: text || "Invalid response from server" }
      }

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`)
      }

      toast({
        title: "Toner associated",
        description: `Updated ${associateDevice.brand} ${associateDevice.model} toner mapping successfully.`,
      })
      setAssociateOpen(false)
      await loadData()
    } catch (e: any) {
      const errorMsg = e instanceof TypeError ? "Network error - check your connection" : (e.message || "Unable to save toner association")
      toast({
        title: "Association failed",
        description: errorMsg,
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

        <TabsContent value="executive-summary" className="space-y-4">
          {/* ── KPI Header ─────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>Printer &amp; Toner Executive Report</CardTitle>
                  <CardDescription>
                    Toner types, quantities, and device distribution across all locations — searchable and filterable.
                  </CardDescription>
                </div>
                <Button onClick={exportExecutiveSummaryCsv} variant="outline" size="sm" className="gap-2 shrink-0">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                {[
                  { label: "Locations", value: executiveSummary.totalLocations, color: "text-sky-600" },
                  { label: "Devices", value: executiveSummary.totalDevices, color: "text-slate-700" },
                  { label: "Printers", value: executiveSummary.totalPrinters, color: "text-blue-600" },
                  { label: "Photocopiers", value: executiveSummary.totalPhotocopiers, color: "text-violet-600" },
                  { label: "Printer Models", value: executiveSummary.uniquePrinterModels, color: "text-amber-600" },
                  { label: "Toner Types", value: executiveSummary.uniqueTonerTypes, color: "text-emerald-600" },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-lg border bg-muted/30 p-3 text-center">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                    <p className={`text-3xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Visual Charts ──────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-sky-600" />
                Visual Metrics Snapshot
              </CardTitle>
              <CardDescription>Top locations by printer/copier count and top toner types by total stock quantity.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Top Locations by Printer/Copier Count</p>
                  <div className="space-y-2">
                    {executiveCharts.topLocations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No location data.</p>
                    ) : (
                      executiveCharts.topLocations.map((item) => {
                        const width = Math.max(6, Math.round((item.total / executiveCharts.maxLocationTotal) * 100))
                        return (
                          <div key={`loc-chart-${item.location}`}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="truncate pr-2 font-medium">{item.location}</span>
                              <span className="font-bold tabular-nums">{item.total}</span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-muted">
                              <div className="h-2.5 rounded-full bg-sky-500" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Top Toner Types by Total Quantity</p>
                  <div className="space-y-2">
                    {executiveCharts.topToners.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No toner inventory data.</p>
                    ) : (
                      executiveCharts.topToners.map((item) => {
                        const width = Math.max(6, Math.round((item.qty / executiveCharts.maxTonerQty) * 100))
                        return (
                          <div key={`toner-chart-${item.name}`}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="truncate pr-2 font-medium">{item.name}</span>
                              <span className="font-bold tabular-nums">{item.qty}</span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-muted">
                              <div className="h-2.5 rounded-full bg-emerald-500" style={{ width: `${width}%` }} />
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

          {/* ── Search & Filter Bar ────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Location &amp; Toner Inventory Table</CardTitle>
                  <CardDescription>All locations with device counts, toner types, and stock status.</CardDescription>
                </div>
                <div className="text-xs text-muted-foreground">
                  Showing {filteredExecData.length} of {executiveSummary.tonerTypesByLocation.length} locations
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search location, printer model, toner type…"
                    value={execSearch}
                    onChange={(e) => setExecSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Select value={execStatusFilter} onValueChange={(v) => setExecStatusFilter(v as typeof execStatusFilter)}>
                  <SelectTrigger className="w-full sm:w-44 h-9">
                    <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    <SelectItem value="urgent">Urgent Only</SelectItem>
                    <SelectItem value="low">Low Stock Only</SelectItem>
                    <SelectItem value="ok">OK / Sufficient</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredExecData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium">No locations match your search</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your search term or filter.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-8" />
                        <TableHead
                          className="cursor-pointer select-none font-semibold hover:text-foreground"
                          onClick={() => toggleExecSort("location")}
                        >
                          Location {execSortField === "location" ? (execSortDir === "asc" ? "↑" : "↓") : ""}
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none text-center font-semibold hover:text-foreground"
                          onClick={() => toggleExecSort("devices")}
                        >
                          Devices {execSortField === "devices" ? (execSortDir === "asc" ? "↑" : "↓") : ""}
                        </TableHead>
                        <TableHead className="text-center font-semibold">Printers</TableHead>
                        <TableHead className="text-center font-semibold">Photocopiers</TableHead>
                        <TableHead
                          className="cursor-pointer select-none text-center font-semibold hover:text-foreground"
                          onClick={() => toggleExecSort("toners")}
                        >
                          Toner Types {execSortField === "toners" ? (execSortDir === "asc" ? "↑" : "↓") : ""}
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none text-center font-semibold hover:text-foreground"
                          onClick={() => toggleExecSort("urgent")}
                        >
                          Urgent {execSortField === "urgent" ? (execSortDir === "asc" ? "↑" : "↓") : ""}
                        </TableHead>
                        <TableHead className="text-center font-semibold">Low Stock</TableHead>
                        <TableHead className="text-center font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExecData.map((loc) => {
                        const isExpanded = execExpandedLocation === loc.location
                        const overallStatus = loc.needsNow > 0 ? "urgent" : loc.lowStock > 0 ? "low" : "ok"
                        return (
                          <>
                            <TableRow
                              key={`exec-row-${loc.location}`}
                              className="cursor-pointer hover:bg-muted/40"
                              onClick={() => setExecExpandedLocation(isExpanded ? null : loc.location)}
                            >
                              <TableCell className="px-3">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell className="font-medium">{loc.location}</TableCell>
                              <TableCell className="text-center tabular-nums">{loc.totalDevices}</TableCell>
                              <TableCell className="text-center tabular-nums">{loc.totalPrinters}</TableCell>
                              <TableCell className="text-center tabular-nums">{loc.totalPhotocopiers}</TableCell>
                              <TableCell className="text-center tabular-nums">{loc.tonerBreakdown.length}</TableCell>
                              <TableCell className="text-center">
                                {loc.needsNow > 0 ? (
                                  <span className="font-semibold text-red-600">{loc.needsNow}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {loc.lowStock > 0 ? (
                                  <span className="font-semibold text-amber-600">{loc.lowStock}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {overallStatus === "urgent" && (
                                  <Badge variant="destructive" className="text-xs">Urgent</Badge>
                                )}
                                {overallStatus === "low" && (
                                  <Badge className="bg-amber-500 text-white text-xs">Low Stock</Badge>
                                )}
                                {overallStatus === "ok" && (
                                  <Badge className="bg-emerald-600 text-white text-xs">OK</Badge>
                                )}
                              </TableCell>
                            </TableRow>

                            {isExpanded && (
                              <TableRow key={`exec-detail-${loc.location}`} className="bg-muted/20 hover:bg-muted/20">
                                <TableCell colSpan={9} className="px-4 py-4">
                                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    {/* Printer Model Breakdown */}
                                    <div>
                                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Printer Models at This Location</p>
                                      {loc.printerTypes.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic">No printer/copier models found.</p>
                                      ) : (
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-background">
                                              <TableHead className="text-xs">Model</TableHead>
                                              <TableHead className="text-xs text-center">Count</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {loc.printerTypes.map((pt) => (
                                              <TableRow key={`${loc.location}-pt-${pt.model}`}>
                                                <TableCell className="text-sm font-medium py-1.5">{pt.model}</TableCell>
                                                <TableCell className="text-center py-1.5">
                                                  <Badge variant="secondary">{pt.count}</Badge>
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      )}
                                    </div>

                                    {/* Toner Inventory Breakdown */}
                                    <div>
                                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Toner Inventory at This Location</p>
                                      {loc.tonerBreakdown.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic">No toner types mapped at this location.</p>
                                      ) : (
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-background">
                                              <TableHead className="text-xs">Toner Type</TableHead>
                                              <TableHead className="text-xs text-center">Devices Using</TableHead>
                                              <TableHead className="text-xs text-center">Qty Here</TableHead>
                                              <TableHead className="text-xs text-center">Qty Global</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {loc.tonerBreakdown.map((t) => {
                                              const tonerStatus = t.locationQty === 0 ? "urgent" : t.locationQty <= 2 ? "low" : "ok"
                                              return (
                                                <TableRow key={`${loc.location}-td-${t.tonerType}`}>
                                                  <TableCell className="text-sm font-medium py-1.5">{t.tonerType}</TableCell>
                                                  <TableCell className="text-center py-1.5 tabular-nums">{t.printersUsing}</TableCell>
                                                  <TableCell className="text-center py-1.5">
                                                    <span className={`font-semibold tabular-nums ${
                                                      tonerStatus === "urgent" ? "text-red-600" : tonerStatus === "low" ? "text-amber-600" : "text-emerald-700"
                                                    }`}>{t.locationQty}</span>
                                                  </TableCell>
                                                  <TableCell className="text-center py-1.5 tabular-nums text-muted-foreground">{t.globalQty}</TableCell>
                                                </TableRow>
                                              )
                                            })}
                                          </TableBody>
                                        </Table>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Full Toner Inventory Cross-Table ───────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Toner Type Inventory — All Locations</CardTitle>
              <CardDescription>
                Every toner type in use across the organisation, showing how many devices use it and stock levels per location and globally.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {(() => {
                const tonerMap = new Map<string, { devicesUsing: number; locationQty: number; globalQty: number; locations: string[] }>()
                executiveSummary.tonerTypesByLocation.forEach((loc) => {
                  loc.tonerBreakdown.forEach((t) => {
                    const existing = tonerMap.get(t.tonerType) || { devicesUsing: 0, locationQty: 0, globalQty: t.globalQty, locations: [] }
                    existing.devicesUsing += t.printersUsing
                    existing.locationQty += t.locationQty
                    if (!existing.locations.includes(loc.location)) existing.locations.push(loc.location)
                    tonerMap.set(t.tonerType, existing)
                  })
                })
                const allTonerRows = Array.from(tonerMap.entries())
                  .map(([tonerType, data]) => ({ tonerType, ...data }))
                  .sort((a, b) => b.devicesUsing - a.devicesUsing)

                if (allTonerRows.length === 0) {
                  return (
                    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                      No toner types have been mapped yet.
                    </div>
                  )
                }

                return (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Toner Type</TableHead>
                          <TableHead className="text-center font-semibold">Devices Using</TableHead>
                          <TableHead className="text-center font-semibold">Total Qty (All Locations)</TableHead>
                          <TableHead className="text-center font-semibold">Locations Stocked</TableHead>
                          <TableHead className="font-semibold">Locations</TableHead>
                          <TableHead className="text-center font-semibold">Stock Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allTonerRows.map((row) => {
                          const stockStatus = row.globalQty === 0 ? "critical" : row.globalQty <= 3 ? "low" : "ok"
                          return (
                            <TableRow key={`toner-all-${row.tonerType}`}>
                              <TableCell className="font-medium">{row.tonerType}</TableCell>
                              <TableCell className="text-center tabular-nums">{row.devicesUsing}</TableCell>
                              <TableCell className="text-center">
                                <span className={`font-semibold tabular-nums ${
                                  stockStatus === "critical" ? "text-red-600" : stockStatus === "low" ? "text-amber-600" : "text-emerald-700"
                                }`}>{row.globalQty}</span>
                              </TableCell>
                              <TableCell className="text-center tabular-nums">{row.locations.length}</TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                                {row.locations.join(" · ")}
                              </TableCell>
                              <TableCell className="text-center">
                                {stockStatus === "critical" && <Badge variant="destructive" className="text-xs">Out of Stock</Badge>}
                                {stockStatus === "low" && <Badge className="bg-amber-500 text-white text-xs">Low</Badge>}
                                {stockStatus === "ok" && <Badge className="bg-emerald-600 text-white text-xs">In Stock</Badge>}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
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
