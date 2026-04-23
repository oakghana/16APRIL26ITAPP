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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle2, XCircle, Eye, AlertCircle, Loader2, ClipboardList } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { ApprovalTracker } from "./approval-tracker"

type FormType = "requisition" | "new-gadget" | "maintenance"

interface ITRequisition {
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
  requester_location?: string | null
  requested_by_email?: string
  department?: string
  department_name?: string
  department_head?: string
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
  const [filteredRequisitions, setFilteredRequisitions] = useState<ITRequisition[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequisition, setSelectedRequisition] = useState<ITRequisition | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false)
  const [processingNotes, setProcessingNotes] = useState("")
  const [processingAction, setProcessingAction] = useState<"process" | "hold">("process")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterTab, setFilterTab] = useState<"pending" | "processed" | "all">("pending")
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    fetchRequisitions()
  }, [user?.location])

  useEffect(() => {
    filterRequisitions()
  }, [searchQuery, requisitions, filterTab])

  const fetchRequisitions = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ status: "pending_it_office_use" })
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

      setRequisitions(combined)
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

  const filterRequisitions = () => {
    let filtered = requisitions

    const isProcessed = (req: ITRequisition) => {
      if (req.formType === "requisition") return !!req.service_desk_approved
      return req.status !== "pending_it_office_use"
    }

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

  const buildApprovalStages = (req: ITRequisition): any[] => {
    return [
      {
        stage: "Department Head Review",
        role: "Department Head",
        status: req.department_head_approved_by ? "completed" : "pending",
        approver: req.department_head_approved_by,
        timestamp: req.department_head_approved_at,
        notes: req.department_head_notes,
      },
      {
        stage: "IT Office Use",
        role: "IT Staff",
        status: req.formType === "requisition"
          ? (req.service_desk_approved ? "completed" : "pending")
          : req.status === "pending_it_office_use"
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

  const getPendingCount = () => requisitions.filter((r) => (r.formType === "requisition" ? !r.service_desk_approved : r.status === "pending_it_office_use")).length
  const getProcessedCount = () => requisitions.filter((r) => (r.formType === "requisition" ? !!r.service_desk_approved : r.status !== "pending_it_office_use")).length

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
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{getPendingCount()}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{getProcessedCount()}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{requisitions.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
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
          <div className="space-y-4">
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
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredRequisitions.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No requisitions for office-use processing</p>
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
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{req.requisition_number || req.request_number || req.id}</span>
                              <Badge variant="outline" className="text-xs">
                                {req.formType === "maintenance" ? "Maintenance" : req.formType === "new-gadget" ? "New Gadget" : "Requisition"}
                              </Badge>
                              <Badge variant={(req.formType === "requisition" ? req.service_desk_approved : req.status !== "pending_it_office_use") ? "secondary" : "default"} className="text-xs">
                                {(req.formType === "requisition" ? req.service_desk_approved : req.status !== "pending_it_office_use") ? "Office Use Completed" : "Pending Office Use"}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {getRequesterLocation(req)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              From: <span className="font-medium">{req.requested_by || req.staff_name || "Unknown"}</span> ({req.department || req.department_name || "Unknown"})
                            </p>
                            <p className="text-sm">Items: {(req.items_required || req.complaints_from_users || "N/A").substring(0, 80)}...</p>
                            {req.department_head_notes && (
                              <p className="text-xs text-muted-foreground italic">
                                HOD Notes: {req.department_head_notes.substring(0, 60)}...
                              </p>
                            )}
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
                            {!((req.formType === "requisition" ? req.service_desk_approved : req.status !== "pending_it_office_use")) && (
                              <Button
                                variant="default"
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700"
                                onClick={() => handleProcess(req)}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Process
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
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRequisition?.requisition_number || selectedRequisition?.request_number}</DialogTitle>
            <DialogDescription>
              Submitted on {selectedRequisition ? new Date(selectedRequisition.created_at).toLocaleDateString() : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedRequisition && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Requested By</Label>
                    <p className="font-medium">{selectedRequisition.requested_by || selectedRequisition.staff_name || "Unknown"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium text-sm">{selectedRequisition.requested_by_email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Department</Label>
                    <p className="font-medium">{selectedRequisition.department || selectedRequisition.department_name || "Unknown"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Location</Label>
                    <p className="font-medium">{getRequesterLocation(selectedRequisition)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Request Date</Label>
                    <p className="font-medium">
                      {new Date(selectedRequisition.request_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Items Required</Label>
                  <p className="font-medium text-sm whitespace-pre-wrap">{selectedRequisition.items_required || selectedRequisition.complaints_from_users || "N/A"}</p>
                </div>

                <div>
                  <Label className="text-muted-foreground">Purpose</Label>
                  <p className="font-medium text-sm">{selectedRequisition.purpose || selectedRequisition.other_comments || "N/A"}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Approval Status</h3>
                <ApprovalTracker stages={buildApprovalStages(selectedRequisition)} currentStatus={selectedRequisition.status} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Processing Dialog */}
      <Dialog open={isProcessDialogOpen} onOpenChange={setIsProcessDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Process Requisition</DialogTitle>
            <DialogDescription>
              {selectedRequisition?.requisition_number || selectedRequisition?.request_number}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="action">Action</Label>
              <Select value={processingAction} onValueChange={(v) => setProcessingAction(v as any)}>
                <SelectTrigger id="action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="process">Complete Office Use & Forward to IT Head</SelectItem>
                  <SelectItem value="hold">Hold for More Info</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Processing Notes *</Label>
              <Textarea
                id="notes"
                placeholder="Add any processing notes or requirements..."
                value={processingNotes}
                onChange={(e) => setProcessingNotes(e.target.value)}
                className="min-h-24 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProcessDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitProcessing}
              disabled={isSubmitting || !processingNotes.trim()}
              variant="default"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
