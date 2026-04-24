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
  department: string
  status: string
  admin_approved?: boolean
  store_head_approved?: boolean
  issuance_notes?: string
  issued_at?: string
  issued_by?: string
  approval_timeline?: Array<any>
  created_at: string
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
  const [filterTab, setFilterTab] = useState<"pending" | "issued" | "all">("pending")
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
      const response = await fetch("/api/it-forms/requisitions?status=ready_for_issuance")
      const data = await response.json()
      setRequisitions(data.requisitions || [])
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
      filtered = filtered.filter((req) => !req.store_head_approved)
    } else if (filterTab === "issued") {
      filtered = filtered.filter((req) => req.store_head_approved)
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
      { stage: "Department Head", role: "HOD", status: "completed" },
      { stage: "IT Service Desk", role: "Service Desk", status: "completed" },
      { stage: "IT Head", role: "IT Head", status: "completed" },
      { stage: "Admin", role: "Admin", status: "completed" },
      {
        stage: "Store Issuance",
        role: "Store Head",
        status: req.store_head_approved ? "completed" : "pending",
      },
    ]
  }

  const handleIssue = (req: ITRequisition) => {
    setSelectedRequisition(req)
    setIssueNotes("")
    setSupplierName("")
    setIsIssueDialogOpen(true)
  }

  const submitIssuance = async () => {
    if (!selectedRequisition || !issueNotes.trim() || !supplierName.trim()) {
      toast({
        title: "Required",
        description: "Please add supplier name and issuance notes",
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
          supplierName,
          notes: issueNotes,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      toast({
        title: "Success",
        description: "Items issued successfully",
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

  const pendingCount = requisitions.filter((r) => !r.store_head_approved).length
  const issuedCount = requisitions.filter((r) => r.store_head_approved).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Store Head - Issue Devices & Consumables</h1>
        <p className="text-muted-foreground mt-2">
          Issue approved IT equipment and consumables to staff
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
            <CardTitle className="text-sm font-medium">Issued</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{issuedCount}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20">
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
                          <Badge variant={req.store_head_approved ? "secondary" : "default"}>
                            {req.store_head_approved ? "Issued" : "Ready"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          To: {req.requested_by} • {req.department}
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
                        {!req.store_head_approved && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleIssue(req)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Issue
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
                  <Label className="text-muted-foreground">Staff</Label>
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
            <DialogTitle>Issue Items</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
            <Textarea
              placeholder="Record issuance details (serial numbers, quantities, etc.)..."
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
              disabled={isSubmitting || !supplierName.trim() || !issueNotes.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Issue Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
