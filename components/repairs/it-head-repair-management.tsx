"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus,
  Send,
  Wrench,
  CheckCircle,
  AlertCircle,
  FileText,
  Timer,
  Search,
  Download,
  Clock,
  DollarSign,
  Edit,
  Trash2,
  Zap,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { DataPagination } from "@/components/ui/data-pagination"
import { SortControls } from "@/components/ui/sort-controls"
import { canSeeAllLocations, canCreateRepairs, getCanonicalLocationName, normalizeLocation } from "@/lib/location-filter"
import { useToast } from "@/hooks/use-toast"
import { sortItems } from "@/lib/sort-utils"
import { useRealtimeUpdates } from "@/hooks/use-realtime-updates"

interface Device {
  id: string
  type: string
  brand: string
  model: string
  serialNumber: string
  assetTag: string
  location: string
  assignedTo: string
  status: string
}

interface ServiceProvider {
  id: string
  name: string
  email: string
  phone: string
  specialization: string[]
  location: string
  is_active: boolean
}

interface RepairTask {
  id: string
  taskNumber: string
  device: Device
  issueDescription: string
  priority: "low" | "medium" | "high" | "critical"
  status: "draft" | "assigned" | "pickup_scheduled" | "collected" | "in_repair" | "completed" | "returned" | "cancelled"
  serviceProvider?: ServiceProvider
  serviceProviderAssignedBy?: string
  serviceProviderAssignedDate?: string
  createdBy: string
  createdByLocation?: string
  createdByRegion?: string
  createdDate: string
  estimatedCost?: number
  actualCost?: number
  pickupDate?: string
  completionDate?: string
  repairNotes?: string
  laborHours?: number
  partsUsed?: string[]
  attachments: string[]
}

export function ITHeadRepairManagement() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [tasks, setTasks] = useState<RepairTask[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingTask, setEditingTask] = useState<RepairTask | null>(null)

  // Form states
  const [selectedDevice, setSelectedDevice] = useState("")
  const [issueDescription, setIssueDescription] = useState("")
  const [priority, setPriority] = useState<RepairTask["priority"]>("medium")
  const [selectedProvider, setSelectedProvider] = useState("")
  const [estimatedCost, setEstimatedCost] = useState("")
  const [selectedLocation, setSelectedLocation] = useState<string>("")
  const [locations, setLocations] = useState<{ code: string; name: string }[]>([])
  const [attachments, setAttachments] = useState<File[]>([])
  const [deviceSearchTerm, setDeviceSearchTerm] = useState("")
  const [liveActivity, setLiveActivity] = useState<any[]>([])
  const [showLiveActivity, setShowLiveActivity] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(6)
  const [sortField, setSortField] = useState("createdDate")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const isRegionalITHead = user?.role === "regional_it_head"

  // Edit form states
  const [editSelectedDevice, setEditSelectedDevice] = useState("")
  const [editIssueDescription, setEditIssueDescription] = useState("")
  const [editPriority, setEditPriority] = useState<RepairTask["priority"]>("medium")
  const [editSelectedProvider, setEditSelectedProvider] = useState("")
  const [editEstimatedCost, setEditEstimatedCost] = useState("")

  useEffect(() => {
    loadLocations()
    loadDevices()
    loadServiceProviders()
    loadRepairTasks()
    
    // Set up auto-refresh every 30 seconds to catch service provider updates
    const refreshInterval = setInterval(() => {
      console.log("[v0] Auto-refreshing repairs data...")
      loadRepairTasks()
    }, 30000)
    
    return () => clearInterval(refreshInterval)
  }, [user])

  // Set up realtime listeners for live updates
  useRealtimeUpdates({
    table: "repair_requests",
    onUpdate: (data) => {
      console.log("[v0] Repair updated in realtime:", data)
      loadRepairTasks()
      // Add to live activity
      setLiveActivity((prev) => [
        {
          id: Date.now(),
          timestamp: new Date(),
          action: `Repair task updated: ${data.task_number || data.device_name}`,
          type: "status_update",
          data,
        },
        ...prev.slice(0, 9), // Keep last 10 activities
      ])
    },
    onInsert: (data) => {
      console.log("[v0] New repair created in realtime:", data)
      loadRepairTasks()
      // Add to live activity
      setLiveActivity((prev) => [
        {
          id: Date.now(),
          timestamp: new Date(),
          action: `New repair task created: ${data.task_number || data.device_name}`,
          type: "new_repair",
          data,
        },
        ...prev.slice(0, 9), // Keep last 10 activities
      ])
    },
  })

  // Reload devices when location filter changes
  useEffect(() => {
    if (selectedLocation !== undefined) {
      loadDevices(selectedLocation)
    }
  }, [selectedLocation])

  const loadLocations = async () => {
    try {
      const response = await fetch("/api/admin/lookup-data?type=locations")
      let activeLocations: { code: string; name: string }[] = [];
      if (response.ok) {
        const data = await response.json()
        activeLocations = data
          .filter((loc: any) => loc.is_active)
          .map((loc: any) => ({ code: loc.code, name: loc.name }))
      }
      setLocations(activeLocations)

      if (user?.location) {
        const normalizedUserLocation = normalizeLocation(user.location)
        const matchedLocation = activeLocations.find((loc) => {
          const codeMatch = normalizeLocation(loc.code) === normalizedUserLocation
          const nameMatch = normalizeLocation(loc.name) === normalizedUserLocation
          const fuzzyMatch = normalizeLocation(loc.name).includes(normalizedUserLocation) || normalizedUserLocation.includes(normalizeLocation(loc.name))
          return codeMatch || nameMatch || fuzzyMatch
        })

        setSelectedLocation(matchedLocation?.code || user.location)
      }
    } catch (error) {
      console.error("[v0] Error loading locations:", error)
    }
  }

  const loadDevices = async (filterLocation?: string) => {
    try {
      const canSeeAll = user ? canSeeAllLocations(user) : false
      const isItStaff = user?.role === "it_staff"
      
      // For IT staff, always use their location; otherwise use the filter or user's location
      const locationToUse = isItStaff ? (user?.location || "") : (filterLocation || "")
      
      // Use API endpoint that bypasses RLS
      const params = new URLSearchParams({
        location: locationToUse,
        canSeeAll: String(!isItStaff && canSeeAll && !filterLocation), // IT staff never sees all
      })
      
      const response = await fetch(`/api/devices?${params}`)
      const result = await response.json()

      if (!response.ok) {
        console.error("[v0] Error loading devices:", result.error)
        return
      }

      console.log("[v0] Raw devices loaded:", result.devices?.length || 0, "for location:", locationToUse || "all")

      // Map and filter for repair-eligible devices (all devices can be sent for repair)
      let mappedDevices: Device[] = (result.devices || []).map((d: any) => ({
        id: d.id,
        type: d.device_type || d.type || "Unknown",
        brand: d.brand || "Unknown",
        model: d.model || "Unknown",
        serialNumber: d.serial_number || "",
        assetTag: d.asset_tag || d.serial_number || d.id?.substring(0, 8) || "",
        location: d.location || "",
        assignedTo: d.assigned_to || "",
        status: d.status || "active",
      }))
      
      // Additional client-side filter for the selected location
      if (filterLocation && !isItStaff) {
        const normFilter = normalizeLocation(filterLocation)
        mappedDevices = mappedDevices.filter((d: Device) => {
          const dLoc = normalizeLocation(d.location)
          return dLoc === normFilter || dLoc.includes(normFilter) || normFilter.includes(dLoc)
        })
      }
      
      console.log("[v0] Mapped devices for repair:", mappedDevices.length)
      setDevices(mappedDevices)
    } catch (error) {
      console.error("[v0] Error loading devices:", error)
    }
  }

  const loadServiceProviders = async () => {
    // Hardcoded service providers - only two providers available
    const providers: ServiceProvider[] = [
      {
        id: "nathland-company",
        name: "NATHLAND COMPANY LIMITED",
        email: "nathland@gmail.com",
        phone: "020000",
        specialization: [],
        location: "Head Office",
        is_active: true,
      },
      {
        id: "intel-computers",
        name: "INTEL COMPUTERS",
        email: "intel@computers.com",
        phone: "",
        specialization: [],
        location: "Head Office",
        is_active: true,
      },
    ]
    
    console.log("[v0] Using hardcoded service providers:", providers.length)
    setServiceProviders(providers)
  }

  const loadRepairTasks = async () => {
    try {
      const canSeeAll = user ? canSeeAllLocations(user) : false
      const location = user?.location || ""
      
      // Use API endpoint that bypasses RLS
      const params = new URLSearchParams({
        location: location,
        canSeeAll: String(canSeeAll),
      })
      
      const response = await fetch(`/api/repairs?${params}`)
      const result = await response.json()

      if (!response.ok) {
        console.error("[v0] Error loading repair tasks:", result.error)
        return
      }

      // Robustly handle undefined/null/invalid result or repairs
      let repairs: any[] = [];
      if (result && typeof result === 'object' && Array.isArray(result.repairs)) {
        repairs = result.repairs;
      } else {
        console.warn('[v0] Unexpected repairs API response:', result);
      }
      // Hardcoded provider lookup for matching names to full details
      const hardcodedProviders: Record<string, { id: string; email: string; phone: string }> = {
        "NATHLAND COMPANY LIMITED": { id: "nathland-company", email: "nathland@gmail.com", phone: "020000" },
        "INTEL COMPUTERS": { id: "intel-computers", email: "intel@computers.com", phone: "" },
      }

      const transformedTasks: RepairTask[] = repairs.map((item: any) => {
        // Map service provider from joined data, then fallback to service_provider_name field
        let serviceProviderData: ServiceProvider | undefined = undefined

        if (item.service_provider && item.service_provider.name) {
          // From DB JOIN (service_providers table)
          serviceProviderData = {
            id: item.service_provider.id,
            name: item.service_provider.name,
            phone: item.service_provider.phone || "",
            email: item.service_provider.email || "",
            location: item.service_provider.location || "",
            specialization: item.service_provider.specialization || [],
            is_active: true,
          }
        } else if (item.service_provider_name) {
          // From service_provider_name column (hardcoded providers stored by name)
          const known = hardcodedProviders[item.service_provider_name]
          serviceProviderData = {
            id: known?.id || item.service_provider_id || "unknown",
            name: item.service_provider_name,
            phone: known?.phone || "",
            email: known?.email || "",
            location: "Head Office",
            specialization: [],
            is_active: true,
          }
        } else if (item.service_provider_id) {
          // Fallback: only have provider ID
          serviceProviderData = {
            id: item.service_provider_id,
            name: "Unknown Provider",
            phone: "",
            email: "",
            location: "",
            specialization: [],
            is_active: true,
          }
        }

        return {
          id: item.id,
          taskNumber: item.task_number || item.id?.substring(0, 8) || "N/A",
          device: item.devices || {
            id: item.device_id || "",
            type: item.device_type || "",
            brand: item.device_brand || "",
            model: item.device_model || "",
            serialNumber: item.serial_number || "",
            assetTag: item.asset_tag || "",
            location: item.location || "",
            assignedTo: item.assigned_to_name || "",
            status: "under_repair" as const,
          },
          issueDescription: item.issue_description || "",
          priority: item.priority || "medium",
          status: item.status || "draft",
          serviceProvider: serviceProviderData,
          createdBy: item.requested_by_name || item.requested_by || "",
          createdByLocation: getCanonicalLocationName(item.requester_location || item.location || ""),
          createdByRegion: getCanonicalLocationName(item.requester_location || item.location || ""),
          createdDate: item.created_at || new Date().toISOString(),
          estimatedCost: item.estimated_cost,
          actualCost: item.actual_cost,
          pickupDate: item.pickup_date,
          completionDate: item.completion_date,
          repairNotes: item.repair_notes,
          laborHours: item.labor_hours,
          partsUsed: item.parts_used || [],
          attachments: item.attachments || [],
        }
      })

      setTasks(transformedTasks)
    } catch (error) {
      console.error("[v0] Error loading repair tasks:", JSON.stringify(error))
    }
  }

  const filteredTasks = tasks.filter((task) => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch =
      (task.taskNumber?.toLowerCase() || "").includes(searchLower) ||
      (task.device?.assetTag?.toLowerCase() || "").includes(searchLower) ||
      (task.device?.assignedTo?.toLowerCase() || "").includes(searchLower) ||
      (task.issueDescription?.toLowerCase() || "").includes(searchLower)

    const matchesStatus = statusFilter === "all" || task.status === statusFilter
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter

    return matchesSearch && matchesStatus && matchesPriority
  })

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, priorityFilter, pageSize, tasks.length, sortField, sortDirection])

  const sortedTasks = useMemo(
    () => sortItems(filteredTasks, sortField, sortDirection),
    [filteredTasks, sortField, sortDirection],
  )

  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedTasks = sortedTasks.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize)

  // Filter devices based on search term
  const filteredDevices = devices.filter((device) => {
    const search = deviceSearchTerm.toLowerCase()
    return (
      device.assetTag?.toLowerCase().includes(search) ||
      device.serialNumber?.toLowerCase().includes(search) ||
      device.brand?.toLowerCase().includes(search) ||
      device.model?.toLowerCase().includes(search) ||
      device.type?.toLowerCase().includes(search)
    )
  })

  const createRepairTask = async () => {
    if (!selectedDevice || !issueDescription) {
      toast({
        title: "❌ Missing Information",
        description:
          devices.length === 0
            ? "No devices are currently available for your location. Please confirm the assigned region and try again."
            : "Please fill in all required fields: device and issue description.",
        variant: "destructive",
      })
      return
    }

    const device = devices.find((d) => d.id === selectedDevice)
    // Automatically use NATHLAND as the service provider
    const provider = serviceProviders.find((p) => p.name === "NATHLAND COMPANY LIMITED")

    console.log("[v0] Creating repair task - Device:", !!device, "Provider:", !!provider)
    console.log("[v0] Auto-assigned to provider:", provider?.name)

    if (!device) {
      toast({
        title: "❌ Device Not Found",
        description: "The selected device could not be found. Please refresh and try again.",
        variant: "destructive",
      })
      return
    }

    if (!provider) {
      toast({
        title: "❌ NATHLAND Service Provider Not Available",
        description: "The NATHLAND service provider is not available. Please contact support.",
        variant: "destructive",
      })
      return
    }

    try {
      console.log("[v0] Saving repair task via API - Auto-assigned to NATHLAND")

      // Convert attachments to base64 or file names
      const attachmentNames = attachments.map((file) => file.name)

      const response = await fetch("/api/repairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: device.id,
          device_name: `${device.assetTag || device.serialNumber} - ${device.type} (${device.brand} ${device.model})`,
          issue_description: issueDescription,
          priority,
          service_provider_id: provider.id,
          service_provider_name: provider.name,
          service_provider_assigned_by: user?.name || user?.email || "Unknown",
          service_provider_assigned_date: new Date().toISOString(),
          requested_by: user?.id,
          requested_by_name: user?.name,
          location: device.location || user?.location || selectedLocation,
          estimated_cost: estimatedCost ? Number.parseFloat(estimatedCost) : null,
          attachments: attachmentNames,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error("[v0] Error saving repair task:", result.error)
        toast({
          title: "❌ Failed to Create Repair Task",
          description: result.error || "Failed to create repair task",
          variant: "destructive",
        })
        return
      }

      console.log("[v0] Repair task saved successfully and assigned to NATHLAND:", result)
      toast({
        title: "✓ Repair Task Created",
        description: "The repair request has been assigned to NATHLAND COMPANY LIMITED",
      })

      // Reload tasks
      await loadRepairTasks()

      // Reset form
      setSelectedDevice("")
      setIssueDescription("")
      setPriority("medium")
      setSelectedProvider("")
      setEstimatedCost("")
      setAttachments([])
      setShowCreateDialog(false)
    } catch (error) {
      console.error("[v0] Error saving repair task:", error)
      toast({
        title: "❌ Error",
        description: "An unexpected error occurred while creating repair task",
        variant: "destructive",
      })
    }
  }

  const openEditDialog = (task: RepairTask) => {
    setEditingTask(task)
    setEditSelectedDevice(task.device.id)
    setEditIssueDescription(task.issueDescription)
    setEditPriority(task.priority)
    setEditSelectedProvider(task.serviceProvider?.id || "")
    setEditEstimatedCost(task.estimatedCost?.toString() || "")
    setShowEditDialog(true)
  }

  const updateRepairTask = async () => {
    if (!editingTask || !editSelectedDevice || !editIssueDescription) return

    const device = devices.find((d) => d.id === editSelectedDevice)
    // Automatically use NATHLAND as the service provider
    const provider = serviceProviders.find((p) => p.name === "NATHLAND COMPANY LIMITED")

    if (!device || !provider) return

    try {
      console.log("[v0] Updating repair task via API - Auto-assigned to NATHLAND")

      const response = await fetch("/api/repairs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTask.id,
          device_id: device.id,
          device_name: `${device.assetTag || device.serialNumber} - ${device.type} (${device.brand} ${device.model})`,
          issue_description: editIssueDescription,
          priority: editPriority,
          service_provider_id: provider.id,
          service_provider_name: provider.name,
          location: device.location || user?.location || selectedLocation,
          estimated_cost: editEstimatedCost ? Number.parseFloat(editEstimatedCost) : null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error("[v0] Error updating repair task:", result.error)
        toast({
          title: "❌ Failed to Update Repair Task",
          description: result.error || "Failed to update repair task",
          variant: "destructive",
        })
        return
      }

      console.log("[v0] Repair task updated successfully:", result)
      toast({
        title: "✏️ Repair Task Updated Successfully",
        description: "The repair request has been updated",
      })

      // Reload tasks
      await loadRepairTasks()

      // Reset form and close dialog
      setEditingTask(null)
      setEditSelectedDevice("")
      setEditIssueDescription("")
      setEditPriority("medium")
      setEditSelectedProvider("")
      setEditEstimatedCost("")
      setShowEditDialog(false)
    } catch (error) {
      console.error("[v0] Error updating repair task:", error)
      toast({
        title: "❌ Error",
        description: "An unexpected error occurred while updating repair task",
        variant: "destructive",
      })
    }
  }

  const deleteRepairTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this repair task? This action cannot be undone.")) {
      return
    }

    try {
      console.log("[v0] Deleting repair task via API")

      const response = await fetch("/api/repairs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, userRole: user?.role }),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error("[v0] Error deleting repair task:", result.error)
        toast({
          title: "❌ Failed to Delete Repair Task",
          description: result.error || "Failed to delete repair task",
          variant: "destructive",
        })
        return
      }

      console.log("[v0] Repair task deleted successfully")
      toast({
        title: "🗑️ Repair Task Deleted Successfully",
        description: "The repair request has been removed",
      })

      // Reload tasks
      await loadRepairTasks()
    } catch (error) {
      console.error("[v0] Error deleting repair task:", error)
      toast({
        title: "❌ Error",
        description: "An unexpected error occurred while deleting repair task",
        variant: "destructive",
      })
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300"
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300"
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300"
      case "assigned":
        return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300"
      case "pickup_scheduled":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300"
      case "collected":
        return "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300"
      case "in_repair":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300"
      case "completed":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300"
      case "returned":
        return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300"
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300"
    }
  }

  const getTaskStats = () => {
    const stats = {
      total: tasks.length,
      active: tasks.filter((t) => !["completed", "returned", "cancelled"].includes(t.status)).length,
      completed: tasks.filter((t) => t.status === "completed" || t.status === "returned").length,
      overdue: tasks.filter((t) => {
        if (!t.pickupDate) return false
        const pickupDate = new Date(t.pickupDate)
        const now = new Date()
        return pickupDate < now && !["completed", "returned"].includes(t.status)
      }).length,
      totalCost: tasks.reduce((sum, t) => sum + (t.actualCost || t.estimatedCost || 0), 0),
      avgRepairTime:
        tasks
          .filter((t) => t.completionDate && t.pickupDate)
          .reduce((sum, t) => {
            const pickup = new Date(t.pickupDate!)
            const completion = new Date(t.completionDate!)
            return sum + (completion.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24)
          }, 0) / tasks.filter((t) => t.completionDate && t.pickupDate).length || 0,
    }
    return stats
  }

  const stats = getTaskStats()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg">
            <Wrench className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Repair Management</h1>
            <p className="text-muted-foreground">
              Manage device repairs and service provider assignments • {user?.name}
            </p>
          </div>
        </div>

        {canCreateRepairs(user) && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add Repair Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Repair Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* Location filter - only show for non-IT-staff */}
                {user?.role !== "it_staff" && (
                  <div>
                    <Label htmlFor="location">Filter by Location</Label>
                    <Select
                      value={selectedLocation}
                      onValueChange={(value) => {
                        setSelectedLocation(value)
                        setSelectedDevice("")
                      }}
                      disabled={isRegionalITHead}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isRegionalITHead ? "Assigned region" : "All Locations"} />
                      </SelectTrigger>
                      <SelectContent>
                        {!isRegionalITHead && <SelectItem value="all">All Locations</SelectItem>}
                        {(locations || []).map((loc) => (
                          <SelectItem key={loc.code} value={loc.code}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {devices.length} device(s) available {selectedLocation && selectedLocation !== "all" ? `in ${locations.find((l) => l.code === selectedLocation)?.name || user?.location || selectedLocation}` : ""}
                    </p>
                  </div>
                )}

                {isRegionalITHead && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                    <p className="text-sm text-emerald-800 dark:text-emerald-200">
                      Regional IT Heads can create repair requests for their assigned location: <strong>{user?.location}</strong>
                    </p>
                  </div>
                )}

                {/* Show current location for IT staff */}
                {user?.role === "it_staff" && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Showing devices from your location: <strong>{user?.location || "Unknown"}</strong>
                      <span className="ml-2">({devices.length} device(s))</span>
                    </p>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="device">Select Device</Label>
                    <div className="space-y-2">
                      <Input
                        placeholder="Search by serial, tag, brand, model..."
                        value={deviceSearchTerm}
                        onChange={(e) => setDeviceSearchTerm(e.target.value)}
                        className="w-full"
                      />
                      <Select value={selectedDevice} onValueChange={(value) => {
                        setSelectedDevice(value)
                        setDeviceSearchTerm("")
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder={devices.length > 0 ? "Choose device to repair" : "No devices available"} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredDevices.length > 0 ? (
                            filteredDevices.map((device) => (
                              <SelectItem key={device.id} value={device.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{device.assetTag || device.serialNumber}</span>
                                  <span className="text-xs text-muted-foreground">{device.type} - {device.brand} {device.model} {device.location ? `@ ${device.location}` : ""}</span>
                                </div>
                              </SelectItem>
                            ))
                          ) : deviceSearchTerm ? (
                            <SelectItem value="no-match" disabled>
                              No devices match your search
                            </SelectItem>
                          ) : (
                            <SelectItem value="no-devices" disabled>
                              {user?.role === "it_staff" ? "No devices in your location" : "Select a location above"}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {filteredDevices.length} device(s) found
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="priority">Priority Level</Label>
                    <Select value={priority} onValueChange={(value) => setPriority(value as RepairTask["priority"])}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low Priority</SelectItem>
                        <SelectItem value="medium">Medium Priority</SelectItem>
                        <SelectItem value="high">High Priority</SelectItem>
                        <SelectItem value="critical">Critical Priority</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="cost">Estimated Cost (GHS)</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="issue">Issue Description</Label>
                  <Textarea
                    id="issue"
                    placeholder="Describe the problem with the device..."
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Service Provider:</strong> This repair will be automatically assigned to <strong>NATHLAND COMPANY LIMITED</strong>
                  </p>
                </div>

                <div>
                  <Label htmlFor="attachments">Attachments (Optional)</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <input
                      id="attachments"
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={(e) => {
                        const files = Array.from(e.currentTarget.files || [])
                        setAttachments(files)
                      }}
                      className="hidden"
                    />
                    <label htmlFor="attachments" className="cursor-pointer">
                      <div className="text-center">
                        <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Click to upload photos or documents</p>
                        <p className="text-xs text-gray-500 mt-1">Images, PDFs, or device photos</p>
                      </div>
                    </label>
                    {attachments.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-medium text-gray-700">Selected files:</p>
                        {attachments.map((file, index) => (
                          <div key={index} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 p-2 rounded">
                            <span className="truncate">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setAttachments(attachments.filter((_, i) => i !== index))
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={createRepairTask}
                    disabled={!selectedDevice || !issueDescription}
                    className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white"
                  >
                    <Wrench className="h-4 w-4 mr-2" />
                    Save Repair
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Live Activity */}
        {showLiveActivity && liveActivity.length > 0 && (
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-transparent dark:from-green-950/20 dark:to-transparent">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-base">Live Activity</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLiveActivity(false)}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {liveActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-2 text-sm p-2 rounded bg-white/50 dark:bg-black/20 hover:bg-white/75 dark:hover:bg-black/30 transition-colors"
                  >
                    <div className="text-green-600 mt-0.5">
                      {activity.type === "new_repair" ? <Plus className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-muted-foreground truncate">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.timestamp?.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Repair Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-device">Select Device</Label>
                  <Select value={editSelectedDevice} onValueChange={setEditSelectedDevice}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose device to repair" />
                    </SelectTrigger>
                    <SelectContent>
                      {(devices || []).map((device) => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.assetTag || device.serialNumber} - {device.type} ({device.brand} {device.model} {device.location ? `@ ${device.location}` : ""})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Service Provider:</strong> This repair is assigned to <strong>NATHLAND COMPANY LIMITED</strong>
                </p>
              </div>

              <div>
                <Label htmlFor="edit-issue">Issue Description</Label>
                <Textarea
                  id="edit-issue"
                  placeholder="Describe the problem with the device..."
                  value={editIssueDescription}
                  onChange={(e) => setEditIssueDescription(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-priority">Priority Level</Label>
                  <Select value={editPriority} onValueChange={(value) => setEditPriority(value as RepairTask["priority"])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                      <SelectItem value="critical">Critical Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-cost">Estimated Cost (GHS)</Label>
                  <Input
                    id="edit-cost"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={editEstimatedCost}
                    onChange={(e) => setEditEstimatedCost(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={updateRepairTask}
                  disabled={!editSelectedDevice || !editIssueDescription || !editSelectedProvider}
                  className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Update Repair
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total Tasks
            </CardTitle>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Active
            </CardTitle>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Completed
            </CardTitle>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Overdue
            </CardTitle>
            <div className="text-2xl font-bold">{stats.overdue}</div>
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Cost
            </CardTitle>
            <div className="text-xl font-bold">GHS {stats.totalCost.toFixed(2)}</div>
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Avg Repair Time
            </CardTitle>
            <div className="text-xl font-bold">{stats.avgRepairTime.toFixed(1)} days</div>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks, devices, or users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="pickup_scheduled">Pickup Scheduled</SelectItem>
                  <SelectItem value="collected">Collected</SelectItem>
                  <SelectItem value="in_repair">In Repair</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <SortControls
                sortField={sortField}
                sortDirection={sortDirection}
                onSortFieldChange={setSortField}
                onSortDirectionChange={setSortDirection}
                options={[
                  { value: "createdDate", label: "Created Date" },
                  { value: "taskNumber", label: "Task Number" },
                  { value: "priority", label: "Priority" },
                  { value: "status", label: "Status" },
                  { value: "device.assetTag", label: "Asset Tag" },
                  { value: "device.location", label: "Location" },
                ]}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tasks List */}
      <div className="space-y-4">
        {paginatedTasks.map((task) => (
          <Card key={task.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{task.taskNumber}</CardTitle>
                    <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                    <Badge className={getStatusColor(task.status)}>{task.status.replace("_", " ")}</Badge>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-medium">
                        {task.device.type} - {task.device.brand} {task.device.model}
                      </p>
                      <p className="text-muted-foreground">Asset: {task.device.assetTag}</p>
                      <p className="text-muted-foreground">User: {task.device.assignedTo}</p>
                    </div>
                    <div>
                      <p className="font-medium">Service Provider</p>
                      <p className={`font-semibold ${task.serviceProvider?.name ? "text-blue-700 dark:text-blue-400" : "text-muted-foreground italic"}`}>
                        {task.serviceProvider?.name || "Not Assigned"}
                      </p>
                      {task.serviceProvider?.email && (
                        <p className="text-muted-foreground text-xs">{task.serviceProvider.email}</p>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">Cost Information</p>
                      <p className="text-muted-foreground">Estimated: GHS {task.estimatedCost?.toFixed(2) || "N/A"}</p>
                      {task.actualCost && (
                        <p className="text-muted-foreground">Actual: GHS {task.actualCost.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(task)}
                    disabled={task.status === "completed" || task.status === "returned"}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  {(user?.role === "admin" || user?.role === "it_head") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteRepairTask(task.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={task.status === "completed" || task.status === "returned"}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Wrench className="h-5 w-5" />
                          {task.taskNumber} - Repair Task Details
                        </DialogTitle>
                      </DialogHeader>
                      <Tabs defaultValue="overview" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                          <TabsTrigger value="overview">Overview</TabsTrigger>
                          <TabsTrigger value="device">Device Info</TabsTrigger>
                          <TabsTrigger value="provider">Service Provider</TabsTrigger>
                          <TabsTrigger value="progress">Progress</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="space-y-4">
                          <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div>
                                <Label className="font-semibold">Task Information</Label>
                                <div className="bg-muted p-3 rounded-lg space-y-1">
                                  <p>
                                    <strong>Task Number:</strong> {task.taskNumber}
                                  </p>
                                  <p>
                                    <strong>Created By:</strong> {task.createdBy}
                                  </p>
                                  <p>
                                    <strong>Creator Location:</strong> {task.createdByLocation || "Not captured"}
                                  </p>
                                  <p>
                                    <strong>Creator Region:</strong> {task.createdByRegion || task.createdByLocation || "Not captured"}
                                  </p>
                                  <p>
                                    <strong>Service Provider:</strong>{" "}
                                    <span className="text-blue-700 dark:text-blue-400 font-semibold">
                                      {task.serviceProvider?.name || "Not Assigned"}
                                    </span>
                                  </p>
                                  <p>
                                    <strong>Created Date:</strong> {new Date(task.createdDate).toLocaleString()}
                                  </p>
                                  <p>
                                    <strong>Priority:</strong>{" "}
                                    <Badge className={getPriorityColor(task.priority)} size="sm">
                                      {task.priority}
                                    </Badge>
                                  </p>
                                  <p>
                                    <strong>Status:</strong>{" "}
                                    <Badge className={getStatusColor(task.status)} size="sm">
                                      {task.status}
                                    </Badge>
                                  </p>
                                </div>
                              </div>

                              <div>
                                <Label className="font-semibold">Issue Description</Label>
                                <p className="text-sm bg-muted p-3 rounded-lg">{task.issueDescription}</p>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div>
                                <Label className="font-semibold">Cost Analysis</Label>
                                <div className="bg-muted p-3 rounded-lg space-y-1">
                                  <p>
                                    <strong>Estimated Cost:</strong> GHS{" "}
                                    {task.estimatedCost?.toFixed(2) || "Not specified"}
                                  </p>
                                  {task.actualCost && (
                                    <p>
                                      <strong>Actual Cost:</strong> GHS {task.actualCost.toFixed(2)}
                                    </p>
                                  )}
                                  {task.laborHours && (
                                    <p>
                                      <strong>Labor Hours:</strong> {task.laborHours}h
                                    </p>
                                  )}
                                  {task.partsUsed && task.partsUsed.length > 0 && (
                                    <div>
                                      <p>
                                        <strong>Parts Used:</strong>
                                      </p>
                                      <ul className="list-disc list-inside ml-4 text-sm">
                                        {(task.partsUsed || []).map((part, index) => (
                                          <li key={index}>{part}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {task.repairNotes && (
                                <div>
                                  <Label className="font-semibold">Repair Notes</Label>
                                  <p className="text-sm bg-muted p-3 rounded-lg">{task.repairNotes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="device" className="space-y-4">
                          <div className="bg-muted p-4 rounded-lg">
                            <h3 className="font-semibold mb-3">Device Information</h3>
                            <div className="grid md:grid-cols-2 gap-4 text-sm">
                              <div className="space-y-2">
                                <p>
                                  <strong>Type:</strong> {task.device.type}
                                </p>
                                <p>
                                  <strong>Brand:</strong> {task.device.brand}
                                </p>
                                <p>
                                  <strong>Model:</strong> {task.device.model}
                                </p>
                                <p>
                                  <strong>Serial Number:</strong> {task.device.serialNumber}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <p>
                                  <strong>Asset Tag:</strong> {task.device.assetTag}
                                </p>
                                <p>
                                  <strong>Location:</strong> {task.device.location}
                                </p>
                                <p>
                                  <strong>Assigned To:</strong> {task.device.assignedTo}
                                </p>
                                <p>
                                  <strong>Status:</strong> <Badge size="sm">{task.device.status}</Badge>
                                </p>
                              </div>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="provider" className="space-y-4">
                          {task.serviceProvider ? (
                            <>
                              <div className="bg-muted p-4 rounded-lg">
                                <h3 className="font-semibold mb-3">Service Provider</h3>
                                <div className="space-y-3 text-sm">
                                  <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                                    <div>
                                      <p className="font-semibold text-base">{task.serviceProvider.name}</p>
                                      <p className="text-muted-foreground text-xs mt-1">
                                        {task.serviceProvider.email}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-muted p-4 rounded-lg">
                                <h3 className="font-semibold mb-3">Assignment Information</h3>
                                <div className="grid gap-3 text-sm">
                                  <div className="flex justify-between p-3 bg-background rounded-lg">
                                    <span className="text-muted-foreground">Assigned By:</span>
                                    <span className="font-medium">{task.serviceProviderAssignedBy || task.createdBy}</span>
                                  </div>
                                  <div className="flex justify-between p-3 bg-background rounded-lg">
                                    <span className="text-muted-foreground">Assigned Date:</span>
                                    <span className="font-medium">
                                      {task.serviceProviderAssignedDate 
                                        ? new Date(task.serviceProviderAssignedDate).toLocaleString()
                                        : new Date(task.createdDate).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-muted p-4 rounded-lg">
                                <h3 className="font-semibold mb-3">Cost Information</h3>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Estimated:</span>
                                    <span className="font-medium">
                                      GHS {task.estimatedCost?.toFixed(2) || "N/A"}
                                    </span>
                                  </div>
                                  {task.actualCost && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Actual:</span>
                                      <span className="font-medium">GHS {task.actualCost.toFixed(2)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="bg-muted p-4 rounded-lg text-center text-muted-foreground">
                              <p>No service provider assigned yet</p>
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="progress" className="space-y-4">
                          <div className="space-y-4">
                            <div>
                              <Label className="font-semibold">Timeline</Label>
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>Created:</span>
                                  <span>{new Date(task.createdDate).toLocaleString()}</span>
                                </div>
                                {task.pickupDate && (
                                  <div className="flex justify-between text-sm">
                                    <span>Pickup Date:</span>
                                    <span>{new Date(task.pickupDate).toLocaleString()}</span>
                                  </div>
                                )}
                                {task.completionDate && (
                                  <div className="flex justify-between text-sm">
                                    <span>Completed:</span>
                                    <span>{new Date(task.completionDate).toLocaleString()}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {task.attachments.length > 0 && (
                              <div>
                                <Label className="font-semibold">Attachments</Label>
                                <div className="space-y-2">
                                  {(task.attachments || []).map((attachment, index) => (
                                    <div key={index} className="flex items-center gap-2 text-sm">
                                      <FileText className="h-4 w-4" />
                                      <span>{attachment}</span>
                                      <Button size="sm" variant="ghost">
                                        <Download className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">{task.issueDescription}</p>

              {task.status === "assigned" && (
                <div className="bg-purple-50 dark:bg-purple-950/50 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                    <Send className="h-4 w-4" />
                    <span className="font-medium">Task Assigned to Service Provider</span>
                  </div>
                  <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                    Waiting for pickup scheduling by {task.serviceProvider?.name || "service provider"}
                  </p>
                </div>
              )}

              {task.status === "in_repair" && (
                <div className="bg-orange-50 dark:bg-orange-950/50 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                    <Wrench className="h-4 w-4" />
                    <span className="font-medium">Currently Under Repair</span>
                  </div>
                  <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                    Device is being repaired by {task.serviceProvider?.name || "service provider"}
                  </p>
                </div>
              )}

              {task.status === "completed" && (
                <div className="bg-green-50 dark:bg-green-950/50 p-3 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Repair Completed</span>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Ready for pickup from {task.serviceProvider?.name || "service provider"} • Cost: GHS{" "}
                    {task.actualCost?.toFixed(2) || task.estimatedCost?.toFixed(2) || "TBD"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTasks.length > 0 && (
        <DataPagination
          currentPage={safeCurrentPage}
          totalItems={sortedTasks.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="repair tasks"
        />
      )}

      {filteredTasks.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Wrench className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Repair Tasks Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== "all" || priorityFilter !== "all"
                ? "Try adjusting your filters or search terms."
                : "No repair tasks have been created yet."}
            </p>
            {!searchTerm && statusFilter === "all" && priorityFilter === "all" && (
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Repair Task
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
