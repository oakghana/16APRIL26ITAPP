"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  Package,
  UserPlus,
  AlertCircle,
  CheckCircle,
  History,
  Download,
  RefreshCw,
  Filter,
  Laptop,
  Printer,
  Monitor,
  Keyboard,
  Mouse,
  HardDrive,
  Edit,
  Trash2,
  ChevronDown,
  X,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { LOCATIONS } from "@/lib/locations"
import { getCanonicalLocationName, locationsMatch } from "@/lib/location-filter"
import { downloadCSV } from "@/lib/export-utils"
import { filterByCategory } from "@/lib/category-utils"
import { useToast } from "@/hooks/use-toast"

interface StockItem {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  location: string
  sku?: string
  reorder_level?: number
}

interface StaffMember {
  id: string
  name: string
  email: string
  department?: string
  location?: string
  role?: string
  phone?: string
  is_active?: boolean
}

interface StockAssignment {
  id: string
  item_id: string
  item_name: string
  quantity: number
  assigned_to: string
  assigned_to_email?: string
  department: string
  office_location?: string
  room_number?: string
  location: string
  status: string
  assigned_by: string
  assigned_by_role: string
  requisition_number?: string
  asset_tag?: string
  serial_number?: string
  is_replacement: boolean
  replacement_reason?: string
  is_hardware: boolean
  devices_created: number
  notes?: string
  created_at: string
}

interface RegionalDispatchConfirmation {
  id: string
  requisition_number: string
  requested_by: string
  requester_location?: string
  location?: string
  department?: string
  items_required: string
  issuance_notes?: string
  supplier_name?: string
  status: string
}

const REGIONAL_PENDING_CONFIRMATION_STATUSES = ["awaiting_regional_confirmation"]
const REGIONAL_CONFIRMED_DISPATCH_STATUSES = ["pending_regional_store", "issued"]
const REGIONAL_DISPATCH_STATUSES = [
  ...REGIONAL_PENDING_CONFIRMATION_STATUSES,
  ...REGIONAL_CONFIRMED_DISPATCH_STATUSES,
]

const categoryIcons: Record<string, any> = {
  "Computers": Laptop,
  "Printers": Printer,
  "Monitors": Monitor,
  "Peripherals": Keyboard,
  "Hardware": HardDrive,
}

export function AssignStockToStaff() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [assignments, setAssignments] = useState<StockAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const [regionalPendingConfirmations, setRegionalPendingConfirmations] = useState<RegionalDispatchConfirmation[]>([])
  const [regionalConfirmedDispatches, setRegionalConfirmedDispatches] = useState<RegionalDispatchConfirmation[]>([])
  const [regionalConfirmLoading, setRegionalConfirmLoading] = useState(false)
  const [confirmingDispatchId, setConfirmingDispatchId] = useState<string | null>(null)

  // Edit assignment state
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  // Revoke assignment state
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [revokingAssignment, setRevokingAssignment] = useState<StockAssignment | null>(null)
  const [revokeReason, setRevokeReason] = useState("")
  const [isRevoking, setIsRevoking] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<StockAssignment | null>(null)
  const [editForm, setEditForm] = useState({
    assigned_to: "",
    assigned_to_email: "",
    department: "",
    office_location: "",
    room_number: "",
    asset_tag: "",
    serial_number: "",
    notes: "",
  })
  const [editLoading, setEditLoading] = useState(false)

  // Assignment form state
  const [assignmentForm, setAssignmentForm] = useState({
    assigned_to_name: "",
    assigned_to_email: "",
    department: "",
    room_number: "",
    requisition_number: "",
    asset_tag: "",
    serial_number: "",
    is_replacement: false,
    replacement_reason: "",
    quantity: 1,
    notes: "",
  })

  // Add new user dialog state
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false)
  const [newUserForm, setNewUserForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    department: "ITD",
    role: "staff",
    location: "Head Office",
    room_number: "",
    password: "qcc@123",
  })
  const [addUserLoading, setAddUserLoading] = useState(false)

  // Searchable staff combobox state
  const [staffSearch, setStaffSearch] = useState("")
  const [staffDropdownOpen, setStaffDropdownOpen] = useState(false)
  const [selectedStaffName, setSelectedStaffName] = useState("")

  const locationOptions = Object.entries(LOCATIONS).map(([value, label]) => ({
    value,
    label,
  }))

  // Check if user has permission to assign stock
  const canAssignStock = ["admin", "it_store_head", "regional_it_head"].includes(user?.role || "")

  const isTrackableAsset = (item: StockItem | null) => {
    if (!item) return false
    const text = `${item.name} ${item.category}`.toLowerCase()
    return ["laptop", "desktop", "printer", "monitor", "server", "router", "switch", "scanner", "projector", "keyboard", "mouse", "ups", "hardware", "computer"].some((keyword) => text.includes(keyword))
  }

  const extractTrackingValue = (notes?: string, label?: string) => {
    if (!notes || !label) return ""
    const match = notes.match(new RegExp(`${label}:\\s*([^\\n.]+)`, "i"))
    return match?.[1]?.trim() || ""
  }

  const stripTrackingNotes = (notes = "") => {
    return notes
      .replace(/Asset Tag:\s*[^\n.]+[.\n]?/gi, "")
      .replace(/Serial Number:\s*[^\n.]+[.\n]?/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim()
  }

  const buildTrackingNotes = (notes: string, assetTag: string, serialNumber: string) => {
    const cleanedNotes = stripTrackingNotes(notes)
    return [
      assetTag.trim() ? `Asset Tag: ${assetTag.trim()}` : "",
      serialNumber.trim() ? `Serial Number: ${serialNumber.trim()}` : "",
      cleanedNotes,
    ]
      .filter(Boolean)
      .join(". ")
  }

  useEffect(() => {
    if (canAssignStock) {
      loadStockItems()
      loadStaffList()
      loadAssignments()
      if (user?.role === "regional_it_head") {
        loadRegionalPendingConfirmations()
      }
    }
  }, [user?.location])

  const loadRegionalPendingConfirmations = async () => {
    if (user?.role !== "regional_it_head") return

    setRegionalConfirmLoading(true)
    try {
      const params = new URLSearchParams({
        status: REGIONAL_DISPATCH_STATUSES.join(","),
        officeUseLocation: user.location || "",
        officeUseRole: user.role || "",
        officeUseUserId: user.id || "",
      })

      const response = await fetch(`/api/it-forms/requisitions?${params.toString()}`)
      const result = await response.json()

      if (!response.ok) {
        toast({ title: "Error", description: result.error || "Failed to load pending confirmations", variant: "destructive" })
        return
      }

      const requisitions: RegionalDispatchConfirmation[] = result.requisitions || []
      setRegionalPendingConfirmations(
        requisitions.filter((req: RegionalDispatchConfirmation) =>
          REGIONAL_PENDING_CONFIRMATION_STATUSES.includes(String(req.status || ""))
        )
      )
      setRegionalConfirmedDispatches(
        requisitions.filter((req: RegionalDispatchConfirmation) =>
          REGIONAL_CONFIRMED_DISPATCH_STATUSES.includes(String(req.status || ""))
        )
      )
    } catch (error) {
      console.error("[v0] Error loading regional pending confirmations:", error)
      toast({ title: "Error", description: "Failed to load pending confirmations", variant: "destructive" })
    } finally {
      setRegionalConfirmLoading(false)
    }
  }

  const handleConfirmRegionalDispatch = async (requisition: RegionalDispatchConfirmation) => {
    if (user?.role !== "regional_it_head") return

    setConfirmingDispatchId(requisition.id)
    try {
      const response = await fetch("/api/it-forms/store-issue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requisitionId: requisition.id,
          action: "regional_confirm_receipt",
          actorId: user?.id,
          actorName: user?.full_name || user?.name || user?.email,
          actorEmail: user?.email,
          actorRole: user?.role,
          actorLocation: user?.location,
          confirmation: "approved",
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to confirm receipt")
      }

      toast({
        title: "Dispatch Confirmed",
        description: "Receipt confirmed. Regional stock is now available for staff assignment.",
      })

      await Promise.all([
        loadRegionalPendingConfirmations(),
        loadStockItems(),
      ])
    } catch (error: any) {
      toast({
        title: "Confirmation Failed",
        description: error.message || "Unable to confirm dispatch receipt",
        variant: "destructive",
      })
    } finally {
      setConfirmingDispatchId(null)
    }
  }

  const loadStockItems = async () => {
    try {
      const location = user?.location || ""
      const canSeeAll = user?.role === "admin" || user?.role === "it_store_head"
      
      const params = new URLSearchParams({
        location: location,
        canSeeAll: String(canSeeAll),
      })
      
      const response = await fetch(`/api/store/items?${params}`)
      const result = await response.json()

      if (!response.ok) {
        console.error("[v0] Error loading stock items:", result.error)
        return
      }

      // Filter items with quantity > 0 and apply strict role-based restrictions
      let availableItems = (result.items || []).filter((item: StockItem) => item.quantity > 0)

      // CRITICAL: Always exclude Central Stores - direct assignment is never allowed
      availableItems = availableItems.filter((item: StockItem) => 
        item.location !== "central_stores" && 
        item.location !== "Central Stores"
      )

      // Apply additional role-based filtering
      if (user?.role === "it_store_head") {
        // IT Store Head can ONLY see Head Office items
        availableItems = availableItems.filter((item: StockItem) => 
          item.location === "head_office" || item.location === "Head Office"
        )
        console.log("[v0] IT Store Head - filtered to Head Office items:", availableItems.length)
      } else if (user?.role === "regional_it_head") {
        // Regional IT Head can ONLY see their specific location items
        const userLocation = user.location || ""
        availableItems = availableItems.filter((item: StockItem) => 
          locationsMatch(item.location, userLocation)
        )
        console.log(`[v0] Regional IT Head - filtered to ${userLocation} items:`, availableItems.length)
      } else if (user?.role === "admin") {
        // Admin can see all items except central stores (already filtered above)
        console.log("[v0] Admin - showing all non-Central Stores items:", availableItems.length)
      }

      setStockItems(availableItems)
    } catch (error) {
      console.error("[v0] Error loading stock items:", error)
    }
  }

  const loadStaffList = async () => {
    try {
      const response = await fetch(`/api/staff/list?allUsers=true`)
      const result = await response.json()

      if (!response.ok) {
        toast({ title: "Error", description: result.error || "Failed to load staff list", variant: "destructive" })
        return
      }

      setStaffList(result.staff || [])
    } catch (error) {
      toast({ title: "Error", description: "Failed to load staff list", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const loadAssignments = async () => {
    try {
      const params = new URLSearchParams({
        location: user?.location || "",
        canSeeAll: String(user?.role === "admin" || user?.role === "it_store_head"),
      })
      
      const response = await fetch(`/api/store/assignments?${params}`)
      const result = await response.json()

      if (response.ok) {
        setAssignments(result.assignments || [])
      }
    } catch (error) {
      console.error("[v0] Error loading assignments:", error)
    }
  }

  const handleAssignItem = (item: StockItem) => {
    setSelectedItem(item)
    setAssignmentForm({
      assigned_to_name: "",
      assigned_to_email: "",
      department: "",
      room_number: "",
      requisition_number: "",
      asset_tag: "",
      serial_number: "",
      is_replacement: false,
      replacement_reason: "",
      quantity: 1,
      notes: "",
    })
    setError("")
    setSuccess("")
    setAssignDialogOpen(true)
  }

  const handleStaffSelect = (staffId: string) => {
    const staff = staffList.find(s => s.id === staffId)
    if (staff) {
      const staffName = staff.name || staff.email || "Unknown Staff"
      setAssignmentForm(prev => ({
        ...prev,
        assigned_to_name: staffName,
        assigned_to_email: staff.email || "",
        department: staff.department || prev.department,
      }))
      setSelectedStaffName(staffName)
      setStaffSearch("")
      setStaffDropdownOpen(false)
    }
  }

  const handleCreateNewUser = async () => {
    if (!newUserForm.full_name.trim()) {
      toast({ title: "Validation Error", description: "Full name is required", variant: "destructive" })
      return
    }
    if (!newUserForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUserForm.email)) {
      toast({ title: "Validation Error", description: "A valid email address is required", variant: "destructive" })
      return
    }

    setAddUserLoading(true)
    try {
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserForm.full_name.trim(),
          email: newUserForm.email.trim().toLowerCase(),
          phone: newUserForm.phone.trim(),
          department: newUserForm.department,
          role: newUserForm.role,
          location: newUserForm.location,
          password: newUserForm.password || "qcc@123",
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast({ title: "Creation Failed", description: result.error || "Failed to create user", variant: "destructive" })
        return
      }

      const newStaffMember: StaffMember = {
        id: result.user?.id || crypto.randomUUID(),
        name: newUserForm.full_name.trim(),
        email: newUserForm.email.trim().toLowerCase(),
        department: newUserForm.department,
        location: newUserForm.location,
        role: newUserForm.role,
        is_active: true,
      }
      setStaffList(prev => [...prev, newStaffMember].sort((a, b) => a.name.localeCompare(b.name)))

      setAssignmentForm(prev => ({
        ...prev,
        assigned_to_name: newUserForm.full_name.trim(),
        assigned_to_email: newUserForm.email.trim().toLowerCase(),
        department: newUserForm.department,
        room_number: newUserForm.room_number,
      }))
      setSelectedStaffName(newUserForm.full_name.trim())

      toast({ title: "User Created", description: `"${newUserForm.full_name}" was created and selected.` })
      setAddUserDialogOpen(false)
      setNewUserForm({ full_name: "", email: "", phone: "", department: "ITD", role: "staff", location: "Head Office", room_number: "", password: "qcc@123" })
    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" })
    } finally {
      setAddUserLoading(false)
    }
  }


  const handleSubmitAssignment = async () => {
    if (!selectedItem) return

    // Validation
    if (!assignmentForm.assigned_to_name.trim()) {
      setError("Please select or enter the name of the person to assign the item to")
      return
    }
    if (!assignmentForm.department.trim()) {
      setError("Please enter the department")
      return
    }
    if (assignmentForm.quantity < 1) {
      setError("Quantity must be at least 1")
      return
    }
    if (assignmentForm.quantity > selectedItem.quantity) {
      setError(`Insufficient stock. Available: ${selectedItem.quantity}`)
      return
    }
    if (assignmentForm.is_replacement && !assignmentForm.replacement_reason.trim()) {
      setError("Please provide a reason for replacement")
      return
    }
    if (isTrackableAsset(selectedItem) && !assignmentForm.asset_tag.trim()) {
      setError("Please enter an asset tag for this issued item so it can be tracked")
      return
    }

    setAssignmentLoading(true)
    setError("")

    try {
      const response = await fetch("/api/store/assign-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: selectedItem.id,
          assigned_to_name: assignmentForm.assigned_to_name.trim(),
          assigned_to_email: assignmentForm.assigned_to_email.trim(),
          department: assignmentForm.department.trim(),
          room_number: assignmentForm.room_number.trim(),
          requisition_number: assignmentForm.requisition_number.trim(),
          asset_tag: assignmentForm.asset_tag.trim(),
          serial_number: assignmentForm.serial_number.trim(),
          is_replacement: assignmentForm.is_replacement,
          replacement_reason: assignmentForm.replacement_reason.trim(),
          notes: buildTrackingNotes(
            assignmentForm.notes,
            assignmentForm.asset_tag,
            assignmentForm.serial_number,
          ),
          quantity: assignmentForm.quantity,
          location: selectedItem.location,
          assigned_by: user?.full_name || user?.name || user?.username,
          assigned_by_role: user?.role,
          user_location: user?.location,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || "Failed to assign item")
        toast({
          title: "Error",
          description: result.error || "Failed to assign item",
          variant: "destructive",
        })
        return
      }

      setSuccess(`Successfully assigned ${assignmentForm.quantity} ${selectedItem.name} to ${assignmentForm.assigned_to_name}`)
      toast({
        title: "✅ Item Assigned",
        description: assignmentForm.asset_tag.trim()
          ? `Successfully assigned ${selectedItem.name} with asset tag ${assignmentForm.asset_tag.trim()}`
          : `Successfully assigned ${assignmentForm.quantity} ${selectedItem.name} to ${assignmentForm.assigned_to_name}`,
      })
      
      // Refresh data
      await loadStockItems()
      await loadAssignments()
      
      // Close dialog after short delay to show success message
      setTimeout(() => {
        setAssignDialogOpen(false)
        setSuccess("")
      }, 2000)

      // Trigger inventory refresh event
      window.dispatchEvent(new CustomEvent("inventory-updated"))
    } catch (error) {
      console.error("[v0] Error assigning item:", error)
      setError("An error occurred while assigning the item")
      toast({
        title: "Error",
        description: "An error occurred while assigning the item",
        variant: "destructive",
      })
    } finally {
      setAssignmentLoading(false)
    }
  }

  const normalizedSearchTerm = searchTerm.toLowerCase()
  const filteredStockItems = filterByCategory(
    stockItems.filter((item) => {
      const itemName = (item.name || "").toLowerCase()
      const itemSku = (item.sku || "").toLowerCase()
      return itemName.includes(normalizedSearchTerm) || itemSku.includes(normalizedSearchTerm)
    }),
    categoryFilter
  )

  const uniqueCategories = [...new Set(stockItems.map(item => item.category).filter(Boolean))]

  // Handle opening edit dialog
  const handleEditAssignment = (assignment: StockAssignment) => {
    setEditingAssignment(assignment)
    setEditForm({
      assigned_to: assignment.assigned_to,
      assigned_to_email: assignment.assigned_to_email || "",
      department: assignment.department || "",
      office_location: assignment.office_location || "",
      room_number: assignment.room_number || "",
      asset_tag: assignment.asset_tag || extractTrackingValue(assignment.notes, "Asset Tag"),
      serial_number: assignment.serial_number || extractTrackingValue(assignment.notes, "Serial Number"),
      notes: stripTrackingNotes(assignment.notes || ""),
    })
    setEditDialogOpen(true)
  }

  // Handle saving edit
  const handleSaveEdit = async () => {
    if (!editingAssignment) return

    if (!editForm.assigned_to.trim()) {
      toast({
        title: "❌ Validation Error",
        description: "Recipient name is required",
        variant: "destructive",
      })
      return
    }

    setEditLoading(true)
    try {
      const response = await fetch("/api/store/update-assignment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: editingAssignment.id,
          assigned_to: editForm.assigned_to,
          assigned_to_email: editForm.assigned_to_email,
          department: editForm.department,
          office_location: editForm.office_location,
          room_number: editForm.room_number,
          asset_tag: editForm.asset_tag,
          serial_number: editForm.serial_number,
          notes: buildTrackingNotes(editForm.notes, editForm.asset_tag, editForm.serial_number),
          updatedBy: user?.full_name || user?.username || user?.email,
          userRole: user?.role,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast({
          title: "❌ Update Failed",
          description: result.error || "Failed to update assignment",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "✅ Assignment Updated",
        description: result.message || "Assignment has been updated successfully",
      })

      setEditDialogOpen(false)
      setEditingAssignment(null)
      loadAssignments() // Refresh the list
    } catch (error) {
      console.error("[v0] Error updating assignment:", error)
      toast({
        title: "❌ Error",
        description: "An error occurred while updating the assignment",
        variant: "destructive",
      })
    } finally {
      setEditLoading(false)
    }
  }

  const handleRevokeAssignment = async () => {
    if (!revokingAssignment || !revokeReason.trim()) return

    setIsRevoking(true)
    try {
      const response = await fetch("/api/store/delete-assignment", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: revokingAssignment.id,
          deletedBy: user?.full_name || user?.email,
          userRole: user?.role,
          reason: revokeReason.trim(),
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        toast({
          title: "Error",
          description: result.error || "Failed to revoke assignment",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "✅ Assignment Revoked",
        description: `Assignment of ${revokingAssignment.item_name} to ${revokingAssignment.assigned_to} has been revoked.`,
      })

      setRevokeDialogOpen(false)
      setRevokingAssignment(null)
      setRevokeReason("")
      loadAssignments()
    } catch (error) {
      console.error("[assign-stock] Error revoking assignment:", error)
      toast({ title: "Error", description: "Failed to revoke assignment", variant: "destructive" })
    } finally {
      setIsRevoking(false)
    }
  }

  const handleExportAssignments = () => {
    const headers = [
      "Date",
      "Item Name",
      "Quantity",
      "Assigned To",
      "Email",
      "Department",
      "Room Number",
      "Location",
      "Requisition #",
      "Asset Tag",
      "Serial Number",
      "Is Replacement",
      "Replacement Reason",
      "Is Hardware",
      "Devices Created",
      "Assigned By",
      "Notes",
      "Status",
    ]

    const rows = assignments.map(a => [
      new Date(a.created_at).toLocaleDateString(),
      a.item_name,
      a.quantity,
      a.assigned_to,
      a.assigned_to_email || "",
      a.department,
      a.room_number || "",
      a.location,
      a.requisition_number || "",
      a.asset_tag || extractTrackingValue(a.notes, "Asset Tag"),
      a.serial_number || extractTrackingValue(a.notes, "Serial Number"),
      a.is_replacement ? "Yes" : "No",
      a.replacement_reason || "",
      a.is_hardware ? "Yes" : "No",
      a.devices_created,
      a.assigned_by,
      a.notes || "",
      a.status,
    ])

    downloadCSV({
      title: "Stock Assignments",
      fileName: "stock-assignments",
      headers,
      rows,
    })
  }

  if (!canAssignStock) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-emerald-700">
            <AlertCircle className="h-5 w-5" />
            <p>You don't have permission to assign stock items.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading stock assignment module...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-stone-50 p-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Assign Stock to Staff</h2>
          <p className="text-muted-foreground">
            {user?.role === "regional_it_head" 
              ? `Assign items from your regional location (${LOCATIONS[user?.location as keyof typeof LOCATIONS] || user?.location}) stock to staff members`
              : user?.role === "it_store_head"
                ? "Assign items from Head Office stock to staff members"
                : "Assign items from all locations' stock to staff members (except Central Stores)"}
          </p>
          {user?.role !== "admin" && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
              Central Stores items are requested through Store Requisitions.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAssignments} className="border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-800">
            <RefreshCw className="h-4 w-4 mr-2 text-emerald-800" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExportAssignments} className="border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-800">
            <Download className="h-4 w-4 mr-2 text-emerald-800" />
            Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="assign" className="space-y-4">
        <TabsList>
          {user?.role === "regional_it_head" && (
            <TabsTrigger value="confirmations">
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirm Dispatch ({regionalPendingConfirmations.length})
            </TabsTrigger>
          )}
          {user?.role === "regional_it_head" && (
            <TabsTrigger value="confirmed-dispatches">
              <History className="h-4 w-4 mr-2" />
              Confirmed ({regionalConfirmedDispatches.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="assign">
            <UserPlus className="h-4 w-4 mr-2" />
            Assign Items
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            Assignment History
          </TabsTrigger>
        </TabsList>

        {user?.role === "regional_it_head" && (
          <TabsContent value="confirmations" className="space-y-4">
            <Card className="rounded-2xl border-emerald-100 bg-white shadow-sm">
              <CardHeader>
                <CardTitle>Regional Dispatch Confirmations</CardTitle>
                <CardDescription>
                  Confirm dispatches received from Head Office Store Head before issuing items to regional staff.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-end">
                  <Button variant="outline" onClick={loadRegionalPendingConfirmations} className="border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-800">
                    <RefreshCw className="h-4 w-4 mr-2 text-emerald-800" />
                    Refresh
                  </Button>
                </div>

                {regionalConfirmLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading pending dispatch confirmations...</div>
                ) : regionalPendingConfirmations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No pending dispatch confirmations.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {regionalPendingConfirmations.map((req) => {
                      const needsConfirmation = req.status === "awaiting_regional_confirmation"
                      return (
                      <div key={req.id} className="rounded-lg border p-4 space-y-2">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-semibold">{req.requisition_number || req.id}</p>
                            <p className="text-sm text-muted-foreground">
                              Requested by: {req.requested_by || "Unknown"}
                              {(req.requester_location || req.location) ? ` • ${req.requester_location || req.location}` : ""}
                            </p>
                            <p className="text-sm text-muted-foreground">Department: {req.department || "-"}</p>
                            <p className="text-sm">Items: {req.items_required}</p>
                            {req.issuance_notes ? (
                              <p className="text-xs text-muted-foreground">Store note: {req.issuance_notes}</p>
                            ) : null}
                            <p className="text-xs text-muted-foreground">
                              Status: Awaiting Receipt Confirmation
                            </p>
                          </div>
                          <Button
                            onClick={() => handleConfirmRegionalDispatch(req)}
                            disabled={!needsConfirmation || confirmingDispatchId === req.id}
                            className={needsConfirmation ? "bg-green-600 hover:bg-green-700" : "bg-slate-400 hover:bg-slate-400 cursor-not-allowed"}
                          >
                            {!needsConfirmation
                              ? "Already Confirmed"
                              : confirmingDispatchId === req.id
                                ? "Confirming..."
                                : "Confirm Receipt"}
                          </Button>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {user?.role === "regional_it_head" && (
          <TabsContent value="confirmed-dispatches" className="space-y-4">
            <Card className="rounded-2xl border-emerald-100 bg-white shadow-sm">
              <CardHeader>
                <CardTitle>Confirmed Dispatches</CardTitle>
                <CardDescription>
                  Dispatches already confirmed by Regional IT Head and ready for issuance or already issued.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-end">
                  <Button variant="outline" onClick={loadRegionalPendingConfirmations} className="border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-800">
                    <RefreshCw className="h-4 w-4 mr-2 text-emerald-800" />
                    Refresh
                  </Button>
                </div>

                {regionalConfirmLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading confirmed dispatches...</div>
                ) : regionalConfirmedDispatches.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No confirmed dispatch records yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {regionalConfirmedDispatches.map((req) => (
                      <div key={req.id} className="rounded-lg border p-4 space-y-2">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-semibold">{req.requisition_number || req.id}</p>
                            <p className="text-sm text-muted-foreground">
                              Requested by: {req.requested_by || "Unknown"}
                              {(req.requester_location || req.location) ? ` • ${req.requester_location || req.location}` : ""}
                            </p>
                            <p className="text-sm text-muted-foreground">Department: {req.department || "-"}</p>
                            <p className="text-sm">Items: {req.items_required}</p>
                            {req.issuance_notes ? (
                              <p className="text-xs text-muted-foreground">Store note: {req.issuance_notes}</p>
                            ) : null}
                            <p className="text-xs text-muted-foreground">
                              Status: {req.status === "pending_regional_store" ? "Confirmed - Ready for Regional Issuance" : "Issued"}
                            </p>
                          </div>
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 w-fit">
                            {req.status === "pending_regional_store" ? "Confirmed" : "Issued"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="assign" className="space-y-4">
          {/* Info Alert about Central Stores restriction */}
          <div className="bg-stone-50 border border-emerald-100 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-emerald-800 mt-0.5" />
              <div>
                <p className="font-medium text-emerald-900">Stock Assignment Policy</p>
                <ul className="text-sm text-emerald-800 mt-1 space-y-1">
                  <li>• <strong>Regional IT Heads:</strong> Can only assign stock from their regional location inventory.</li>
                  <li>• <strong>IT Store Heads:</strong> Can only assign stock from Head Office inventory.</li>
                  <li>• <strong>Central Stores:</strong> Items cannot be directly assigned. Use <strong>Store Requisitions</strong> to request items from Central Stores.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Search and Filter */}
          <Card className="rounded-2xl border-emerald-100 bg-white shadow-sm">
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-emerald-800" />
                  <Input
                    placeholder="Search items by name or SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Available Stock Items */}
          <Card className="rounded-2xl border-emerald-100 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Available Stock Items</CardTitle>
              <CardDescription>
                Select an item to assign to a staff member. Stock will be deducted from the location's inventory.
                {user?.role === "regional_it_head" && (
                  <span className="block text-emerald-700 mt-1">
                    You can only assign items from your regional location ({LOCATIONS[user?.location as keyof typeof LOCATIONS] || user?.location}).
                  </span>
                )}
                {user?.role === "it_store_head" && (
                  <span className="block text-emerald-700 mt-1">
                    You can only assign items from Head Office stock.
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredStockItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No items available for assignment</p>
                  <p className="text-sm">Items must have quantity greater than 0</p>
                  {user?.role === "regional_it_head" && (
                    <p className="text-sm text-emerald-700 mt-2">
                      Check if your regional location ({LOCATIONS[user?.location as keyof typeof LOCATIONS] || user?.location}) has stock available.
                    </p>
                  )}
                  {user?.role === "it_store_head" && (
                    <p className="text-sm text-emerald-700 mt-2">
                      Check if Head Office has stock available.
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-center">Available</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStockItems.map((item) => {
                        const IconComponent = categoryIcons[item.category] || Package
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4 text-emerald-800" />
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  {item.sku && (
                                    <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.category}</Badge>
                            </TableCell>
                            <TableCell>
                              {getCanonicalLocationName(item.location)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={item.quantity <= (item.reorder_level || 5) ? "destructive" : "secondary"}>
                                {item.quantity} {item.unit}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                onClick={() => handleAssignItem(item)}
                                className="bg-green-100 hover:bg-green-200 text-green-900 border border-green-200"
                              >
                                <UserPlus className="h-4 w-4 mr-1 text-green-900" />
                                Assign
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="rounded-2xl border-emerald-100 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Assignment History</CardTitle>
              <CardDescription>
                View all stock assignments made to staff members
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No assignments recorded yet</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Dept / Location</TableHead>
                        <TableHead>Tag / Req No</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignments.map((assignment) => {
                        const assetTag = assignment.asset_tag || extractTrackingValue(assignment.notes, "Asset Tag")
                        const serialNumber = assignment.serial_number || extractTrackingValue(assignment.notes, "Serial Number")

                        return (
                          <TableRow key={assignment.id}>
                            <TableCell className="whitespace-nowrap">
                              {new Date(assignment.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{assignment.item_name}</p>
                                {assignment.is_hardware && (
                                  <p className="text-xs text-muted-foreground">
                                    {assignment.devices_created} device(s) created
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{assignment.quantity}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{assignment.assigned_to}</p>
                                {assignment.assigned_to_email && (
                                  <p className="text-xs text-muted-foreground">{assignment.assigned_to_email}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p>{assignment.department || "-"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {getCanonicalLocationName(assignment.location || "") || "-"}
                                  {assignment.room_number ? ` • Room: ${assignment.room_number}` : ""}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="text-sm font-medium">{assetTag || "-"}</p>
                                <p className="text-xs text-muted-foreground">Req: {assignment.requisition_number || "-"}</p>
                                {serialNumber && (
                                  <p className="text-xs text-muted-foreground">SN: {serialNumber}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {assignment.is_replacement ? (
                                <Badge variant="secondary">Replacement</Badge>
                              ) : (
                                <Badge variant="outline">New</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={assignment.status === "assigned" ? "default" : "secondary"}
                              >
                                {assignment.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {["admin", "it_store_head", "it_head", "regional_it_head"].includes(user?.role || "") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditAssignment(assignment)}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                              )}
                              {["admin", "it_store_head"].includes(user?.role || "") && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="ml-1"
                                  onClick={() => {
                                    setRevokingAssignment(assignment)
                                    setRevokeReason("")
                                    setRevokeDialogOpen(true)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Revoke
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Stock Item to Staff</DialogTitle>
            <DialogDescription>
              Fill in the details below to assign {selectedItem?.name} to a staff member.
              Stock will be deducted from {selectedItem?.location} inventory.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4 py-4">
              {/* Error/Success Messages */}
              {error && (
                <div className="bg-destructive/10 text-destructive px-4 py-2 rounded flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-100 text-green-800 px-4 py-2 rounded flex items-center gap-2 dark:bg-green-900/20 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  {success}
                </div>
              )}

              {/* Item Info */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Item</Label>
                    <p className="font-medium">{selectedItem.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Category</Label>
                    <p className="font-medium">{selectedItem.category}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Available Stock</Label>
                    <Badge variant="secondary">{selectedItem.quantity} {selectedItem.unit}</Badge>
                  </div>
                </div>
              </div>

              {/* Staff Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Select Staff Member *</Label>
                  <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="text-xs">
                        <UserPlus className="h-3 w-3 mr-1" />
                        Add New User
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Create New User</DialogTitle>
                        <DialogDescription>
                          Add a new user to the system. They will be created as active and automatically selected.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor="new-user-name">Full Name *</Label>
                            <Input
                              id="new-user-name"
                              placeholder="Enter full name"
                              value={newUserForm.full_name}
                              onChange={(e) => setNewUserForm(prev => ({ ...prev, full_name: e.target.value }))}
                              disabled={addUserLoading}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="new-user-email">Email *</Label>
                            <Input
                              id="new-user-email"
                              type="email"
                              placeholder="Enter email"
                              value={newUserForm.email}
                              onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                              disabled={addUserLoading}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="new-user-phone">Phone</Label>
                            <Input
                              id="new-user-phone"
                              placeholder="e.g. 0244000000"
                              value={newUserForm.phone}
                              onChange={(e) => setNewUserForm(prev => ({ ...prev, phone: e.target.value }))}
                              disabled={addUserLoading}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="new-user-department">Department</Label>
                            <Select
                              value={newUserForm.department}
                              onValueChange={(v) => setNewUserForm(prev => ({ ...prev, department: v }))}
                              disabled={addUserLoading}
                            >
                              <SelectTrigger id="new-user-department">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {["ITD","Marketing","AUDIT","ACCOUNTS","RESEARCH","ESTATE","SECURITY","OPERATIONS","PROCUREMENT","HR","LEGAL","FINANCE"].map(d => (
                                  <SelectItem key={d} value={d}>{d}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="new-user-role">Role</Label>
                            <Select
                              value={newUserForm.role}
                              onValueChange={(v) => setNewUserForm(prev => ({ ...prev, role: v }))}
                              disabled={addUserLoading}
                            >
                              <SelectTrigger id="new-user-role">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="staff">Staff</SelectItem>
                                <SelectItem value="it_staff">IT Staff</SelectItem>
                                <SelectItem value="it_head">IT Head</SelectItem>
                                <SelectItem value="it_store_head">IT Store Head</SelectItem>
                                <SelectItem value="service_desk_head">Service Desk Head</SelectItem>
                                <SelectItem value="service_desk_staff">Service Desk Staff</SelectItem>
                                <SelectItem value="regional_it_head">Regional IT Head</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="new-user-location">Location</Label>
                            <Select
                              value={newUserForm.location}
                              onValueChange={(v) => setNewUserForm(prev => ({ ...prev, location: v }))}
                              disabled={addUserLoading}
                            >
                              <SelectTrigger id="new-user-location">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {["Head Office","Accra","Kumasi","Takoradi","Tema","Swedru/CR","Ho","Tamale","Sunyani"].map(l => (
                                  <SelectItem key={l} value={l}>{l}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="new-user-room">Room Number</Label>
                            <Input
                              id="new-user-room"
                              placeholder="e.g. Room 205"
                              value={newUserForm.room_number}
                              onChange={(e) => setNewUserForm(prev => ({ ...prev, room_number: e.target.value }))}
                              disabled={addUserLoading}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="new-user-password">Default Password</Label>
                            <Input
                              id="new-user-password"
                              type="password"
                              value={newUserForm.password}
                              onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                              disabled={addUserLoading}
                            />
                            <p className="text-xs text-muted-foreground">User can change after first login</p>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAddUserDialogOpen(false)} disabled={addUserLoading}>
                          Cancel
                        </Button>
                        <Button onClick={handleCreateNewUser} disabled={addUserLoading}>
                          {addUserLoading ? "Creating..." : "Create User"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="relative">
                  {/* Trigger button */}
                  <button
                    type="button"
                    onClick={() => setStaffDropdownOpen(prev => !prev)}
                    className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <span className={selectedStaffName ? "text-foreground" : "text-muted-foreground"}>
                      {selectedStaffName || "Select a staff member..."}
                    </span>
                    <div className="flex items-center gap-1">
                      {selectedStaffName && (
                        <X
                          className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedStaffName("")
                            setAssignmentForm(prev => ({ ...prev, assigned_to_name: "", assigned_to_email: "", department: "" }))
                          }}
                        />
                      )}
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>

                  {/* Dropdown panel */}
                  {staffDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                      {/* Search input */}
                      <div className="flex items-center border-b px-3 py-2 gap-2">
                        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search by name..."
                          value={staffSearch}
                          onChange={(e) => setStaffSearch(e.target.value)}
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                        {staffSearch && (
                          <X
                            className="h-3.5 w-3.5 text-muted-foreground cursor-pointer hover:text-foreground"
                            onClick={() => setStaffSearch("")}
                          />
                        )}
                      </div>

                      {/* User list */}
                      <div className="max-h-60 overflow-y-auto">
                        {staffList.length === 0 ? (
                          <div className="p-4 text-sm text-muted-foreground text-center">
                            No users available. Use "Add New User" to create one.
                          </div>
                        ) : (() => {
                          const filtered = staffList.filter((s) =>
                            (s.name || "").toLowerCase().includes(staffSearch.toLowerCase())
                          )
                          return filtered.length === 0 ? (
                            <div className="p-4 text-sm text-muted-foreground text-center">
                              No users match "{staffSearch}"
                            </div>
                          ) : (
                            filtered.map((staff) => (
                              <button
                                key={staff.id}
                                type="button"
                                onClick={() => handleStaffSelect(staff.id)}
                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground outline-none"
                              >
                                <span>{staff.name || staff.email || "Unknown Staff"}</span>
                                {staff.is_active === false ? (
                                  <Badge variant="secondary" className="text-xs ml-2">Inactive</Badge>
                                ) : (
                                  <Badge className="text-xs ml-2 bg-green-600 text-white">Active</Badge>
                                )}
                              </button>
                            ))
                          )
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Click-outside overlay */}
                  {staffDropdownOpen && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => { setStaffDropdownOpen(false); setStaffSearch("") }}
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Or enter details manually below if the person is not in the list
                </p>
              </div>

              {/* Manual Entry Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assigned_to_name">Recipient Name *</Label>
                  <Input
                    id="assigned_to_name"
                    placeholder="Full name of recipient"
                    value={assignmentForm.assigned_to_name}
                    onChange={(e) => setAssignmentForm(prev => ({ ...prev, assigned_to_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assigned_to_email">Email Address</Label>
                  <Input
                    id="assigned_to_email"
                    type="email"
                    placeholder="Email (optional)"
                    value={assignmentForm.assigned_to_email}
                    onChange={(e) => setAssignmentForm(prev => ({ ...prev, assigned_to_email: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Department *</Label>
                  <Input
                    id="department"
                    placeholder="e.g., Finance, HR, IT"
                    value={assignmentForm.department}
                    onChange={(e) => setAssignmentForm(prev => ({ ...prev, department: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="room_number">Room Number</Label>
                  <Input
                    id="room_number"
                    placeholder="e.g., Room 205"
                    value={assignmentForm.room_number}
                    onChange={(e) => setAssignmentForm(prev => ({ ...prev, room_number: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="requisition_number">Requisition Number</Label>
                  <Input
                    id="requisition_number"
                    placeholder="e.g., REQ-2024-001"
                    value={assignmentForm.requisition_number}
                    onChange={(e) => setAssignmentForm(prev => ({ ...prev, requisition_number: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    max={selectedItem.quantity}
                    value={assignmentForm.quantity}
                    onChange={(e) => setAssignmentForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="asset_tag">
                    Asset Tag {isTrackableAsset(selectedItem) ? "*" : ""}
                  </Label>
                  <Input
                    id="asset_tag"
                    placeholder="e.g., QCC-IT-0001"
                    value={assignmentForm.asset_tag}
                    onChange={(e) => setAssignmentForm(prev => ({ ...prev, asset_tag: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    {isTrackableAsset(selectedItem)
                      ? "Required for trackable equipment being issued out."
                      : "Optional for non-trackable items."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serial_number">Serial Number</Label>
                  <Input
                    id="serial_number"
                    placeholder="Manufacturer serial number"
                    value={assignmentForm.serial_number}
                    onChange={(e) => setAssignmentForm(prev => ({ ...prev, serial_number: e.target.value }))}
                  />
                </div>
              </div>

              {/* Replacement Section */}
              <div className="space-y-2 p-4 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_replacement"
                    checked={assignmentForm.is_replacement}
                    onCheckedChange={(checked) => setAssignmentForm(prev => ({ ...prev, is_replacement: checked as boolean }))}
                  />
                  <Label htmlFor="is_replacement" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    This is a replacement item
                  </Label>
                </div>
                {assignmentForm.is_replacement && (
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="replacement_reason">Reason for Replacement *</Label>
                    <Textarea
                      id="replacement_reason"
                      placeholder="Describe why the item needs to be replaced (e.g., damaged, faulty, lost, end of life)"
                      value={assignmentForm.replacement_reason}
                      onChange={(e) => setAssignmentForm(prev => ({ ...prev, replacement_reason: e.target.value }))}
                      rows={2}
                    />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional information about this assignment..."
                  value={assignmentForm.notes}
                  onChange={(e) => setAssignmentForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                />
              </div>

              {/* Hardware Notice */}
              {["Computers", "Printers", "Monitors", "Peripherals", "Hardware", "Network Equipment", "Accessories"].some(
                cat => selectedItem.category?.toLowerCase().includes(cat.toLowerCase()) ||
                       (selectedItem.name || "").toLowerCase().includes("laptop") ||
                       (selectedItem.name || "").toLowerCase().includes("desktop") ||
                       (selectedItem.name || "").toLowerCase().includes("printer")
              ) && (
                <div className="p-3 bg-emerald-50 text-emerald-900 rounded-lg text-sm border border-emerald-200">
                  <p className="font-medium">Hardware Item Detected</p>
                  <p>A device record will be automatically created and added to the location's device inventory.</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              disabled={assignmentLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitAssignment}
              disabled={assignmentLoading}
              className="bg-green-100 hover:bg-green-200 text-green-900 border border-green-300"
            >
              {assignmentLoading ? "Assigning..." : "Assign Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Assignment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Assignment</DialogTitle>
            <DialogDescription>
              Update the assignment details. {editingAssignment?.is_hardware && "Device records will also be updated."}
            </DialogDescription>
          </DialogHeader>

          {editingAssignment && (
            <div className="space-y-4 py-4">
              {/* Item Info (read-only) */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Item</p>
                <p className="font-medium">{editingAssignment.item_name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Quantity: {editingAssignment.quantity} • Location: {editingAssignment.location}
                </p>
                {editingAssignment.is_hardware && (
                  <Badge variant="secondary" className="mt-2">
                    Hardware - {editingAssignment.devices_created} device(s)
                  </Badge>
                )}
              </div>

              {/* Editable Fields */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_assigned_to">Recipient Name *</Label>
                    <Input
                      id="edit_assigned_to"
                      value={editForm.assigned_to}
                      onChange={(e) => setEditForm(prev => ({ ...prev, assigned_to: e.target.value }))}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_email">Email</Label>
                    <Input
                      id="edit_email"
                      type="email"
                      value={editForm.assigned_to_email}
                      onChange={(e) => setEditForm(prev => ({ ...prev, assigned_to_email: e.target.value }))}
                      placeholder="Email address"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_department">Department</Label>
                    <Input
                      id="edit_department"
                      value={editForm.department}
                      onChange={(e) => setEditForm(prev => ({ ...prev, department: e.target.value }))}
                      placeholder="Department"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_room">Room Number</Label>
                    <Input
                      id="edit_room"
                      value={editForm.room_number}
                      onChange={(e) => setEditForm(prev => ({ ...prev, room_number: e.target.value }))}
                      placeholder="Room number"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_office_location">Office Location</Label>
                  <Input
                    id="edit_office_location"
                    value={editForm.office_location}
                    onChange={(e) => setEditForm(prev => ({ ...prev, office_location: e.target.value }))}
                    placeholder="Office location"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_asset_tag">Asset Tag</Label>
                    <Input
                      id="edit_asset_tag"
                      value={editForm.asset_tag}
                      onChange={(e) => setEditForm(prev => ({ ...prev, asset_tag: e.target.value }))}
                      placeholder="QCC-IT-0001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_serial_number">Serial Number</Label>
                    <Input
                      id="edit_serial_number"
                      value={editForm.serial_number}
                      onChange={(e) => setEditForm(prev => ({ ...prev, serial_number: e.target.value }))}
                      placeholder="Serial number"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_notes">Notes</Label>
                  <Textarea
                    id="edit_notes"
                    value={editForm.notes}
                    onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes..."
                    rows={2}
                  />
                </div>
              </div>

              {editingAssignment.is_hardware && (
                <div className="p-3 bg-emerald-50 text-emerald-900 rounded-lg text-sm border border-emerald-200">
                  <p className="font-medium">Hardware Assignment</p>
                  <p>Updating this assignment will also update the associated device records in the device inventory.</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false)
                setEditingAssignment(null)
              }}
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={editLoading} className="bg-green-100 hover:bg-green-200 text-green-900 border border-green-300">
              {editLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Assignment Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Revoke Assignment</DialogTitle>
            <DialogDescription>
              This will permanently revoke the assignment of{" "}
              <strong>{revokingAssignment?.item_name}</strong> (qty: {revokingAssignment?.quantity}) from{" "}
              <strong>{revokingAssignment?.assigned_to}</strong>. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="revoke-reason" className="text-sm font-medium">
                Reason for revoking *
              </Label>
              <Textarea
                id="revoke-reason"
                placeholder="Provide a reason (e.g., staff transferred, item returned, duplicate assignment)"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRevokeDialogOpen(false)
                setRevokingAssignment(null)
                setRevokeReason("")
              }}
              disabled={isRevoking}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeAssignment}
              disabled={isRevoking || !revokeReason.trim()}
            >
              {isRevoking ? "Revoking..." : "Revoke Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
