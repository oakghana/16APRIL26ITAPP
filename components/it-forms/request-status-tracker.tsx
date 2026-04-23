"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertCircle, Download, Eye, FileEdit, Loader2, Lock, RefreshCw } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { ApprovalTracker } from "./approval-tracker"
import { exportITFormPDF } from "@/lib/export-utils"
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface ITRequisition {
  id: string
  requisition_number?: string
  request_number?: string
  items_required?: string
  complaints_from_users?: string
  purpose?: string
  other_comments?: string
  requested_by?: string
  staff_name?: string
  department?: string
  department_name?: string
  departmental_head_name?: string
  departmental_head_date?: string
  sectional_head_name?: string
  sectional_head_date?: string
  gadget_make?: string
  supplier_name?: string
  serial_number?: string
  item_sn?: string
  year_of_purchase?: number | string
  date_of_purchase?: string
  date_of_last_repairs?: string
  times_repaired?: number | string
  diagnosis_items?: Array<{
    partItem?: string
    makeSerialNo?: string
    faultRemarks?: string
  }>
  hardware_supervisor_name?: string
  hardware_supervisor_date?: string
  confirmed_by?: string
  confirmed_date?: string
  recommended?: boolean | null
  gadget_working_status?: string
  request_date: string
  status: string
  department_head_approved?: boolean
  department_head_approved_by?: string
  department_head_approved_at?: string
  department_head_signature?: string
  department_head_notes?: string
  service_desk_approved?: boolean
  it_head_approved_by?: string
  it_head_approved_at?: string
  it_head_signature?: string
  it_head_approved?: boolean
  admin_approved_by?: string
  admin_approved_at?: string
  admin_signature?: string
  admin_approved?: boolean
  store_head_approved?: boolean
  approval_timeline?: Array<{
    approver: string
    role: string
    action: string
    notes: string
    timestamp: string
  }>
  created_at: string
  updated_at: string
}

interface RequestStatusTrackerProps {
  formType?: "requisition" | "maintenance" | "new-gadget"
  title?: string
  description?: string
}

export function RequestStatusTracker({
  formType = "requisition",
  title,
  description,
}: RequestStatusTrackerProps) {
  const [requisitions, setRequisitions] = useState<ITRequisition[]>([])
  const [filteredRequisitions, setFilteredRequisitions] = useState<ITRequisition[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequisition, setSelectedRequisition] = useState<ITRequisition | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [editData, setEditData] = useState({ items_required: "", purpose: "" })
  const [savingEdit, setSavingEdit] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (!user?.id && formType === "requisition") return
    if (!user?.name && formType !== "requisition") return

    fetchMyRequisitions()
  }, [user?.id, user?.name, user?.full_name, formType])

  useEffect(() => {
    filterRequisitions()
  }, [searchQuery, requisitions])

  const fetchMyRequisitions = async () => {
    try {
      setLoading(true)

      const endpoint =
        formType === "maintenance"
          ? `/api/it-forms/maintenance-repairs?staffName=${encodeURIComponent(user?.full_name || user?.name || "")}`
          : formType === "new-gadget"
            ? `/api/it-forms/new-gadget?staffName=${encodeURIComponent(user?.full_name || user?.name || "")}`
            : `/api/it-forms/my-requisitions?userId=${user?.id}`

      const response = await fetch(endpoint)
      const data = await response.json()

      if (data.success) {
        setRequisitions(data.requisitions || data.requests || [])
      }
    } catch (error) {
      console.error("[v0] Error fetching requisitions:", error)
      toast({
        title: "Error",
        description: "Failed to load your requisitions",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getRequestNumber = (req: ITRequisition) => req.requisition_number || req.request_number || `REQ-${req.id}`
  const getRequestSummary = (req: ITRequisition) => req.items_required || req.complaints_from_users || "No request details"
  const getRequestPurpose = (req: ITRequisition) => req.purpose || req.other_comments || req.complaints_from_users || "N/A"
  const getDepartment = (req: ITRequisition) => req.department || req.department_name || "N/A"

  const filterRequisitions = () => {
    const normalizedSearch = searchQuery.toLowerCase()
    const filtered = requisitions.filter(
      (req) =>
        getRequestNumber(req).toLowerCase().includes(normalizedSearch) ||
        getRequestSummary(req).toLowerCase().includes(normalizedSearch)
    )
    setFilteredRequisitions(filtered)
  }

  const canEditRequest = (req: ITRequisition) => ["draft", "pending_department_head", "pending", "pending_hod"].includes(req.status)

  const handleDownload = async (req: ITRequisition) => {
    const requestNumber = getRequestNumber(req)

    await exportITFormPDF({
      formType,
      fileName: requestNumber,
      requestNumber,
      staffName: req.requested_by || req.staff_name || user?.full_name || user?.name || "",
      department: getDepartment(req),
      requestDate: formatDisplayDate(req.request_date),
      summary: getRequestSummary(req),
      purpose: getRequestPurpose(req),
      status: req.status,
      gadgetMake: req.gadget_make || req.supplier_name,
      serialNumber: req.serial_number || req.item_sn,
      yearOfPurchase: req.year_of_purchase,
      dateOfPurchase: req.date_of_purchase,
      lastRepairDate: req.date_of_last_repairs,
      timesRepaired: req.times_repaired,
      hodName: req.department_head_approved_by || req.departmental_head_name || req.sectional_head_name,
      hodDate: req.department_head_approved_at || req.departmental_head_date || req.sectional_head_date,
      hodSignature: req.department_head_signature,
      extraNotes: req.other_comments,
      diagnosisItems: req.diagnosis_items,
      supervisorName: req.hardware_supervisor_name,
      supervisorDate: req.hardware_supervisor_date,
      managerName: req.admin_approved_by || req.it_head_approved_by || req.confirmed_by,
      managerDate: req.admin_approved_at || req.it_head_approved_at || req.confirmed_date,
      managerSignature: req.admin_signature || req.it_head_signature,
      recommendation: req.recommended,
      repairStatus: req.gadget_working_status,
    })
  }

  const handleEditSave = async () => {
    if (!selectedRequisition) return

    try {
      setSavingEdit(true)
      const patchEndpoint =
        formType === "maintenance"
          ? `/api/it-forms/maintenance-repairs?id=${selectedRequisition.id}`
          : formType === "new-gadget"
            ? `/api/it-forms/new-gadget?id=${selectedRequisition.id}`
            : `/api/it-forms/my-requisitions?id=${selectedRequisition.id}`

      const response = await fetch(patchEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to update request")
      }

      setRequisitions((prev) => prev.map((req) => req.id === selectedRequisition.id ? { ...req, ...data.requisition } : req))
      setSelectedRequisition((prev) => prev ? { ...prev, ...data.requisition } : prev)
      toast({ title: "Request updated", description: "Your draft requisition has been updated." })
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message || "Could not update this request.", variant: "destructive" })
    } finally {
      setSavingEdit(false)
    }
  }

  const buildApprovalStages = (req: ITRequisition): any[] => {
    if (formType !== "requisition") {
      const hodApprover = req.departmental_head_name || req.sectional_head_name
      const hodTimestamp = req.departmental_head_date || req.sectional_head_date
      const isRejected = req.status.includes("rejected")
      const hodCompleted = Boolean(hodApprover) || ["hod_approved", "pending_manager", "recommended", "not_recommended", "gadget_issued", "sent_for_repair", "repaired", "confirmed_working", "pending_service_desk", "pending_it_head", "pending_admin", "pending_store", "approved", "issued", "completed"].includes(req.status)
      const serviceDeskCompleted = ["hod_approved", "pending_manager", "recommended", "not_recommended", "gadget_issued", "sent_for_repair", "repaired", "confirmed_working", "pending_it_head", "pending_admin", "pending_store", "approved", "issued", "completed"].includes(req.status)
      const adminCompleted = ["pending_manager", "recommended", "not_recommended", "gadget_issued", "sent_for_repair", "repaired", "confirmed_working", "pending_store", "approved", "issued", "completed"].includes(req.status)

      return [
        {
          stage: "Request Submitted",
          role: "Requester",
          status: "completed",
          timestamp: req.created_at,
        },
        {
          stage: "Department Head Review",
          role: "Department Head",
          status: isRejected ? "rejected" : hodCompleted ? "completed" : "pending",
          approver: hodApprover,
          timestamp: hodTimestamp,
        },
        {
          stage: "IT Service Desk Review",
          role: "IT Service Desk",
          status: isRejected ? "rejected" : serviceDeskCompleted ? "completed" : "pending",
        },
        {
          stage: "IT Head / Admin Review",
          role: "IT Head / Admin",
          status: isRejected ? "rejected" : adminCompleted ? "completed" : "pending",
          timestamp: req.updated_at,
        },
      ]
    }

    return [
      {
        stage: "Department Head Review",
        role: "Department Head",
        status: req.department_head_approved_by 
          ? (req.department_head_approved ? "completed" : "rejected")
          : "pending",
        approver: req.department_head_approved_by,
        timestamp: req.department_head_approved_at,
        notes: req.department_head_notes,
        signatureDataUrl: req.department_head_signature,
      },
      {
        stage: "IT Service Desk Processing",
        role: "IT Service Desk",
        status: req.service_desk_approved ? "completed" : "pending",
      },
      {
        stage: "IT Head Review",
        role: "IT Head",
        status: req.it_head_approved ? "completed" : "pending",
        approver: req.it_head_approved_by,
        timestamp: req.it_head_approved_at,
        signatureDataUrl: req.it_head_signature,
      },
      {
        stage: "Admin Approval",
        role: "Admin",
        status: req.admin_approved ? "completed" : "pending",
        approver: req.admin_approved_by,
        timestamp: req.admin_approved_at,
        signatureDataUrl: req.admin_signature,
      },
      {
        stage: "Store Head Issuance",
        role: "IT Store Head",
        status: req.store_head_approved ? "completed" : "pending",
      },
    ]
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; label: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      pending: { variant: "default", label: "Awaiting HOD" },
      pending_hod: { variant: "default", label: "Awaiting HOD" },
      pending_department_head: { variant: "default", label: "Awaiting HOD" },
      hod_approved: { variant: "secondary", label: "HOD Approved" },
      pending_service_desk: { variant: "default", label: "Processing" },
      pending_it_head: { variant: "default", label: "Awaiting IT Head" },
      pending_admin: { variant: "default", label: "Awaiting Admin" },
      pending_store: { variant: "default", label: "Ready for Issue" },
      approved: { variant: "default", label: "Approved" },
      issued: { variant: "default", label: "Issued" },
      rejected_department_head: { variant: "destructive", label: "Rejected by HOD" },
    }

    const config = statusConfig[status] || { variant: "secondary", label: status }
    return <Badge variant={config.variant as any}>{config.label}</Badge>
  }

  const getNextStep = (req: ITRequisition) => {
    if (formType !== "requisition") {
      if (["draft", "pending_department_head", "pending", "pending_hod"].includes(req.status)) return "Waiting for Department Head approval"
      if (req.status === "hod_approved") return "Approved by Department Head and awaiting IT processing"
      if (req.status === "pending_service_desk") return "Being reviewed by IT Service Desk"
      if (req.status === "pending_it_head") return "Awaiting IT Head review"
      if (req.status === "pending_admin") return "Awaiting Admin review"
      if (req.status === "pending_store") return "Awaiting final fulfilment"
      if (req.status.includes("rejected")) return "Request was rejected"
      return "Request completed"
    }

    if (!req.department_head_approved_by) return "Waiting for Department Head approval"
    if (req.department_head_approved === false) return "Your request was rejected"
    if (!req.service_desk_approved) return "Being processed by IT Service Desk"
    if (!req.it_head_approved) return "Awaiting IT Head review"
    if (!req.admin_approved) return "Awaiting Admin approval"
    if (!req.store_head_approved) return "Ready for store issuance"
    return "Request completed"
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-r from-amber-50 via-white to-emerald-50 p-5 shadow-sm dark:from-amber-950/20 dark:via-background dark:to-emerald-950/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/images/qcc-logo.png"
              alt="QCC Logo"
              className="h-14 w-14 rounded-full border bg-white object-contain p-1 shadow-sm"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700 dark:text-amber-300">
                Quality Control Company Limited
              </p>
              <h1 className="text-3xl font-bold tracking-tight">{title || "My Submitted Requests"}</h1>
              <p className="text-muted-foreground mt-1">
                {description || "Track requests, edit them while awaiting HOD approval, and download professional PDF copies of your forms."}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            Logo-ready reports
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requisitions.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {requisitions.filter((r) => !["issued", "rejected_department_head"].includes(r.status)).length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Issued</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {requisitions.filter((r) => r.status === "issued").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requisitions List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Requests</CardTitle>
          <CardDescription>View request progress from submission to HOD approval and onward IT processing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by requisition number or items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
            <Button variant="outline" size="sm" onClick={fetchMyRequisitions}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRequisitions.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No requisitions found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequisitions.map((req) => (
                <div
                  key={req.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-all hover:shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{getRequestNumber(req)}</span>
                        {getStatusBadge(req.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Submitted: {formatDisplayDate(req.request_date)}
                      </p>
                      <p className="text-sm">Summary: {getRequestSummary(req).substring(0, 80)}...</p>
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        Next: {getNextStep(req)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedRequisition(req)
                          setEditData({ items_required: req.items_required || "", purpose: req.purpose || "" })
                          setIsDetailDialogOpen(true)
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDownload(req)}>
                        <Download className="h-4 w-4 mr-1" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog with Tracker */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRequisition ? getRequestNumber(selectedRequisition) : ""}
              {selectedRequisition && canEditRequest(selectedRequisition) ? (
                <Badge variant="secondary" className="gap-1"><FileEdit className="h-3 w-3" /> Editable before HOD review</Badge>
              ) : (
                <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> Locked for review</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Submitted on {selectedRequisition ? formatDisplayDate(selectedRequisition.created_at) : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedRequisition && (
            <div className="space-y-6">
              {/* Request Details */}
              <div className="space-y-2">
                <h3 className="font-semibold">Request Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Department:</span>
                    <p className="font-medium">{getDepartment(selectedRequisition)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <p>{getStatusBadge(selectedRequisition.status)}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 rounded-xl border bg-slate-50/70 p-4 dark:bg-slate-900/40">
                <div className="space-y-2">
                  <Label>Items Required</Label>
                  <Textarea
                    value={editData.items_required}
                    onChange={(e) => setEditData((prev) => ({ ...prev, items_required: e.target.value }))}
                    placeholder="Request summary or complaint details"
                    disabled={!canEditRequest(selectedRequisition) || savingEdit}
                    className="min-h-24"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Purpose</Label>
                  <Textarea
                    value={editData.purpose}
                    onChange={(e) => setEditData((prev) => ({ ...prev, purpose: e.target.value }))}
                    disabled={!canEditRequest(selectedRequisition) || savingEdit}
                    className="min-h-20"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {canEditRequest(selectedRequisition) && (
                    <Button onClick={handleEditSave} disabled={savingEdit}>
                      {savingEdit ? "Saving..." : "Save changes"}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => handleDownload(selectedRequisition)}>
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              </div>
              {/* Approval Tracker */}
              <div>
                <h3 className="font-semibold mb-3">Approval Timeline</h3>
                <ApprovalTracker 
                  stages={buildApprovalStages(selectedRequisition)} 
                  currentStatus={selectedRequisition.status} 
                />
                <p className="text-xs text-muted-foreground mt-3">
                  Last updated: {formatDisplayDateTime(selectedRequisition.updated_at)}
                </p>              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
