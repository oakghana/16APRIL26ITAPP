"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Search,
  Filter,
  Eye,
  MessageSquare,
  Clock,
  User,
  MapPin,
  Monitor,
  Wifi,
  Smartphone,
  Printer,
  Settings,
  HelpCircle,
  Edit,
  CheckCircle,
  ArrowUp,
  Wrench,
  AlertTriangle,
  Send,
  Trash2,
  UserCheck,
  Loader2,
} from "lucide-react"
import { AssignTicketDialog } from "./assign-ticket-dialog"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import { canSeeAllLocations, getCanonicalLocationName } from "@/lib/location-filter"
import { safeJsonParse } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { DataPagination } from "@/components/ui/data-pagination"
import { SortControls } from "@/components/ui/sort-controls"
import { sortItems } from "@/lib/sort-utils"

interface Ticket {
  id: string
  uuid: string  // Store actual UUID for API operations
  title: string
  category: string
  priority: string
  status: string
  location: string
  requester: string
  assignee: string
  created: string
  updated: string
  description: string
  comments: Array<{
    id: string
    author: string
    message: string
    timestamp: string
  }>
}

export function TicketList({ tickets: propTickets, onRefresh }: { tickets?: Ticket[], onRefresh?: () => void }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false)
  const [commentDialogOpen, setCommentDialogOpen] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [escalationDialogOpen, setEscalationDialogOpen] = useState(false)
  const [escalationReason, setEscalationReason] = useState("")
  const [escalationSuccess, setEscalationSuccess] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [dbLocations, setDbLocations] = useState<{ code: string; name: string }[]>([])
  const [deleteTicketId, setDeleteTicketId] = useState<string | null>(null)
  const deleteTicketIdRef = useRef<string | null>(null) // Use ref to prevent state reset issues
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false) // Prevent double-click
  const isDeletingRef = useRef(false) // Use ref for immediate check
  const [itRequestFormFile, setItRequestFormFile] = useState<File | null>(null)
  const [isEscalating, setIsEscalating] = useState(false)
  const [selfAssigningTicketId, setSelfAssigningTicketId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [sortField, setSortField] = useState("created")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const supabase = createClient()

  useEffect(() => {
    if (propTickets) {
      // Map propTickets to ensure they have the uuid property
      const mappedPropTickets = propTickets.map((ticket: any) => ({
        ...ticket,
        uuid: ticket.uuid || ticket.id, // Ensure uuid is set
      }))
      setTickets(mappedPropTickets)
      setLoading(false)
    } else {
      loadTickets()
    }
    loadLocations()
  }, [propTickets])

  const loadLocations = async () => {
    try {
      const res = await fetch("/api/admin/lookup-data?type=locations")
      if (res.ok) {
        const data = await res.json()
        const activeLocations = data
          .filter((loc: any) => loc.is_active && loc.code && loc.code.trim() !== "")
          .map((loc: any) => ({
            code: getCanonicalLocationName(loc.code),
            name: getCanonicalLocationName(loc.name),
          }))
        // Deduplicate by canonical code
        const seen = new Set<string>()
        const deduped = activeLocations.filter((loc: { code: string }) => {
          if (seen.has(loc.code)) return false
          seen.add(loc.code)
          return true
        })
        setDbLocations(deduped)
      }
    } catch (error) {
      console.error("Error loading locations:", error)
    }
  }

  const loadTickets = async () => {
    try {
      setLoading(true)
      const location = user?.location || ""
      const canSeeAll = user ? canSeeAllLocations(user) : false
      
      console.log("[v0] Loading tickets via API for user:", user?.role, "location:", location, "canSeeAll:", canSeeAll)
      
      // Use API endpoint that bypasses RLS
      const params = new URLSearchParams({
        location: location,
        canSeeAll: String(canSeeAll),
        userRole: user?.role || "",
        userId: user?.id || "",
        userName: user?.full_name || user?.name || "",
        userEmail: user?.email || "",
      })
      
      const response = await fetch(`/api/service-tickets?${params}`)
      const result = await response.json()

      if (!response.ok) {
        console.error("[v0] Error loading tickets:", result.error)
        return
      }

      console.log("[v0] Loaded tickets from API:", result.tickets?.length || 0, "tickets")

      const mappedTickets: Ticket[] = (result.tickets || []).map((ticket: any) => ({
        id: ticket.ticket_number || ticket.id,
        uuid: ticket.id,  // Store actual UUID for API operations
        title: ticket.title,
        category: ticket.category || "Other",
        priority: ticket.priority || "Medium",
        status: ticket.status || "Open",
            location: getCanonicalLocationName(ticket.location) || "Unknown",
        requester: ticket.requested_by || "Unknown",
        assignee: ticket.assigned_to || "Unassigned",
        created: new Date(ticket.created_at).toLocaleString(),
        updated: new Date(ticket.updated_at || ticket.created_at).toLocaleString(),
        description: ticket.description || "",
        comments: [],
      }))

      setTickets(mappedTickets)
    } catch (error) {
      console.error("[v0] Error loading tickets:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateTicketInDatabase = async (ticketId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from("service_tickets")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("ticket_number", ticketId)
        .eq("id", ticketId)

      if (error) {
        console.error("[v0] Error updating ticket:", error)
        return false
      }

      // Call onRefresh if provided, otherwise call local loadTickets
      if (onRefresh) {
        onRefresh()
      } else {
        await loadTickets()
      }
      return true
    } catch (error) {
      console.error("[v0] Error updating ticket:", error)
      return false
    }
  }

  const categoryIcons = {
    Hardware: Monitor,
    Software: Smartphone,
    Network: Wifi,
    Account: User,
    Printer: Printer,
    Other: HelpCircle,
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Open":
        return "destructive"
      case "In Progress":
        return "default"
      case "Resolved":
        return "secondary"
      case "Escalated":
        return "default"
      default:
        return "outline"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "destructive"
      case "Medium":
        return "default"
      case "Low":
        return "secondary"
      default:
        return "outline"
    }
  }

  const getPriorityCardClass = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "urgent":
        return "border-l-4 border-l-red-600 bg-red-50/30 dark:bg-red-950/20 hover:bg-red-50/50 dark:hover:bg-red-950/30"
      case "high":
        return "border-l-4 border-l-orange-600 bg-orange-50/30 dark:bg-orange-950/20 hover:bg-orange-50/50 dark:hover:bg-orange-950/30"
      case "medium":
        return "border-l-4 border-l-yellow-600 bg-yellow-50/30 dark:bg-yellow-950/20 hover:bg-yellow-50/50 dark:hover:bg-yellow-950/30"
      case "low":
        return "border-l-4 border-l-green-600 bg-green-50/30 dark:bg-green-950/20 hover:bg-green-50/50 dark:hover:bg-green-950/30"
      default:
        return "border-l-4 border-l-gray-600 bg-gray-50/30 dark:bg-gray-950/20 hover:bg-gray-50/50 dark:hover:bg-gray-950/30"
    }
  }

  const handleViewTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setViewDetailsOpen(true)
  }

  const handleEditTicket = (ticket: Ticket) => {
    setEditingTicket({ ...ticket })
    setEditDialogOpen(true)
  }

  const handleUpdateTicket = async () => {
    if (editingTicket) {
      const updateSuccess = await updateTicketInDatabase(editingTicket.id, {
        title: editingTicket.title,
        status: editingTicket.status,
        priority: editingTicket.priority,
        assignee: editingTicket.assignee,
        description: editingTicket.description,
      })

      if (updateSuccess) {
        setEditDialogOpen(false)
        setEditingTicket(null)
      }
    }
  }

  const handleAddComment = async () => {
    if (selectedTicket && newComment.trim()) {
      const updatedTicket = {
        ...selectedTicket,
        comments: [
          ...selectedTicket.comments,
          {
            id: `c${Date.now()}`,
            author: "Current User",
            message: newComment,
            timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
          },
        ],
      }

      const updateSuccess = await updateTicketInDatabase(selectedTicket.id, {
        comments: updatedTicket.comments,
      })

      if (updateSuccess) {
        setSelectedTicket(updatedTicket)
        setNewComment("")
        setCommentDialogOpen(false)
      }
    }
  }

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    await updateTicketInDatabase(ticketId, { status: newStatus })
  }

  const handleEscalateToRepair = async () => {
    if (selectedTicket && escalationReason.trim()) {
      const repairRequest = {
        id: `REP-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
        deviceId: `DEV-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
        deviceName: selectedTicket.title.split(" - ")[0] || "Device",
        issueDescription: selectedTicket.description,
        priority: selectedTicket.priority.toLowerCase(),
        status: "pending_approval",
        requestedBy: selectedTicket.requester,
        location: selectedTicket.location,
        escalatedFrom: selectedTicket.id,
        escalationReason: escalationReason,
        submittedAt: new Date().toISOString(),
      }

      const updatedTicket = {
        ...selectedTicket,
        status: "Escalated",
        comments: [
          ...selectedTicket.comments,
          {
            id: `c${Date.now()}`,
            author: "Service Desk Admin",
            message: `Ticket escalated to repair team. Repair request ${repairRequest.id} created. Reason: ${escalationReason}`,
            timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
          },
        ],
      }

      const updateSuccess = await updateTicketInDatabase(selectedTicket.id, {
        status: updatedTicket.status,
        comments: updatedTicket.comments,
      })

      if (updateSuccess) {
        const existingRepairsRaw = localStorage.getItem("repairRequests")
        const parsedRepairs = safeJsonParse<any[]>(existingRepairsRaw, [])
        const existingRepairs = Array.isArray(parsedRepairs) ? parsedRepairs : []
        existingRepairs.push(repairRequest)
        localStorage.setItem("repairRequests", JSON.stringify(existingRepairs))

        setEscalationSuccess(true)
        setEscalationReason("")
        setEscalationDialogOpen(false)

        setTimeout(() => {
          setEscalationSuccess(false)
          setViewDetailsOpen(false)
        }, 3000)
      }
    }
  }

  const handleAssignTicket = async (assignment: any) => {
    try {
      console.log("[v0] Assignment completed, refreshing tickets")

      // Just reload tickets - the dialog already made the API call
      // Call onRefresh if provided, otherwise call local loadTickets
      if (onRefresh) {
        onRefresh()
      } else {
        await loadTickets()
      }
    } catch (error) {
      console.error("[v0] Error refreshing tickets:", error)
    } finally {
      setAssignDialogOpen(false)
      setSelectedTicket(null)
    }
  }

  const handleSelfAssign = async (ticket: Ticket) => {
    if (!user?.id) return
    setSelfAssigningTicketId(ticket.uuid || ticket.id)
    try {
      const response = await fetch("/api/service-tickets/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.uuid || ticket.id,
          assigneeId: user.id,
          assignee: user.full_name || user.name || user.email || "Regional IT Head",
          assigneeEmail: user.email,
          assigneePhone: user.phone || "",
          priority: ticket.priority?.toLowerCase() || "medium",
          dueDate: "",
          instructions: "Self-assigned by Regional IT Head",
          assignedBy: user.full_name || user.name || user.email || "Regional IT Head",
          assignedById: user.id,
          notifyEmail: false,
          notifySMS: false,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        toast({
          title: "Assignment Failed",
          description: result.error || "Failed to self-assign ticket",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Ticket Assigned to You",
        description: `Ticket ${ticket.id} has been assigned to you successfully.`,
      })

      if (onRefresh) {
        onRefresh()
      } else {
        await loadTickets()
      }
    } catch (error) {
      console.error("[v0] Error self-assigning ticket:", error)
      toast({
        title: "Error",
        description: "An error occurred while self-assigning the ticket",
        variant: "destructive",
      })
    } finally {
      setSelfAssigningTicketId(null)
    }
  }

  const handleDeleteTicket = async (ticketId: string) => {
    // Prevent double-click using ref for immediate check
    if (isDeletingRef.current) {
      console.log("[v0] Delete already in progress (ref check), ignoring duplicate call")
      return
    }
    
    isDeletingRef.current = true
    setIsDeleting(true)
    try {
      console.log("[v0] Deleting ticket:", ticketId)

      const response = await fetch("/api/service-tickets/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticketId,
          userId: user?.full_name || user?.name || user?.username,
          userRole: user?.role,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error("[v0] Error deleting ticket:", result.error)
        toast({
          title: "❌ Failed to Delete Ticket",
          description: result.error || "Failed to delete ticket",
          variant: "destructive",
        })
        return
      }

      console.log("[v0] Ticket deleted successfully:", result.message)
      toast({
        title: "🗑️ Ticket Deleted Successfully",
        description: result.message || "Ticket has been deleted",
      })
      
      setDeleteConfirmOpen(false)
      setDeleteTicketId(null)
      deleteTicketIdRef.current = null
      setViewDetailsOpen(false)
      
      // Call onRefresh if provided, otherwise call local loadTickets
      if (onRefresh) {
        onRefresh()
      } else {
        await loadTickets()
      }
    } catch (error) {
      console.error("[v0] Error deleting ticket:", error)
      toast({
        title: "❌ Error",
        description: "An error occurred while deleting the ticket",
        variant: "destructive",
      })
    } finally {
      isDeletingRef.current = false
      setIsDeleting(false)
    }
  }

  const handleEscalateTicket = async () => {
    if (!selectedTicket || !escalationReason) {
      toast({
        title: "⚠️ Missing Information",
        description: "Please provide an escalation reason",
        variant: "destructive",
      })
      return
    }

    setIsEscalating(true)
    try {
      console.log("[v0] Escalating ticket:", selectedTicket.id)

      // Determine escalation target based on user role and location
      let escalateTo = "regional_it_head"
      if (user?.role === "it_staff" && user?.location !== "head_office") {
        escalateTo = "regional_it_head"
      } else if (user?.role === "it_staff" && user?.location === "head_office") {
        escalateTo = "it_head"
      }

      const response = await fetch("/api/service-tickets/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          escalateTo,
          escalationReason,
          itRequestFormUrl: null, // Will add file upload later
          currentAssignedUser: user?.full_name || user?.name,
          currentUserRole: user?.role,
          currentUserLocation: user?.location,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error("[v0] Error escalating ticket:", result.error)
        toast({
          title: "❌ Escalation Failed",
          description: result.error || "Failed to escalate ticket",
          variant: "destructive",
        })
        return
      }

      console.log("[v0] Ticket escalated successfully")
      toast({
        title: "⬆️ Ticket Escalated Successfully",
        description: "Ticket has been escalated to the appropriate team",
      })
      
      setEscalationDialogOpen(false)
      setEscalationReason("")
      setViewDetailsOpen(false)
      
      // Call onRefresh if provided, otherwise call local loadTickets
      if (onRefresh) {
        onRefresh()
      } else {
        await loadTickets()
      }
    } catch (error) {
      console.error("[v0] Error escalating ticket:", error)
      alert("An error occurred while escalating the ticket")
    } finally {
      setIsEscalating(false)
    }
  }

  const isItHeadOrAdmin = user?.role === "it_head" || user?.role === "admin" || user?.role === "regional_it_head" || user?.role?.startsWith("service_desk_")

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setPriorityFilter("all")
    setLocationFilter("all")
  }

  const displayTickets = propTickets || tickets

  // Filter out any invalid/empty ticket objects and ensure uuid is set
  const validTickets = displayTickets.filter((ticket) => {
    if (!ticket || !ticket.id || typeof ticket !== 'object' || Object.keys(ticket).length === 0) {
      console.warn("[v0] Invalid ticket found:", ticket)
      return false
    }
    return true
  }).map((ticket) => ({
    ...ticket,
    uuid: ticket.uuid || ticket.dbId || ticket.id, // Ensure uuid is always set
  }))

  const filteredTickets = validTickets.filter((ticket) => {
    const matchesSearch =
      ticket.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.requester?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.id?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter
    const matchesLocation = locationFilter === "all" || getCanonicalLocationName(ticket.location) === locationFilter

    return matchesSearch && matchesStatus && matchesPriority && matchesLocation
  })

  const sortedTickets = useMemo(
    () => sortItems(filteredTickets, sortField, sortDirection),
    [filteredTickets, sortField, sortDirection],
  )

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedTickets.length / pageSize))
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedTickets = sortedTickets.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, priorityFilter, locationFilter, sortField, sortDirection, pageSize])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading tickets...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {escalationSuccess && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Ticket successfully escalated to repair team. A repair request has been created and the IT repair team has
            been notified.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filter Tickets</CardTitle>
          <CardDescription>Search and filter IT support tickets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Resolved">Resolved</SelectItem>
                <SelectItem value="Escalated">Escalated</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {dbLocations.map((loc) => (
                  <SelectItem key={loc.code} value={loc.code}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <SortControls
              sortField={sortField}
              sortDirection={sortDirection}
              onSortFieldChange={setSortField}
              onSortDirectionChange={setSortDirection}
              options={[
                { value: "created", label: "Created Date" },
                { value: "title", label: "Title" },
                { value: "priority", label: "Priority" },
                { value: "status", label: "Status" },
                { value: "location", label: "Location" },
                { value: "requester", label: "Requester" },
              ]}
            />

            <Button variant="outline" className="w-full bg-transparent" onClick={clearFilters}>
              <Filter className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results summary and pagination info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          Showing {sortedTickets.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, sortedTickets.length)} of {sortedTickets.length} tickets
        </p>
        {totalPages > 1 && (
          <p>Page {currentPage} of {totalPages}</p>
        )}
      </div>

      <div className="space-y-4">
        {paginatedTickets.map((ticket) => {
          const IconComponent = categoryIcons[ticket.category as keyof typeof categoryIcons] || HelpCircle
          return (
            <Card key={ticket.id} className={cn("hover:shadow-md transition-all duration-200", getPriorityCardClass(ticket.priority))}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="p-2 bg-green-100 dark:bg-green-950/30 rounded-lg">
                      <IconComponent className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-semibold text-lg">{ticket.title}</h3>
                        <Badge variant="outline" className="text-xs">
                          {ticket.id}
                        </Badge>
                      </div>

                      <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{ticket.description}</p>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <User className="h-3 w-3" />
                          <span>{ticket.requester}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-3 w-3" />
                          <span>{ticket.location}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>Created {ticket.created}</span>
                        </div>
                        {ticket.assignee !== "Unassigned" && (
                          <div className="flex items-center space-x-1">
                            <Settings className="h-3 w-3" />
                            <span>Assigned to {ticket.assignee}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-2 ml-4">
                    <div className="flex items-center space-x-2">
                      <Badge variant={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
                      <Badge variant={getStatusColor(ticket.status)}>{ticket.status}</Badge>
                    </div>

                    <div className="flex items-center space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => handleViewTicket(ticket)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEditTicket(ticket)}>
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTicket(ticket)
                          setCommentDialogOpen(true)
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Comment
                      </Button>
                      {isItHeadOrAdmin && ticket.status !== "Resolved" && ticket.status !== "Escalated" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedTicket(ticket)
                              setAssignDialogOpen(true)
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Assign
                          </Button>
                          {user?.role === "regional_it_head" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSelfAssign(ticket)}
                              disabled={selfAssigningTicketId === (ticket.uuid || ticket.id)}
                              className="text-green-600 hover:text-green-800 hover:bg-green-50"
                            >
                              {selfAssigningTicketId === (ticket.uuid || ticket.id) ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <UserCheck className="h-4 w-4 mr-1" />
                              )}
                              Self-Assign
                            </Button>
                          )}
                        </>
                      )}
                      {ticket.status !== "Resolved" && ticket.status !== "Escalated" && (
                        <Button variant="ghost" size="sm" onClick={() => handleStatusChange(ticket.id, "Resolved")}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Resolve
                        </Button>
                      )}
                      {/* Only Admin can delete ANY ticket, regardless of assignment status */}
                      {user?.role === "admin" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            console.log("[v0] Setting delete ticket - id:", ticket.id, "uuid:", ticket.uuid)
                            if (!ticket.uuid) {
                              console.error("[v0] Ticket has no uuid property!", ticket)
                              alert("Error: Ticket has no UUID. Cannot delete.")
                              return
                            }
                            deleteTicketIdRef.current = ticket.uuid // Set ref
                            setDeleteTicketId(ticket.uuid)
                            setDeleteConfirmOpen(true)
                          }}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      )}

                      {ticket.status !== "Resolved" && ticket.status !== "Escalated" && user?.role === "it_staff" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTicket(ticket)
                            setEscalationDialogOpen(true)
                          }}
                          className="text-orange-600 hover:text-orange-800 hover:bg-orange-50"
                        >
                          <ArrowUp className="h-4 w-4 mr-1" />
                          Escalate
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {filteredTickets.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No tickets found</h3>
            <p className="text-muted-foreground">Try adjusting your search criteria or create a new ticket</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ticket Details - {selectedTicket?.id}</DialogTitle>
            <DialogDescription>{selectedTicket?.title}</DialogDescription>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Status:</strong> {selectedTicket.status}
                </div>
                <div>
                  <strong>Priority:</strong> {selectedTicket.priority}
                </div>
                <div>
                  <strong>Category:</strong> {selectedTicket.category}
                </div>
                <div>
                  <strong>Location:</strong> {selectedTicket.location}
                </div>
                <div>
                  <strong>Requester:</strong> {selectedTicket.requester}
                </div>
                <div>
                  <strong>Assignee:</strong> {selectedTicket.assignee}
                </div>
              </div>
              <div>
                <strong>Description:</strong>
                <p className="mt-1 text-muted-foreground">{selectedTicket.description}</p>
              </div>
              <div>
                <strong>Comments ({selectedTicket.comments.length}):</strong>
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                  {selectedTicket.comments.map((comment) => (
                    <div key={comment.id} className="p-2 bg-muted rounded">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{comment.author}</span>
                        <span>{comment.timestamp}</span>
                      </div>
                      <p className="text-sm">{comment.message}</p>
                    </div>
                  ))}
                </div>
              </div>
              {selectedTicket.status !== "Resolved" && selectedTicket.status !== "Escalated" && (
                <div className="flex justify-between pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedTicket(selectedTicket)
                      setEscalationDialogOpen(true)
                    }}
                    className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/40"
                  >
                    <ArrowUp className="h-4 w-4 mr-2" />
                    Escalate to Repair Team
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Ticket - {editingTicket?.id}</DialogTitle>
            <DialogDescription>Update ticket information</DialogDescription>
          </DialogHeader>
          {editingTicket && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editingTicket.title}
                  onChange={(e) => setEditingTicket({ ...editingTicket, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editingTicket.status}
                    onValueChange={(value) => setEditingTicket({ ...editingTicket, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={editingTicket.priority}
                    onValueChange={(value) => setEditingTicket({ ...editingTicket, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Assignee</Label>
                <Input
                  value={editingTicket.assignee}
                  onChange={(e) => setEditingTicket({ ...editingTicket, assignee: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingTicket.description}
                  onChange={(e) => setEditingTicket({ ...editingTicket, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateTicket}
                  className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
                >
                  Update Ticket
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Comment</DialogTitle>
            <DialogDescription>Add a comment to ticket {selectedTicket?.id}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter your comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setCommentDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddComment}
                className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
              >
                Add Comment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={escalationDialogOpen} onOpenChange={setEscalationDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-green-600 dark:text-green-400" />
              Escalate to Repair Team
            </DialogTitle>
            <DialogDescription>
              This will create a repair request and transfer the issue to the IT repair team for hardware intervention.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
              <AlertTriangle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <strong>Ticket:</strong> {selectedTicket?.id} - {selectedTicket?.title}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="escalation-reason">Escalation Reason</Label>
              <Textarea
                id="escalation-reason"
                placeholder="Explain why this ticket needs to be escalated to the repair team (e.g., hardware replacement required, device needs physical repair, etc.)"
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
                rows={4}
                required
              />
            </div>

            <div className="bg-muted p-3 rounded-lg text-sm">
              <p className="font-medium mb-1">What happens next:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>A repair request will be created automatically</li>
                <li>The IT repair team will be notified</li>
                <li>This ticket status will change to "Escalated"</li>
                <li>The repair team will handle hardware intervention</li>
              </ul>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEscalationDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleEscalateToRepair}
                disabled={!escalationReason.trim()}
                className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
              >
                <Wrench className="h-4 w-4 mr-2" />
                Escalate to Repair Team
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Ticket Dialog */}
      {selectedTicket && (
        <AssignTicketDialog
          ticketId={selectedTicket.id}
          ticketTitle={selectedTicket.title}
          ticketLocation={selectedTicket.location}
          isOpen={assignDialogOpen}
          onClose={() => setAssignDialogOpen(false)}
          onAssign={handleAssignTicket}
        />
      )}

      {/* Escalation Dialog */}
      <Dialog open={escalationDialogOpen} onOpenChange={setEscalationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUp className="h-5 w-5 text-orange-600" />
              Escalate Ticket
            </DialogTitle>
            <DialogDescription>
              Escalate this ticket to your supervisor for further action
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTicket && (
              <>
                <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                    Ticket: {selectedTicket.title}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    Category: {selectedTicket.category}
                  </p>
                </div>

                <div>
                  <Label htmlFor="escalationReason">Reason for Escalation</Label>
                  <Textarea
                    id="escalationReason"
                    placeholder="Explain why this ticket needs to be escalated..."
                    value={escalationReason}
                    onChange={(e) => setEscalationReason(e.target.value)}
                    rows={4}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="itRequestForm">IT Request Form (Optional)</Label>
                  <Input
                    id="itRequestForm"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => setItRequestFormFile(e.target.files?.[0] || null)}
                  />
                  {itRequestFormFile && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Selected: {itRequestFormFile.name}
                    </p>
                  )}
                </div>

                <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
                  <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <AlertDescription className="text-orange-800 dark:text-orange-200 text-sm">
                    This will escalate the ticket to {user?.location === "head_office" ? "IT Head at Head Office" : "Regional IT Head"} for further action.
                  </AlertDescription>
                </Alert>
              </>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEscalationDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleEscalateTicket}
                disabled={isEscalating || !escalationReason.trim()}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {isEscalating ? "Escalating..." : "Escalate Ticket"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Delete Ticket
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this ticket? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Alert className={user?.role === "admin" || user?.role === "it_head" ? "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30" : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"}>
            <AlertTriangle className={user?.role === "admin" || user?.role === "it_head" ? "h-4 w-4 text-orange-600 dark:text-orange-400" : "h-4 w-4 text-red-600 dark:text-red-400"} />
            <AlertDescription className={user?.role === "admin" || user?.role === "it_head" ? "text-orange-800 dark:text-orange-200" : "text-red-800 dark:text-red-200"}>
              {user?.role === "admin" || user?.role === "it_head" 
                ? "Admin/IT Head: You can delete any ticket regardless of status."
                : "Only unassigned tickets can be deleted by their creators. Contact your IT Head or Admin for help."}
            </AlertDescription>
          </Alert>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => {
              setDeleteConfirmOpen(false)
              deleteTicketIdRef.current = null
            }} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={async (e) => {
                e.preventDefault()
                e.stopPropagation()
                
                // Immediately close dialog and disable to prevent duplicate clicks
                const ticketIdToDelete = deleteTicketId || deleteTicketIdRef.current
                if (!ticketIdToDelete) {
                  console.error("[v0] No deleteTicketId set - state:", deleteTicketId, "ref:", deleteTicketIdRef.current)
                  alert("Error: No ticket selected for deletion")
                  return
                }
                
                // Clear refs immediately to prevent duplicate calls
                const idToDelete = ticketIdToDelete
                deleteTicketIdRef.current = null
                setDeleteTicketId(null)
                
                console.log("[v0] Delete button clicked, ticketId:", idToDelete)
                await handleDeleteTicket(idToDelete)
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? "Deleting..." : "Delete Ticket"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
