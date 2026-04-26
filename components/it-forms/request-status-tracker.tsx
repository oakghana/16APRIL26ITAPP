"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertCircle, Download, Eye, FileEdit, Loader2, Lock, Printer, RefreshCw } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { ApprovalTracker } from "./approval-tracker"
import { exportITFormPDF, openITFormPrintView } from "@/lib/export-utils"
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface ITRequisition {
  id: string
  requisition_number?: string
  request_number?: string
  locked_system?: string
  lock_description?: string
  system_name?: string
  other_system_name?: string
  account_identifier?: string
  issue_summary?: string
  new_staff_name?: string
  new_staff_email?: string
  new_staff_role?: string
  new_staff_department?: string
  new_staff_location?: string
  start_date?: string
  special_requirements?: string
  departing_staff_name?: string
  departing_staff_email?: string
  departing_staff_role?: string
  departing_staff_department?: string
  last_work_date?: string
  departure_reason?: string
  special_notes?: string
  software_name?: string
  other_software_name?: string
  access_level?: string
  justification?: string
  asset_type?: string
  asset_description?: string
  from_department?: string
  from_location?: string
  to_department?: string
  to_location?: string
  transfer_reason?: string
  handover_condition?: string
  urgency?: string
  requester_location?: string | null
  assigned_to?: string | null
  assigned_to_id?: string | null
  manager_approved_by?: string | null
  manager_approved_at?: string | null
  manager_signature?: string | null
  manager_notes?: string | null
  work_notes?: string | null
  user_confirmed?: boolean
  user_confirmed_at?: string | null
  confirmation_status?: string | null
  work_completed_at?: string | null
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
  it_manager_approved_by?: string
  it_manager_approved_at?: string
  it_manager_signature?: string
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
  formType?:
    | "requisition"
    | "maintenance"
    | "new-gadget"
    | "password-reset"
    | "account-unlock"
    | "onboarding"
    | "offboarding"
    | "software-access"
    | "asset-transfer"
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
    if (!user?.id && !user?.name && !user?.full_name && formType !== "requisition") return

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
            : formType === "password-reset"
              ? `/api/it-forms/password-reset?requestedById=${encodeURIComponent(user?.id || "")}&viewerId=${encodeURIComponent(user?.id || "")}&status=all`
              : formType === "account-unlock"
                ? `/api/it-forms/account-unlock?requestedById=${encodeURIComponent(user?.id || "")}&viewerId=${encodeURIComponent(user?.id || "")}&status=all`
                : formType === "onboarding"
                  ? `/api/it-forms/onboarding?requestedById=${encodeURIComponent(user?.id || "")}&status=all`
                  : formType === "offboarding"
                    ? `/api/it-forms/offboarding?requestedById=${encodeURIComponent(user?.id || "")}&status=all`
                    : formType === "software-access"
                      ? `/api/it-forms/software-access?requestedById=${encodeURIComponent(user?.id || "")}&viewerId=${encodeURIComponent(user?.id || "")}&status=all`
                      : formType === "asset-transfer"
                        ? `/api/it-forms/asset-transfer?requestedById=${encodeURIComponent(user?.id || "")}&status=all`
            : `/api/it-forms/my-requisitions?userId=${encodeURIComponent(user?.id || "")}&userEmail=${encodeURIComponent(user?.email || "")}`

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
  const getRequestSummary = (req: ITRequisition) => {
    if (formType === "password-reset") {
      const systemName = req.system_name === "Other" ? (req.other_system_name || "Other") : (req.system_name || "System")
      return `${systemName} | ${req.account_identifier || "No account"} | ${req.issue_summary || "No issue details"}`
    }
    if (formType === "account-unlock") {
      const lockedSystem = req.locked_system === "Other" ? (req.other_system_name || "Other") : (req.locked_system || "System")
      return `${lockedSystem} | ${req.account_identifier || "No account"} | ${req.lock_description || "No lock details"}`
    }
    if (formType === "onboarding") {
      return `${req.new_staff_name || "New staff"} | ${req.new_staff_department || "No dept"} | Start ${req.start_date || "N/A"}`
    }
    if (formType === "offboarding") {
      return `${req.departing_staff_name || "Departing staff"} | ${req.departing_staff_department || "No dept"} | Last day ${req.last_work_date || "N/A"}`
    }
    if (formType === "software-access") {
      const softwareName = req.software_name === "Other" ? (req.other_software_name || "Other") : (req.software_name || "Software")
      return `${softwareName} | ${req.access_level || "standard"} | ${req.justification || "No justification"}`
    }
    if (formType === "asset-transfer") {
      return `${req.asset_type || "Asset"} | ${req.from_department || "From"} -> ${req.to_department || "To"} | ${req.transfer_reason || "No reason"}`
    }
    return req.items_required || req.complaints_from_users || "No request details"
  }
  const getRequestPurpose = (req: ITRequisition) => {
    if (formType === "password-reset") return req.issue_summary || req.other_comments || "N/A"
    if (formType === "account-unlock") return req.lock_description || req.other_comments || "N/A"
    if (formType === "onboarding") return req.special_requirements || req.new_staff_role || "N/A"
    if (formType === "offboarding") return req.special_notes || req.departure_reason || "N/A"
    if (formType === "software-access") return req.justification || req.other_comments || "N/A"
    if (formType === "asset-transfer") return req.transfer_reason || req.asset_description || "N/A"
    return req.purpose || req.other_comments || req.complaints_from_users || "N/A"
  }
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

  const canEditRequest = (req: ITRequisition) => {
    if (formType === "password-reset") {
      return ["pending_manager", "reopened"].includes(req.status)
    }
    return formType === "requisition" && ["draft", "pending_department_head", "pending", "pending_hod"].includes(req.status)
  }
  const canConfirmManagedRequest = (req: ITRequisition) =>
    ["password-reset", "account-unlock", "software-access"].includes(formType) && req.status === "awaiting_user_confirmation"

  const extractManagerMeta = (req: ITRequisition) => {
    const noteText = req.other_comments || ""
    const match = noteText.match(/IT Manager\s+(approved|rejected)\s+note:[\s\S]*?\(by\s+(.+?)\s+on\s+([^\)]+)\)/i)
    return {
      managerName: req.manager_approved_by || req.it_manager_approved_by || req.admin_approved_by || req.it_head_approved_by || (match?.[2] || ""),
      managerDate: req.manager_approved_at || req.it_manager_approved_at || req.admin_approved_at || req.it_head_approved_at || (match?.[3] || ""),
    }
  }

  const buildExportPayload = (req: ITRequisition) => {
    const requestNumber = getRequestNumber(req)
    const { managerName, managerDate } = extractManagerMeta(req)
    const isPasswordReset = formType === "password-reset"
    const passwordSystem = req.system_name === "Other" ? (req.other_system_name || "Other") : (req.system_name || "Password Reset")
    return {
      formType,
      fileName: requestNumber,
      requestNumber,
      staffName: req.requested_by || req.staff_name || user?.full_name || user?.name || "",
      department: getDepartment(req),
      requestDate: formatDisplayDate(req.request_date || req.created_at),
      summary: getRequestSummary(req),
      purpose: isPasswordReset ? passwordSystem : getRequestPurpose(req),
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
      diagnosisItems: req.diagnosis_items,
      supervisorName: req.hardware_supervisor_name,
      supervisorDate: req.hardware_supervisor_date,
      managerName,
      managerDate,
      managerSignature: req.manager_signature || req.it_manager_signature || req.admin_signature || req.it_head_signature,
      recommendation: req.recommended,
      repairStatus: req.gadget_working_status,
      extraNotes: isPasswordReset ? req.work_notes || req.other_comments : req.other_comments,
    }
  }

  const handleDownload = async (req: ITRequisition) => {
    await exportITFormPDF(buildExportPayload(req))
  }

  const handlePrintView = (req: ITRequisition) => {
    openITFormPrintView(buildExportPayload(req))
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
            : formType === "password-reset"
              ? `/api/it-forms/password-reset`
            : `/api/it-forms/my-requisitions?id=${selectedRequisition.id}`

      const response = await fetch(patchEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          formType === "password-reset"
            ? {
                requestId: selectedRequisition.id,
                action: "update_request",
                actorId: user?.id,
                actorName: user?.full_name || user?.name || user?.email,
                actorRole: user?.role,
                actorDepartment: user?.department,
                actorLocation: user?.location,
                systemName: selectedRequisition.system_name || "",
                otherSystemName: selectedRequisition.other_system_name || "",
                accountIdentifier: editData.items_required,
                issueSummary: editData.purpose,
                urgency: selectedRequisition.urgency || "medium",
              }
            : editData
        ),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to update request")
      }

      setRequisitions((prev) => prev.map((req) => req.id === selectedRequisition.id ? { ...req, ...data.requisition } : req))
      setSelectedRequisition((prev) => prev ? { ...prev, ...data.requisition } : prev)
      toast({ title: "Request updated", description: "Your request details have been updated." })
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message || "Could not update this request.", variant: "destructive" })
    } finally {
      setSavingEdit(false)
    }
  }

  const buildApprovalStages = (req: ITRequisition): any[] => {
    if (["password-reset", "account-unlock", "software-access"].includes(formType)) {
      const deptHeadDone = ["dept_head_approved", "pending_manager", "assigned", "in_progress", "awaiting_user_confirmation", "completed"].includes(req.status)
      const assignedOrBeyond = ["assigned", "in_progress", "awaiting_user_confirmation", "completed"].includes(req.status)
      const startedOrBeyond = ["in_progress", "awaiting_user_confirmation", "completed"].includes(req.status)
      const awaitingOrDone = ["awaiting_user_confirmation", "completed"].includes(req.status)
      const rejected = req.status === "rejected"
      const workLabel =
        formType === "software-access"
          ? "IT Staff Access Provisioning"
          : formType === "account-unlock"
            ? "IT Staff Unlock Execution"
            : "IT Staff Password Reset"

      const stages: any[] = [
        {
          stage: "Request Submitted",
          role: "Requester",
          status: "completed",
          approver: req.staff_name || req.requested_by,
          timestamp: req.created_at,
        },
      ]

      // Software access requires dept head approval
      if (formType === "software-access") {
        const dhRejected = req.status === "rejected" && !!(req as any).dept_head_approved_at
        stages.push({
          stage: "Department Head Approval",
          role: "Department Head",
          status: dhRejected ? "rejected" : deptHeadDone ? "completed" : req.status === "pending_dept_head" ? "pending" : "pending",
          approver: (req as any).dept_head_name || undefined,
          timestamp: (req as any).dept_head_approved_at || undefined,
          notes: (req as any).dept_head_notes || undefined,
        })
      }

      stages.push(
        {
          stage: "IT Manager Approval & Assignment",
          role: "IT Manager",
          status: rejected ? "rejected" : assignedOrBeyond ? "completed" : "pending",
          approver: req.manager_approved_by || undefined,
          timestamp: req.manager_approved_at || undefined,
          notes: req.manager_notes || undefined,
          signatureDataUrl: req.manager_signature || undefined,
        },
        {
          stage: workLabel,
          role: "IT Staff",
          status: rejected ? "rejected" : startedOrBeyond ? "completed" : "pending",
          approver: req.assigned_to || undefined,
          timestamp: req.updated_at,
          notes: req.work_notes || undefined,
        },
        {
          stage: "Requester Confirmation",
          role: "Requester",
          status: req.status === "completed" ? "completed" : rejected ? "rejected" : awaitingOrDone ? "pending" : "pending",
          approver: req.user_confirmed ? (req.staff_name || req.requested_by) : undefined,
          timestamp: req.user_confirmed_at || undefined,
        },
      )
      return stages
    }

    if (["onboarding", "offboarding", "asset-transfer"].includes(formType)) {
      const deptHeadDone = ["dept_head_approved", "pending_manager", "assigned", "in_progress", "completed"].includes(req.status)
      const deptHeadRejected = req.status === "rejected" && !!(req as any).dept_head_approved_at
      const assignedOrBeyond = ["assigned", "in_progress", "completed"].includes(req.status)
      const startedOrBeyond = ["in_progress", "completed"].includes(req.status)
      const rejected = req.status === "rejected"
      const needsDeptHead = ["onboarding", "asset-transfer"].includes(formType)

      const stages: any[] = [
        {
          stage: "Request Submitted",
          role: "Requester",
          status: "completed",
          approver: req.staff_name || req.requested_by,
          timestamp: req.created_at,
        },
      ]

      if (needsDeptHead) {
        stages.push({
          stage: "Department Head Approval",
          role: "Department Head",
          status: deptHeadRejected ? "rejected" : deptHeadDone ? "completed" : req.status === "pending_dept_head" ? "pending" : "pending",
          approver: (req as any).dept_head_name || undefined,
          timestamp: (req as any).dept_head_approved_at || undefined,
          notes: (req as any).dept_head_notes || undefined,
        })
      }

      stages.push(
        {
          stage: "IT Manager Approval & Assignment",
          role: "IT Manager",
          status: rejected ? "rejected" : assignedOrBeyond ? "completed" : "pending",
          approver: req.manager_approved_by || undefined,
          timestamp: req.manager_approved_at || undefined,
          notes: req.manager_notes || undefined,
          signatureDataUrl: req.manager_signature || undefined,
        },
        {
          stage: "IT Staff Execution",
          role: "IT Staff",
          status: rejected ? "rejected" : startedOrBeyond ? "completed" : "pending",
          approver: req.assigned_to || undefined,
          timestamp: req.work_completed_at || req.updated_at,
          notes: req.work_notes || undefined,
        },
      )
      return stages
    }

    if (formType !== "requisition") {
      const hodApprover = req.departmental_head_name || req.sectional_head_name
      const hodTimestamp = req.departmental_head_date || req.sectional_head_date
      const isRejected = req.status.includes("rejected") || req.status.includes("not_recommended")
      const hodCompleted = Boolean(hodApprover) || ["hod_approved", "pending_it_office_use", "pending_manager", "recommended", "not_recommended", "manager_confirmed", "gadget_issued", "sent_for_repair", "repaired", "confirmed_working", "rejected"].includes(req.status)
      const serviceDeskCompleted = ["pending_manager", "recommended", "not_recommended", "manager_confirmed", "gadget_issued", "sent_for_repair", "repaired", "confirmed_working", "rejected"].includes(req.status)
      const managerCompleted = ["recommended", "manager_confirmed", "gadget_issued", "sent_for_repair", "repaired", "confirmed_working"].includes(req.status)

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
          stage: "IT Office Use",
          role: "IT Staff",
          status: isRejected ? "rejected" : serviceDeskCompleted ? "completed" : "pending",
        },
        {
          stage: "IT Manager Review",
          role: "IT Manager",
          status: isRejected ? "rejected" : managerCompleted ? "completed" : "pending",
          approver: req.it_manager_approved_by,
          timestamp: req.it_manager_approved_at || req.updated_at,
          signatureDataUrl: req.it_manager_signature,
        },
      ]
    }

    const isRegional = (req as any).regional_fulfillment === true ||
      req.status === "pending_regional_store"

    const adminStageCompleted =
      Boolean(req.admin_approved) ||
      Boolean(req.it_head_approved) ||
      ["pending_store", "pending_regional_store", "approved", "issued", "completed"].includes(req.status)

    if (isRegional) {
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
          stage: "IT Office Use",
          role: "IT Staff",
          status: req.service_desk_approved ? "completed" : "pending",
        },
        {
          stage: "IT Head / Regional IT Review",
          role: "IT Head / Regional IT Head",
          status: req.it_head_approved ? "completed" : "pending",
          approver: req.it_head_approved_by,
          timestamp: req.it_head_approved_at,
          signatureDataUrl: req.it_head_signature,
        },
        {
          stage: "Regional IT Head Assignment",
          role: "Regional IT Head",
          status: req.store_head_approved ? "completed" : req.it_head_approved ? "awaiting" : "pending",
          notes: req.it_head_approved ? "Item will be added to your regional store for assignment" : undefined,
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
        stage: "IT Office Use",
        role: "IT Staff",
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
      pending_service_desk: { variant: "default", label: "IT Office Use" },
      pending_it_office_use: { variant: "default", label: "IT Office Use" },
      pending_it_head: { variant: "default", label: "Awaiting IT Head" },
      pending_admin: { variant: "default", label: "Awaiting Admin" },
      pending_store: { variant: "default", label: "Ready for Issue" },
      pending_regional_store: { variant: "default", label: "Pending Regional Assignment" },
      approved: { variant: "default", label: "Approved" },
      issued: { variant: "default", label: "Issued" },
      rejected_department_head: { variant: "destructive", label: "Rejected by HOD" },
      pending_manager: { variant: "default", label: "Awaiting IT Manager" },
      assigned: { variant: "secondary", label: "Assigned" },
      in_progress: { variant: "secondary", label: "In Progress" },
      awaiting_user_confirmation: { variant: "default", label: "Awaiting Your Confirmation" },
      completed: { variant: "secondary", label: "Completed" },
      reopened: { variant: "destructive", label: "Reopened" },
      rejected: { variant: "destructive", label: "Rejected" },
    }

    const config = statusConfig[status] || { variant: "secondary", label: status }
    return <Badge variant={config.variant as any}>{config.label}</Badge>
  }

  const getNextStep = (req: ITRequisition) => {
    if (["password-reset", "account-unlock", "software-access"].includes(formType)) {
      if (req.status === "pending_manager") return "Awaiting IT manager review and assignment"
      if (req.status === "assigned") return "Assigned to IT staff for reset"
      if (req.status === "in_progress") return "Password reset is in progress"
      if (req.status === "awaiting_user_confirmation") return "Please confirm the new password is working"
      if (req.status === "reopened") return "Marked for rework and queued for IT manager reassignment"
      if (req.status === "rejected") return "Request was rejected by IT manager"
      return "Request completed"
    }

    if (["onboarding", "offboarding", "asset-transfer"].includes(formType)) {
      if (req.status === "pending_manager") return "Awaiting IT manager review and assignment"
      if (req.status === "assigned") return "Assigned to IT staff"
      if (req.status === "in_progress") return "IT processing is in progress"
      if (req.status === "reopened") return "Marked for rework and queued for IT manager reassignment"
      if (req.status === "rejected") return "Request was rejected by IT manager"
      return "Request completed"
    }

    if (formType !== "requisition") {
      if (["draft", "pending_department_head", "pending", "pending_hod"].includes(req.status)) return "Waiting for Department Head approval"
      if (req.status === "hod_approved") return "Approved by Department Head and awaiting IT processing"
      if (req.status === "pending_it_office_use") return "Awaiting IT office-use completion by IT staff"
      if (req.status === "pending_service_desk") return "Being reviewed by IT Service Desk"
      if (req.status === "pending_it_head") return "Awaiting IT Head review"
      if (req.status === "pending_admin") return "Awaiting Admin review"
      if (req.status === "pending_store") return "Awaiting final fulfilment"
      if (req.status.includes("rejected")) return "Request was rejected"
      return "Request completed"
    }

    if (!req.department_head_approved_by) return "Waiting for Department Head approval"
    if (req.department_head_approved === false) return "Your request was rejected"
    if (!req.service_desk_approved) return "Awaiting IT office-use completion by IT staff"
    if (!req.it_head_approved) return "Awaiting IT Head review"
    if (!req.store_head_approved) return "Ready for store issuance"
    if (req.status === "pending_regional_store") return "Awaiting regional IT head to assign item from local stock"
    return "Request completed"
  }

  const confirmManagedRequest = async (req: ITRequisition, approved: boolean) => {
    try {
      const notes = window.prompt(
        approved
          ? "Add confirmation note (optional):"
          : "Describe why access is still not working and should be re-opened:"
      )

      const endpoint =
        formType === "account-unlock"
          ? "/api/it-forms/account-unlock"
          : formType === "software-access"
            ? "/api/it-forms/software-access"
            : "/api/it-forms/password-reset"

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: req.id,
          action: "user_confirm",
          actorId: user?.id,
          actorName: user?.full_name || user?.name || user?.email,
          actorRole: user?.role,
          actorDepartment: user?.department,
          actorLocation: user?.location,
          confirmation: approved ? "approved" : "rejected",
          notes: notes || "",
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to submit confirmation")

      toast({
        title: approved ? "Confirmation submitted" : "Request reopened",
        description: approved
          ? "Thank you. This password reset request has been completed."
          : "The request has been reopened for IT follow-up.",
      })

      fetchMyRequisitions()
      setSelectedRequisition((prev) => (prev && prev.id === req.id ? data.request || prev : prev))
    } catch (error: any) {
      toast({
        title: "Confirmation failed",
        description: error.message || "Unable to submit confirmation",
        variant: "destructive",
      })
    }
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
              {requisitions.filter((r) => !["issued", "completed", "rejected_department_head", "rejected"].includes(r.status)).length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {requisitions.filter((r) => ["issued", "completed"].includes(r.status)).length}
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
                          setEditData({
                            items_required: formType === "password-reset" ? (req.account_identifier || "") : (req.items_required || ""),
                            purpose: formType === "password-reset" ? (req.issue_summary || "") : (req.purpose || ""),
                          })
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
                      <Button variant="outline" size="sm" onClick={() => handlePrintView(req)}>
                        <Printer className="h-4 w-4 mr-1" />
                        Print
                      </Button>
                      {canConfirmManagedRequest(req) && (
                        <>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => confirmManagedRequest(req, true)}>
                            Confirm Working
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => confirmManagedRequest(req, false)}>
                            Reopen
                          </Button>
                        </>
                      )}
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
                    placeholder={formType === "password-reset" ? "Affected account/email/username" : "Request summary or complaint details"}
                    disabled={formType === "password-reset" ? selectedRequisition.status !== "pending_manager" || savingEdit : !canEditRequest(selectedRequisition) || savingEdit}
                    className="min-h-24"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Purpose</Label>
                  <Textarea
                    value={editData.purpose}
                    onChange={(e) => setEditData((prev) => ({ ...prev, purpose: e.target.value }))}
                    disabled={formType === "password-reset" ? selectedRequisition.status !== "pending_manager" || savingEdit : !canEditRequest(selectedRequisition) || savingEdit}
                    className="min-h-20"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {(formType === "password-reset" ? selectedRequisition.status === "pending_manager" : canEditRequest(selectedRequisition)) && (
                    <Button onClick={handleEditSave} disabled={savingEdit}>
                      {savingEdit ? "Saving..." : "Save changes"}
                    </Button>
                  )}
                  {canConfirmManagedRequest(selectedRequisition) && (
                    <>
                      <Button className="bg-green-600 hover:bg-green-700" onClick={() => confirmManagedRequest(selectedRequisition, true)}>
                        Confirm Working
                      </Button>
                      <Button variant="destructive" onClick={() => confirmManagedRequest(selectedRequisition, false)}>
                        Reopen
                      </Button>
                    </>
                  )}
                  <Button variant="outline" onClick={() => handleDownload(selectedRequisition)}>
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                  <Button variant="outline" onClick={() => handlePrintView(selectedRequisition)}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print View
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
