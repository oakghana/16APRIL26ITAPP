"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle2, Eye, AlertCircle, Loader2, ClipboardList, History, Pencil, ChevronLeft, ChevronRight, Lock } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { ApprovalTracker } from "./approval-tracker"

type FormType = "requisition" | "new-gadget" | "maintenance"

interface ITRequisition {
  id: string
  formType: FormType
  requisition_number?: string
  request_number?: string
  item_sn?: string
  supplier_name?: string
  items_required?: string
  complaints_from_users?: string
  purpose?: string
  other_comments?: string
  diagnosis_items?: string[]
  gadget_make?: string
  serial_number?: string
  year_of_purchase?: number
  hardware_supervisor_name?: string
  date_of_last_repairs?: string
  date_of_purchase?: string
  times_repaired?: number
  gadget_working_status?: string
  confirmed_by?: string
  confirmed_date?: string
  requested_by?: string
  staff_name?: string
  requester_location?: string | null
  requested_by_email?: string
  department?: string
  department_name?: string
  department_head?: string
  departmental_head_name?: string
  departmental_head_date?: string
  sectional_head_name?: string
  sectional_head_date?: string
  request_date: string
  status: string
  department_head_approved_by?: string
  department_head_approved_at?: string
  department_head_notes?: string
  service_desk_notes?: string
  service_desk_approved?: boolean
  service_desk_processed_by?: string
  service_desk_processed_at?: string
  it_head_approved?: boolean
  admin_approved?: boolean
  store_head_approved?: boolean
  approval_timeline?: Array<any>
  created_at: string
  updated_at: string
}

export function ITServiceDeskProcessingPanel() {
  const [requisitions, setRequisitions] = useState<ITRequisition[]>([])
  const [myWorkHistory, setMyWorkHistory] = useState<ITRequisition[]>([])
  const [filteredRequisitions, setFilteredRequisitions] = useState<ITRequisition[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedRequisition, setSelectedRequisition] = useState<ITRequisition | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [processingNotes, setProcessingNotes] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [processingAction, setProcessingAction] = useState<"process" | "hold">("process")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEditSubmitting, setIsEditSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [historySearch, setHistorySearch] = useState("")
  const [filterTab, setFilterTab] = useState<"pending" | "processed" | "all">("pending")
  const [mainTab, setMainTab] = useState<"queue" | "mywork">("queue")
  // Pagination for My Work tab
  const ITEMS_PER_PAGE = 10
  const [historyPage, setHistoryPage] = useState(1)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    fetchRequisitions()
    fetchMyWorkHistory()
  }, [user?.location, user?.full_name])

  useEffect(() => {
    filterRequisitions()
  }, [searchQuery, requisitions, filterTab])

  useEffect(() => {
    setHistoryPage(1)
  }, [historySearch])

  const fetchRequisitions = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ status: "all" })
      if (user?.location) {
        params.set("officeUseLocation", user.location)
      }
      if (user?.role) {
        params.set("officeUseRole", user.role)
      }
      const scopeQuery = params.toString()

      const [reqRes, gadgetRes, maintenanceRes] = await Promise.all([
        fetch(`/api/it-forms/requisitions?${scopeQuery}`),
        fetch(`/api/it-forms/new-gadget?${scopeQuery}`),
        fetch(`/api/it-forms/maintenance-repairs?${scopeQuery}`),
      ])

      const reqData = reqRes.ok ? await reqRes.json() : { requisitions: [] }
      const gadgetData = gadgetRes.ok ? await gadgetRes.json() : { requests: [] }
      const maintenanceData = maintenanceRes.ok ? await maintenanceRes.json() : { requests: [] }

      const combined: ITRequisition[] = [
        ...((reqData.requisitions || []).map((r: any) => ({ ...r, formType: "requisition" as const }))),
        ...((gadgetData.requests || []).map((r: any) => ({ ...r, formType: "new-gadget" as const }))),
        ...((maintenanceData.requests || []).map((r: any) => ({ ...r, formType: "maintenance" as const }))),
      ]

      const pendingStatusesByType: Record<FormType, string[]> = {
        requisition: ["pending_it_office_use", "pending_service_desk"],
        "new-gadget": ["pending_it_office_use", "hod_approved"],
        maintenance: ["pending_it_office_use", "hod_approved"],
      }

      const officeUseQueue = combined.filter((req) => {
        const statuses = pendingStatusesByType[req.formType]
        return statuses.includes(req.status)
      })

      setRequisitions(officeUseQueue)
    } catch (error) {
      console.error("[v0] Error fetching requisitions:", error)
      toast({
        title: "Error",
        description: "Failed to load requisitions",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchMyWorkHistory = async () => {
    if (!user?.full_name && !user?.email) return
    try {
      setHistoryLoading(true)
      const processedByName = user.full_name || user.email || ""
      const params = new URLSearchParams({ status: "all", processedBy: processedByName })

      const [reqRes, gadgetRes, maintRes] = await Promise.all([
        fetch(`/api/it-forms/requisitions?${params.toString()}`),
        fetch(`/api/it-forms/new-gadget?${params.toString()}`),
        fetch(`/api/it-forms/maintenance-repairs?${params.toString()}`),
      ])

      const reqData = reqRes.ok ? await reqRes.json() : { requisitions: [] }
      const gadgetData = gadgetRes.ok ? await gadgetRes.json() : { requests: [] }
      const maintData = maintRes.ok ? await maintRes.json() : { requests: [] }

      const combined: ITRequisition[] = [
        ...((reqData.requisitions || []).map((r: any) => ({ ...r, formType: "requisition" as const }))),
        ...((gadgetData.requests || []).map((r: any) => ({ ...r, formType: "new-gadget" as const }))),
        ...((maintData.requests || []).map((r: any) => ({ ...r, formType: "maintenance" as const }))),
      ]

      // Sort newest first
      combined.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      setMyWorkHistory(combined)
    } catch (error) {
      console.error("[v0] Error fetching work history:", error)
    } finally {
      setHistoryLoading(false)
    }
  }

  const filterRequisitions = () => {
    let filtered = requisitions

    const isPendingOfficeUse = (req: ITRequisition) => {
      if (req.formType === "requisition") {
        return req.status === "pending_it_office_use" || req.status === "pending_service_desk"
      }
      return req.status === "pending_it_office_use" || req.status === "hod_approved"
    }

    const isProcessed = (req: ITRequisition) => !isPendingOfficeUse(req)

    if (filterTab === "pending") {
      filtered = filtered.filter((req) => !isProcessed(req))
    } else if (filterTab === "processed") {
      filtered = filtered.filter((req) => isProcessed(req))
    }

    filtered = filtered.filter(
      (req) =>
        (req.requisition_number || req.request_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (req.requested_by || req.staff_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (req.items_required || req.complaints_from_users || "").toLowerCase().includes(searchQuery.toLowerCase())
    )

    setFilteredRequisitions(filtered)
  }

  const getRequesterLocation = (req: ITRequisition) => req.requester_location || "Unknown Location"
  const getRequester = (req: ITRequisition) => req.requested_by || req.staff_name || "Unknown"
  const getRequestNumber = (req: ITRequisition) => req.requisition_number || req.request_number || req.id
  const getDepartment = (req: ITRequisition) => req.department || req.department_name || "Unknown"
  const getFaultSummary = (req: ITRequisition) => req.complaints_from_users || req.items_required || req.purpose || "N/A"

  const getDeviceDetails = (req: ITRequisition) => {
    const details: string[] = []
    if (req.gadget_make) details.push(`Make: ${req.gadget_make}`)
    if (req.serial_number) details.push(`Serial: ${req.serial_number}`)
    if (req.year_of_purchase) details.push(`Year: ${req.year_of_purchase}`)
    if (req.item_sn) details.push(`Item SN: ${req.item_sn}`)
    if (req.supplier_name) details.push(`Supplier: ${req.supplier_name}`)
    return details
  }

  const getMaintenanceContext = (req: ITRequisition) => {
    const details: string[] = []
    if (req.diagnosis_items && req.diagnosis_items.length > 0) details.push(`Diagnosis: ${req.diagnosis_items.join(", ")}`)
    if (req.times_repaired !== undefined && req.times_repaired !== null) details.push(`Times repaired: ${req.times_repaired}`)
    if (req.date_of_last_repairs) details.push(`Last repair: ${req.date_of_last_repairs}`)
    if (req.gadget_working_status) details.push(`Current status: ${req.gadget_working_status}`)
    return details
  }

  const buildApprovalStages = (req: ITRequisition): any[] => {
    const hasLegacyHodApproval = Boolean(req.department_head_approved_by)
    const hasNonRequisitionHodApproval = Boolean(req.departmental_head_name || req.sectional_head_name)
      || req.status === "hod_approved"
      || ["pending_it_office_use", "pending_service_desk", "pending_it_head", "pending_admin", "pending_store", "pending_manager", "recommended", "not_recommended", "approved", "issued", "completed"].includes(req.status)

    const hodCompleted = req.formType === "requisition" ? hasLegacyHodApproval : hasNonRequisitionHodApproval

    return [
      {
        stage: "Department Head Review",
        role: "Department Head",
        status: hodCompleted ? "completed" : "pending",
        approver: req.department_head_approved_by || req.departmental_head_name || req.sectional_head_name,
        timestamp: req.department_head_approved_at || req.departmental_head_date || req.sectional_head_date,
        notes: req.department_head_notes,
      },
      {
        stage: "IT Office Use",
        role: "IT Staff",
        status: req.formType === "requisition"
          ? (req.status === "pending_it_office_use" || req.status === "pending_service_desk" ? "pending" : "completed")
          : req.status === "pending_it_office_use" || req.status === "hod_approved"
            ? "pending"
            : "completed",
        approver: req.service_desk_processed_by,
        timestamp: req.service_desk_processed_at,
        notes: req.service_desk_notes,
      },
      {
        stage: "IT Head Review",
        role: "IT Head",
        status: req.it_head_approved ? "completed" : "pending",
      },
      {
        stage: "Admin Approval",
        role: "Admin",
        status: req.admin_approved ? "completed" : "pending",
      },
      {
        stage: "Store Head Issuance",
        role: "IT Store Head",
        status: req.store_head_approved ? "completed" : "pending",
      },
    ]
  }

  const handleProcess = (req: ITRequisition) => {
    setSelectedRequisition(req)
    setProcessingAction("process")
    setProcessingNotes("")
    setIsProcessDialogOpen(true)
  }

  const submitProcessing = async () => {
    if (!selectedRequisition || !processingNotes.trim()) {
      toast({
        title: "Required",
        description: "Please add processing notes",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/it-forms/service-desk-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requisitionId: selectedRequisition.id,
          formType: selectedRequisition.formType,
          action: processingAction,
          processedBy: user?.full_name || user?.email || "Unknown",
          processedById: user?.id,
          processedByLocation: user?.location,
          notes: processingNotes,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to process request")
      }

      toast({
        title: "Success",
        description: "Requisition processed successfully",
      })

      fetchRequisitions()
      setIsProcessDialogOpen(false)
      setSelectedRequisition(null)
      setProcessingNotes("")
    } catch (error: any) {
      console.error("[v0] Error processing request:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to process request",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getPendingCount = () =>
    requisitions.filter((r) => {
      if (r.formType === "requisition") return r.status === "pending_it_office_use" || r.status === "pending_service_desk"
      return r.status === "pending_it_office_use" || r.status === "hod_approved"
    }).length
  const getProcessedCount = () => requisitions.filter((r) => !((r.formType === "requisition" ? (r.status === "pending_it_office_use" || r.status === "pending_service_desk") : (r.status === "pending_it_office_use" || r.status === "hod_approved")))).length

  // Can the current user still edit their notes on a completed form?
  const NEXT_STAGE_ACTED: Record<string, string[]> = {
    requisition: ["pending_admin", "pending_store", "approved", "issued", "completed", "rejected_it_head", "rejected_admin"],
    "new-gadget": ["recommended", "not_recommended", "gadget_issued", "rejected"],
    maintenance: ["manager_confirmed", "sent_for_repair", "repaired", "confirmed_working", "rejected"],
  }
  const canEditWork = (req: ITRequisition) => {
    const locked = NEXT_STAGE_ACTED[req.formType] || []
    return !locked.includes(req.status)
  }

  const handleEditWork = (req: ITRequisition) => {
    setSelectedRequisition(req)
    const currentNotes = req.formType === "requisition"
      ? (req.service_desk_notes || "")
      : (req.other_comments || "")
    setEditNotes(currentNotes)
    setIsEditDialogOpen(true)
  }

  const submitEdit = async () => {
    if (!selectedRequisition || !editNotes.trim()) return
    setIsEditSubmitting(true)
    try {
      const res = await fetch("/api/it-forms/office-use-edit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requisitionId: selectedRequisition.id,
          formType: selectedRequisition.formType,
          newNotes: editNotes,
          processedBy: user?.full_name || user?.email || "Unknown",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update notes")
      toast({ title: "Notes updated", description: "Your IT office-use notes have been saved." })
      setIsEditDialogOpen(false)
      fetchMyWorkHistory()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsEditSubmitting(false)
    }
  }

  // Paginated history
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return myWorkHistory
    const term = historySearch.toLowerCase()
    return myWorkHistory.filter((r) =>
      getRequestNumber(r).toLowerCase().includes(term) ||
      getRequester(r).toLowerCase().includes(term) ||
      getDepartment(r).toLowerCase().includes(term) ||
      getFaultSummary(r).toLowerCase().includes(term)
    )
  }, [myWorkHistory, historySearch])

  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistory.length / ITEMS_PER_PAGE))
  const pagedHistory = filteredHistory.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">IT Office Use - Request Processing</h1>
        <p className="text-muted-foreground mt-2">
          IT staff and regional IT heads complete office-use details for all HOD-approved IT forms before manager review
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pending Processing</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{getPendingCount()}</div></CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">My Completed</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-600 dark:text-green-400">{myWorkHistory.length}</div></CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total in Queue</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{requisitions.length}</div></CardContent>
        </Card>
      </div>

      {/* Main Tabs: Queue vs My Work History */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "queue" | "mywork")}>
        <TabsList className="mb-2">
          <TabsTrigger value="queue"><ClipboardList className="h-4 w-4 mr-2" />Processing Queue</TabsTrigger>
          <TabsTrigger value="mywork"><History className="h-4 w-4 mr-2" />My Completed Work ({myWorkHistory.length})</TabsTrigger>
        </TabsList>

        {/* ── QUEUE TAB ── */}
        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Requisition Processing Queue</CardTitle>
                  <CardDescription>Review and complete office-use processing for HOD-approved requisitions</CardDescription>
                </div>
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search by requisition number, requester, or items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-md"
              />
              <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as any)}>
                <TabsList>
                  <TabsTrigger value="pending">Pending ({getPendingCount()})</TabsTrigger>
                  <TabsTrigger value="processed">Processed ({getProcessedCount()})</TabsTrigger>
                  <TabsTrigger value="all">All ({requisitions.length})</TabsTrigger>
                </TabsList>
                <TabsContent value={filterTab} className="mt-4">
                  {loading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                  ) : filteredRequisitions.length === 0 ? (
                    <div className="text-center py-12">
                      <AlertCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground">No IT forms for office-use processing</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredRequisitions.map((req) => (
                        <div key={req.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-all hover:shadow-sm space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">{getRequestNumber(req)}</span>
                                <Badge variant="outline" className="text-xs">
                                  {req.formType === "maintenance" ? "Maintenance" : req.formType === "new-gadget" ? "New Gadget" : "Requisition"}
                                </Badge>
                                <Badge variant={((req.formType === "requisition" ? (req.status === "pending_it_office_use" || req.status === "pending_service_desk") : (req.status === "pending_it_office_use" || req.status === "hod_approved"))) ? "default" : "secondary"} className="text-xs">
                                  {((req.formType === "requisition" ? (req.status === "pending_it_office_use" || req.status === "pending_service_desk") : (req.status === "pending_it_office_use" || req.status === "hod_approved"))) ? "Pending Office Use" : "Office Use Completed"}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">{getRequesterLocation(req)}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">From: <span className="font-medium">{getRequester(req)}</span> ({getDepartment(req)})</p>
                              <p className="text-sm">Fault / Request: {getFaultSummary(req).substring(0, 120)}...</p>
                              {getDeviceDetails(req).length > 0 && <p className="text-xs text-muted-foreground">{getDeviceDetails(req).join(" • ")}</p>}
                              {getMaintenanceContext(req).length > 0 && <p className="text-xs text-muted-foreground">{getMaintenanceContext(req).join(" • ")}</p>}
                              {req.department_head_notes && (
                                <p className="text-xs text-muted-foreground italic">HOD Notes: {req.department_head_notes.substring(0, 60)}...</p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => { setSelectedRequisition(req); setIsDetailDialogOpen(true) }}>
                                <Eye className="h-4 w-4 mr-1" />View
                              </Button>
                              {((req.formType === "requisition" ? (req.status === "pending_it_office_use" || req.status === "pending_service_desk") : (req.status === "pending_it_office_use" || req.status === "hod_approved"))) && (
                                <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleProcess(req)}>
                                  <CheckCircle2 className="h-4 w-4 mr-1" />Process
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── MY WORK HISTORY TAB ── */}
        <TabsContent value="mywork">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>My Completed Work</CardTitle>
                  <CardDescription>All IT forms you have processed. You can edit your notes while the next reviewer has not yet acted.</CardDescription>
                </div>
                <History className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search by number, requester, department, or fault..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="max-w-md"
              />

              {historyLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : filteredHistory.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">{myWorkHistory.length === 0 ? "You have not processed any forms yet." : "No forms match your search."}</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {pagedHistory.map((req) => {
                      const editable = canEditWork(req)
                      return (
                        <div key={req.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-all hover:shadow-sm space-y-2">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">{getRequestNumber(req)}</span>
                                <Badge variant="outline" className="text-xs">
                                  {req.formType === "maintenance" ? "Maintenance" : req.formType === "new-gadget" ? "New Gadget" : "Requisition"}
                                </Badge>
                                <Badge variant="secondary" className="text-xs capitalize">{req.status.replace(/_/g, " ")}</Badge>
                                {editable ? (
                                  <Badge variant="outline" className="text-xs text-green-600 border-green-400">Editable</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Lock className="h-3 w-3" />Locked
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                From: <span className="font-medium">{getRequester(req)}</span> • {getDepartment(req)} • {getRequesterLocation(req)}
                              </p>
                              <p className="text-sm">Fault: {getFaultSummary(req).substring(0, 100)}...</p>
                              {(req.service_desk_notes || req.confirmed_by) && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 italic">
                                  Your notes: {req.service_desk_notes || req.other_comments || "—"}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Processed: {new Date(req.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                              </p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <Button variant="outline" size="sm" onClick={() => { setSelectedRequisition(req); setIsDetailDialogOpen(true) }}>
                                <Eye className="h-4 w-4 mr-1" />View
                              </Button>
                              {editable && (
                                <Button variant="outline" size="sm" className="border-blue-400 text-blue-600 hover:bg-blue-50" onClick={() => handleEditWork(req)}>
                                  <Pencil className="h-4 w-4 mr-1" />Edit Notes
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {Math.min((historyPage - 1) * ITEMS_PER_PAGE + 1, filteredHistory.length)}–{Math.min(historyPage * ITEMS_PER_PAGE, filteredHistory.length)} of {filteredHistory.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium">Page {historyPage} / {totalHistoryPages}</span>
                      <Button variant="outline" size="sm" disabled={historyPage >= totalHistoryPages} onClick={() => setHistoryPage((p) => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── DETAIL DIALOG ── */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRequisition ? getRequestNumber(selectedRequisition) : ""}</DialogTitle>
            <DialogDescription>Submitted on {selectedRequisition ? new Date(selectedRequisition.created_at).toLocaleDateString() : ""}</DialogDescription>
          </DialogHeader>
          {selectedRequisition && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><Label className="text-muted-foreground">Requested By</Label><p className="font-medium">{getRequester(selectedRequisition)}</p></div>
                  <div><Label className="text-muted-foreground">Email</Label><p className="font-medium text-sm">{selectedRequisition.requested_by_email || "N/A"}</p></div>
                  <div><Label className="text-muted-foreground">Department</Label><p className="font-medium">{getDepartment(selectedRequisition)}</p></div>
                  <div><Label className="text-muted-foreground">Location</Label><p className="font-medium">{getRequesterLocation(selectedRequisition)}</p></div>
                  <div><Label className="text-muted-foreground">Request Date</Label><p className="font-medium">{new Date(selectedRequisition.request_date).toLocaleDateString()}</p></div>
                </div>
                <div><Label className="text-muted-foreground">Fault / Request Details</Label><p className="font-medium text-sm whitespace-pre-wrap">{getFaultSummary(selectedRequisition)}</p></div>
                <div><Label className="text-muted-foreground">Purpose / Additional Notes</Label><p className="font-medium text-sm whitespace-pre-wrap">{selectedRequisition.purpose || selectedRequisition.other_comments || "N/A"}</p></div>
                {getDeviceDetails(selectedRequisition).length > 0 && (
                  <div><Label className="text-muted-foreground">Device Information</Label><ul className="mt-1 text-sm space-y-1">{getDeviceDetails(selectedRequisition).map((d) => <li key={d}>• {d}</li>)}</ul></div>
                )}
                {getMaintenanceContext(selectedRequisition).length > 0 && (
                  <div><Label className="text-muted-foreground">Maintenance Context</Label><ul className="mt-1 text-sm space-y-1">{getMaintenanceContext(selectedRequisition).map((d) => <li key={d}>• {d}</li>)}</ul></div>
                )}
                {(selectedRequisition.confirmed_by || selectedRequisition.confirmed_date) && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><Label className="text-muted-foreground">Last Office Use By</Label><p className="font-medium">{selectedRequisition.confirmed_by || "N/A"}</p></div>
                    <div><Label className="text-muted-foreground">Office Use Date</Label><p className="font-medium">{selectedRequisition.confirmed_date || "N/A"}</p></div>
                  </div>
                )}
                {selectedRequisition.service_desk_notes && (
                  <div><Label className="text-muted-foreground">IT Office Use Notes</Label><p className="font-medium text-sm whitespace-pre-wrap">{selectedRequisition.service_desk_notes}</p></div>
                )}
              </div>
              <div>
                <h3 className="font-semibold mb-3">Approval Status</h3>
                <ApprovalTracker stages={buildApprovalStages(selectedRequisition)} currentStatus={selectedRequisition.status} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── PROCESS DIALOG ── */}
      <Dialog open={isProcessDialogOpen} onOpenChange={setIsProcessDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Process Requisition</DialogTitle>
            <DialogDescription>{selectedRequisition ? getRequestNumber(selectedRequisition) : ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRequisition && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <p><span className="font-medium">Requester:</span> {getRequester(selectedRequisition)}</p>
                <p><span className="font-medium">Location:</span> {getRequesterLocation(selectedRequisition)}</p>
                <p><span className="font-medium">Department:</span> {getDepartment(selectedRequisition)}</p>
                <p className="line-clamp-3"><span className="font-medium">Fault:</span> {getFaultSummary(selectedRequisition)}</p>
              </div>
            )}
            <div>
              <Label htmlFor="action">Action</Label>
              <Select value={processingAction} onValueChange={(v) => setProcessingAction(v as any)}>
                <SelectTrigger id="action"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="process">Complete Office Use & Forward to IT Head</SelectItem>
                  <SelectItem value="hold">Hold for More Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Processing Notes *</Label>
              <Textarea id="notes" placeholder="Add any processing notes or requirements..." value={processingNotes} onChange={(e) => setProcessingNotes(e.target.value)} className="min-h-24 resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProcessDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitProcessing} disabled={isSubmitting || !processingNotes.trim()} variant="default">
              {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</> : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── EDIT NOTES DIALOG ── */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit IT Office Use Notes</DialogTitle>
            <DialogDescription>
              {selectedRequisition ? getRequestNumber(selectedRequisition) : ""} — update your processing notes while the next reviewer has not yet acted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRequisition && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <p><span className="font-medium">Requester:</span> {getRequester(selectedRequisition)}</p>
                <p><span className="font-medium">Department:</span> {getDepartment(selectedRequisition)}</p>
                <p><span className="font-medium">Current Status:</span> {selectedRequisition.status.replace(/_/g, " ")}</p>
              </div>
            )}
            <div>
              <Label htmlFor="editnotes">Updated Notes *</Label>
              <Textarea id="editnotes" placeholder="Update your office-use processing notes..." value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="min-h-28 resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitEdit} disabled={isEditSubmitting || !editNotes.trim()}>
              {isEditSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Notes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
