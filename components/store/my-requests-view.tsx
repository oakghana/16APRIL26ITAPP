"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, Search, Package, FileText, Wrench, Ticket, RefreshCw } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"

interface StockAssignment {
  id: string
  item_name: string
  quantity: number
  assigned_to: string
  department: string
  location: string
  status: string
  assigned_by: string
  asset_tag?: string
  serial_number?: string
  requisition_number?: string
  created_at: string
  notes?: string
}

interface StoreRequisition {
  id: string
  requisition_number: string
  requested_by: string
  beneficiary?: string
  location: string
  items: { itemName: string; quantity: number; unit: string }[]
  status: string
  created_at: string
  approved_by?: string
  issued_by?: string
  notes?: string
}

interface ItRequisition {
  id: string
  requisition_number?: string
  request_number?: string
  req_number?: string
  reference_number?: string
  requested_by?: string
  items_required?: string
  status?: string
  created_at: string
  location?: string
  purpose?: string
  _source: string
}

interface ServiceTicket {
  id: string
  ticket_number?: string
  title?: string
  subject?: string
  description?: string
  status: string
  priority?: string
  created_at: string
  location?: string
}

interface RepairRequest {
  id: string
  issue_description?: string
  description?: string
  status: string
  priority?: string
  created_at: string
  location?: string
  assigned_to_name?: string
}

interface MyRequestsData {
  assignments: StockAssignment[]
  storeRequisitions: StoreRequisition[]
  itRequisitions: ItRequisition[]
  serviceTickets: ServiceTicket[]
  repairRequests: RepairRequest[]
}

const statusColor: Record<string, string> = {
  pending: "secondary",
  approved: "default",
  issued: "default",
  rejected: "destructive",
  assigned: "default",
  completed: "default",
  resolved: "default",
  open: "secondary",
  in_progress: "secondary",
  closed: "outline",
  ready_for_issuance: "default",
}

function downloadCSVData(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))]
  const blob = new Blob([lines.join("\n")], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function MyRequestsView() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [data, setData] = useState<MyRequestsData>({
    assignments: [],
    storeRequisitions: [],
    itRequisitions: [],
    serviceTickets: [],
    repairRequests: [],
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("assignments")

  const loadData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        userRole: user.role,
        userName: user.full_name || user.name || "",
        userEmail: user.email || "",
        userId: user.id || "",
      })
      const response = await fetch(`/api/store/my-involved-requests?${params}`)
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to load requests")
      }
      const result = await response.json()
      setData({
        assignments: result.assignments || [],
        storeRequisitions: result.storeRequisitions || [],
        itRequisitions: result.itRequisitions || [],
        serviceTickets: result.serviceTickets || [],
        repairRequests: result.repairRequests || [],
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load your requests",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])

  const filterText = search.toLowerCase()

  const filteredAssignments = data.assignments.filter(
    (a) =>
      a.item_name?.toLowerCase().includes(filterText) ||
      a.assigned_to?.toLowerCase().includes(filterText) ||
      a.asset_tag?.toLowerCase().includes(filterText),
  )

  const filteredStoreReqs = data.storeRequisitions.filter(
    (r) =>
      r.requisition_number?.toLowerCase().includes(filterText) ||
      r.requested_by?.toLowerCase().includes(filterText) ||
      r.beneficiary?.toLowerCase().includes(filterText),
  )

  const filteredItReqs = data.itRequisitions.filter(
    (r) =>
      (r.requisition_number || r.request_number || r.req_number || "")
        .toLowerCase()
        .includes(filterText) ||
      r.requested_by?.toLowerCase().includes(filterText),
  )

  const filteredTickets = data.serviceTickets.filter(
    (t) =>
      (t.title || t.subject || "").toLowerCase().includes(filterText) ||
      (t.ticket_number || "").toLowerCase().includes(filterText),
  )

  const filteredRepairs = data.repairRequests.filter(
    (r) =>
      (r.issue_description || r.description || "").toLowerCase().includes(filterText) ||
      r.assigned_to_name?.toLowerCase().includes(filterText),
  )

  const handleDownloadAssignments = () => {
    downloadCSVData(
      "my-stock-assignments.csv",
      ["Date", "Item", "Qty", "Assigned To", "Dept", "Location", "Asset Tag", "SN", "Req #", "Status"],
      filteredAssignments.map((a) => [
        new Date(a.created_at).toLocaleDateString(),
        a.item_name,
        a.quantity,
        a.assigned_to,
        a.department,
        a.location,
        a.asset_tag || "",
        a.serial_number || "",
        a.requisition_number || "",
        a.status,
      ]),
    )
  }

  const handleDownloadStoreReqs = () => {
    downloadCSVData(
      "my-store-requisitions.csv",
      ["Date", "Req #", "Requested By", "Beneficiary", "Location", "Items", "Status", "Approved By"],
      filteredStoreReqs.map((r) => [
        new Date(r.created_at).toLocaleDateString(),
        r.requisition_number,
        r.requested_by,
        r.beneficiary || "",
        r.location,
        Array.isArray(r.items)
          ? r.items.map((i) => `${i.itemName}(${i.quantity})`).join("; ")
          : "",
        r.status,
        r.approved_by || "",
      ]),
    )
  }

  const handleDownloadItReqs = () => {
    downloadCSVData(
      "my-it-requisitions.csv",
      ["Date", "Req #", "Requested By", "Items/Purpose", "Status", "Location"],
      filteredItReqs.map((r) => [
        new Date(r.created_at).toLocaleDateString(),
        r.requisition_number || r.request_number || r.req_number || r.reference_number || r.id,
        r.requested_by || "",
        r.items_required || r.purpose || "",
        r.status || "",
        r.location || "",
      ]),
    )
  }

  const handleDownloadTickets = () => {
    downloadCSVData(
      "my-service-tickets.csv",
      ["Date", "Ticket #", "Title", "Priority", "Status", "Location"],
      filteredTickets.map((t) => [
        new Date(t.created_at).toLocaleDateString(),
        t.ticket_number || t.id,
        t.title || t.subject || "",
        t.priority || "",
        t.status,
        t.location || "",
      ]),
    )
  }

  const handleDownloadRepairs = () => {
    downloadCSVData(
      "my-repairs.csv",
      ["Date", "ID", "Issue", "Priority", "Status", "Location", "Assigned To"],
      filteredRepairs.map((r) => [
        new Date(r.created_at).toLocaleDateString(),
        r.id.slice(0, 8),
        r.issue_description || r.description || "",
        r.priority || "",
        r.status,
        r.location || "",
        r.assigned_to_name || "",
      ]),
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading your requests...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-stone-50 p-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Requests</h1>
          <p className="text-muted-foreground">
            All requests, assignments and tickets you are directly involved in
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadData}
          className="border-blue-200 bg-white hover:bg-blue-50 text-blue-800"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, item, ticket number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="assignments" className="text-xs sm:text-sm">
            <Package className="h-4 w-4 mr-1 hidden sm:inline" />
            Assignments ({filteredAssignments.length})
          </TabsTrigger>
          <TabsTrigger value="store-reqs" className="text-xs sm:text-sm">
            <FileText className="h-4 w-4 mr-1 hidden sm:inline" />
            Store Reqs ({filteredStoreReqs.length})
          </TabsTrigger>
          <TabsTrigger value="it-reqs" className="text-xs sm:text-sm">
            <FileText className="h-4 w-4 mr-1 hidden sm:inline" />
            IT Reqs ({filteredItReqs.length})
          </TabsTrigger>
          <TabsTrigger value="tickets" className="text-xs sm:text-sm">
            <Ticket className="h-4 w-4 mr-1 hidden sm:inline" />
            Tickets ({filteredTickets.length})
          </TabsTrigger>
          <TabsTrigger value="repairs" className="text-xs sm:text-sm">
            <Wrench className="h-4 w-4 mr-1 hidden sm:inline" />
            Repairs ({filteredRepairs.length})
          </TabsTrigger>
        </TabsList>

        {/* Stock Assignments Tab */}
        <TabsContent value="assignments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Stock Assignments</CardTitle>
                <CardDescription>IT stock items assigned to you</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadAssignments}>
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            </CardHeader>
            <CardContent>
              {filteredAssignments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No stock assignments found for you.</p>
              ) : (
                <div className="space-y-3">
                  {filteredAssignments.map((a) => (
                    <div key={a.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{a.item_name}</span>
                        <Badge variant={statusColor[a.status] as any || "outline"}>{a.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                        <span>Qty: {a.quantity}</span>
                        <span>Dept: {a.department}</span>
                        <span>Location: {a.location}</span>
                        {a.asset_tag && <span>Asset Tag: {a.asset_tag}</span>}
                        {a.serial_number && <span>SN: {a.serial_number}</span>}
                        {a.requisition_number && <span>Req: {a.requisition_number}</span>}
                        <span>Date: {new Date(a.created_at).toLocaleDateString()}</span>
                        <span>Assigned By: {a.assigned_by}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Store Requisitions Tab */}
        <TabsContent value="store-reqs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Store Requisitions</CardTitle>
                <CardDescription>Requisitions you requested or are the beneficiary of</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadStoreReqs}>
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            </CardHeader>
            <CardContent>
              {filteredStoreReqs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No store requisitions found for you.</p>
              ) : (
                <div className="space-y-3">
                  {filteredStoreReqs.map((r) => (
                    <div key={r.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{r.requisition_number}</span>
                        <Badge variant={statusColor[r.status] as any || "outline"}>{r.status}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
                        <span>Requested By: {r.requested_by}</span>
                        {r.beneficiary && <span>Beneficiary: {r.beneficiary}</span>}
                        <span>Location: {r.location}</span>
                        <span>Date: {new Date(r.created_at).toLocaleDateString()}</span>
                        {r.approved_by && <span>Approved By: {r.approved_by}</span>}
                      </div>
                      {Array.isArray(r.items) && r.items.length > 0 && (
                        <div className="text-sm">
                          <span className="font-medium">Items: </span>
                          {r.items.map((i, idx) => (
                            <span key={idx} className="text-muted-foreground">
                              {i.itemName} ({i.quantity} {i.unit}){idx < r.items.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* IT Requisitions Tab */}
        <TabsContent value="it-reqs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>IT Equipment Requisitions</CardTitle>
                <CardDescription>IT requisitions you submitted</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadItReqs}>
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            </CardHeader>
            <CardContent>
              {filteredItReqs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No IT requisitions found for you.</p>
              ) : (
                <div className="space-y-3">
                  {filteredItReqs.map((r) => (
                    <div key={r.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {r.requisition_number || r.request_number || r.req_number || r.reference_number || `ID: ${r.id.slice(0, 8)}`}
                        </span>
                        <Badge variant={statusColor[r.status || ""] as any || "outline"}>{r.status || "N/A"}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
                        {r.requested_by && <span>Requested By: {r.requested_by}</span>}
                        {r.location && <span>Location: {r.location}</span>}
                        <span>Date: {new Date(r.created_at).toLocaleDateString()}</span>
                        {(r.items_required || r.purpose) && (
                          <span className="col-span-2">Purpose/Items: {r.items_required || r.purpose}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Service Tickets Tab */}
        <TabsContent value="tickets">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Service Desk Tickets</CardTitle>
                <CardDescription>Tickets assigned to you or submitted by you</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadTickets}>
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            </CardHeader>
            <CardContent>
              {filteredTickets.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No service tickets found for you.</p>
              ) : (
                <div className="space-y-3">
                  {filteredTickets.map((t) => (
                    <div key={t.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{t.title || t.subject || "Service Ticket"}</span>
                        <Badge variant={statusColor[t.status] as any || "outline"}>{t.status}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
                        <span>Ticket #: {t.ticket_number || t.id.slice(0, 8)}</span>
                        {t.priority && <span>Priority: {t.priority}</span>}
                        {t.location && <span>Location: {t.location}</span>}
                        <span>Date: {new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Repairs Tab */}
        <TabsContent value="repairs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Repair Requests</CardTitle>
                <CardDescription>Repair jobs assigned to you or submitted by you</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadRepairs}>
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            </CardHeader>
            <CardContent>
              {filteredRepairs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No repair requests found for you.</p>
              ) : (
                <div className="space-y-3">
                  {filteredRepairs.map((r) => (
                    <div key={r.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{r.issue_description || r.description || "Repair Request"}</span>
                        <Badge variant={statusColor[r.status] as any || "outline"}>{r.status}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
                        {r.priority && <span>Priority: {r.priority}</span>}
                        {r.location && <span>Location: {r.location}</span>}
                        <span>Date: {new Date(r.created_at).toLocaleDateString()}</span>
                        {r.assigned_to_name && <span>Assigned To: {r.assigned_to_name}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
