"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle2, XCircle, Eye, AlertCircle, Loader2, PenLine } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { ApprovalTracker } from "./approval-tracker"
import { FormApprovalChainView } from "./form-approval-chain-view"
import { formatDisplayDate } from "@/lib/utils"
import { SignaturePad } from "@/components/ui/signature-pad"
import { normalizeDepartmentName } from "@/lib/department-options"

type FormType = "requisition" | "new-gadget" | "maintenance"

interface ITFormRequest {
  id: string
  formType: FormType
  requisition_number?: string
  request_number?: string
  items_required?: string
  complaints_from_users?: string
  purpose?: string
  other_comments?: string
  requested_by?: string
  staff_name?: string
  requested_by_email?: string
  department?: string
  department_name?: string
  request_date: string
  status: string
  department_head_approved?: boolean
  department_head_approved_by?: string
  department_head_approved_at?: string
  department_head_signature?: string
  department_head_notes?: string
  departmental_head_name?: string
  departmental_head_date?: string
  sectional_head_name?: string
  sectional_head_date?: string
  service_desk_approved?: boolean
  it_head_approved?: boolean
  admin_approved?: boolean
  store_head_approved?: boolean
  created_by?: string
  created_by_role?: string
  created_by_email?: string
  created_at: string
  updated_at: string
}

export function DepartmentHeadApprovalModule() {
  const [requisitions, setRequisitions] = useState<ITFormRequest[]>([])
  const [filteredRequisitions, setFilteredRequisitions] = useState<ITFormRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequisition, setSelectedRequisition] = useState<ITFormRequest | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false)
  const [approvalNotes, setApprovalNotes] = useState("")
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hodSignature, setHodSignature] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterTab, setFilterTab] = useState<"pending" | "approved" | "rejected" | "all">("pending")
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest")
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const { user } = useAuth()
  const { toast } = useToast()
  const isDepartmentHead = user?.role === "department_head"
  const scopedDepartment = normalizeDepartmentName(user?.department)

  const loadStoredSignature = async () => {
    if (!user?.id || !user?.role) return

    try {
      const params = new URLSearchParams({ userId: user.id, role: user.role })
      const response = await fetch(`/api/it-forms/signature-profile?${params.toString()}`)
      const data = await response.json()
      if (!response.ok) return

      if (data?.profile?.signature_data_url) {
        setHodSignature(data.profile.signature_data_url)
      }
    } catch {
      // Silent fallback; user can still sign manually
    }
  }

  useEffect(() => {
    fetchRequisitions()
  }, [user?.role, user?.department])

  useEffect(() => {
    filterRequisitions()
    setCurrentPage(1)
  }, [searchQuery, requisitions, filterTab, sortOrder])

  const getRequestNumber = (req: ITFormRequest) => req.requisition_number || req.request_number || req.id
  const getRequester = (req: ITFormRequest) => req.requested_by || req.staff_name || "Unknown requester"
  const getDepartment = (req: ITFormRequest) => req.department || req.department_name || "Unknown department"
  const getSummary = (req: ITFormRequest) => req.items_required || req.complaints_from_users || "No details provided"
  const getPurpose = (req: ITFormRequest) => req.purpose || req.other_comments || "N/A"
  const getSubmittedDate = (req: ITFormRequest) => req.request_date || req.created_at
  const getTypeLabel = (req: ITFormRequest) =>
    req.formType === "maintenance"
      ? "Maintenance"
      : req.formType === "new-gadget"
        ? "New Gadget"
        : "Requisition"

  const isRejected = (req: ITFormRequest) => req.status.includes("rejected") || req.department_head_approved === false
  const isApproved = (req: ITFormRequest) =>
    req.department_head_approved === true ||
    ["hod_approved", "pending_manager", "recommended", "not_recommended", "gadget_issued", "sent_for_repair", "repaired", "confirmed_working", "pending_it_office_use", "pending_service_desk", "pending_it_head", "pending_admin", "pending_store", "approved", "issued", "completed"].includes(req.status)

  const fetchRequisitions = async () => {
    try {
      setLoading(true)

      if (isDepartmentHead && !scopedDepartment) {
        setRequisitions([])
        toast({
          title: "Department not configured",
          description: "Your profile department is not configured. Contact admin.",
          variant: "destructive",
        })
        return
      }

      const [requisitionRes, gadgetRes, maintenanceRes] = await Promise.all([
        fetch("/api/it-forms/requisitions?status=all"),
        fetch("/api/it-forms/new-gadget?status=all"),
        fetch("/api/it-forms/maintenance-repairs?status=all"),
      ])

      const requisitionData = requisitionRes.ok ? await requisitionRes.json() : { requisitions: [] }
      const gadgetData = gadgetRes.ok ? await gadgetRes.json() : { requests: [] }
      const maintenanceData = maintenanceRes.ok ? await maintenanceRes.json() : { requests: [] }

      const combined: ITFormRequest[] = [
        ...(requisitionData.requisitions || []).map((req: any) => ({ ...req, formType: "requisition" as const })),
        ...(gadgetData.requests || []).map((req: any) => ({ ...req, formType: "new-gadget" as const })),
        ...(maintenanceData.requests || []).map((req: any) => ({ ...req, formType: "maintenance" as const })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      const departmentScoped = isDepartmentHead
        ? combined.filter((req) => normalizeDepartmentName(req.department || req.department_name) === scopedDepartment)
        : combined

      setRequisitions(departmentScoped)
    } catch (error) {
      console.error("[v0] Error fetching requisitions:", error)
      toast({
        title: "Error",
        description: "Failed to load requests awaiting HOD review",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filterRequisitions = () => {
    let filtered = requisitions

    if (filterTab === "pending") {
      filtered = filtered.filter((req) => !isApproved(req) && !isRejected(req))
    } else if (filterTab === "approved") {
      filtered = filtered.filter((req) => isApproved(req) && !isRejected(req))
    } else if (filterTab === "rejected") {
      filtered = filtered.filter((req) => isRejected(req))
    }

    const term = searchQuery.toLowerCase()
    filtered = filtered.filter(
      (req) =>
        getRequestNumber(req).toLowerCase().includes(term) ||
        getRequester(req).toLowerCase().includes(term) ||
        getDepartment(req).toLowerCase().includes(term) ||
        getSummary(req).toLowerCase().includes(term)
    )

    filtered = [...filtered].sort((a, b) => {
      const aTime = new Date(getSubmittedDate(a)).getTime()
      const bTime = new Date(getSubmittedDate(b)).getTime()
      return sortOrder === "oldest" ? aTime - bTime : bTime - aTime
    })

    setFilteredRequisitions(filtered)
  }

  const canApprove = (req: ITFormRequest): boolean => {
    return ["draft", "pending_department_head", "pending", "pending_hod"].includes(req.status) && !isApproved(req) && !isRejected(req)
  }

  const buildApprovalStages = (req: ITFormRequest): any[] => {
    const hodApprover = req.department_head_approved_by || req.departmental_head_name || req.sectional_head_name
    const hodTimestamp = req.department_head_approved_at || req.departmental_head_date || req.sectional_head_date

    if (req.formType !== "requisition") {
      const managerRejected = ["not_recommended", "rejected"].includes(req.status)
      const managerCompleted = ["recommended", "manager_confirmed", "gadget_issued", "sent_for_repair", "repaired", "confirmed_working"].includes(req.status)
      const serviceDeskCompleted = ["pending_manager", "recommended", "not_recommended", "manager_confirmed", "gadget_issued", "sent_for_repair", "repaired", "confirmed_working", "rejected"]

      return [
        {
          stage: "Department Head Review",
          role: "Department Head",
          status: isRejected(req) ? "rejected" : isApproved(req) ? "completed" : "pending",
          approver: hodApprover,
          timestamp: hodTimestamp,
          notes: req.department_head_notes,
          signatureDataUrl: req.department_head_signature,
        },
        {
          stage: "IT Office Use",
          role: "IT Staff",
          status: serviceDeskCompleted.includes(req.status)
            ? "completed"
            : isRejected(req)
              ? "rejected"
              : "pending",
        },
        {
          stage: "IT Manager Review",
          role: "IT Manager",
          status: managerCompleted ? "completed" : managerRejected ? "rejected" : "pending",
        },
      ]
    }

    return [
      {
        stage: "Department Head Review",
        role: "Department Head",
        status: isRejected(req) ? "rejected" : isApproved(req) ? "completed" : "pending",
        approver: hodApprover,
        timestamp: hodTimestamp,
        notes: req.department_head_notes,
        signatureDataUrl: req.department_head_signature,
      },
      {
        stage: "IT Office Use",
        role: "IT Staff",
        status: ["pending_it_head", "pending_admin", "pending_store", "approved", "issued", "completed"].includes(req.status)
          ? "completed"
          : isRejected(req)
            ? "rejected"
            : "pending",
      },
      {
        stage: "IT Head / Admin Review",
        role: "IT Head / Admin",
        status: ["pending_store", "approved", "issued", "completed"].includes(req.status) ? "completed" : isRejected(req) ? "rejected" : "pending",
      },
      {
        stage: "Store / Fulfilment",
        role: "Store / Operations",
        status: ["issued", "completed"].includes(req.status) ? "completed" : isRejected(req) ? "rejected" : "pending",
      },
    ]
  }

  const handleApprove = (req: ITFormRequest) => {
    setSelectedRequisition(req)
    setApprovalAction("approve")
    setApprovalNotes("")
    setHodSignature(null)
    setIsApprovalDialogOpen(true)
    loadStoredSignature()
  }

  const handleReject = (req: ITFormRequest) => {
    setSelectedRequisition(req)
    setApprovalAction("reject")
    setApprovalNotes("")
    setHodSignature(null)
    setIsApprovalDialogOpen(true)
  }

  const submitApproval = async () => {
    if (!selectedRequisition || !approvalNotes.trim()) {
      toast({
        title: "Required",
        description: "Please add notes for your approval or rejection",
        variant: "destructive",
      })
      return
    }

    if (approvalAction === "approve" && !hodSignature) {
      toast({
        title: "Signature required",
        description: "Please capture your digital signature before approving this request.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/it-forms/department-head-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requisitionId: selectedRequisition.id,
          formType: selectedRequisition.formType,
          action: approvalAction,
          approvedBy: user?.full_name || user?.email || "Unknown",
          approvedById: user?.id,
          notes: approvalNotes,
          hodSignature: approvalAction === "approve" ? hodSignature : undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to process request")
      }

      toast({
        title: "Success",
        description: `${getTypeLabel(selectedRequisition)} ${approvalAction === "approve" ? "approved" : "rejected"} successfully`,
      })

      fetchRequisitions()
      setIsApprovalDialogOpen(false)
      setSelectedRequisition(null)
      setApprovalNotes("")
      setHodSignature(null)
    } catch (error: any) {
      console.error("[v0] Error submitting approval:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to process request",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getPendingCount = () => requisitions.filter((req) => !isApproved(req) && !isRejected(req)).length
  const getApprovedCount = () => requisitions.filter((req) => isApproved(req) && !isRejected(req)).length
  const getRejectedCount = () => requisitions.filter((req) => isRejected(req)).length
  const totalPages = Math.max(1, Math.ceil(filteredRequisitions.length / pageSize))
  const startIndex = (currentPage - 1) * pageSize
  const paginatedRequisitions = filteredRequisitions.slice(startIndex, startIndex + pageSize)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Department Head Approval Queue</h1>
        <p className="text-muted-foreground mt-2">
          Review staff IT forms first before they move to Service Desk, IT Head, or Admin.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending HOD Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{getPendingCount()}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Approved by HOD</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{getApprovedCount()}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">{getRejectedCount()}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{requisitions.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff IT Requests</CardTitle>
          <CardDescription>Equipment requisitions, gadget requests, and maintenance forms now route through HOD first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Input
              placeholder="Search by request number, requester, department, or summary..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
            <div className="flex items-center gap-2 text-sm">
              <Label htmlFor="sort-order" className="text-xs text-muted-foreground">Sort</Label>
              <select
                id="sort-order"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
                className="h-9 rounded-md border bg-background px-2"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first (early requests)</option>
              </select>

              <Label htmlFor="page-size" className="text-xs text-muted-foreground">Per page</Label>
              <select
                id="page-size"
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="h-9 rounded-md border bg-background px-2"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>

          <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as any)}>
            <TabsList>
              <TabsTrigger value="pending">Pending ({getPendingCount()})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({getApprovedCount()})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({getRejectedCount()})</TabsTrigger>
              <TabsTrigger value="all">All ({requisitions.length})</TabsTrigger>
            </TabsList>

            <TabsContent value={filterTab} className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRequisitions.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">No requests found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedRequisitions.map((req) => (
                    <div key={req.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-all hover:shadow-sm space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{getRequestNumber(req)}</span>
                            <Badge variant="outline">{getTypeLabel(req)}</Badge>
                            <Badge variant={canApprove(req) ? "default" : isRejected(req) ? "destructive" : "secondary"} className="text-xs">
                              {canApprove(req) ? "Awaiting HOD Review" : isRejected(req) ? "Rejected by HOD" : "Approved by HOD"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Requested by: <span className="font-medium">{getRequester(req)}</span> • Department: <span className="font-medium">{getDepartment(req)}</span>
                          </p>
                          <p className="text-sm">Summary: {getSummary(req).substring(0, 90)}...</p>
                          <p className="text-xs text-muted-foreground">Submitted: {formatDisplayDate(getSubmittedDate(req))}</p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedRequisition(req)
                              setIsDetailDialogOpen(true)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          {canApprove(req) && (
                            <>
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(req)}>
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleReject(req)}>
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <p className="text-xs text-muted-foreground">
                      Showing {filteredRequisitions.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + pageSize, filteredRequisitions.length)} of {filteredRequisitions.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      >
                        Previous
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRequisition ? getRequestNumber(selectedRequisition) : ""}</DialogTitle>
            <DialogDescription>
              Submitted on {selectedRequisition ? formatDisplayDate(selectedRequisition.created_at) : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedRequisition && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Request Type</Label>
                  <p className="font-medium">{getTypeLabel(selectedRequisition)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Requested By</Label>
                  <p className="font-medium">{getRequester(selectedRequisition)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Department</Label>
                  <p className="font-medium">{getDepartment(selectedRequisition)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Request Date</Label>
                  <p className="font-medium">{formatDisplayDate(selectedRequisition.request_date)}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Summary</Label>
                <p className="font-medium text-sm whitespace-pre-wrap">{getSummary(selectedRequisition)}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Purpose / Notes</Label>
                <p className="font-medium text-sm whitespace-pre-wrap">{getPurpose(selectedRequisition)}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Approval Status</h3>
                <ApprovalTracker stages={buildApprovalStages(selectedRequisition)} currentStatus={selectedRequisition.status} />
              </div>

              {selectedRequisition.created_by && (
                <div>
                  <h3 className="font-semibold mb-3">Request Initiator</h3>
                  <FormApprovalChainView
                    formType={
                      selectedRequisition.formType === "requisition"
                        ? "equipment_requisition"
                        : selectedRequisition.formType === "new-gadget"
                        ? "new_gadget"
                        : "maintenance"
                    }
                    formNumber={getRequestNumber(selectedRequisition)}
                    createdBy={selectedRequisition.created_by}
                    createdByRole={selectedRequisition.created_by_role || "it_staff"}
                    createdByEmail={selectedRequisition.created_by_email}
                    createdAt={selectedRequisition.created_at}
                    approvalChain={buildApprovalStages(selectedRequisition).map((s) => ({
                      role: s.role,
                      person: s.approver,
                      timestamp: s.timestamp,
                      signature: s.signatureDataUrl,
                    }))}
                    status={selectedRequisition.status}
                  />
                </div>
              )}

              {selectedRequisition.department_head_signature && (
                <div>
                  <Label className="text-muted-foreground flex items-center gap-1.5">
                    <PenLine className="h-4 w-4 text-orange-500" />
                    HOD Signature
                  </Label>
                  <div className="mt-2 border rounded-md overflow-hidden bg-white dark:bg-slate-950 p-2 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedRequisition.department_head_signature}
                      alt="HOD Signature"
                      className="max-h-24 object-contain"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Signed by {selectedRequisition.department_head_approved_by || selectedRequisition.departmental_head_name || "HOD"}{" "}
                    {selectedRequisition.department_head_approved_at
                      ? `on ${formatDisplayDate(selectedRequisition.department_head_approved_at)}`
                      : ""}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{approvalAction === "approve" ? "Approve Request" : "Reject Request"}</DialogTitle>
            <DialogDescription>{selectedRequisition ? getRequestNumber(selectedRequisition) : ""}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="notes">{approvalAction === "approve" ? "Approval Notes" : "Rejection Reason"} *</Label>
              <Textarea
                id="notes"
                placeholder={approvalAction === "approve" ? "Add any notes about your approval..." : "Explain why you're rejecting this request..."}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                className="min-h-24 resize-none"
              />
            </div>
            {approvalAction === "approve" && (
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  <PenLine className="h-4 w-4 text-orange-500" />
                  HOD Signature {hodSignature ? <span className="text-green-600 text-xs">(saved signature loaded)</span> : <span className="text-muted-foreground text-xs">(required)</span>}
                </Label>
                <SignaturePad
                  signerLabel={user?.full_name || user?.email || "Unknown"}
                  roleLabel="Department Head"
                  initialValue={hodSignature || undefined}
                  onSave={(dataUrl) => setHodSignature(dataUrl)}
                  onClear={() => setHodSignature(null)}
                  height={130}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitApproval} disabled={isSubmitting || !approvalNotes.trim()} variant={approvalAction === "approve" ? "default" : "destructive"} className={approvalAction === "approve" ? "bg-orange-600 hover:bg-orange-700" : ""}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : approvalAction === "approve" ? (
                "Approve Request"
              ) : (
                "Reject Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
