"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DeviceTransferForm } from "./device-transfer-form"
import { AddDeviceForm } from "./add-device-form"
import { BulkDeviceImportDialog } from "./bulk-device-import-dialog"
import { DeviceLocationReallocationDialog } from "./device-location-reallocation-dialog"
import { DeviceQuickEntryDialog } from "./device-quick-entry-dialog"
import { RepairServiceProviderDialog } from "./repair-service-provider-dialog"
import { Plus, Monitor, Smartphone, Printer, HardDrive, Laptop, Server, UsbIcon, Download, Upload, FileDown, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { canSeeAllLocations, getCanonicalLocationName, locationsMatch, normalizeLocation } from "@/lib/location-filter"
import { toast } from "@/hooks/use-toast"
import { deviceLocationService } from "@/lib/device-location-service"
import { notificationService } from "@/lib/notification-service"
import { DataPagination } from "@/components/ui/data-pagination"
import { SortControls } from "@/components/ui/sort-controls"
import { sortItems } from "@/lib/sort-utils"
import { buildDeviceTypeOptions, normalizeDeviceTypeCode } from "@/lib/device-types"

interface Device {
  id: string
  name: string
  type: string
  serialNumber: string
  assetTag: string
  model: string
  brand: string
  status: "active" | "repair" | "maintenance" | "retired"
  location: string
  assignedTo: string
  assignedDate: string
  lastUpdated: string
  deviceType: string
  purchaseDate: string
  warrantyExpiry: string
  region_id?: string
  district_id?: string
}

const deviceTypeIcons = {
  laptop: Laptop,
  desktop: Monitor,
  printer: Printer,
  photocopier: Printer,
  mobile: Smartphone,
  handset: Smartphone,
  server: Server,
  monitor: Monitor,
  scanner: Printer,
  ups: HardDrive,
  stabiliser: HardDrive,
  network_cable: UsbIcon,
  network_adapter: UsbIcon,
  switch: Server,
  router: Server,
  projector: Monitor,
  cctv_camera: Monitor,
  keyboard: Monitor,
  mouse: Monitor,
  webcam: Monitor,
  headset: Smartphone,
  external_drive: HardDrive,
  external_hdd: HardDrive,
  flash_drive: HardDrive,
  docking_station: Monitor,
  adapter: UsbIcon,
  charger: UsbIcon,
  battery: HardDrive,
  toner: Printer,
  ink: Printer,
  cable: UsbIcon,
  power_cable: UsbIcon,
  hdmi_cable: UsbIcon,
  vga_cable: UsbIcon,
  trunk: Server,
  other: Monitor,
}

const statusColors = {
  active: "default",
  repair: "destructive",
  maintenance: "secondary",
  retired: "outline",
} as const

export function DeviceInventory() {
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const handleDeleteDevice = async (deviceId: string) => {
      if (!user) return
      if (!window.confirm("Are you sure you want to delete this device? This action cannot be undone.")) return
      setDeletingId(deviceId)
      try {
        const response = await fetch("/api/devices/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId,
            userId: user.id,
            userRole: user.role,
            userLocation: user.location,
            reason: "User-initiated delete from Device Inventory"
          })
        })
        const result = await response.json()
        if (!response.ok) {
          toast({ title: "Error", description: result.error || "Failed to delete device.", variant: "destructive" })
        } else {
          setDevices((prev) => prev.filter((d) => d.id !== deviceId))
          toast({ title: "Success", description: result.message || "Device deleted successfully." })
        }
      } catch (err) {
        toast({ title: "Error", description: "Error deleting device.", variant: "destructive" })
      } finally {
        setDeletingId(null)
      }
    }
  const { user } = useAuth()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [locationFilter, setLocationFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [sortField, setSortField] = useState("brand")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [transferDeviceOpen, setTransferDeviceOpen] = useState(false)
  const [editDeviceOpen, setEditDeviceOpen] = useState(false)
  const [addDeviceOpen, setAddDeviceOpen] = useState(false)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [reallocateDialogOpen, setReallocateDialogOpen] = useState(false)
  const [devicesWithoutLocation, setDevicesWithoutLocation] = useState<any[]>([])
  const [quickEntryOpen, setQuickEntryOpen] = useState(false)
  const [repairDialogOpen, setRepairDialogOpen] = useState(false)
  const [deviceForRepair, setDeviceForRepair] = useState<Device | null>(null)
  const [repairLoading, setRepairLoading] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState("")
  const [editFormData, setEditFormData] = useState({
    device_type: "",
    brand: "",
    model: "",
    serial_number: "",
    asset_tag: "",
    status: "",
    location: "",
    assigned_to: "",
    purchase_date: "",
    warranty_expiry: "",
    region_id: "",
    district_id: "",
  })
  const [dbLocations, setDbLocations] = useState<{ code: string; name: string; region_id?: string }[]>([])
  const [dbRegions, setDbRegions] = useState<{ id: string; code: string; name: string }[]>([])
  const [dbDistricts, setDbDistricts] = useState<{ id: string; code: string; name: string; region_id: string }[]>([])
  const [dbDeviceTypes, setDbDeviceTypes] = useState<Array<{ code: string; name: string }>>([])
  const [assignableUsers, setAssignableUsers] = useState<Array<{ id: string; name: string; location: string }>>([])
  const [editAssigneeSearchOpen, setEditAssigneeSearchOpen] = useState(false)
  const [editAssigneeSearchQuery, setEditAssigneeSearchQuery] = useState("")
  const [editUseCustomAssignee, setEditUseCustomAssignee] = useState(false)

  const supabase = createClient()
  const canSelectAllLocations = user ? canSeeAllLocations(user) : false

  useEffect(() => {
    loadDevices()
    loadLocations()
    loadRegionsAndDistricts()
    loadDeviceTypes()
    loadAssignableUsers()
    checkDevicesWithoutLocation()
  }, [])

  useEffect(() => {
    if (user?.location && !canSelectAllLocations) {
      setLocationFilter(getCanonicalLocationName(user.location))
    }
  }, [user?.location, canSelectAllLocations])

  const loadRegionsAndDistricts = async () => {
    try {
      // Load regions
      const { data: regionsData, error: regionsError } = await supabase
        .from("regions")
        .select("id, code, name")
        .eq("is_active", true)
        .order("name")

      if (!regionsError && regionsData) {
        setDbRegions(regionsData)
      }

      // Load districts
      const { data: districtsData, error: districtsError } = await supabase
        .from("districts")
        .select("id, code, name, region_id")
        .eq("is_active", true)
        .order("name")

      if (!districtsError && districtsData) {
        setDbDistricts(districtsData)
      }
    } catch (error) {
      console.error("Error loading regions/districts:", error)
    }
  }

  const checkDevicesWithoutLocation = async () => {
    try {
      const devicesNoLoc = await deviceLocationService.getDevicesWithoutLocation()
      console.log("[v0] Devices without location:", devicesNoLoc.length)
      setDevicesWithoutLocation(devicesNoLoc)
      
      // Auto-open reallocation dialog if there are unallocated devices
      if (devicesNoLoc.length > 0) {
        setReallocateDialogOpen(true)
      }
    } catch (error) {
      console.error("[v0] Error checking devices without location:", error)
    }
  }

  const loadLocations = async () => {
    try {
      const res = await fetch("/api/admin/lookup-data?type=locations")
      let activeLocations: { code: string; name: string; region_id?: string }[] = [];
      if (res.ok) {
        const data = await res.json()
        activeLocations = data
          .filter((loc: any) => loc.is_active && loc.code && loc.code.trim() !== "")
          .map((loc: any) => ({
            code: loc.code || loc.name,
            name: getCanonicalLocationName(loc.name),
            region_id: loc.region_id || null,
          }))
        // Deduplicate by canonical name (merge WN/WS variants)
        const seen = new Set<string>()
        activeLocations = activeLocations.filter((loc) => {
          const canonical = getCanonicalLocationName(loc.code)
          if (seen.has(canonical)) return false
          seen.add(canonical)
          loc.code = canonical // use canonical as the code for filter matching
          return true
        })
      }
      // Always include Takoradi Port if not present
      if (!activeLocations.some(loc => loc.code === "Takoradi Port" || loc.name === "Takoradi Port")) {
        activeLocations.push({ code: "Takoradi Port", name: "Takoradi Port" })
      }
      setDbLocations(activeLocations)
    } catch (error) {
      console.error("Error loading locations:", error)
    }
  }

  const loadDeviceTypes = async () => {
    try {
      const response = await fetch("/api/admin/lookup-data?type=device_types")
      if (!response.ok) return
      const data = await response.json()
      setDbDeviceTypes(buildDeviceTypeOptions(data.filter((type: any) => type.is_active)))
    } catch (error) {
      console.error("Error loading device types:", error)
    }
  }

  const loadAssignableUsers = async () => {
    try {
      const response = await fetch("/api/staff/list?allUsers=true")
      if (!response.ok) return
      const data = await response.json()
      setAssignableUsers(
        (data.staff || [])
          .filter((member: any) => member.is_active !== false)
          .map((member: any) => ({ id: member.id, name: member.name, location: member.location }))
      )
    } catch (error) {
      console.error("Error loading assignable users:", error)
    }
  }

  // Auto-populate region when location changes
  const handleLocationChange = (locationCode: string) => {
    const selectedLocation = dbLocations.find((loc) => loc.code === locationCode)
    const newRegionId = selectedLocation?.region_id || ""
    setEditFormData((prev) => ({
      ...prev,
      location: locationCode === "none" ? "" : locationCode,
      region_id: newRegionId,
    }))
  }

  const loadDevices = async () => {
    try {
      setLoading(true)

      const canSeeAll = user ? canSeeAllLocations(user) : false
      console.log("[v0] Loading devices for user:", user?.username, "role:", user?.role, "location:", user?.location)
      console.log("[v0] Can see all locations:", canSeeAll)

      // Use API endpoint to bypass RLS issues
      const params = new URLSearchParams()
      if (user?.location) params.set("location", user.location)
      params.set("canSeeAll", String(canSeeAll))

      const response = await fetch(`/api/devices?${params.toString()}`)

      if (!response.ok) {
        const errorData = await response.json()
        console.error("[v0] Error loading devices:", errorData)
        return
      }

      const responseData = await response.json()
      const data = responseData.devices || responseData || []
      console.log("[v0] Loaded devices from API:", data?.length, "devices")

      const mappedDevices: Device[] = data.map((device: any) => ({
        id: device.id,
        name: `${device.brand} ${device.model}`,
        type: normalizeDeviceTypeCode(device.device_type),
        serialNumber: device.serial_number,
        assetTag: device.asset_tag || "",
        model: device.model,
        brand: device.brand,
        status: device.status || "active",
        location: device.location || "Head Office",
        assignedTo: device.assigned_to || "Unassigned",
        assignedDate: device.purchase_date || device.created_at,
        lastUpdated: device.updated_at || device.created_at,
        deviceType: normalizeDeviceTypeCode(device.device_type),
        purchaseDate: device.purchase_date || "",
        warrantyExpiry: device.warranty_expiry || "",
        region_id: device.region_id || "",
        district_id: device.district_id || "",
      }))

      console.log(
        "[v0] Mapped devices with locations:",
        mappedDevices.slice(0, 3).map((d) => ({ name: d.name, location: d.location })),
      )

      setDevices(mappedDevices)
    } catch (error) {
      console.error("[v0] Error loading devices:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (device.assetTag || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.assignedTo.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || device.status === statusFilter
    
    // Use canonical location names for comparison
    const matchesLocation =
      locationFilter === "all" ||
      normalizeLocation(device.location) === normalizeLocation(locationFilter)

    return matchesSearch && matchesStatus && matchesLocation
  })
  
  console.log("[v0] Device filter - locationFilter:", locationFilter, "total devices:", devices.length, "filtered:", filteredDevices.length)

  const sortedDevices = useMemo(
    () => sortItems(filteredDevices, sortField, sortDirection),
    [filteredDevices, sortField, sortDirection],
  )

  // Pagination calculations
  const totalDevices = sortedDevices.length
  const totalPages = Math.max(1, Math.ceil(totalDevices / pageSize))
  const startIndex = totalDevices === 0 ? 0 : (page - 1) * pageSize + 1
  const endIndex = Math.min(page * pageSize, totalDevices)
  const paginatedDevices = sortedDevices.slice((page - 1) * pageSize, page * pageSize)

  // Ensure current page is within bounds when totalPages changes
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [totalPages])

  // Reset to first page when filters/search change
  useEffect(() => {
    setPage(1)
  }, [searchQuery, statusFilter, locationFilter, pageSize, sortField, sortDirection])

  const handleAddDevice = () => {
    setAddDeviceOpen(true)
  }

  const handleAddDeviceSubmit = () => {
    setAddDeviceOpen(false)
    loadDevices()
    toast({
      title: "Success",
      description: "Device added successfully",
    })
  }

  const handleTransferDevice = (deviceId: string, newLocation: string, newAssignee: string) => {
    setDevices(
      devices.map((device) =>
        device.id === deviceId
          ? {
              ...device,
              location: newLocation as Device["location"],
              assignedTo: newAssignee,
              lastUpdated: new Date().toISOString().split("T")[0],
            }
          : device,
      ),
    )
    setTransferDeviceOpen(false)
    setSelectedDevice(null)
  }

  const handleEditDevice = (device: Device) => {
    setSelectedDevice(device)
    setEditFormData({
      device_type: normalizeDeviceTypeCode(device.deviceType),
      brand: device.brand,
      model: device.model,
      serial_number: device.serialNumber,
      asset_tag: device.assetTag || "",
      status: device.status,
      location: device.location,
      assigned_to: device.assignedTo,
      purchase_date: device.purchaseDate || "",
      warranty_expiry: device.warrantyExpiry || "",
      region_id: device.region_id || "",
      district_id: device.district_id || "",
    })
    setEditAssigneeSearchOpen(false)
    setEditAssigneeSearchQuery("")
    setEditUseCustomAssignee(false)
    setEditDeviceOpen(true)
    setEditError("")
  }

  const handleSaveDeviceEdit = async () => {
    if (!selectedDevice) return

    // Check if status is being changed to "maintenance" (which represents "Under Repair" state)
    const statusChangingToMaintenance = editFormData.status === "maintenance" && selectedDevice.status !== "maintenance"

    if (statusChangingToMaintenance) {
      console.log("[v0] Status changing to maintenance, showing repair dialog")
      // Show repair dialog instead of saving immediately
      setDeviceForRepair({
        ...selectedDevice,
        brand: editFormData.brand,
        model: editFormData.model,
        serialNumber: editFormData.serial_number,
        deviceType: editFormData.device_type,
      })
      setRepairDialogOpen(true)
      return
    }

    try {
      setEditLoading(true)
      setEditError("")

      const response = await fetch("/api/devices/update-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedDevice.id,
          device_type: editFormData.device_type,
          brand: editFormData.brand,
          model: editFormData.model,
          serial_number: editFormData.serial_number,
          asset_tag: editFormData.asset_tag,
          status: editFormData.status,
          location: editFormData.location,
          assigned_to: editFormData.assigned_to,
          purchase_date: editFormData.purchase_date || null,
          warranty_expiry: editFormData.warranty_expiry || null,
          region_id: editFormData.region_id || null,
          district_id: editFormData.district_id || null,
          userRole: user?.role,
          userLocation: user?.location,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update device")
      }

      toast({
        title: "Success",
        description: "Device updated successfully",
      })

      setEditDeviceOpen(false)
      loadDevices()
    } catch (error: any) {
      setEditError(error.message)
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setEditLoading(false)
    }
  }

  const editDeviceTypeOptions = useMemo(
    () => buildDeviceTypeOptions(dbDeviceTypes, editFormData.device_type),
    [dbDeviceTypes, editFormData.device_type]
  )

  const editAssigneeOptions = useMemo(() => {
    const matched = assignableUsers.filter((member) => locationsMatch(member.location, editFormData.location))
    if (editFormData.assigned_to && !matched.some((member) => member.name === editFormData.assigned_to)) {
      return [{ id: "current", name: editFormData.assigned_to, location: editFormData.location }, ...matched]
    }
    return matched
  }, [assignableUsers, editFormData.assigned_to, editFormData.location])

  const filteredEditAssigneeOptions = useMemo(() => {
    const query = editAssigneeSearchQuery.trim().toLowerCase()
    if (!query) return editAssigneeOptions
    return editAssigneeOptions.filter((member) => member.name.toLowerCase().includes(query))
  }, [editAssigneeOptions, editAssigneeSearchQuery])

  const handleExportToExcel = () => {
    try {
      // Prepare data for export
      const exportData = filteredDevices.map((device, index) => ({
        "S/N": index + 1,
        "Asset Tag": device.assetTag || "N/A",
        "Device Type": device.deviceType.toUpperCase(),
        Brand: device.brand,
        Model: device.model,
        "Serial Number": device.serialNumber,
        Status: device.status.charAt(0).toUpperCase() + device.status.slice(1),
        Location: locationNames[device.location] || device.location,
        "Assigned To": device.assignedTo,
        "Purchase Date": device.purchaseDate || "N/A",
        "Warranty Expiry": device.warrantyExpiry || "N/A",
      }))

      // Create CSV content
      const headers = Object.keys(exportData[0] || {})
      const csvContent = [
        headers.join(","),
        ...exportData.map((row) => headers.map((header) => `"${row[header as keyof typeof row]}"`).join(",")),
      ].join("\n")

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)

      const filterSummary = []
      if (statusFilter !== "all") filterSummary.push(statusFilter)
      if (locationFilter !== "all") filterSummary.push(locationFilter)
      const filename = `device-inventory${filterSummary.length ? "-" + filterSummary.join("-") : ""}-${new Date().toISOString().split("T")[0]}.csv`

      link.setAttribute("href", url)
      link.setAttribute("download", filename)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Export Successful",
        description: `Exported ${exportData.length} devices to ${filename}`,
      })
    } catch (error) {
      console.error("[v0] Error exporting to Excel:", error)
      toast({
        title: "Export Failed",
        description: "Failed to export device inventory",
        variant: "destructive",
      })
    }
  }

  const [exportingReimport, setExportingReimport] = useState(false)

  const handleExportForReimport = async () => {
    if (!user?.location) {
      toast({
        title: "Error",
        description: "User location is required for export",
        variant: "destructive",
      })
      return
    }
    setExportingReimport(true)
    try {
      const locationParam = locationFilter !== "all" ? locationFilter : user.location
      const response = await fetch(
        `/api/devices/bulk-import?action=export&location=${encodeURIComponent(locationParam)}`
      )
      if (!response.ok) {
        const err = await response.json()
        toast({
          title: "Export Failed",
          description: err.error || "Failed to export devices",
          variant: "destructive",
        })
        return
      }
      const csv = await response.text()
      const blob = new Blob([csv], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `devices-reimport-${locationParam.replace(/\s+/g, "_")}-${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      toast({
        title: "Export Complete",
        description: "CSV exported in import-compatible format. Make your corrections, then use Bulk Import with 'Skip Duplicates' enabled to re-import.",
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "An error occurred while exporting devices",
        variant: "destructive",
      })
    } finally {
      setExportingReimport(false)
    }
  }

  const handleRepairConfirm = async (serviceProviderData: {
    serviceProviderId: string
    issueDescription: string
    priority: string
    estimatedCost: string
  }) => {
    if (!selectedDevice) return

    try {
      setRepairLoading(true)

      // First, update device status to maintenance (which represents "Under Repair")
      const updateResponse = await fetch("/api/devices/update-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedDevice.id,
          device_type: editFormData.device_type,
          brand: editFormData.brand,
          model: editFormData.model,
          serial_number: editFormData.serial_number,
          asset_tag: editFormData.asset_tag,
          status: "maintenance",
          location: editFormData.location,
          assigned_to: editFormData.assigned_to,
          purchase_date: editFormData.purchase_date || null,
          warranty_expiry: editFormData.warranty_expiry || null,
          region_id: editFormData.region_id || null,
          district_id: editFormData.district_id || null,
          userRole: user?.role,
          userLocation: user?.location,
        }),
      })

      if (!updateResponse.ok) {
        const error = await updateResponse.json()
        throw new Error(error.error || "Failed to update device status")
      }

      // Then, create a repair ticket with the service provider
      const repairResponse = await fetch("/api/repairs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          deviceType: editFormData.device_type,
          brand: editFormData.brand,
          model: editFormData.model,
          serialNumber: editFormData.serial_number,
          issueDescription: serviceProviderData.issueDescription,
          priority: serviceProviderData.priority,
          estimatedCost: serviceProviderData.estimatedCost || null,
          serviceProviderId: serviceProviderData.serviceProviderId,
          createdBy: user?.id,
        }),
      })

      if (!repairResponse.ok) {
        const error = await repairResponse.json()
        throw new Error(error.error || "Failed to create repair ticket")
      }

      const repairData = await repairResponse.json()
      console.log("[v0] Repair ticket created:", repairData)

      notificationService.success(
        "Device Sent for Repair",
        `${editFormData.brand} ${editFormData.model} has been marked as "Under Maintenance" and assigned to the service provider`
      )

      setRepairDialogOpen(false)
      setEditDeviceOpen(false)
      setRepairLoading(false)
      loadDevices()
    } catch (error: any) {
      console.error("[v0] Error confirming repair:", error)
      // Don't re-throw - the error is already handled by the dialog component
      // Just log it for debugging purposes
      setRepairLoading(false)
    }
  }

  const locationNames: Record<string, string> = {}
  dbLocations.forEach((loc) => {
    locationNames[loc.code] = loc.name
    locationNames[loc.code.toLowerCase()] = loc.name
    locationNames[loc.code.toUpperCase()] = loc.name
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading devices...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header - Compact */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Device Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {totalDevices === 0 ? (
              "No devices"
            ) : (
              <>Showing {startIndex}–{endIndex} of {totalDevices} device{totalDevices !== 1 ? 's' : ''}</>
            )}
            {user?.location && !canSeeAllLocations(user) ? ` in ${getCanonicalLocationName(user.location)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportToExcel} disabled={filteredDevices.length === 0}>
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
          {user && ["admin", "it_staff", "regional_it_head"].includes(user.role || "") && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportForReimport}
                disabled={exportingReimport}
                className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950"
              >
                <FileDown className="mr-1.5 h-4 w-4" />
                {exportingReimport ? "Exporting..." : "Export for Corrections"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setBulkImportOpen(true)}>
                <Upload className="mr-1.5 h-4 w-4" />
                Bulk Import
              </Button>
            </>
          )}
          <Button size="sm" onClick={handleAddDevice}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Device
          </Button>
          <Button size="sm" variant="outline" onClick={() => setQuickEntryOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Quick Entry
          </Button>
        </div>
      </div>

      {/* Filters - More compact */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <Input
            placeholder="Search devices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="maintenance">Under Maintenance</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
        {/* Page size selector and pagination controls */}
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
            <SelectTrigger className="w-28 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 per page</SelectItem>
              <SelectItem value="20">20 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
              <SelectItem value="100">100 per page</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Prev
            </Button>
            <div className="text-sm px-2">{page} / {totalPages}</div>
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Next
            </Button>
          </div>
        </div>
        <SortControls
          sortField={sortField}
          sortDirection={sortDirection}
          onSortFieldChange={setSortField}
          onSortDirectionChange={setSortDirection}
          options={[
            { value: "brand", label: "Brand" },
            { value: "model", label: "Model" },
            { value: "assetTag", label: "Asset Tag" },
            { value: "serialNumber", label: "Serial Number" },
            { value: "location", label: "Location" },
            { value: "status", label: "Status" },
            { value: "assignedTo", label: "Assigned To" },
          ]}
        />
        <Select value={locationFilter} onValueChange={setLocationFilter} disabled={!canSelectAllLocations}>
          <SelectTrigger className="w-full sm:w-40 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {canSelectAllLocations && <SelectItem value="all">All Locations</SelectItem>}
            {(canSelectAllLocations
              ? dbLocations.filter((loc) => loc.code && loc.code.trim() !== "")
              : [{ code: getCanonicalLocationName(user?.location || ""), name: getCanonicalLocationName(user?.location || "") }]
            ).map((loc) => (
              <SelectItem key={loc.code} value={loc.code}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {paginatedDevices.map((device) => {
          const IconComponent = deviceTypeIcons[device.type] || Monitor;
          // Only admin or regional_it_head at the device's location can see delete
          const canDelete =
            user?.role === "admin" ||
            (user?.role === "regional_it_head" && user?.location && user.location === device.location);
          return (
            <Card
              key={device.id}
              className="group hover:shadow-lg hover:border-primary/30 transition-all duration-200 cursor-pointer overflow-hidden"
            >
              <div className="p-4" onClick={() => handleEditDevice(device)}>
                {/* Header: Icon + Name + Status */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="shrink-0 p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                    <IconComponent className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate" title={device.name}>
                      {device.brand} {device.model}
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono truncate" title={device.assetTag}>
                      Tag: {device.assetTag || "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate" title={device.serialNumber}>
                      {device.serialNumber}
                    </p>
                  </div>
                  <Badge variant={statusColors[device.status]} className="shrink-0 text-xs px-2 py-0.5">
                    {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
                  </Badge>
                </div>

                {/* Details: Compact 2-column layout */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                    <span className="truncate">{locationNames[device.location] || device.location}</span>
                  </div>
                  <div className="text-right text-muted-foreground truncate" title={device.assignedTo}>
                    {device.assignedTo === "Unassigned" ? (
                      <span className="italic opacity-60">Unassigned</span>
                    ) : (
                      device.assignedTo
                    )}
                  </div>
                </div>
                {/* Delete Button */}
                {canDelete && (
                  <div className="flex justify-end mt-3">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deletingId === device.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDevice(device.id);
                      }}
                    >
                      {deletingId === device.id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {sortedDevices.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Monitor className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No devices found</h3>
            <p className="text-muted-foreground text-center">
              No devices match your current filters. Try adjusting your search criteria.
            </p>
          </CardContent>
        </Card>
      )}

      <DataPagination
        currentPage={page}
        totalItems={sortedDevices.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        itemLabel="devices"
      />

      <Dialog open={transferDeviceOpen} onOpenChange={setTransferDeviceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Device</DialogTitle>
            <DialogDescription>Move {selectedDevice?.name} to a different location or assignee</DialogDescription>
          </DialogHeader>
          {selectedDevice && (
            <DeviceTransferForm
              device={selectedDevice}
              onSubmit={handleTransferDevice}
              onCancel={() => {
                setTransferDeviceOpen(false)
                setSelectedDevice(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editDeviceOpen} onOpenChange={setEditDeviceOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Device</DialogTitle>
            <DialogDescription>Update device details and information</DialogDescription>
          </DialogHeader>
          {editError && <div className="bg-destructive/10 text-destructive px-4 py-2 rounded">{editError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Device Type</label>
              <Select
                value={editFormData.device_type}
                onValueChange={(value) => setEditFormData({ ...editFormData, device_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {editDeviceTypeOptions.map((type) => (
                    <SelectItem key={type.code} value={type.code}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Brand</label>
              <Input
                value={editFormData.brand}
                onChange={(e) => setEditFormData({ ...editFormData, brand: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Model</label>
              <Input
                value={editFormData.model}
                onChange={(e) => setEditFormData({ ...editFormData, model: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Serial Number</label>
              <Input
                value={editFormData.serial_number}
                onChange={(e) => setEditFormData({ ...editFormData, serial_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Asset Tag</label>
              <Input
                value={editFormData.asset_tag}
                onChange={(e) => setEditFormData({ ...editFormData, asset_tag: e.target.value })}
                placeholder="QCC-IT-001"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={editFormData.status}
                onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="maintenance">Under Maintenance (Repair)</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Assigned To</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditAssigneeSearchOpen((prev) => !prev)}
                >
                  <Search className="h-4 w-4 mr-2" />Search Users
                </Button>
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id="editAssignedToCustom"
                    checked={editUseCustomAssignee}
                    onCheckedChange={(checked) => setEditUseCustomAssignee(Boolean(checked))}
                  />
                  <label htmlFor="editAssignedToCustom" className="text-sm font-normal">Use custom assignee</label>
                </div>
              </div>
              {editAssigneeSearchOpen && !editUseCustomAssignee && (
                <Input
                  value={editAssigneeSearchQuery}
                  onChange={(e) => setEditAssigneeSearchQuery(e.target.value)}
                  placeholder="Search users at this location"
                />
              )}
              {editUseCustomAssignee ? (
                <Input
                  value={editFormData.assigned_to}
                  onChange={(e) => setEditFormData({ ...editFormData, assigned_to: e.target.value })}
                  placeholder="Enter custom user or department"
                />
              ) : (
                <Select
                  value={editFormData.assigned_to || "__unassigned__"}
                  onValueChange={(value) => setEditFormData({ ...editFormData, assigned_to: value === "__unassigned__" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user at this location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned__">Unassigned</SelectItem>
                    {filteredEditAssigneeOptions.map((member) => (
                      <SelectItem key={`${member.id}-${member.name}`} value={member.name}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">Users are filtered to the device location. Switch to custom if the person is not listed.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Purchase Date</label>
              <Input
                type="date"
                value={editFormData.purchase_date}
                onChange={(e) => setEditFormData({ ...editFormData, purchase_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Warranty Expiry</label>
              <Input
                type="date"
                value={editFormData.warranty_expiry}
                onChange={(e) => setEditFormData({ ...editFormData, warranty_expiry: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <Select value={editFormData.location || "none"} onValueChange={handleLocationChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select location...</SelectItem>
                  {dbLocations
                    .filter((loc) => loc.code && loc.code.trim() !== "")
                    .map((loc) => (
                      <SelectItem key={loc.code} value={loc.code}>
                        {loc.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Region</label>
              <Select
                value={editFormData.region_id || "none"}
                onValueChange={(value) =>
                  setEditFormData({ ...editFormData, region_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Region</SelectItem>
                  {dbRegions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Auto-populated from location, or select manually</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">District</label>
              <Input
                value={editFormData.district_id || ""}
                onChange={(e) => setEditFormData({ ...editFormData, district_id: e.target.value })}
                placeholder="Enter district if applicable"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setEditDeviceOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDeviceEdit} disabled={editLoading}>
              {editLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addDeviceOpen} onOpenChange={setAddDeviceOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Device</DialogTitle>
            <DialogDescription>Enter device details to add it to the inventory</DialogDescription>
          </DialogHeader>
          <AddDeviceForm onSubmit={handleAddDeviceSubmit} />
        </DialogContent>
      </Dialog>

      <BulkDeviceImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onImportSuccess={() => {
          loadDevices()
        }}
      />

      <DeviceLocationReallocationDialog
        open={reallocateDialogOpen}
        onOpenChange={setReallocateDialogOpen}
        devices={devicesWithoutLocation}
        onReallocate={() => {
          setDevicesWithoutLocation([])
          loadDevices()
          checkDevicesWithoutLocation()
        }}
      />

      <DeviceQuickEntryDialog
        open={quickEntryOpen}
        onOpenChange={setQuickEntryOpen}
        onDeviceAdded={() => {
          loadDevices()
          checkDevicesWithoutLocation()
        }}
      />

      <RepairServiceProviderDialog
        open={repairDialogOpen}
        onOpenChange={setRepairDialogOpen}
        device={deviceForRepair}
        onConfirm={handleRepairConfirm}
        loading={repairLoading}
      />
    </div>
  )
}
