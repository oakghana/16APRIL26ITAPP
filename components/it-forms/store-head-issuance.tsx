"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle2, Eye, AlertCircle, Loader2, Package } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { ApprovalTracker } from "./approval-tracker"

interface ITRequisition {
  id: string
  requisition_number: string
  items_required: string
  purpose: string
  requested_by: string
  requested_by_email: string
  requested_by_id?: string
  department: string
  status: string
  requester_location?: string
  location?: string
  admin_approved?: boolean
  store_head_approved?: boolean
  issuance_notes?: string
  supplier_name?: string
  issued_at?: string
  issued_by?: string
  approval_timeline?: Array<any>
  created_at: string
  it_head_approved_by_name?: string
  it_head_approved_by?: string
  it_head_approved_at?: string
  service_desk_processed_by?: string
  department_head_approved_by?: string
}

export function StoreHeadIssuanceModule() {
  const [requisitions, setRequisitions] = useState<ITRequisition[]>([])
  const [filteredRequisitions, setFilteredRequisitions] = useState<ITRequisition[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequisition, setSelectedRequisition] = useState<ITRequisition | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false)
  const [issueNotes, setIssueNotes] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterTab, setFilterTab] = useState<"pending" | "awaiting" | "issued" | "all">("pending")
  const { user } = useAuth()
  const { toast } = useToast()
  const isRegionalHead = user?.role === "regional_it_head"

  useEffect(() => {
    if (user) fetchRequisitions()
  }, [user?.role, user?.location])

  useEffect(() => {
    filterRequisitions()
  }, [searchQuery, requisitions, filterTab])

  const fetchRequisitions = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ status: "all" })
      if (user?.location) {
        params.set("officeUseLocation", user.location)
        params.set("officeUseRole", user.role || "")
      }
      const response = await fetch(`/api/it-forms/requisitions?${params.toString()}`)
      const data = await response.json()
      // Filter client-side: pending queue + already-issued ones
      const targetStatuses = isRegionalHead
        ? ["awaiting_regional_confirmation", "pending_regional_store", "issued"]
        : ["pending_store", "awaiting_user_confirmation", "awaiting_regional_confirmation", "issued"]
      setRequisitions((data.requisitions || []).filter((r: any) => targetStatuses.includes(r.status)))
    } catch (error) {
      console.error("[v0] Error:", error)
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
      filtered = filtered.filter((req) =>
        isRegionalHead ? req.status === "pending_regional_store" : req.status === "pending_store"
      )
    } else if (filterTab === "awaiting") {
      filtered = filtered.filter((req) =>
        isRegionalHead
          ? req.status === "awaiting_regional_confirmation"
          : req.status === "awaiting_user_confirmation" || req.status === "awaiting_regional_confirmation"
      )
    } else if (filterTab === "issued") {
      filtered = filtered.filter((req) => req.status === "issued")
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
    const storeStageStatus = req.status === "pending_store"
      ? "pending"
      : ["awaiting_user_confirmation", "awaiting_regional_confirmation", "pending_regional_store", "issued"].includes(req.status)
        ? "completed"
        : "pending"

    const confirmationStageStatus = req.status === "awaiting_user_confirmation" || req.status === "awaiting_regional_confirmation"
      ? "awaiting"
      : ["pending_regional_store", "issued"].includes(req.status)
        ? "completed"
        : "pending"

    return [
      { stage: "Department Head", role: "HOD", status: "completed" },
      { stage: "IT Service Desk", role: "Service Desk", status: "completed" },
      { stage: "IT Head", role: "IT Head", status: "completed" },
      { stage: "Admin", role: "Admin", status: "completed" },
      {
        stage: "Store Issuance",
        role: "Store Head",
        status: storeStageStatus,
      },
      {
        stage: isHeadOfficeReq(req) ? "Requester Confirmation" : "Regional Receipt Confirmation",
        role: isHeadOfficeReq(req) ? "Requester" : "Regional IT Head",
        status: confirmationStageStatus,
      },
    ]
  }

  const handleIssue = (req: ITRequisition) => {
    setSelectedRequisition(req)
    setIssueNotes(req.issuance_notes || "")
    setSupplierName(req.supplier_name || "")
    setIsIssueDialogOpen(true)
  }

  const confirmRegionalReceipt = async (req: ITRequisition) => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/it-forms/store-issue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requisitionId: req.id,
          action: "regional_confirm_receipt",
          actorId: user?.id,
          actorName: user?.full_name || user?.name || user?.email,
          actorRole: user?.role || "",
          actorLocation: user?.location || "",
          confirmation: "approved",
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to confirm receipt")

      toast({
        title: "Receipt confirmed",
        description: "Regional stock has been updated. You can now assign the item to staff.",
      })
      fetchRequisitions()
    } catch (error: any) {
      toast({
        title: "Confirmation failed",
        description: error.message || "Unable to confirm receipt",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitIssuance = async () => {
    if (!selectedRequisition || !issueNotes.trim()) {
      toast({
        title: "Required",
        description: "Please add issuance notes",
        variant: "destructive",
      })
      return
    }
    if (!isRegionalHead && !supplierName.trim()) {
      toast({
        title: "Required",
        description: "Please add supplier name",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/it-forms/store-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requisitionId: selectedRequisition.id,
          issuedBy: user?.full_name || "Unknown",
          userRole: user?.role || "",
          userLocation: user?.location || "",
          supplierName: isRegionalHead ? undefined : supplierName,
          notes: issueNotes,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      toast({
        title: "Success",
        description: data.awaitingConfirmation
          ? data.confirmationTarget === "regional_it_head"
            ? `Dispatch prepared for ${data.requesterLocation || "regional"}. Regional IT Head must confirm receipt before stock moves.`
            : "Issue prepared. The requester must confirm receipt before final issuance."
          : "Items issued successfully",
      })

      fetchRequisitions()
      setIsIssueDialogOpen(false)
      setSelectedRequisition(null)
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

  const pendingCount = isRegionalHead
    ? requisitions.filter((r) => r.status === "pending_regional_store").length
    : requisitions.filter((r) => r.status === "pending_store").length
  const awaitingCount = isRegionalHead
    ? requisitions.filter((r) => r.status === "awaiting_regional_confirmation").length
    : requisitions.filter((r) => ["awaiting_user_confirmation", "awaiting_regional_confirmation"].includes(r.status)).length
  const issuedCount = requisitions.filter((r) => r.status === "issued").length

  const isHeadOfficeReq = (req: ITRequisition) => {
    const loc = (req.requester_location || req.location || "").toLowerCase().replace(/[\s_-]+/g, "_").trim()
    return loc === "head_office" || loc === "head_office_accra" || loc === "headoffice" || loc === "accra" || loc.startsWith("head_office") || loc === "ho"
  }

  const getStatusLabel = (req: ITRequisition) => {
    if (req.status === "pending_store") return "Ready"
    if (req.status === "awaiting_user_confirmation") return "Awaiting User Confirmation"
    if (req.status === "awaiting_regional_confirmation") return "Awaiting Regional Receipt"
    if (req.status === "pending_regional_store") return "Ready for Regional Assignment"
    if (req.status === "issued") return "Issued"
    return req.status.replace(/_/g, " ")
  }

  const getPrimaryActionLabel = (req: ITRequisition) => {
    if (isRegionalHead) {
      if (req.status === "awaiting_regional_confirmation") return "Confirm Receipt"
      if (req.status === "pending_regional_store") return "Assign to Staff"
      return null
    }

    if (req.status === "awaiting_user_confirmation") return "Edit Issue"
    if (req.status === "awaiting_regional_confirmation") return "Edit Dispatch"
    if (req.status === "pending_store") return isHeadOfficeReq(req) ? "Issue Directly" : "Dispatch to Region"
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {isRegionalHead ? "Regional IT Head - Assign Items to Staff" : "Store Head - Issue Devices & Consumables"}
        </h1>
        <p className="text-muted-foreground mt-2">
          {isRegionalHead
            ? "Issue IT equipment from regional stock to staff in your region"
            : "Issue approved IT equipment and consumables to staff"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Issuance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{pendingCount}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Awaiting Confirmation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{awaitingCount}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Issued</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{issuedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Issuance Queue</CardTitle>
              <CardDescription>Ready for store issuance</CardDescription>
            </div>
            <Package className="h-5 w-5 text-muted-foreground" />
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
              <TabsTrigger value="awaiting">Awaiting ({awaitingCount})</TabsTrigger>
              <TabsTrigger value="issued">Issued ({issuedCount})</TabsTrigger>
              <TabsTrigger value="all">All ({requisitions.length})</TabsTrigger>
            </TabsList>

            <TabsContent value={filterTab} className="mt-4 space-y-3">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredRequisitions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No requisitions found
                </div>
              ) : (
                filteredRequisitions.map((req) => (
                  <div key={req.id} className="border rounded-lg p-4 hover:bg-muted/50 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{req.requisition_number}</span>
                          <Badge variant={req.status === "issued" ? "secondary" : "default"}>
                            {getStatusLabel(req)}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">
                          Assign to: <span className="text-foreground">{req.requested_by || "Unknown"}</span>
                          {(req.requester_location || req.location) && (
                            <span className="text-muted-foreground"> &bull; {req.requester_location || req.location}</span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Dept: {req.department || "—"}
                          {req.it_head_approved_by_name || req.it_head_approved_by ? (
                            <span> &bull; Approved by: {req.it_head_approved_by_name || req.it_head_approved_by}</span>
                          ) : null}
                        </p>
                        <p className="text-sm">Items: {req.items_required.substring(0, 80)}{req.items_required.length > 80 ? "..." : ""}</p>
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
                        {getPrimaryActionLabel(req) && (
                          <Button
                            size="sm"
                            className={isRegionalHead && req.status === "awaiting_regional_confirmation"
                              ? "bg-amber-600 hover:bg-amber-700"
                              : isRegionalHead
                                ? "bg-green-600 hover:bg-green-700"
                                : isHeadOfficeReq(req)
                                  ? "bg-green-600 hover:bg-green-700"
                                  : "bg-blue-600 hover:bg-blue-700"}
                            onClick={() => req.status === "awaiting_regional_confirmation" && isRegionalHead ? confirmRegionalReceipt(req) : handleIssue(req)}
                            disabled={isSubmitting}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            {getPrimaryActionLabel(req)}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRequisition?.requisition_number}</DialogTitle>
          </DialogHeader>
          {selectedRequisition && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Staff / Assign To</Label>
                  <p className="font-medium">{selectedRequisition.requested_by}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Location</Label>
                  <p className="font-medium">{selectedRequisition.requester_location || selectedRequisition.location || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Department</Label>
                  <p className="font-medium">{selectedRequisition.department}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">IT Head Approved By</Label>
                  <p className="font-medium">{selectedRequisition.it_head_approved_by_name || selectedRequisition.it_head_approved_by || "—"}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Items</Label>
                <p className="text-sm whitespace-pre-wrap">{selectedRequisition.items_required}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-3">Approval Timeline</h3>
                <ApprovalTracker stages={buildApprovalStages(selectedRequisition)} currentStatus={selectedRequisition.status} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isRegionalHead
                ? "Assign to Staff"
                : selectedRequisition?.status === "awaiting_user_confirmation"
                  ? "Edit Direct Issue"
                  : selectedRequisition?.status === "awaiting_regional_confirmation"
                    ? "Edit Regional Dispatch"
                    : selectedRequisition && !isHeadOfficeReq(selectedRequisition)
                      ? "Dispatch to Regional Stock"
                      : "Issue Directly"} — {selectedRequisition?.requisition_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRequisition && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                <p><span className="font-medium">Assign to:</span> {selectedRequisition.requested_by}</p>
                <p><span className="font-medium">Location:</span> {selectedRequisition.requester_location || selectedRequisition.location || "—"}</p>
                <p><span className="font-medium">Department:</span> {selectedRequisition.department || "—"}</p>
                <p><span className="font-medium">Items:</span> {selectedRequisition.items_required}</p>
                {selectedRequisition.issuance_notes && (
                  <p><span className="font-medium">Current notes:</span> {selectedRequisition.issuance_notes}</p>
                )}
              </div>
            )}
            {!isRegionalHead && (
              <div className="space-y-2">
                <Label htmlFor="supplierName">Supplier Name *</Label>
                <Input
                  id="supplierName"
                  placeholder="Enter supplier name"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Item S/N will be auto-generated as a 5-character alphanumeric code when issued.
                </p>
              </div>
            )}
            <Textarea
              placeholder={isRegionalHead ? "Record assignment details (serial number, quantity, etc.)..." : "Record issuance details (serial numbers, quantities, etc.)..."}
              value={issueNotes}
              onChange={(e) => setIssueNotes(e.target.value)}
              className="min-h-24"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIssueDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitIssuance}
              disabled={isSubmitting || (!isRegionalHead && !supplierName.trim()) || !issueNotes.trim()}
              className={isRegionalHead
                ? "bg-green-600 hover:bg-green-700"
                : selectedRequisition && !isHeadOfficeReq(selectedRequisition)
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-green-600 hover:bg-green-700"}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {isRegionalHead
                ? "Assign to Staff"
                : selectedRequisition?.status === "awaiting_user_confirmation"
                  ? "Save Direct Issue"
                  : selectedRequisition?.status === "awaiting_regional_confirmation"
                    ? "Save Dispatch"
                    : selectedRequisition && !isHeadOfficeReq(selectedRequisition)
                      ? "Dispatch to Regional Stock"
                      : "Issue Directly"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
