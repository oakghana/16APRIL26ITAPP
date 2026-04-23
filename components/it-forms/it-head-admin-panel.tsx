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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle2, XCircle, Eye, AlertCircle, Loader2, BarChart3, PenLine } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { ApprovalTracker } from "./approval-tracker"
import { SignaturePad } from "@/components/ui/signature-pad"
import { formatDisplayDate } from "@/lib/utils"

interface ITRequisition {
  id: string
  requisition_number: string
  items_required: string
  purpose: string
  requested_by: string
  requested_by_email: string
  department: string
  status: string
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
  approval_timeline?: Array<any>
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterTab, setFilterTab] = useState<"pending" | "approved" | "rejected" | "all">("pending")
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    fetchRequisitions()
  }, [])

  useEffect(() => {
    filterRequisitions()
  }, [searchQuery, requisitions, filterTab])

  const fetchRequisitions = async () => {
    try {
      setLoading(true)
      const statusFilter = user?.role === "admin" ? "all" : "pending_it_head"
      const response = await fetch(`/api/it-forms/requisitions?status=${statusFilter}`)
      const data = await response.json()
      setRequisitions(data.requisitions || [])
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

    if (filterTab === "pending") {
      filtered = filtered.filter((req) => {
        if (user?.role === "admin") {
          return req.status === "pending_admin" || (req.status === "pending_it_head" && !req.it_head_approved)
        }
        return req.status === "pending_it_head" && !req.it_head_approved
      })
    } else if (filterTab === "approved") {
      filtered = filtered.filter((req) => req.it_head_approved || req.admin_approved)
    } else if (filterTab === "rejected") {
      filtered = filtered.filter((req) => req.status === "rejected_it_head" || req.status === "rejected_admin")
    }

    filtered = filtered.filter(
      (req) =>
        req.requisition_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.requested_by.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.items_required.toLowerCase().includes(searchQuery.toLowerCase())
    )

    setFilteredRequisitions(filtered)
  }

  const buildApprovalStages = (req: ITRequisition): any[] => {
    return [
      {
        stage: "Department Head Review",
        role: "Department Head",
        status: "completed",
      },
      {
        stage: "IT Service Desk Processing",
        role: "IT Service Desk",
        status: "completed",
        approver: req.service_desk_processed_by,
        timestamp: req.service_desk_processed_at,
        notes: req.service_desk_notes,
      },
      {
        stage: "IT Head Review",
        role: "IT Head",
        status: req.it_head_approved ? "completed" : req.it_head_notes ? "rejected" : "pending",
        approver: req.it_head_approved_by,
        timestamp: req.it_head_approved_at,
        notes: req.it_head_notes,
        signatureDataUrl: req.it_head_signature,
      },
      {
        stage: "Admin Approval",
        role: "Admin",
        status: req.admin_approved ? "completed" : req.status === "rejected_admin" ? "rejected" : "pending",
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

  const handleApprove = (req: ITRequisition) => {
    setSelectedRequisition(req)
    setApprovalAction("approve")
    setApprovalNotes("")
    setApproverSignature(null)
    setIsApprovalDialogOpen(true)
  }

  const handleReject = (req: ITRequisition) => {
    setSelectedRequisition(req)
    setApprovalAction("reject")
    setApprovalNotes("")
    setApproverSignature(null)
    setIsApprovalDialogOpen(true)
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
      const response = await fetch("/api/it-forms/it-head-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requisitionId: selectedRequisition.id,
          action: approvalAction,
          approvedBy: user?.full_name || "Unknown",
          approverRole: user?.role || "it_head",
          notes: approvalNotes,
          approverSignature: approvalAction === "approve" ? approverSignature : undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      toast({
        title: "Success",
        description: `Requisition ${approvalAction}d successfully`,
      })

      fetchRequisitions()
      setIsApprovalDialogOpen(false)
      setSelectedRequisition(null)
      setApproverSignature(null)
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

  const pendingCount = requisitions.filter((r) => {
    if (user?.role === "admin") return r.status === "pending_admin"
    return r.status === "pending_it_head" && !r.it_head_approved
  }).length
  const approvedCount = requisitions.filter((r) => r.it_head_approved || r.admin_approved).length
  const rejectedCount = requisitions.filter((r) => ["rejected_it_head", "rejected_admin"].includes(r.status)).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">IT Head / Admin Review Panel</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve IT requisitions from your departments
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
              <CardTitle>Requisition Review Queue</CardTitle>
              <CardDescription>Review and approve all departmentally processed requisitions</CardDescription>
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
                  No requisitions found
                </div>
              ) : (
                filteredRequisitions.map((req) => (
                  <div
                    key={req.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{req.requisition_number}</span>
                          <Badge variant={req.it_head_approved ? "secondary" : req.it_head_notes ? "destructive" : "default"}>
                            {req.it_head_approved ? "Approved" : req.it_head_notes ? "Rejected" : "Pending"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          From: {req.requested_by} • {req.department}
                        </p>
                        <p className="text-sm">Items: {req.items_required.substring(0, 80)}...</p>
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
                        {(user?.role === "admin"
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
            <DialogTitle>{selectedRequisition?.requisition_number}</DialogTitle>
          </DialogHeader>
          {selectedRequisition && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Requested By</Label>
                  <p className="font-medium">{selectedRequisition.requested_by}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Department</Label>
                  <p className="font-medium">{selectedRequisition.department}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Items</Label>
                <p className="text-sm whitespace-pre-wrap">{selectedRequisition.items_required}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-3">Approval Status</h3>
                <ApprovalTracker stages={buildApprovalStages(selectedRequisition)} currentStatus={selectedRequisition.status} />
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
              {approvalAction === "approve" ? "Approve" : "Reject"} Requisition
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder={approvalAction === "approve" ? "Approval notes..." : "Rejection reason..."}
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              className="min-h-24"
            />
            {approvalAction === "approve" && (
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  <PenLine className="h-4 w-4 text-orange-500" />
                  {user?.role === "admin" ? "Admin Signature" : "IT Head Signature"}
                  {approverSignature ? <span className="text-green-600 text-xs">(captured)</span> : <span className="text-muted-foreground text-xs">(required)</span>}
                </Label>
                <SignaturePad
                  signerLabel={user?.full_name || user?.email || "Unknown"}
                  roleLabel={user?.role === "admin" ? "Admin" : "IT Head"}
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
              disabled={isSubmitting || !approvalNotes.trim()}
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
