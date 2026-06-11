"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, Clock, AlertTriangle, Ticket, MapPin, Monitor, Wifi, Smartphone, Printer, UserPlus, Eye, CheckCircle, User, Calendar, FileText, Trash2, UserCheck, Loader2, Repeat2, Pause, Droplets, Users } from "lucide-react"
import { MyDeviceTonerPanel } from "@/components/devices/my-device-toner-panel"
import { NewTicketForm } from "./new-ticket-form"
import { KnowledgeBase } from "./knowledge-base"
import { AssignTicketDialog } from "./assign-ticket-dialog"
import { ReassignTicketDialog } from "./reassign-ticket-dialog"
import { HoldTicketDialog } from "./hold-ticket-dialog"
import { CompletionConfirmationModal } from "./completion-confirmation-modal"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { getCanonicalLocationName, isLocationInSameRegion } from "@/lib/location-filter"
import { Separator } from "@/components/ui/separator"
import { TicketList } from "./ticket-list"

export function ServiceDeskDashboard() {
  const [activeTab, setActiveTab] = useState("overview")
  const [showNewTicketForm, setShowNewTicketForm] = useState(false)
  const [selectedTicketForAssign, setSelectedTicketForAssign] = useState<any>(null)
  const [selectedTicketForDetails, setSelectedTicketForDetails] = useState<any>(null)
  const [ticketDetails, setTicketDetails] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [ticketToDelete, setTicketToDelete] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { canViewAllLocations, getUserLocation, user } = useAuth()
  const userLocation = (getUserLocation() || user?.location || '').toLowerCase()
  const isHeadOfficeUser = userLocation === 'head_office' || userLocation === 'head office'
  const { toast } = useToast()
  const [allTickets, setAllTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selfAssigningTicketId, setSelfAssigningTicketId] = useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [ticketsPerPage] = useState(10)
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false)
  const [selectedTicketForReassign, setSelectedTicketForReassign] = useState<any>(null)
  const [holdDialogOpen, setHoldDialogOpen] = useState(false)
  const [selectedTicketForHold, setSelectedTicketForHold] = useState<any>(null)
  const [isResumingHold, setIsResumingHold] = useState(false)
  const [completionModalOpen, setCompletionModalOpen] = useState(false)
  const [selectedTicketForCompletion, setSelectedTicketForCompletion] = useState<any>(null)
  const [isStaffSubmitting, setIsStaffSubmitting] = useState(false)
  const [itStaffList, setItStaffList] = useState<any[]>([])
  const canSeeAllLocations = canViewAllLocations()

  // Check if user can assign tickets (IT Head, Regional IT Head, Admin)
  const canAssignTickets = () => {
    return (
      user?.role === "admin" ||
      user?.role === "it_head" ||
      user?.role === "regional_it_head" ||
      user?.role === "service_desk_head"
    )
  }

  const handleConfirmAll = async () => {
    if (!user) {
      toast({ 
        title: "Error", 
        description: "User information not available", 
        variant: "destructive" 
      })
      return
    }

    // Check permission
    const allowedRoles = ["admin", "it_head", "regional_it_head", "service_desk_head"]
    if (!allowedRoles.includes(user.role)) {
      toast({ 
        title: "Access Denied", 
        description: "You don't have permission to confirm tickets on behalf of staff", 
        variant: "destructive" 
      })
      return
    }

    if (!confirm("Are you sure you want to confirm all pending tickets?")) {
      return
    }

    try {
      console.log("[v0] handleConfirmAll - sending request with user:", user.id, user.role)
      
      const res = await fetch("/api/service-tickets/confirm-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          userName: user.full_name || user.name || user.username || "Admin",
          userRole: user.role,
        }),
      })

      console.log("[v0] handleConfirmAll - response status:", res.status)

      const result = await res.json()
      console.log("[v0] handleConfirmAll - response body:", result)

      if (res.ok && result.success) {
        const count = result.count || result.confirmedCount || 0
        toast({ 
          title: "Success", 
          description: `${count} ticket(s) confirmed successfully on behalf of staff`,
          variant: "default"
        })
        loadTickets()
      } else {
        const errorMsg = result.error || "Failed to confirm tickets"
        console.error("[v0] handleConfirmAll error:", errorMsg)
        toast({ 
          title: "Confirmation Failed", 
          description: errorMsg,
          variant: "destructive" 
        })
      }
    } catch (err) {
      console.error("[v0] handleConfirmAll exception:", err)
      const errorMsg = err instanceof Error ? err.message : "Network error"
      toast({ 
        title: "Error", 
        description: `Failed to confirm tickets: ${errorMsg}`,
        variant: "destructive" 
      })
    }
  }

  const loadTickets = useCallback(async () => {
    if (!user?.id) return
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      setLoading(true)
      const location = getUserLocation() || ""

      console.log("[v0] Loading tickets via API for user:", user?.role, "location:", location, "canSeeAll:", canSeeAllLocations)

      const params = new URLSearchParams({
        location: location,
        canSeeAll: String(canSeeAllLocations),
        userRole: user?.role || "",
        userId: user?.id || "",
        userName: user?.full_name || user?.name || "",
        userEmail: user?.email || "",
      })

      const response = await fetch(`/api/service-tickets?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      })
      const result = await response.json()

      if (!response.ok) {
        console.error("[v0] Error loading tickets:", result.error)
        toast({
          title: "Could not load tickets",
          description: result.error || "Please try again.",
          variant: "destructive",
        })
        setAllTickets([])
        return
      }

      console.log("[v0] Loaded tickets from API:", result.tickets?.length || 0, "tickets")

      const mappedTickets = (result.tickets || []).map((ticket: any) => ({
        id: ticket.ticket_number || ticket.id,
        uuid: ticket.id, // Store actual UUID for API operations (delete, etc.)
        dbId: ticket.id, // Keep database ID for updates
        title: ticket.title,
        category: ticket.category || "Other",
        priority: ticket.priority || "Medium",
        status: ticket.status || "Open",
          location: ticket.location || "head_office",
          locationName: getCanonicalLocationName(ticket.location) || "Unknown Location",
        requester: ticket.requested_by || "Unknown",
        requesterDepartment: ticket.requester_department || "",
        requesterRoom: ticket.requester_room_number || ticket.requester_room || "",
        created: new Date(ticket.created_at).toLocaleString(),
        assignedTo: ticket.assigned_to_name || null,
        assignedToId: ticket.assigned_to || null,
      }))

      setAllTickets(mappedTickets)
    } catch (error) {
      console.error("[v0] Error loading tickets:", error)

      const message = error instanceof Error && error.name === "AbortError"
        ? "Ticket loading timed out. Please refresh."
        : "Network error while loading tickets."

      toast({
        title: "Service Desk Unavailable",
        description: message,
        variant: "destructive",
      })
      setAllTickets([])
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }, [user?.id, user?.role, user?.full_name, user?.name, user?.email, getUserLocation, canSeeAllLocations, toast])

  const loadITStaff = useCallback(async () => {
    if (!user?.id || !canAssignTickets()) {
      setItStaffList([])
      return
    }

    try {
      const response = await fetch("/api/staff-members?roles=it_staff,it_technician,service_desk_head,regional_it_head&onlyActive=true")
      
      if (!response.ok) {
        console.error("[v0] Error loading IT staff - API returned:", response.status)
        return
      }

      const result = await response.json()
      console.log("[v0] IT Staff loaded from API:", result.data?.length || 0)

      setItStaffList(result.data || [])
    } catch (error) {
      console.error("[v0] Error loading IT staff:", error)
    }
  }, [user?.id, user?.role])

  useEffect(() => {
    if (!user?.id) return
    loadTickets()
    loadITStaff()
  }, [user?.id, user?.role, user?.location, loadTickets, loadITStaff])

  // Handle ticket assignment
  const handleAssignTicket = async (assignment: any) => {
    try {
      console.log("[v0] Assignment completed, refreshing tickets")

      // Just reload tickets - the dialog already made the API call
      await loadTickets()
    } catch (error) {
      console.error("[v0] Error refreshing tickets:", error)
    } finally {
      setSelectedTicketForAssign(null)
    }
  }

  // Quick self-assign for regional IT heads
  const handleSelfAssign = async (ticket: any) => {
    if (!user?.id) return
    setSelfAssigningTicketId(ticket.uuid || ticket.dbId || ticket.id)
    try {
      const response = await fetch("/api/service-tickets/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.uuid || ticket.dbId || ticket.id,
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

      await loadTickets()
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

  // Load ticket details with updates history
  const loadTicketDetails = async (ticket: any) => {
    setSelectedTicketForDetails(ticket)
    setLoadingDetails(true)
    
    try {
      // Get ticket updates/history
      const { data: updates } = await supabase
        .from("service_ticket_updates")
        .select("*")
        .eq("ticket_id", ticket.dbId)
        .order("created_at", { ascending: false })

      // Get full ticket details
      const { data: fullTicket, error: ticketError } = await supabase
        .from("service_tickets")
        .select("*")
        .eq("id", ticket.dbId)
        .single()

      if (ticketError) {
        console.error("[v0] Error loading ticket details:", ticketError)
      }

      setTicketDetails({
        ...ticket,
        fullData: fullTicket,
        updates: updates || []
      })
    } catch (error) {
      console.error("[v0] Error loading ticket details:", error)
    } finally {
      setLoadingDetails(false)
    }
  }

  // Delete ticket handler
  const handleDeleteTicket = async () => {
    if (!ticketToDelete || isDeleting) return

    setIsDeleting(true)
    try {
      const response = await fetch(
        `/api/service-tickets?id=${ticketToDelete.uuid}&userRole=${user?.role}`,
        { method: "DELETE" }
      )

      if (!response.ok) {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to delete ticket",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: "Ticket deleted successfully",
      })

      // Refresh tickets
      await loadTickets()
      setDeleteConfirmOpen(false)
      setTicketToDelete(null)
    } catch (error) {
      console.error("[v0] Error deleting ticket:", error)
      toast({
        title: "Error",
        description: "Failed to delete ticket",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const isOpenStatus = (s: string | undefined) => {
    const ls = (s || "").toLowerCase()
    return ls === "open" || ls === "pending" || ls === "new"
  }
  const isInProgressStatus = (s: string | undefined) => {
    const ls = (s || "").toLowerCase()
    return ls === "in_progress" || ls === "in progress" || ls === "assigned" || ls === "on_hold" || ls === "on hold"
  }
  const isResolvedStatus = (s: string | undefined) => {
    const ls = (s || "").toLowerCase()
    return ls === "resolved" || ls === "closed" || ls === "completed"
  }

  const canCurrentUserConfirmTicket = (ticket: any) => {
    const requesterName = (ticket.requester || "").toLowerCase().trim()
    const currentName = (user?.full_name || user?.name || "").toLowerCase().trim()
    return Boolean(requesterName && currentName && requesterName === currentName)
  }

  const filteredTickets = useMemo(() => {
    let tickets = allTickets
    
    // Filter by location
    if (selectedLocation !== 'all' && canSeeAllLocations) {
      tickets = tickets.filter(t => t.location === selectedLocation)
    }

    // Filter by status based on active tab
    if (activeTab === 'closed') {
      tickets = tickets.filter(t => isResolvedStatus(t.status))
    } else if (activeTab === 'overview') {
      tickets = tickets.filter(t => !isResolvedStatus(t.status))
    }

    return tickets
  }, [allTickets, selectedLocation, activeTab, canSeeAllLocations])

  // Pagination
  const paginatedTickets = useMemo(() => {
    const startIndex = (currentPage - 1) * ticketsPerPage
    const endIndex = startIndex + ticketsPerPage
    return filteredTickets.slice(startIndex, endIndex)
  }, [filteredTickets, currentPage, ticketsPerPage])

  const totalPages = Math.ceil(filteredTickets.length / ticketsPerPage)

  const stats = useMemo(() => {
    let openTickets = 0
    let inProgress = 0
    let resolved = 0

    for (const t of filteredTickets) {
      if (isOpenStatus(t.status)) openTickets++
      else if (isInProgressStatus(t.status)) inProgress++
      else if (isResolvedStatus(t.status)) resolved++
    }

    return {
      totalTickets: filteredTickets.length,
      openTickets,
      inProgress,
      resolved,
      avgResolutionTime: "2.3 hours",
      satisfaction: "94%",
    }
  }, [filteredTickets])

  // Get closed/resolved tickets
  const closedTickets = filteredTickets.filter(t => isResolvedStatus(t.status))

  // Get available locations
  const availableLocations = useMemo(() => {
    return [...new Set(allTickets.map(t => t.location))].filter(Boolean)
  }, [allTickets])

  const categoryIcons = {
    Hardware: Monitor,
    Software: Smartphone,
    Network: Wifi,
    Printer: Printer,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading service desk...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">IT Service Desk</h1>
          <p className="text-muted-foreground">
            {user?.role === "user" || user?.role === "staff"
              ? "Request IT support and track your service tickets"
              : canViewAllLocations()
                ? "Manage IT support requests across all QCC office locations"
                : `Manage IT support requests for ${getUserLocation()}`}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {(user?.role === "admin" || user?.role === "it_head") && (
            <Button
              onClick={handleConfirmAll}
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-950/30"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Confirm All Pending
            </Button>
          )}
          <Button
            onClick={() => setShowNewTicketForm(true)}
            className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setActiveTab("overview")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTickets}</div>
            <p className="text-xs text-muted-foreground">
              {user?.role === "user" || user?.role === "staff"
                ? "Your requests"
                : canViewAllLocations()
                  ? "All locations"
                  : "This location"}
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setActiveTab("overview")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.openTickets}</div>
            <p className="text-xs text-muted-foreground">Awaiting response</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setActiveTab("overview")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">Being worked on</p>
          </CardContent>
        </Card>

        {/* Closed Tickets Card - Clickable */}
        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors border-green-200 dark:border-green-800"
          onClick={() => setActiveTab("closed")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Closed Tickets</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
            <p className="text-xs text-muted-foreground">Click to view details</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="closed">
            <CheckCircle className="h-4 w-4 mr-1" />
            Closed ({stats.resolved})
          </TabsTrigger>
          {user?.role === "regional_it_head" && (
            <TabsTrigger value="regional-staff" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Regional IT Staff
            </TabsTrigger>
          )}
          <TabsTrigger value="my-devices" className="flex items-center gap-1">
            <Droplets className="h-4 w-4" />
            My Devices & Toner
          </TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* All Tickets */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>All Tickets</CardTitle>
                  <CardDescription>
                    {user?.role === "user" || user?.role === "staff"
                      ? "All your IT support requests"
                      : canViewAllLocations()
                        ? "All IT support requests from all locations"
                        : "All IT support requests from your location"}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-sm">
                  {filteredTickets.length} {filteredTickets.length === 1 ? 'ticket' : 'tickets'}
                </Badge>
              </div>

              {/* Location Filter */}
              {canSeeAllLocations && availableLocations.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">Filter by Location:</span>
                    <Button
                      variant={selectedLocation === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setSelectedLocation('all')
                        setCurrentPage(1)
                      }}
                      className="text-xs"
                    >
                      All Locations
                    </Button>
                    {availableLocations.map(loc => (
                      <Button
                        key={loc}
                        variant={selectedLocation === loc ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setSelectedLocation(loc)
                          setCurrentPage(1)
                        }}
                        className="text-xs"
                      >
                        {getCanonicalLocationName(loc) || loc}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paginatedTickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Ticket className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No tickets found</p>
                  </div>
                ) : (
                  paginatedTickets.map((ticket) => {
                    const IconComponent = categoryIcons[ticket.category as keyof typeof categoryIcons] || Monitor
                    return (
                      <div key={ticket.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-green-100 dark:bg-green-950/30 rounded-lg">
                            <IconComponent className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <h4 className="font-medium text-sm">{ticket.title}</h4>
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{ticket.locationName}</span>
                            <span>•</span>
                            <span className="font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Requested by: {ticket.requester}
                              {(user?.role === "it_staff" || user?.role === "regional_it_head") && (ticket.requesterDepartment || ticket.requesterRoom) && (
                                <span className="ml-2 text-xs text-muted-foreground">{ticket.requesterDepartment ? `${ticket.requesterDepartment}` : ""}{ticket.requesterDepartment && ticket.requesterRoom ? ' • ' : ''}{ticket.requesterRoom ? `Room ${ticket.requesterRoom}` : ''}</span>
                              )}
                            </span>
                            <span>•</span>
                            <span>{ticket.created}</span>
                            {ticket.assignedTo && (
                              <>
                                <span>•</span>
                                <span className="text-green-600 dark:text-green-400 font-medium">
                                  Assigned to: {ticket.assignedTo}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={
                            ticket.priority === "High" || ticket.priority === "high"
                              ? "destructive"
                              : ticket.priority === "Medium" || ticket.priority === "medium"
                                ? "default"
                                : "secondary"
                          }
                          className="text-xs"
                        >
                          {ticket.priority}
                        </Badge>
                        <Badge
                          variant={ticket.status === "Open" || ticket.status === "open" ? "outline" : "secondary"}
                          className="text-xs"
                        >
                          {ticket.status}
                        </Badge>
                        {/* View Details button */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950 bg-transparent"
                          onClick={() => loadTicketDetails(ticket)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Details
                        </Button>
                        {/* Assign button for IT Heads */}
                        {canAssignTickets() && (ticket.status === "Open" || ticket.status === "open") && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950 bg-transparent"
                              onClick={() => setSelectedTicketForAssign(ticket)}
                            >
                              <UserPlus className="h-3 w-3 mr-1" />
                              Assign
                            </Button>
                            {user?.role === "regional_it_head" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950 bg-transparent"
                                onClick={() => handleSelfAssign(ticket)}
                                disabled={selfAssigningTicketId === (ticket.uuid || ticket.dbId || ticket.id)}
                              >
                                {selfAssigningTicketId === (ticket.uuid || ticket.dbId || ticket.id) ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <UserCheck className="h-3 w-3 mr-1" />
                                )}
                                Self-Assign
                              </Button>
                            )}
                          </>
                        )}
                        {/* Delete button for Admins */}
                        {user?.role === "admin" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950 bg-transparent"
                            onClick={() => {
                              setTicketToDelete(ticket)
                              setDeleteConfirmOpen(true)
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        )}
                        {/* Reassign button for Service Desk Head, Regional IT Head, and Admin */}
                        {(user?.role === "service_desk_head" || user?.role === "regional_it_head" || user?.role === "admin") && ticket.assignedToId && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950 bg-transparent"
                            onClick={() => {
                              setSelectedTicketForReassign(ticket)
                              setReassignDialogOpen(true)
                            }}
                          >
                            <Repeat2 className="h-3 w-3 mr-1" />
                            Reassign
                          </Button>
                        )}
                        {/* Hold button for Service Desk Head, Regional IT Head, and Admin */}
                        {(user?.role === "service_desk_head" || user?.role === "regional_it_head" || user?.role === "admin") && (
                          <>
                            {ticket.status !== "On Hold" && ticket.status !== "on_hold" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950 bg-transparent"
                                onClick={() => {
                                  setSelectedTicketForHold(ticket)
                                  setIsResumingHold(false)
                                  setHoldDialogOpen(true)
                                }}
                              >
                                <Pause className="h-3 w-3 mr-1" />
                                Hold
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950 bg-transparent"
                                onClick={() => {
                                  setSelectedTicketForHold(ticket)
                                  setIsResumingHold(true)
                                  setHoldDialogOpen(true)
                                }}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Resume
                              </Button>
                            )}
                          </>
                        )}
                        {/* Completion button for IT Staff */}
                        {(ticket.assignedToId === user?.id ||
                          ( (user?.role === "regional_it_head" || user?.role === "service_desk_head" || user?.role === "it_head") && isLocationInSameRegion(ticket.location, user?.location) )
                        ) && (ticket.status === "In Progress" || ticket.status === "in_progress") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950 bg-transparent"
                            onClick={() => {
                              setSelectedTicketForCompletion(ticket)
                              setIsStaffSubmitting(true)
                              setCompletionModalOpen(true)
                            }}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Complete
                          </Button>
                        )}
                        {/* Confirmation button for Requesters */}
                        {(ticket.status === "Awaiting Confirmation" || ticket.status === "awaiting_confirmation") && canCurrentUserConfirmTicket(ticket) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950 bg-transparent"
                            onClick={() => {
                              setSelectedTicketForCompletion(ticket)
                              setIsStaffSubmitting(false)
                              setCompletionModalOpen(true)
                            }}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Confirm
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    )
                  })
                )}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * ticketsPerPage) + 1} to {Math.min(currentPage * ticketsPerPage, filteredTickets.length)} of {filteredTickets.length} tickets
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <Button
                          key={i + 1}
                          variant={currentPage === i + 1 ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(i + 1)}
                          className="w-8 h-8 p-0"
                        >
                          {i + 1}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Closed Tickets Tab - Detailed View */}
        <TabsContent value="closed" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Closed & Resolved Tickets
                  </CardTitle>
                  <CardDescription>
                    Complete list of all resolved and closed tickets with full details
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  {closedTickets.length} tickets
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {closedTickets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No closed tickets yet</p>
                  <p className="text-sm">Resolved tickets will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {closedTickets.map((ticket) => {
                    const IconComponent = categoryIcons[ticket.category as keyof typeof categoryIcons] || Monitor
                    return (
                      <div key={ticket.id} className="border rounded-lg p-4 bg-green-50/50 dark:bg-green-950/20">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-green-100 dark:bg-green-950 rounded-lg mt-1">
                              <IconComponent className="h-4 w-4 text-green-600" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{ticket.title}</h4>
                                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                  {ticket.status}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{ticket.id}</span>
                                <span>•</span>
                                <span>{ticket.category}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {ticket.locationName}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-sm mt-2">
                                <div>
                                  <span className="text-muted-foreground">Requested by: </span>
                                  <span className="font-medium">{ticket.requester}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Created: </span>
                                  <span>{ticket.created}</span>
                                </div>
                                {ticket.assignedTo && (
                                  <div>
                                    <span className="text-muted-foreground">Resolved by: </span>
                                    <span className="font-medium text-green-600">{ticket.assignedTo}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={ticket.priority === "High" || ticket.priority === "high" ? "destructive" : "outline"}>
                              {ticket.priority}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => loadTicketDetails(ticket)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View Details
                            </Button>
                            {/* Delete button for Admins */}
                            {user?.role === "admin" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950 bg-transparent"
                                onClick={() => {
                                  setTicketToDelete(ticket)
                                  setDeleteConfirmOpen(true)
                                }}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Regional IT Staff Monitoring — only for regional_it_head */}
        {user?.role === "regional_it_head" && (
          <TabsContent value="regional-staff" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      Regional IT Staff
                    </CardTitle>
                    <CardDescription>
                      Monitor your regional IT staff and their current ticket workload
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {itStaffList.filter(s => isLocationInSameRegion(s.location, user?.location)).length} staff members
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const regionalStaff = itStaffList.filter(s => isLocationInSameRegion(s.location || "", user?.location || ""))
                  if (regionalStaff.length === 0) {
                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">No IT staff found in your region</p>
                        <p className="text-sm">Staff members assigned to your region will appear here</p>
                      </div>
                    )
                  }
                  return (
                    <div className="space-y-4">
                      {regionalStaff.map((staff: any) => {
                        const staffId = (staff.id || "").toLowerCase()
                        const staffName = (staff.full_name || staff.name || "").toLowerCase()
                        const assignedTickets = allTickets.filter(t =>
                          (t.assignedToId && t.assignedToId.toLowerCase() === staffId) ||
                          (t.assignedTo && t.assignedTo.toLowerCase() === staffName)
                        )
                        const openCount = assignedTickets.filter(t => isOpenStatus(t.status)).length
                        const inProgressCount = assignedTickets.filter(t => isInProgressStatus(t.status)).length
                        const resolvedCount = assignedTickets.filter(t => isResolvedStatus(t.status)).length

                        return (
                          <div key={staff.id} className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                                <User className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                              </div>
                              <div>
                                <p className="font-medium">{staff.full_name || staff.name || staff.username}</p>
                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-0.5">
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {staff.location || "—"}
                                  </span>
                                  {staff.email && (
                                    <span>{staff.email}</span>
                                  )}
                                  {staff.phone && (
                                    <span>{staff.phone}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="text-center min-w-[56px]">
                                <p className="text-lg font-bold text-amber-600">{openCount}</p>
                                <p className="text-xs text-muted-foreground">Open</p>
                              </div>
                              <div className="text-center min-w-[56px]">
                                <p className="text-lg font-bold text-blue-600">{inProgressCount}</p>
                                <p className="text-xs text-muted-foreground">In Progress</p>
                              </div>
                              <div className="text-center min-w-[56px]">
                                <p className="text-lg font-bold text-green-600">{resolvedCount}</p>
                                <p className="text-xs text-muted-foreground">Resolved</p>
                              </div>
                              <div className="text-center min-w-[56px] border-l pl-3">
                                <p className="text-lg font-bold">{assignedTickets.length}</p>
                                <p className="text-xs text-muted-foreground">Total</p>
                              </div>
                              <Badge
                                variant={inProgressCount > 0 ? "default" : openCount > 0 ? "outline" : "secondary"}
                                className="ml-2"
                              >
                                {inProgressCount > 0 ? "Active" : openCount > 0 ? "Pending" : "Free"}
                              </Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>

            {/* Unassigned Tickets in Region */}
            {(() => {
              const unassigned = allTickets.filter(t => !t.assignedToId && (isOpenStatus(t.status)))
              if (unassigned.length === 0) return null
              return (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-5 w-5" />
                      Unassigned Tickets ({unassigned.length})
                    </CardTitle>
                    <CardDescription>
                      Open tickets in your region that have not yet been assigned to a staff member
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {unassigned.map(ticket => {
                        const IconComponent = categoryIcons[ticket.category as keyof typeof categoryIcons] || Monitor
                        return (
                          <div key={ticket.id} className="flex items-center justify-between p-3 border rounded-lg border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                                <IconComponent className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{ticket.title}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                  <MapPin className="h-3 w-3" />
                                  <span>{ticket.locationName}</span>
                                  <span>•</span>
                                  <span>By: {ticket.requester}</span>
                                  <span>•</span>
                                  <span>{ticket.created}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={ticket.priority === "High" || ticket.priority === "high" ? "destructive" : "outline"} className="text-xs">
                                {ticket.priority}
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950 bg-transparent"
                                onClick={() => setSelectedTicketForAssign(ticket)}
                              >
                                <UserPlus className="h-3 w-3 mr-1" />
                                Assign
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950 bg-transparent"
                                onClick={() => handleSelfAssign(ticket)}
                                disabled={selfAssigningTicketId === (ticket.uuid || ticket.dbId || ticket.id)}
                              >
                                {selfAssigningTicketId === (ticket.uuid || ticket.dbId || ticket.id) ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <UserCheck className="h-3 w-3 mr-1" />
                                )}
                                Self-Assign
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )
            })()}
          </TabsContent>
        )}

        <TabsContent value="my-devices" className="space-y-4">
          <MyDeviceTonerPanel />
        </TabsContent>

        <TabsContent value="knowledge">
          <KnowledgeBase />
        </TabsContent>
      </Tabs>

      {/* New Ticket Form Modal */}
      {showNewTicketForm && <NewTicketForm onClose={() => setShowNewTicketForm(false)} onTicketCreated={loadTickets} />}

      {/* Assign Ticket Dialog */}
      {selectedTicketForAssign && (
        <AssignTicketDialog
          ticketId={selectedTicketForAssign.id}
          ticketTitle={selectedTicketForAssign.title}
          ticketLocation={selectedTicketForAssign.location}
          isOpen={!!selectedTicketForAssign}
          onClose={() => setSelectedTicketForAssign(null)}
          onAssign={handleAssignTicket}
        />
      )}

      {/* Ticket Details Dialog */}
      <Dialog open={!!selectedTicketForDetails} onOpenChange={(open) => !open && setSelectedTicketForDetails(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              Ticket Details
            </DialogTitle>
            <DialogDescription>
              Complete information about this service request
            </DialogDescription>
          </DialogHeader>
          
          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Loading ticket details...</p>
            </div>
          ) : ticketDetails ? (
            <div className="space-y-6">
              {/* Ticket Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ticket ID</p>
                  <p className="font-mono text-sm">{ticketDetails.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge variant={ticketDetails.status === "Open" || ticketDetails.status === "open" ? "outline" : "secondary"}>
                    {ticketDetails.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Priority</p>
                  <Badge variant={
                    ticketDetails.priority === "High" || ticketDetails.priority === "high" ? "destructive" :
                    ticketDetails.priority === "Medium" || ticketDetails.priority === "medium" ? "default" : "secondary"
                  }>
                    {ticketDetails.priority}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Category</p>
                  <p>{ticketDetails.category || "General"}</p>
                </div>
              </div>

              <Separator />

              {/* Title & Description */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Title</p>
                <p className="font-medium">{ticketDetails.title}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{ticketDetails.fullData?.description || "No description provided"}</p>
              </div>

              <Separator />

              {/* Requester Info */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium flex items-center gap-2 mb-3">
                  <User className="h-4 w-4" />
                  Requester Information
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Requested By</p>
                    <p>{ticketDetails.requester}</p>
                    <div className="text-xs text-muted-foreground mt-1">
                      {ticketDetails.fullData?.requester_department && (
                        <div>Department: {ticketDetails.fullData.requester_department}</div>
                      )}
                      {ticketDetails.fullData?.requester_room_number && (
                        <div>Room: {ticketDetails.fullData.requester_room_number}</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Location</p>
                    <p>{ticketDetails.locationName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Created</p>
                    <p>{ticketDetails.created}</p>
                  </div>
                </div>
              </div>

              {/* Assignment Info */}
              {ticketDetails.assignedTo && (
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4">
                  <h4 className="font-medium flex items-center gap-2 mb-3">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    Assignment Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Assigned To</p>
                      <p className="text-blue-700 dark:text-blue-300 font-medium">{ticketDetails.assignedTo}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Current Status</p>
                      <Badge variant="secondary">{ticketDetails.status}</Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Work History */}
              {ticketDetails.updates && ticketDetails.updates.length > 0 && (
                <div>
                  <h4 className="font-medium flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4" />
                    Work History
                  </h4>
                  <div className="space-y-3">
                    {ticketDetails.updates.map((update: any, index: number) => (
                      <div key={index} className="border-l-2 border-green-200 pl-4 py-2">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{update.status || update.action}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(update.created_at).toLocaleString()}
                          </p>
                        </div>
                        {update.notes && <p className="text-sm text-muted-foreground mt-1">{update.notes}</p>}
                        <p className="text-xs text-muted-foreground">By: {update.updated_by || "System"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setSelectedTicketForDetails(null)}>
                  Close
                </Button>
                {canAssignTickets() && (ticketDetails.status === "Open" || ticketDetails.status === "open") && (
                  <>
                    {(user?.role === "regional_it_head" || (user?.role === "it_staff" && !isHeadOfficeUser)) && (
                      <Button
                        onClick={() => {
                          handleSelfAssign(ticketDetails)
                          setSelectedTicketForDetails(null)
                        }}
                        disabled={selfAssigningTicketId === (ticketDetails.uuid || ticketDetails.dbId || ticketDetails.id)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {selfAssigningTicketId === (ticketDetails.uuid || ticketDetails.dbId || ticketDetails.id) ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <UserCheck className="h-4 w-4 mr-2" />
                        )}
                        Assign to Me
                      </Button>
                    )}
                    <Button 
                      onClick={() => {
                        setSelectedTicketForDetails(null)
                        setSelectedTicketForAssign(ticketDetails)
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Assign to Staff
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No ticket selected</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Ticket</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this ticket? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {ticketToDelete && (
            <div className="space-y-3 py-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ticket ID</p>
                <p className="font-mono text-sm">{ticketToDelete.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Title</p>
                <p>{ticketToDelete.title}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge>{ticketToDelete.status}</Badge>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteConfirmOpen(false)
                setTicketToDelete(null)
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteTicket}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Ticket"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reassign Ticket Dialog */}
      <ReassignTicketDialog
        open={reassignDialogOpen}
        onOpenChange={setReassignDialogOpen}
        ticket={selectedTicketForReassign}
        itStaff={itStaffList}
        onReassignSuccess={loadTickets}
        currentUser={user}
      />

      {/* Hold Ticket Dialog */}
      <HoldTicketDialog
        open={holdDialogOpen}
        onOpenChange={setHoldDialogOpen}
        ticket={selectedTicketForHold}
        onHoldSuccess={loadTickets}
        currentUser={user}
        isResuming={isResumingHold}
      />

      {/* Completion Confirmation Modal */}
      <CompletionConfirmationModal
        open={completionModalOpen}
        onOpenChange={setCompletionModalOpen}
        ticket={selectedTicketForCompletion}
        onConfirmationSuccess={loadTickets}
        currentUser={user}
        isStaffSubmitting={isStaffSubmitting}
      />
    </div>
  )
}
