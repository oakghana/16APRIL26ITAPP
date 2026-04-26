"use client"

import { useState, useEffect } from "react"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle2, XCircle, Eye, AlertCircle, Loader2, BarChart3, Download, PenLine, Printer } from "lucide-react"
import { FormApprovalChainView } from "./form-approval-chain-view"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { ApprovalTracker } from "./approval-tracker"
import { SignaturePad } from "@/components/ui/signature-pad"
import { exportITFormPDF, openITFormPrintView } from "@/lib/export-utils"
import { formatDisplayDate } from "@/lib/utils"
import { isITDDepartment } from "@/lib/department-options"

type FormType =
  | "requisition"
  | "new-gadget"
  | "maintenance"
  | "password-reset"
  | "account-unlock"
  | "onboarding"
  | "offboarding"
  | "software-access"
  | "asset-transfer"

interface AssigneeOption {
  id: string
  full_name: string
  email?: string | null
  role?: string | null
  location?: string | null
}

interface ITRequisition {
  id: string
  formType: FormType
  requisition_number?: string
  request_number?: string
  request_date?: string
  items_required?: string
  complaints_from_users?: string
  purpose?: string
  issue_summary?: string
  locked_system?: string
  lock_description?: string
  system_name?: string
  other_system_name?: string
  account_identifier?: string
  new_staff_name?: string
  new_staff_department?: string
  start_date?: string
  departing_staff_name?: string
  departing_staff_department?: string
  last_work_date?: string
  software_name?: string
  other_software_name?: string
  access_level?: string
  justification?: string
  asset_type?: string
  from_department?: string
  to_department?: string
  transfer_reason?: string
  urgency?: string
  other_comments?: string
  requested_by?: string
  requested_by_id?: string
  requested_by_email?: string
  staff_name?: string
  requester_location?: string | null
  department?: string
  department_name?: string
  status: string
  department_head_signature?: string
  service_desk_notes?: string
  service_desk_processed_by?: string
  service_desk_processed_at?: string
  it_head_notes?: string
  it_head_approved_by?: string
  it_head_approved_at?: string
  it_head_signature?: string
  it_head_approved?: boolean
  admin_approved_by?: string
  admin_approved_at?: string
  admin_signature?: string
  admin_approved?: boolean
  store_head_approved?: boolean
  departmental_head_name?: string
  departmental_head_date?: string
  sectional_head_name?: string
  sectional_head_date?: string
  confirmed_by?: string
  confirmed_date?: string
  manager_approved_by?: string
  manager_approved_by_id?: string
  manager_approved_at?: string
  manager_notes?: string
  manager_signature?: string
  it_manager_approved_by?: string
  it_manager_approved_at?: string
  it_manager_signature?: string
  recommended?: boolean | null
  gadget_working_status?: string
  approval_timeline?: Array<any>
  created_by?: string
  created_by_role?: string
  created_by_email?: string
  assigned_to?: string
  assigned_to_id?: string
  assigned_to_role?: string
  user_confirmed?: boolean
  user_confirmed_at?: string
  confirmation_status?: string
  work_notes?: string
  work_completed_at?: string
  created_at: string
}

export function ITHeadAdminPanel() {
  const [requisitions, setRequisitions] = useState<ITRequisition[]>([])
  const [filteredRequisitions, setFilteredRequisitions] = useState<ITRequisition[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequisition, setSelectedRequisition] = useState<ITRequisition | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false)
  const [approvalNotes, setApprovalNotes] = useState("")
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve")
  const [approverSignature, setApproverSignature] = useState<string | null>(null)
  const [assignees, setAssignees] = useState<AssigneeOption[]>([])
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("")
  const [loadingAssignees, setLoadingAssignees] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterTab, setFilterTab] = useState<"pending" | "approved" | "rejected" | "all">("pending")
  const { user } = useAuth()
  const { toast } = useToast()

  const loadStoredSignature = async () => {
    if (!user?.id || !user?.role) return

    try {
      const params = new URLSearchParams({ userId: user.id, role: user.role })
      const response = await fetch(`/api/it-forms/signature-profile?${params.toString()}`)
      const data = await response.json()
      if (!response.ok) return

      if (data?.profile?.signature_data_url) {
        setApproverSignature(data.profile.signature_data_url)
      }
    } catch {
      // Silent fallback; user can still sign manually
    }
  }

  useEffect(() => {
    fetchRequisitions()
  }, [])

  useEffect(() => {
    filterRequisitions()
  }, [searchQuery, requisitions, filterTab])

  const loadAssigneesByFormType = async (formType: FormType) => {
    if (!user?.id) return
    setLoadingAssignees(true)
    try {
      const params = new URLSearchParams({ mode: "assignees", viewerId: user.id })
      const endpoint =
        formType === "account-unlock"
          ? "/api/it-forms/account-unlock"
          : formType === "onboarding"
            ? "/api/it-forms/onboarding"
            : formType === "offboarding"
              ? "/api/it-forms/offboarding"
              : formType === "software-access"
                ? "/api/it-forms/software-access"
                : formType === "asset-transfer"
                  ? "/api/it-forms/asset-transfer"
                  : "/api/it-forms/password-reset"

      const response = await fetch(`${endpoint}?${params.toString()}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to load assignees")
      let options = (data.assignees || []) as AssigneeOption[]

      if (options.length === 0) {
        const fallbackParams = new URLSearchParams({
          role: "staff_roles",
          userRole: user.role || "",
          location: user.location || "all",
        })
        const fallbackRes = await fetch(`/api/staff/list?${fallbackParams.toString()}`)
        const fallbackData = await fallbackRes.json()
        if (fallbackRes.ok) {
          options = (fallbackData.staff || []).map((staff: any) => ({
            id: staff.id,
            full_name: staff.name,
            email: staff.email,
            role: staff.role,
            location: staff.location,
          }))
        }
      }

      setAssignees(options)
      if (options.length > 0) {
        setSelectedAssigneeId((prev) => prev || options[0].id)
      }
      if (options.length === 0) {
        toast({
          title: "No IT staff available",
          description: "No assignees were returned for your role/location.",
          variant: "destructive",
        })
      }
    } catch {
      setAssignees([])
      setSelectedAssigneeId("")
      toast({
        title: "Failed to load assignees",
        description: "Please refresh and try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingAssignees(false)
    }
  }

  const getRequestNumber = (req: ITRequisition) => req.requisition_number || req.request_number || req.id
  const getRequester = (req: ITRequisition) => req.requested_by || req.staff_name || "Unknown requester"
  const getDepartment = (req: ITRequisition) => req.department || req.department_name || "Unknown department"
  const getSummary = (req: ITRequisition) => {
    if (req.formType === "password-reset") {
      const systemName = req.system_name === "Other" ? (req.other_system_name || "Other") : (req.system_name || "System")
      return `${systemName} | ${req.account_identifier || "Account not provided"} | ${req.issue_summary || "No details provided"}`
    }
    if (req.formType === "account-unlock") {
      const lockedSystem = req.locked_system === "Other" ? (req.other_system_name || "Other") : (req.locked_system || "System")
      return `${lockedSystem} | ${req.account_identifier || "Account not provided"} | ${req.lock_description || "No details provided"}`
    }
    if (req.formType === "onboarding") {
      return `${req.new_staff_name || "New staff"} | ${req.new_staff_department || "No department"} | Start ${req.start_date || "N/A"}`
    }
    if (req.formType === "offboarding") {
      return `${req.departing_staff_name || "Departing staff"} | ${req.departing_staff_department || "No department"} | Last day ${req.last_work_date || "N/A"}`
    }
    if (req.formType === "software-access") {
      const softwareName = req.software_name === "Other" ? (req.other_software_name || "Other") : (req.software_name || "Software")
      return `${softwareName} | ${req.access_level || "standard"} | ${req.justification || "No justification"}`
    }
    if (req.formType === "asset-transfer") {
      return `${req.asset_type || "Asset"} | ${req.from_department || "From"} -> ${req.to_department || "To"} | ${req.transfer_reason || "No reason"}`
    }
    return req.items_required || req.complaints_from_users || "No details provided"
  }
  const getTypeLabel = (req: ITRequisition) =>
    req.formType === "maintenance"
      ? "Maintenance"
      : req.formType === "new-gadget"
        ? "New Gadget"
        : req.formType === "password-reset"
          ? "Password Reset"
          : req.formType === "account-unlock"
            ? "Account Unlock"
            : req.formType === "onboarding"
              ? "Onboarding"
              : req.formType === "offboarding"
                ? "Offboarding"
                : req.formType === "software-access"
                  ? "Software Access"
                  : req.formType === "asset-transfer"
                    ? "Asset Transfer"
        : "Requisition"

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
    const isPasswordReset = req.formType === "password-reset"
    const passwordSystem = req.system_name === "Other" ? (req.other_system_name || "Other") : (req.system_name || "Password Reset")
    return {
      formType: req.formType,
      fileName: requestNumber,
      requestNumber,
      staffName: getRequester(req),
      department: getDepartment(req),
      requestDate: (req.request_date || req.created_at) ? formatDisplayDate(req.request_date || req.created_at || "") : "",
      summary: getSummary(req),
      purpose: isPasswordReset ? passwordSystem : (req.purpose || req.other_comments || ""),
      status: req.status,
      hodName: req.department_head_approved_by || req.departmental_head_name || req.sectional_head_name,
      hodDate: req.department_head_approved_at || req.departmental_head_date || req.sectional_head_date,
      hodSignature: req.department_head_signature,
      extraNotes: isPasswordReset ? (req.work_notes || req.manager_notes || req.other_comments) : req.other_comments,
      managerName,
      managerDate,
      managerSignature: req.manager_signature || req.it_manager_signature || req.admin_signature || req.it_head_signature,
      recommendation: req.recommended,
      repairStatus: req.gadget_working_status,
    }
  }

  const handleDownload = async (req: ITRequisition) => {
    await exportITFormPDF(buildExportPayload(req))
  }

  const handlePrint = (req: ITRequisition) => {
    openITFormPrintView(buildExportPayload(req))
  }

  const fetchRequisitions = async () => {
    try {
      setLoading(true)
      const [requisitionRes, gadgetRes, maintenanceRes] = await Promise.all([
        fetch("/api/it-forms/requisitions?status=all"),
        fetch("/api/it-forms/new-gadget?status=all"),
        fetch("/api/it-forms/maintenance-repairs?status=all"),
      ])

      const passwordRes = await fetch(`/api/it-forms/password-reset?${new URLSearchParams({ status: "all", viewerId: user?.id || "" }).toString()}`)
      const [unlockRes, onboardingRes, offboardingRes, softwareRes, transferRes] = await Promise.all([
        fetch(`/api/it-forms/account-unlock?${new URLSearchParams({ status: "all", viewerId: user?.id || "" }).toString()}`),
        fetch(`/api/it-forms/onboarding?${new URLSearchParams({ status: "all", viewerId: user?.id || "" }).toString()}`),
        fetch(`/api/it-forms/offboarding?${new URLSearchParams({ status: "all", viewerId: user?.id || "" }).toString()}`),
        fetch(`/api/it-forms/software-access?${new URLSearchParams({ status: "all", viewerId: user?.id || "" }).toString()}`),
        fetch(`/api/it-forms/asset-transfer?${new URLSearchParams({ status: "all", viewerId: user?.id || "" }).toString()}`),
      ])

      const requisitionData = requisitionRes.ok ? await requisitionRes.json() : { requisitions: [] }
      const gadgetData = gadgetRes.ok ? await gadgetRes.json() : { requests: [] }
      const maintenanceData = maintenanceRes.ok ? await maintenanceRes.json() : { requests: [] }
      const passwordData = passwordRes.ok ? await passwordRes.json() : { requests: [] }
      const unlockData = unlockRes.ok ? await unlockRes.json() : { requests: [] }
      const onboardingData = onboardingRes.ok ? await onboardingRes.json() : { requests: [] }
      const offboardingData = offboardingRes.ok ? await offboardingRes.json() : { requests: [] }
      const softwareData = softwareRes.ok ? await softwareRes.json() : { requests: [] }
      const transferData = transferRes.ok ? await transferRes.json() : { requests: [] }

      const combined: ITRequisition[] = [
        ...(requisitionData.requisitions || []).map((req: any) => ({ ...req, formType: "requisition" as const })),
        ...(gadgetData.requests || []).map((req: any) => ({ ...req, formType: "new-gadget" as const })),
        ...(maintenanceData.requests || []).map((req: any) => ({ ...req, formType: "maintenance" as const })),
        ...(passwordData.requests || []).map((req: any) => ({ ...req, formType: "password-reset" as const })),
        ...(unlockData.requests || []).map((req: any) => ({ ...req, formType: "account-unlock" as const })),
        ...(onboardingData.requests || []).map((req: any) => ({ ...req, formType: "onboarding" as const })),
        ...(offboardingData.requests || []).map((req: any) => ({ ...req, formType: "offboarding" as const })),
        ...(softwareData.requests || []).map((req: any) => ({ ...req, formType: "software-access" as const })),
        ...(transferData.requests || []).map((req: any) => ({ ...req, formType: "asset-transfer" as const })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setRequisitions(combined)
    } catch (error) {
      console.error("[v0] Error fetching requisitions:", error)
      toast({
        title: "Error",
        description: "Failed to load IT requests",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filterRequisitions = () => {
    let filtered = requisitions

    // ITD Department Head can see pending_it_head forms
    const isITDepartmentHead = user?.role === "department_head" && isITDDepartment(user?.department)
    const isPendingForManager = (req: ITRequisition) =>
      req.formType === "requisition"
        ? req.status === "pending_it_head" && !req.it_head_approved
        : req.formType === "password-reset"
          ? ["pending_manager", "reopened"].includes(req.status)
          : req.status === "pending_manager"

    const isApprovedForManager = (req: ITRequisition) =>
      req.formType === "requisition"
        ? Boolean(req.it_head_approved || req.admin_approved) || ["pending_store", "pending_regional_store"].includes(req.status)
        : req.formType === "password-reset"
          ? ["assigned", "in_progress", "awaiting_user_confirmation", "completed"].includes(req.status)
          : req.formType === "account-unlock" || req.formType === "software-access"
            ? ["assigned", "in_progress", "awaiting_user_confirmation", "completed"].includes(req.status)
            : req.formType === "onboarding" || req.formType === "offboarding" || req.formType === "asset-transfer"
              ? ["assigned", "in_progress", "completed"].includes(req.status)
        : ["recommended", "not_recommended", "gadget_issued", "manager_confirmed", "sent_for_repair", "repaired", "confirmed_working"].includes(req.status)

    const isRejectedForManager = (req: ITRequisition) =>
      ["rejected_it_head", "rejected_admin", "rejected", "not_recommended"].includes(req.status)

    if (filterTab === "pending") {
      filtered = filtered.filter((req) => {
        if (user?.role === "admin") {
          if (req.formType === "requisition") {
            return req.status === "pending_admin" || isPendingForManager(req)
          }
          return isPendingForManager(req)
        }
        if (isITDepartmentHead) {
          return isPendingForManager(req)
        }
        return isPendingForManager(req)
      })
    } else if (filterTab === "approved") {
      filtered = filtered.filter((req) => isApprovedForManager(req))
    } else if (filterTab === "rejected") {
      filtered = filtered.filter((req) => isRejectedForManager(req))
    }

    filtered = filtered.filter(
      (req) =>
        getRequestNumber(req).toLowerCase().includes(searchQuery.toLowerCase()) ||
        getRequester(req).toLowerCase().includes(searchQuery.toLowerCase()) ||
        getSummary(req).toLowerCase().includes(searchQuery.toLowerCase())
    )

    setFilteredRequisitions(filtered)
  }

  const buildApprovalStages = (req: ITRequisition): any[] => {
    if (req.formType === "password-reset") {
      const assignedOrBeyond = ["assigned", "in_progress", "awaiting_user_confirmation", "completed"].includes(req.status)
      const startedOrBeyond = ["in_progress", "awaiting_user_confirmation", "completed"].includes(req.status)
      const awaitingUserOrBeyond = ["awaiting_user_confirmation", "completed"].includes(req.status)
      const closed = req.status === "completed"
      const rejected = req.status === "rejected"

      return [
        {
          stage: "Request Submitted",
          role: "Requester",
          status: "completed",
          approver: req.staff_name,
          timestamp: req.created_at,
        },
        {
          stage: "IT Manager Approval & Assignment",
          role: "IT Manager",
          status: rejected ? "rejected" : assignedOrBeyond ? "completed" : "pending",
          approver: req.manager_approved_by,
          timestamp: req.manager_approved_at,
          notes: req.manager_notes,
          signatureDataUrl: req.manager_signature,
        },
        {
          stage: "IT Staff Execution",
          role: "IT Staff",
          status: rejected ? "rejected" : startedOrBeyond ? "completed" : "pending",
          approver: req.assigned_to,
          timestamp: req.work_completed_at || req.updated_at,
          notes: req.work_notes,
        },
        {
          stage: "Requester Confirmation",
          role: "Requester",
          status: rejected ? "rejected" : closed ? "completed" : awaitingUserOrBeyond ? "pending" : "pending",
          approver: req.user_confirmed ? req.staff_name : undefined,
          timestamp: req.user_confirmed_at,
        },
      ]
    }

    if (["account-unlock", "software-access", "onboarding", "offboarding", "asset-transfer"].includes(req.formType)) {
      const assignedOrBeyond = ["assigned", "in_progress", "awaiting_user_confirmation", "completed"].includes(req.status)
      const startedOrBeyond = ["in_progress", "awaiting_user_confirmation", "completed"].includes(req.status)
      const awaitingUserOrBeyond = ["awaiting_user_confirmation", "completed"].includes(req.status)
      const closed = req.status === "completed"
      const rejected = req.status === "rejected"
      const hasUserConfirmation = ["account-unlock", "software-access"].includes(req.formType)

      const stages: any[] = [
        {
          stage: "Request Submitted",
          role: "Requester",
          status: "completed",
          approver: req.staff_name,
          timestamp: req.created_at,
        },
        {
          stage: "IT Manager Approval & Assignment",
          role: "IT Manager",
          status: rejected ? "rejected" : assignedOrBeyond ? "completed" : "pending",
          approver: req.manager_approved_by,
          timestamp: req.manager_approved_at,
          notes: req.manager_notes,
          signatureDataUrl: req.manager_signature,
        },
        {
          stage: "IT Staff Execution",
          role: "IT Staff",
          status: rejected ? "rejected" : startedOrBeyond ? "completed" : "pending",
          approver: req.assigned_to,
          timestamp: req.work_completed_at || req.updated_at,
          notes: req.work_notes,
        },
      ]

      if (hasUserConfirmation) {
        stages.push({
          stage: "Requester Confirmation",
          role: "Requester",
          status: rejected ? "rejected" : closed ? "completed" : awaitingUserOrBeyond ? "pending" : "pending",
          approver: req.user_confirmed ? req.staff_name : undefined,
          timestamp: req.user_confirmed_at,
        })
      }

      return stages
    }

    const isNonRequisition = req.formType !== "requisition"
    const managerDoneForNonReq = ["recommended", "not_recommended", "gadget_issued", "manager_confirmed", "sent_for_repair", "repaired", "confirmed_working"].includes(req.status)
    const managerRejectedForNonReq = req.status === "rejected" || req.status === "not_recommended"

    if (isNonRequisition) {
      return [
        {
          stage: "Department Head Review",
          role: "Department Head",
          status: "completed",
          approver: req.departmental_head_name || req.sectional_head_name,
          timestamp: req.departmental_head_date || req.sectional_head_date,
        },
        {
          stage: "IT Office Use",
          role: "IT Staff",
          status: "completed",
          approver: req.confirmed_by,
          timestamp: req.confirmed_date,
          notes: req.other_comments,
        },
        {
          stage: "IT Manager Review",
          role: "IT Manager",
          status: managerDoneForNonReq ? (managerRejectedForNonReq ? "rejected" : "completed") : "pending",
          approver: managerDoneForNonReq ? (req.it_manager_approved_by || "IT Manager") : undefined,
          timestamp: req.it_manager_approved_at,
          notes: req.other_comments,
          signatureDataUrl: req.it_manager_signature,
        },
      ]
    }

    const isRegional = (req as any).regional_fulfillment === true ||
      req.status === "pending_regional_store"

    if (isRegional) {
      return [
        {
          stage: "Department Head Review",
          role: "Department Head",
          status: "completed",
          approver: req.department_head_approved_by || req.departmental_head_name || req.sectional_head_name,
          timestamp: req.department_head_approved_at || req.departmental_head_date || req.sectional_head_date,
        },
        {
          stage: "IT Office Use",
          role: "IT Staff",
          status: "completed",
          approver: req.formType === "requisition" ? req.service_desk_processed_by : req.confirmed_by,
          timestamp: req.formType === "requisition" ? req.service_desk_processed_at : req.confirmed_date,
          notes: req.formType === "requisition" ? req.service_desk_notes : req.other_comments,
        },
        {
          stage: "IT Head / Regional IT Review",
          role: "IT Head / Regional IT Head",
          status: req.it_head_approved || (req.it_head_approved_by && req.it_head_signature) ? "completed" : req.it_head_notes ? "rejected" : "pending",
          approver: req.it_head_approved_by,
          timestamp: req.it_head_approved_at,
          notes: req.it_head_notes,
          signatureDataUrl: req.it_head_signature,
        },
        {
          stage: "Regional IT Head Assignment",
          role: "Regional IT Head",
          status: req.store_head_approved ? "completed" : req.it_head_approved ? "awaiting" : "pending",
        },
      ]
    }

    const managerApprovedRequisition =
      req.it_head_approved === true ||
      Boolean(req.it_head_approved_at) ||
      Boolean(req.it_head_approved_by) ||
      Boolean(req.it_manager_approved_at) ||
      Boolean(req.it_manager_approved_by) ||
      req.status === "pending_store" ||
      req.status === "pending_regional_store" ||
      req.status === "approved" ||
      req.status === "issued" ||
      req.status === "completed"

    const managerRejectedRequisition =
      req.status === "rejected_it_head" ||
      req.status === "rejected_admin"

    return [
      {
        stage: "Department Head Review",
        role: "Department Head",
        status: "completed",
        approver: req.department_head_approved_by || req.departmental_head_name || req.sectional_head_name,
        timestamp: req.department_head_approved_at || req.departmental_head_date || req.sectional_head_date,
      },
      {
        stage: "IT Office Use",
        role: "IT Staff",
        status: "completed",
        approver: req.formType === "requisition" ? req.service_desk_processed_by : req.confirmed_by,
        timestamp: req.formType === "requisition" ? req.service_desk_processed_at : req.confirmed_date,
        notes: req.formType === "requisition" ? req.service_desk_notes : req.other_comments,
      },
      {
        stage: "IT Head Review",
        role: "IT Head",
        status: managerRejectedRequisition ? "rejected" : managerApprovedRequisition ? "completed" : "pending",
        approver: req.it_head_approved_by || req.it_manager_approved_by,
        timestamp: req.it_head_approved_at || req.it_manager_approved_at,
        notes: req.it_head_notes,
        signatureDataUrl: req.it_head_signature || req.it_manager_signature,
      },
      {
        stage: "Store Head Issuance",
        role: "IT Store Head",
        status: req.store_head_approved ? "completed" : "pending",
      },
    ]
  }

  const handleApprove = (req: ITRequisition) => {
    setSelectedRequisition(req)
    setApprovalAction("approve")
    setApprovalNotes("")
    setApproverSignature(null)
    setIsApprovalDialogOpen(true)
    loadStoredSignature()
  }

  const handleReject = (req: ITRequisition) => {
    setSelectedRequisition(req)
    setApprovalAction("reject")
    setApprovalNotes("")
    setApproverSignature(null)
    setIsApprovalDialogOpen(true)
  }

  const handleReview = (req: ITRequisition) => {
    setSelectedRequisition(req)
    setApprovalAction("approve")
    setApprovalNotes("")
    setApproverSignature(null)
    setSelectedAssigneeId("")
    setIsApprovalDialogOpen(true)
    loadStoredSignature()
    if (req.formType !== "requisition") {
      loadAssigneesByFormType(req.formType)
    }
  }

  const submitApproval = async () => {
    if (!selectedRequisition || !approvalNotes.trim()) {
      toast({
        title: "Required",
        description: "Please add notes",
        variant: "destructive",
      })
      return
    }

    if (approvalAction === "approve" && !approverSignature) {
      toast({
        title: "Signature required",
        description: "Please capture your digital signature before approving this request.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const endpoint = selectedRequisition.formType === "requisition"
        ? "/api/it-forms/it-head-approve"
        : selectedRequisition.formType === "password-reset"
          ? "/api/it-forms/password-reset"
          : selectedRequisition.formType === "account-unlock"
            ? "/api/it-forms/account-unlock"
            : selectedRequisition.formType === "onboarding"
              ? "/api/it-forms/onboarding"
              : selectedRequisition.formType === "offboarding"
                ? "/api/it-forms/offboarding"
                : selectedRequisition.formType === "software-access"
                  ? "/api/it-forms/software-access"
                  : selectedRequisition.formType === "asset-transfer"
                    ? "/api/it-forms/asset-transfer"
          : "/api/it-forms/manager-approve"

      const requisitionApproverRole = selectedRequisition.status === "pending_admin" ? "admin" : "it_head"

      const assignee = assignees.find((person) => person.id === selectedAssigneeId)

      const payload = selectedRequisition.formType === "requisition"
        ? {
            requisitionId: selectedRequisition.id,
            action: approvalAction,
            approvedBy: user?.full_name || "Unknown",
            approvedById: user?.id,
        approverRole: requisitionApproverRole,
            notes: approvalNotes,
            approverSignature: approvalAction === "approve" ? approverSignature : undefined,
            userRole: user?.role,
            userDepartment: user?.department,
            userLocation: user?.location,
          }
        : selectedRequisition.formType === "password-reset"
          ? {
              requestId: selectedRequisition.id,
              action: approvalAction === "approve" ? "manager_assign" : "manager_reject",
              actorId: user?.id,
              actorName: user?.full_name || user?.email || "IT Manager",
              actorRole: user?.role,
              actorDepartment: user?.department,
              actorLocation: user?.location,
              notes: approvalNotes,
              managerSignature: approvalAction === "approve" ? approverSignature : undefined,
              assignToId: approvalAction === "approve" ? selectedAssigneeId : undefined,
              assignToName: approvalAction === "approve" ? (assignee?.full_name || assignee?.email) : undefined,
              assignToRole: approvalAction === "approve" ? assignee?.role : undefined,
            }
        : ["account-unlock", "onboarding", "offboarding", "software-access", "asset-transfer"].includes(selectedRequisition.formType)
          ? {
              requestId: selectedRequisition.id,
              action: approvalAction === "approve" ? "manager_assign" : "manager_reject",
              actorId: user?.id,
              actorName: user?.full_name || user?.email || "IT Manager",
              actorRole: user?.role,
              actorDepartment: user?.department,
              actorLocation: user?.location,
              notes: approvalNotes,
              managerSignature: approvalAction === "approve" ? approverSignature : undefined,
              assignToId: approvalAction === "approve" ? selectedAssigneeId : undefined,
              assignToName: approvalAction === "approve" ? (assignee?.full_name || assignee?.email) : undefined,
              assignToRole: approvalAction === "approve" ? assignee?.role : undefined,
            }
        : {
            requisitionId: selectedRequisition.id,
            formType: selectedRequisition.formType,
            action: approvalAction,
            approvedBy: user?.full_name || user?.email || "Unknown",
            approvedById: user?.id,
            notes: approvalNotes,
            approverSignature: approvalAction === "approve" ? approverSignature : undefined,
            userRole: user?.role,
            userDepartment: user?.department,
            userLocation: user?.location,
          }

      const response = await fetch(endpoint, {
        method: ["password-reset", "account-unlock", "onboarding", "offboarding", "software-access", "asset-transfer"].includes(selectedRequisition.formType) ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      toast({
        title: "Success",
        description: `${getTypeLabel(selectedRequisition)} ${approvalAction === "approve" ? "reviewed" : "rejected"} successfully`,
      })

      fetchRequisitions()
      setIsApprovalDialogOpen(false)
      setSelectedRequisition(null)
      setApprovalNotes("")
      setApproverSignature(null)
      setSelectedAssigneeId("")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isPendingForManager = (req: ITRequisition) =>
    req.formType === "requisition"
      ? req.status === "pending_it_head" && !req.it_head_approved
      : req.formType === "password-reset"
        ? ["pending_manager", "reopened"].includes(req.status)
        : req.status === "pending_manager"
  const isApprovedForManager = (req: ITRequisition) =>
    req.formType === "requisition"
      ? Boolean(req.it_head_approved || req.admin_approved)
      : req.formType === "password-reset"
        ? ["assigned", "in_progress", "awaiting_user_confirmation", "completed"].includes(req.status)
        : req.formType === "account-unlock" || req.formType === "software-access"
          ? ["assigned", "in_progress", "awaiting_user_confirmation", "completed"].includes(req.status)
          : req.formType === "onboarding" || req.formType === "offboarding" || req.formType === "asset-transfer"
            ? ["assigned", "in_progress", "completed"].includes(req.status)
      : ["recommended", "not_recommended", "gadget_issued", "manager_confirmed", "sent_for_repair", "repaired", "confirmed_working"].includes(req.status)
  const isRejectedForManager = (req: ITRequisition) =>
    ["rejected_it_head", "rejected_admin", "rejected", "not_recommended"].includes(req.status)

  const pendingCount = requisitions.filter((r) => {
    if (user?.role === "admin") {
      if (r.formType === "requisition") return r.status === "pending_admin" || isPendingForManager(r)
      return isPendingForManager(r)
    }
    return isPendingForManager(r)
  }).length
  const approvedCount = requisitions.filter((r) => isApprovedForManager(r)).length
  const rejectedCount = requisitions.filter((r) => isRejectedForManager(r)).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">IT Head / Admin Review Panel</h1>
        <p className="text-muted-foreground mt-2">
          Review IT requests completed by IT office-use teams and handle manager-stage approvals
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{pendingCount}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{approvedCount}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{rejectedCount}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{requisitions.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>IT Manager Review Queue</CardTitle>
              <CardDescription>Review queue for requisitions, repairs, password reset, unlock, onboarding, offboarding, software access, and asset transfer requests</CardDescription>
            </div>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />

          <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as any)}>
            <TabsList>
              <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({approvedCount})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({rejectedCount})</TabsTrigger>
              <TabsTrigger value="all">All ({requisitions.length})</TabsTrigger>
            </TabsList>

            <TabsContent value={filterTab} className="mt-4 space-y-3">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredRequisitions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  No IT requests found
                </div>
              ) : (
                filteredRequisitions.map((req) => (
                  <div
                    key={req.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{getRequestNumber(req)}</span>
                          <Badge variant="outline" className="text-xs">{getTypeLabel(req)}</Badge>
                          <Badge variant={isApprovedForManager(req) ? "secondary" : isRejectedForManager(req) ? "destructive" : "default"}>
                            {isApprovedForManager(req) ? "Approved" : isRejectedForManager(req) ? "Rejected" : "Pending"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          From: {getRequester(req)} • {getDepartment(req)}
                        </p>
                        <p className="text-sm">Details: {getSummary(req).substring(0, 100)}...</p>
                      </div>
                      <div className="flex gap-2">
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
                        {req.formType === "requisition" && (user?.role === "admin"
                          ? req.status === "pending_admin"
                          : req.status === "pending_it_head") && (
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
                        {req.formType !== "requisition" && ["pending_manager", "reopened"].includes(req.status) && (
                          <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => handleReview(req)}>
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            {req.status === "reopened" ? "Re-Assign" : "Assign"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRequisition ? getRequestNumber(selectedRequisition) : ""}</DialogTitle>
          </DialogHeader>
          {selectedRequisition && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Requested By</Label>
                  <p className="font-medium">{getRequester(selectedRequisition)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Department</Label>
                  <p className="font-medium">{getDepartment(selectedRequisition)}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Request Details</Label>
                <p className="text-sm whitespace-pre-wrap">{getSummary(selectedRequisition)}</p>
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
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => handleDownload(selectedRequisition)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
                <Button variant="outline" onClick={() => handlePrint(selectedRequisition)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print View
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {selectedRequisition.it_head_signature && (
                  <div>
                    <Label className="text-muted-foreground">IT Head Signature</Label>
                    <div className="mt-2 border rounded-md overflow-hidden bg-white p-2 inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selectedRequisition.it_head_signature} alt="IT Head Signature" className="max-h-24 object-contain" />
                    </div>
                    {selectedRequisition.it_head_approved_at && (
                      <p className="text-xs text-muted-foreground mt-1">Signed on {formatDisplayDate(selectedRequisition.it_head_approved_at)}</p>
                    )}
                  </div>
                )}
                {selectedRequisition.admin_signature && (
                  <div>
                    <Label className="text-muted-foreground">Admin Signature</Label>
                    <div className="mt-2 border rounded-md overflow-hidden bg-white p-2 inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selectedRequisition.admin_signature} alt="Admin Signature" className="max-h-24 object-contain" />
                    </div>
                    {selectedRequisition.admin_approved_at && (
                      <p className="text-xs text-muted-foreground mt-1">Signed on {formatDisplayDate(selectedRequisition.admin_approved_at)}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {approvalAction === "approve" ? "Approve" : "Reject"} IT Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRequisition?.formType !== "requisition" && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={approvalAction === "approve" ? "default" : "outline"}
                  onClick={() => setApprovalAction("approve")}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  variant={approvalAction === "reject" ? "destructive" : "outline"}
                  onClick={() => setApprovalAction("reject")}
                >
                  Reject
                </Button>
              </div>
            )}
            <Textarea
              placeholder={approvalAction === "approve" ? "Approval notes..." : "Rejection reason..."}
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              className="min-h-24"
            />
            {selectedRequisition?.formType !== "requisition" && approvalAction === "approve" && (
              <div className="space-y-2">
                <Label>Assign To IT Staff *</Label>
                <Select value={selectedAssigneeId} onValueChange={setSelectedAssigneeId}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingAssignees ? "Loading assignees..." : "Select assignee"} />
                  </SelectTrigger>
                  <SelectContent>
                    {assignees.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.full_name || person.email} {person.role ? `(${person.role})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {approvalAction === "approve" && (
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  <PenLine className="h-4 w-4 text-orange-500" />
                  {selectedRequisition?.formType === "requisition"
                    ? (user?.role === "admin" ? "Admin Signature" : "IT Head Signature")
                    : "IT Manager Signature"}
                  {approverSignature ? <span className="text-green-600 text-xs">(saved signature loaded)</span> : <span className="text-muted-foreground text-xs">(required)</span>}
                </Label>
                <SignaturePad
                  signerLabel={user?.full_name || user?.email || "Unknown"}
                  roleLabel={selectedRequisition?.formType === "requisition" ? (user?.role === "admin" ? "Admin" : "IT Head") : "IT Manager"}
                  initialValue={approverSignature || undefined}
                  onSave={(dataUrl) => setApproverSignature(dataUrl)}
                  onClear={() => setApproverSignature(null)}
                  height={130}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitApproval}
              disabled={isSubmitting || !approvalNotes.trim() || (selectedRequisition?.formType === "password-reset" && approvalAction === "approve" && !selectedAssigneeId)}
              variant={approvalAction === "approve" ? "default" : "destructive"}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {approvalAction === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
