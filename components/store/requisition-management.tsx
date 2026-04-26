"use client"

import { DialogFooter } from "@/components/ui/dialog"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, FileText, Search, CheckCircle, Clock, XCircle, Download, Edit, Trash2, Package, Zap, Eye, Loader2, CheckCircle2, Minus } from "lucide-react"
import { NewRequisitionForm } from "./new-requisition-form"
import { IssueItemsForm } from "./issue-items-form"
import { AddStockToCentralStore } from "./add-stock-to-central-store"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { canSeeAllLocations } from "@/lib/location-filter"
import { getLocationOptions } from "@/lib/locations"
import { useToast } from "@/hooks/use-toast"
import { DataPagination } from "@/components/ui/data-pagination"
import { useSearchParams } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Requisition {
  id: string
  requisition_number: string
  requested_by: string
  requested_by_role?: string
  beneficiary?: string
  location: string
  items: { itemName: string; quantity: number; unit: string; item_id?: string }[]
  created_at: string
  status: "pending" | "approved" | "issued" | "rejected"
  updated_at?: string
  issued_by?: string
  approved_by?: string
  notes?: string
  allocated_to_location?: string
  allocation_date?: string
  allocated_by?: string
}

interface StockTransaction {
  id: string
  item_name: string
  transaction_type: string
  quantity: number
  location: string
  location_name?: string
  reference_type: string
  created_at: string
  item_id?: string
  reference_number?: string
}

interface StockItem {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  location: string
  sku?: string
}

interface DispatchItem extends StockItem {
  dispatchQty: number
  selected: boolean
}

const statusConfig = {
  pending: { icon: Clock, color: "secondary", label: "Pending" },
  approved: { icon: CheckCircle, color: "default", label: "Approved" },
  issued: { icon: CheckCircle, color: "default", label: "Issued" },
  rejected: { icon: XCircle, color: "destructive", label: "Rejected" },
}

const DEFAULT_PAGE_SIZE = 10

type RequisitionTabValue = "all" | "pending" | "approved" | "issued" | "rejected" | "transactions"

const INITIAL_PAGE_STATE: Record<RequisitionTabValue, number> = {
  all: 1,
  pending: 1,
  approved: 1,
  issued: 1,
  rejected: 1,
  transactions: 1,
}

const INITIAL_PAGE_SIZE_STATE: Record<RequisitionTabValue, number> = {
  all: DEFAULT_PAGE_SIZE,
  pending: DEFAULT_PAGE_SIZE,
  approved: DEFAULT_PAGE_SIZE,
  issued: DEFAULT_PAGE_SIZE,
  rejected: DEFAULT_PAGE_SIZE,
  transactions: DEFAULT_PAGE_SIZE,
}

export function RequisitionManagement() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([])
  const [transactions, setTransactions] = useState<StockTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [newReqOpen, setNewReqOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [selectedReq, setSelectedReq] = useState<Requisition | null>(null)
  const [allocateOpen, setAllocateOpen] = useState(false)
  const [allocatingReq, setAllocatingReq] = useState<Requisition | null>(null)
  const [allocateLocation, setAllocateLocation] = useState("")
  const [editReqOpen, setEditReqOpen] = useState(false)
  const [editingReq, setEditingReq] = useState<Requisition | null>(null)
  const [editFormData, setEditFormData] = useState({
    beneficiary: "",
    location: "",
    notes: "",
  })
  const [editError, setEditError] = useState("")
  const [editLoading, setEditLoading] = useState(false)
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [approvingReq, setApprovingReq] = useState<Requisition | null>(null)
  const [approvedQuantity, setApprovedQuantity] = useState("")
  const [approvalNotes, setApprovalNotes] = useState("")
  const [isApproving, setIsApproving] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingReq, setDeletingReq] = useState<Requisition | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [transactionDeleteDialog, setTransactionDeleteDialog] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<StockTransaction | null>(null)
  const [transactionDeleteReason, setTransactionDeleteReason] = useState("")
  const [isDeletingTransaction, setIsDeletingTransaction] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()
  const searchParams = useSearchParams()

  const [filteredRequisitions, setFilteredRequisitions] = useState<Requisition[]>([])
  const [approvedQuantities, setApprovedQuantities] = useState<Record<string, number>>({})
  const [activeTab, setActiveTab] = useState<RequisitionTabValue>("all")
  const [pageByTab, setPageByTab] = useState<Record<RequisitionTabValue, number>>(INITIAL_PAGE_STATE)
  const [pageSizeByTab, setPageSizeByTab] = useState<Record<RequisitionTabValue, number>>(INITIAL_PAGE_SIZE_STATE)
  const [isSyncingApprovedIt, setIsSyncingApprovedIt] = useState(false)
  const [hasHandledAutoSync, setHasHandledAutoSync] = useState(false)
  const [approvedItOpen, setApprovedItOpen] = useState(false)
  const [approvedItReqs, setApprovedItReqs] = useState<any[]>([])
  const [approvedItLoading, setApprovedItLoading] = useState(false)
  const [issuingItReq, setIssuingItReq] = useState<string | null>(null)
  const [itIssueDialogOpen, setItIssueDialogOpen] = useState(false)
  const [selectedItReq, setSelectedItReq] = useState<any | null>(null)
  const [itIssueNotes, setItIssueNotes] = useState("")
  const [itSupplierName, setItSupplierName] = useState("")
  const [centralStock, setCentralStock] = useState<DispatchItem[]>([])
  const [stockLoading, setStockLoading] = useState(false)
  const [stockSearch, setStockSearch] = useState("")
  const [regionalHeads, setRegionalHeads] = useState<{ id: string; full_name: string; location: string; email?: string }[]>([])
  const [selectedRegionalHead, setSelectedRegionalHead] = useState<string>("")
  const [dispatchLocation, setDispatchLocation] = useState<string>("")
  const [headSearch, setHeadSearch] = useState("")
  const [headDropOpen, setHeadDropOpen] = useState(false)

  useEffect(() => {
    loadRequisitions()
  }, [])

  const loadRequisitions = async () => {
    try {
      setLoading(true)
      let query = supabase.from("store_requisitions").select("*").order("created_at", { ascending: false })

      if (user && !canSeeAllLocations(user) && user.location) {
        query = query.or(`location.eq.${user.location},location.eq.Central Stores`)
      }

      const { data, error } = await query

      if (error) {
        console.error("[v0] Error loading requisitions:", error)
        return
      }

      console.log("[v0] Loaded requisitions from Supabase:", data)

      const mappedRequisitions: Requisition[] = data.map((req: any) => ({
        id: req.id,
        requisition_number: req.requisition_number || `SIV-${String(req.id).slice(0, 8)}`,
        requested_by: req.requested_by,
        beneficiary: req.beneficiary,
        location: req.location || "Unknown",
        items: Array.isArray(req.items) ? req.items : [],
        created_at: req.created_at,
        status: req.status,
        updated_at: req.updated_at,
        issued_by: req.issued_by,
        approved_by: req.approved_by,
        notes: req.notes,
        allocated_to_location: req.allocated_to_location,
        allocation_date: req.allocation_date,
        allocated_by: req.allocated_by,
      }))

      setRequisitions(mappedRequisitions)
      setFilteredRequisitions(mappedRequisitions)
    } catch (error) {
      console.error("[v0] Error loading requisitions:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadTransactions = async () => {
    try {
      setTransactionsLoading(true)
      const response = await fetch('/api/store/all-transactions')
      if (response.ok) {
        const data = await response.json()
        setTransactions(data.transactions || [])
      }
    } catch (error) {
      console.error('[v0] Error loading transactions:', error)
    } finally {
      setTransactionsLoading(false)
    }
  }

  const handleDeleteTransaction = async () => {
    if (!selectedTransaction || !transactionDeleteReason.trim()) {
      alert('Please provide a reason for deleting this transaction')
      return
    }

    try {
      setIsDeletingTransaction(true)
      
      // Delete the transaction
      const deleteResponse = await fetch('/api/store/delete-transaction', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: selectedTransaction.id,
          itemId: selectedTransaction.item_id,
          quantity: selectedTransaction.quantity,
          location: selectedTransaction.location_name || selectedTransaction.location,
          transactionType: selectedTransaction.transaction_type,
          deletedBy: user?.email || 'unknown',
          reason: transactionDeleteReason,
          userRole: user?.role,
        }),
      })

      const data = await deleteResponse.json()

      if (!deleteResponse.ok) {
        alert(`Error: ${data.error || 'Failed to delete transaction'}`)
        return
      }

      alert('Transaction deleted and reversal created successfully')
      setTransactionDeleteDialog(false)
      setSelectedTransaction(null)
      setTransactionDeleteReason('')
      await loadTransactions()
    } catch (error) {
      console.error('[v0] Error deleting transaction:', error)
      alert('Failed to delete transaction')
    } finally {
      setIsDeletingTransaction(false)
    }
  }

  useEffect(() => {
    const filtered = requisitions.filter((req) => {
      const siv = (req.requisition_number || "").toString().toLowerCase()
      const requester = (req.requested_by || "").toString().toLowerCase()
      const term = searchTerm.toLowerCase()
      return siv.includes(term) || requester.includes(term)
    })
    setFilteredRequisitions(filtered)
    setPageByTab((prev) => ({
      ...prev,
      all: 1,
      pending: 1,
      approved: 1,
      issued: 1,
      rejected: 1,
    }))
  }, [searchTerm, requisitions])

  useEffect(() => {
    if (hasHandledAutoSync) {
      return
    }

    if (searchParams.get("syncApprovedIt") !== "1") {
      return
    }

    if (!user || !["admin", "it_store_head"].includes(user.role)) {
      return
    }

    setHasHandledAutoSync(true)
    void syncApprovedItRequisitions()
  }, [hasHandledAutoSync, searchParams, user])

  const syncApprovedItRequisitions = async () => {
    // Legacy — kept for auto-sync URL param compat
  }

  const isHeadOfficeReq = (req: any): boolean => {
    const loc = String(req.requester_location || req.location || "").toLowerCase().replace(/[\s_-]+/g, "_").trim()
    return loc === "head_office" || loc === "head_office_accra" || loc === "headoffice" || loc === "accra" || loc.startsWith("head_office") || loc === "ho"
  }

  const loadApprovedItRequisitions = async () => {
    setApprovedItLoading(true)
    try {
      const response = await fetch("/api/it-forms/requisitions?status=pending_store")
      const data = await response.json()
      setApprovedItReqs(data.requisitions || [])
    } catch (err) {
      console.error("[v0] Failed to load approved IT requisitions:", err)
    } finally {
      setApprovedItLoading(false)
    }
  }

  const openApprovedItPanel = () => {
    setApprovedItOpen(true)
    void loadApprovedItRequisitions()
  }

  const loadCentralStock = async () => {
    setStockLoading(true)
    try {
      const response = await fetch("/api/it-forms/store-issue?location=Head%20Office")
      const data = await response.json()
      setCentralStock((data.items || []).map((item: StockItem) => ({
        ...item, dispatchQty: 1, selected: false,
      })))
    } catch (err) {
      console.error("[v0] Failed to load central stock:", err)
    } finally {
      setStockLoading(false)
    }
  }

  const loadRegionalHeads = async () => {
    try {
      const res = await fetch("/api/weekly-internet-reports/regional-heads")
      const json = await res.json()
      setRegionalHeads(json.heads || [])
    } catch (err) {
      console.error("[v0] Failed to load regional IT heads:", err)
    }
  }

  const handleItIssue = (req: any) => {
    setSelectedItReq(req)
    setItIssueNotes("")
    setItSupplierName("")
    setStockSearch("")
    setSelectedRegionalHead("")
    // Pre-fill dispatch location from requester's location
    setDispatchLocation(req.requester_location || req.location || "")
    setItIssueDialogOpen(true)
    if (!isHeadOfficeReq(req)) {
      void loadCentralStock()
      void loadRegionalHeads()
    }
  }

  const toggleDispatchItem = (id: string) => {
    setCentralStock(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item))
  }

  const setDispatchQty = (id: string, qty: number) => {
    setCentralStock(prev => prev.map(item => item.id === id ? { ...item, dispatchQty: Math.max(1, Math.min(qty, item.quantity)) } : item))
  }

  const submitItIssuance = async () => {
    if (!selectedItReq || !itIssueNotes.trim() || !itSupplierName.trim()) return
    const isDispatch = !isHeadOfficeReq(selectedItReq)
    const selectedDispatchItems = centralStock.filter(i => i.selected)
    if (isDispatch && selectedDispatchItems.length === 0) {
      toast({ title: "Select items", description: "Please select at least one item to dispatch", variant: "destructive" })
      return
    }
    if (isDispatch && !selectedRegionalHead) {
      toast({ title: "Select regional IT head", description: "Please select the regional IT head to dispatch to", variant: "destructive" })
      return
    }
    setIssuingItReq(selectedItReq.id)
    const assignedHead = regionalHeads.find(h => h.id === selectedRegionalHead)
    try {
      const response = await fetch("/api/it-forms/store-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requisitionId: selectedItReq.id,
          issuedBy: user?.full_name || user?.email || "Store Head",
          userRole: user?.role || "",
          userLocation: user?.location || "",
          supplierName: itSupplierName,
          notes: itIssueNotes,
          assignedRegionalHeadId: isDispatch ? selectedRegionalHead : undefined,
          assignedRegionalHeadName: isDispatch ? assignedHead?.full_name : undefined,
          dispatchToLocation: isDispatch ? (dispatchLocation || assignedHead?.location) : undefined,
          dispatchItems: isDispatch ? selectedDispatchItems.map(i => ({
            id: i.id, name: i.name, dispatchQty: i.dispatchQty, unit: i.unit, category: i.category,
          })) : undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      toast({
        title: isDispatch ? "Dispatched to Regional Stock" : "Items Issued",
        description: isDispatch
          ? `${selectedDispatchItems.length} item type(s) dispatched to ${assignedHead?.full_name || "regional IT head"} at ${dispatchLocation || assignedHead?.location || "region"}`
          : "Items issued successfully to requester",
      })
      setItIssueDialogOpen(false)
      setSelectedItReq(null)
      setCentralStock([])
      setSelectedRegionalHead("")
      setDispatchLocation("")
      void loadApprovedItRequisitions()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setIssuingItReq(null)
    }
  }

  const handleTabChange = (value: string) => {
    const nextTab = value as RequisitionTabValue
    setActiveTab(nextTab)

    if (nextTab === "transactions") {
      loadTransactions()
    }
  }

  const handlePageChange = (tab: RequisitionTabValue, page: number) => {
    setPageByTab((prev) => ({ ...prev, [tab]: page }))
  }

  const handlePageSizeChange = (tab: RequisitionTabValue, pageSize: number) => {
    setPageSizeByTab((prev) => ({ ...prev, [tab]: pageSize }))
    setPageByTab((prev) => ({ ...prev, [tab]: 1 }))
  }

  const paginateItems = <T,>(items: T[], tab: RequisitionTabValue) => {
    const currentPage = pageByTab[tab]
    const pageSize = pageSizeByTab[tab]
    const startIndex = (currentPage - 1) * pageSize

    return items.slice(startIndex, startIndex + pageSize)
  }

  const updateRequisitionStatus = async (reqId: string, newStatus: "approved" | "rejected", approvedBy?: string) => {
    try {
      const { error } = await supabase
        .from("store_requisitions")
        .update({
          status: newStatus,
          approved_by: approvedBy,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reqId)

      if (error) {
        console.error("[v0] Error updating requisition:", error)
        toast({
          title: "Error",
          description: "Failed to update requisition status",
          variant: "destructive",
        })
        return
      }

      toast({
        title: newStatus === "approved" ? "✅ Approved" : "❌ Rejected",
        description: `Requisition has been ${newStatus} successfully`,
      })
      await loadRequisitions()
    } catch (error) {
      console.error("[v0] Error updating requisition:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  const issueRequisition = async (reqId: string, issuedBy: string) => {
    try {
      const { error } = await supabase
        .from("store_requisitions")
        .update({
          status: "issued",
          issued_by: issuedBy,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reqId)

      if (error) {
        console.error("[v0] Error issuing requisition:", error)
        toast({
          title: "Error",
          description: "Failed to issue requisition",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "📦 Items Issued",
        description: "Requisition items have been issued successfully",
      })
      await loadRequisitions()
    } catch (error) {
      console.error("[v0] Error issuing requisition:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  const allocateRequisition = async () => {
    if (!allocatingReq || !allocateLocation) return

    try {
      const response = await fetch("/api/store/allocate-requisition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requisitionId: allocatingReq.id,
          approvedBy: user?.full_name || "Admin",
          allocateToLocation: allocateLocation,
        }),
      })

      if (!response.ok) {
        console.error("[v0] Error allocating requisition")
        toast({
          title: "Error",
          description: "Failed to allocate requisition",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "🏢 Allocated",
        description: `Requisition allocated to ${allocateLocation} successfully`,
      })
      setAllocateOpen(false)
      setAllocatingReq(null)
      setAllocateLocation("")
      await loadRequisitions()
    } catch (error) {
      console.error("[v0] Error allocating requisition:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  const handleEditRequisition = (req: Requisition) => {
    setEditingReq(req)
    setEditFormData({
      beneficiary: req.beneficiary || "",
      location: req.location || "",
      notes: req.notes || "",
    })
    setEditReqOpen(true)
  }

  const shouldRequireApproval = (req: Requisition) => {
    // Roles that DON'T need approval (auto-approve)
    const noApprovalRoles = ["admin", "it_head", "it_store_head"]
    
    // Get the requester's role
    const requestedByRole = req.requested_by_role || "it_staff"
    
    // Return true if approval IS required, false if not
    return !noApprovalRoles.includes(requestedByRole)
  }

  const handleSaveRequisitionEdit = async () => {
    if (!editingReq || !user) return

    setEditError("")
    setEditLoading(true)

    try {
      const response = await fetch("/api/store/update-requisition", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requisitionId: editingReq.id,
          updates: editFormData,
          updatedBy: user.full_name || user.email,
          reason: "Requisition details updated",
          userRole: user.role,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setEditError(result.error || "Failed to update requisition")
        toast({
          title: "Error",
          description: result.error || "Failed to update requisition",
          variant: "destructive",
        })
        return
      }

      console.log("[v0] Requisition updated successfully")
      toast({
        title: "✏️ Updated",
        description: "Requisition has been updated successfully",
      })
      setEditReqOpen(false)
      setEditingReq(null)
      await loadRequisitions()
    } catch (error) {
      console.error("[v0] Error updating requisition:", error)
      setEditError("Failed to update requisition")
      toast({
        title: "Error",
        description: "Failed to update requisition",
        variant: "destructive",
      })
    } finally {
      setEditLoading(false)
    }
  }

  const handleApproveRequisition = async (requisition: Requisition, action: "approve" | "reject") => {
    // IT Store Head requisitions auto-approve without dialog
    if (action === "approve" && !approvingReq) {
      // Check if this is an IT Store Head requisition
      const isItStoreHeadRequisition = requisition.requested_by_role === "it_store_head"
      
      if (isItStoreHeadRequisition) {
        // Auto-approve IT Store Head requisitions directly
        console.log("[v0] Auto-approving IT Store Head requisition:", requisition.id)
        setIsApproving(true)
        try {
          const response = await fetch("/api/store/approve-requisition", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requisitionId: requisition.id,
              approvalAction: "approve",
              approvedQuantities: requisition.items?.reduce((acc: Record<string, number>, item: any) => {
                acc[item.item_id] = item.quantity
                return acc
              }, {}),
              approvalNotes: "Auto-approved - IT Store Head",
              approvedBy: user?.id,
              approvedByName: user?.full_name || user?.email,
              approvedByRole: user?.role,
            }),
          })

          const result = await response.json()

          if (!response.ok) {
            console.error("[v0] API error response:", result)
            toast({
              title: "Error",
              description: result.error || "Failed to approve requisition",
              variant: "destructive",
            })
            return
          }

          console.log("[v0] Requisition approved successfully")
          toast({
            title: "✅ Approved",
            description: "IT Store Head requisition approved and stock transferred successfully",
          })
          
          // Dispatch event to refresh inventory in all dashboards
          window.dispatchEvent(new CustomEvent("inventory-updated", { detail: { requisitionId: requisition.id } }))
          
          setApprovalDialogOpen(false)
          setApprovingReq(null)
          await loadRequisitions()
        } catch (error) {
          console.error("[v0] Error processing requisition:", error)
          toast({
            title: "Error",
            description: "An error occurred while processing the requisition",
            variant: "destructive",
          })
        } finally {
          setIsApproving(false)
        }
        return
      }

      // For non-IT Store Head requisitions, show approval dialog
      setApprovingReq(requisition)
      setApprovalDialogOpen(true)
      // Initialize approved quantities with requested quantities
      const initQties: Record<string, number> = {}
      if (Array.isArray(requisition.items)) {
        requisition.items.forEach((item: any) => {
          initQties[item.item_id] = item.quantity
        })
      }
      setApprovedQuantities(initQties)
      return
    }

    setIsApproving(true)
    try {
      console.log("[v0] Processing requisition:", requisition.id, "Action:", action)

      const response = await fetch("/api/store/approve-requisition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requisitionId: requisition.id,
          approvalAction: action,
          approvedQuantities: approvedQuantities, // Now pass all item quantities
          approvalNotes: approvalNotes,
          approvedBy: user.id,
          approvedByName: user.full_name || user.email,
          approvedByRole: user.role,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error("[v0] API error response:", result)
        toast({
          title: "Error",
          description: result.error || `Failed to ${action} requisition`,
          variant: "destructive",
        })
        return
      }

      console.log("[v0] Requisition", action, "successfully")
      toast({
        title: action === "approve" ? "✅ Approved" : "❌ Rejected",
        description: `Requisition ${action}ed successfully${action === "approve" ? " and stock has been transferred" : ""}`,
      })
      
      // Dispatch event to refresh inventory in all dashboards
      if (action === "approve") {
        window.dispatchEvent(new CustomEvent("inventory-updated", { detail: { requisitionId: requisition.id } }))
      }
      
      setApprovalDialogOpen(false)
      setApprovingReq(null)
      setApprovedQuantity("")
      setApprovalNotes("")
      await loadRequisitions()
    } catch (error) {
      console.error("[v0] Error processing requisition:", error)
      toast({
        title: "Error",
        description: "An error occurred while processing the requisition",
        variant: "destructive",
      })
    } finally {
      setIsApproving(false)
    }
  }

  const handleDeleteRequisition = async () => {
    if (!deletingReq) return

    setIsDeleting(true)
    try {
      const response = await fetch("/api/store/delete-requisition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requisitionId: deletingReq.id,
          updatedBy: user?.id,
          userRole: user?.role,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast({
          title: "Error",
          description: `Error deleting requisition: ${result.error}`,
          variant: "destructive",
        })
        return
      }

      toast({
        title: "🗑️ Deleted",
        description: "Requisition deleted successfully",
      })
      setDeleteConfirmOpen(false)
      setDeletingReq(null)
      await loadRequisitions()
    } catch (error) {
      console.error("[v0] Error deleting requisition:", error)
      alert("Failed to delete requisition")
    } finally {
      setIsDeleting(false)
    }
  }

  // Check if user can create requisitions (only admin and it_store_head)
  const canCreateRequisition = () => {
    if (!user?.role) return false
    const allowedRoles = ["admin", "it_store_head"]
    return allowedRoles.includes(user.role)
  }

  const getTransactionBadgeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'addition':
      case 'transfer_in':
      case 'receipt':
        return 'bg-green-100 text-green-800'
      case 'transfer_out':
      case 'issue':
      case 'reduction':
        return 'bg-red-100 text-red-800'
      case 'assignment':
        return 'bg-emerald-100 text-emerald-900'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getFilteredByStatus = (status: string) => {
    if (status === "all") return filteredRequisitions
    return filteredRequisitions.filter((req) => req.status === status)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading requisitions...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-stone-50 p-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Store Requisitions</h1>
          <p className="text-muted-foreground">Manage IT item requisitions and issuances (SIV)</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Add Stock to Central Store - Only Admin or IT Store Head */}
          {(user?.role === "admin" || user?.role === "it_store_head") && (
            <AddStockToCentralStore onStockAdded={loadRequisitions} />
          )}

          {(user?.role === "admin" || user?.role === "it_store_head") && (
            <Button
              onClick={openApprovedItPanel}
              className="border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100 border"
              variant="outline"
            >
              <Eye className="mr-2 h-4 w-4" />
              View Approved IT Requisitions
            </Button>
          )}
          
          {canCreateRequisition() ? (
            <Dialog open={newReqOpen} onOpenChange={setNewReqOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-100 hover:bg-green-200 text-green-900 border border-green-300">
                  <Plus className="mr-2 h-4 w-4 text-green-900" />
                  New Requisition
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New Store Requisition</DialogTitle>
                  <DialogDescription>Request IT items from the store inventory</DialogDescription>
                </DialogHeader>
                <NewRequisitionForm onSubmit={() => setNewReqOpen(false)} />
              </DialogContent>
            </Dialog>
          ) : (
            <div className="p-3 border border-emerald-300 bg-emerald-50 rounded-md text-emerald-800">
              <p className="text-sm font-medium">Restricted Access</p>
              <p className="text-xs">Only <strong>Admin</strong> or <strong>IT Store Head</strong> can create requisitions from Central Stores.</p>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by SIV number or requester name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="issued">Issued</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-1">
            <Zap className="h-4 w-4" />
            Transactions
          </TabsTrigger>
        </TabsList>

        {["all", "pending", "approved", "issued", "rejected"].map((status) => (
          <TabsContent key={status} value={status} className="space-y-4">
            {paginateItems(getFilteredByStatus(status), status as RequisitionTabValue).map((req) => {
              const StatusIcon = statusConfig[req.status].icon
              return (
                <Card key={req.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          {req.requisition_number}
                        </CardTitle>
                        <CardDescription>Requested by {req.requested_by}</CardDescription>
                      </div>
                      <Badge variant={statusConfig[req.status].color as any}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig[req.status].label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Requisition No</p>
                        <p className="font-medium">{req.requisition_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">SIV Number</p>
                        <p className="font-medium">{req.requisition_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Department</p>
                        <p className="font-medium">{req.location}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Request Date</p>
                        <p className="font-medium">{new Date(req.created_at).toLocaleDateString()}</p>
                      </div>
                      {req.updated_at && req.status === "issued" && (
                        <>
                          <div>
                            <p className="text-sm text-muted-foreground">Issued Date</p>
                            <p className="font-medium">{new Date(req.updated_at).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Issued By</p>
                            <p className="font-medium">{req.issued_by || "N/A"}</p>
                          </div>
                        </>
                      )}
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Items Requested</p>
                      <div className="space-y-2">
                        {req.items.length > 0 ? (
                          req.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                              <span className="font-medium">{item.itemName}</span>
                              <Badge variant="outline">
                                {item.quantity} {item.unit}
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No items listed</p>
                        )}
                      </div>
                    </div>

                    {req.allocated_to_location && (
                      <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                        <p className="text-sm font-medium text-primary mb-1">Allocated to Location</p>
                        <p className="text-sm">{req.allocated_to_location}</p>
                        {req.allocation_date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Allocated on {new Date(req.allocation_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}

                    {req.status === "approved" && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setSelectedReq(req)
                            setIssueOpen(true)
                          }}
                          className="flex-1"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Issue Items (SIV)
                        </Button>
                      </div>
                    )}

                    {(req.status === "pending" || req.status === "approved") && (
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleEditRequisition(req)}
                          className="flex-1"
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => {
                            setDeletingReq(req)
                            setDeleteConfirmOpen(true)
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    )}

                    {/* Admin can delete ANY requisition regardless of status */}
                    {user?.role === "admin" && req.status !== "pending" && req.status !== "approved" && (
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => {
                          setDeletingReq(req)
                          setDeleteConfirmOpen(true)
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    )}

                    {req.status === "pending" && (
                      <div className="flex gap-2">
                        {shouldRequireApproval(req) ? (
                          <>
                            <Dialog open={approvalDialogOpen && approvingReq?.id === req.id} onOpenChange={setApprovalDialogOpen}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="default"
                                  className="flex-1 bg-green-100 hover:bg-green-200 text-green-900 border border-green-300"
                                  onClick={() => {
                                    setApprovingReq(req)
                                    setApprovedQuantity(req.items[0]?.quantity?.toString() || "")
                                  }}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4 text-green-900" />
                                  Approve
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Approve Requisition</DialogTitle>
                                  <DialogDescription>
                                    Approve this requisition and transfer stock automatically
                                  </DialogDescription>
                                </DialogHeader>
                                {approvingReq && (
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label className="text-base font-medium">Items to Approve</Label>
                                      {Array.isArray(approvingReq.items) && approvingReq.items.length > 0 ? (
                                        approvingReq.items.map((item: any) => (
                                          <div key={item.item_id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium">{item.itemName}</p>
                                              <p className="text-xs text-muted-foreground">
                                                Requested: {item.quantity} {item.unit}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Label htmlFor={`qty-${item.item_id}`} className="text-xs">
                                                Approve:
                                              </Label>
                                              <Input
                                                id={`qty-${item.item_id}`}
                                                type="number"
                                                min="0"
                                                max={item.quantity}
                                                value={approvedQuantities[item.item_id] || 0}
                                                onChange={(e) =>
                                                  setApprovedQuantities({
                                                    ...approvedQuantities,
                                                    [item.item_id]: Number.parseInt(e.target.value) || 0,
                                                  })
                                                }
                                                className="w-20"
                                              />
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        <p className="text-sm text-muted-foreground">No items in this requisition</p>
                                      )}
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="approvalNotes">Approval Notes (Optional)</Label>
                                      <textarea
                                        id="approvalNotes"
                                        value={approvalNotes}
                                        onChange={(e) => setApprovalNotes(e.target.value)}
                                        placeholder="Add approval notes or comments..."
                                        className="w-full min-h-24 p-2 border rounded-md bg-background text-foreground"
                                      />
                                    </div>
                                  </div>
                                )}
                                <DialogFooter className="flex gap-2 pt-4">
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setApprovalDialogOpen(false)
                                      setApprovingReq(null)
                                      setApprovedQuantities({})
                                      setApprovalNotes("")
                                    }}
                                    className="flex-1"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    onClick={() => {
                                      handleApproveRequisition(approvingReq, "reject")
                                      setApprovalDialogOpen(false)
                                    }}
                                    disabled={isApproving}
                                    className="flex-1"
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    {isApproving ? "Processing..." : "Reject"}
                                  </Button>
                                  <Button
                                    variant="default"
                                    onClick={() => {
                                      handleApproveRequisition(approvingReq, "approve")
                                      setApprovalDialogOpen(false)
                                    }}
                                    disabled={isApproving}
                                    className="flex-1 bg-green-100 hover:bg-green-200 text-green-900 border border-green-300"
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4 text-green-900" />
                                    {isApproving ? "Processing..." : "Approve & Transfer"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            <Button
                              variant="destructive"
                              className="flex-1"
                              onClick={() => {
                                if (confirm("Are you sure you want to reject this requisition?")) {
                                  setApprovingReq(req)
                                  handleApproveRequisition(req, "reject")
                                }
                              }}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject
                            </Button>
                          </>
                        ) : (
                          <div className="w-full space-y-2">
                            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                              <CheckCircle className="h-5 w-5 text-emerald-800 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-emerald-900">Auto-Approved</p>
                                <p className="text-xs text-emerald-800">
                                  {req.requested_by_role === "it_head"
                                    ? "Requested by IT Head"
                                    : req.requested_by_role === "admin"
                                      ? "Requested by Admin"
                                      : "Requested by IT Store Head"}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="default"
                              className="w-full bg-green-100 hover:bg-green-200 text-green-900 border border-green-300"
                              onClick={() => {
                                setApprovingReq(req)
                                handleApproveRequisition(req, "approve")
                              }}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Process Transfer
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}

            {getFilteredByStatus(status).length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No requisitions found</h3>
                  <p className="text-muted-foreground text-center">
                    No requisitions match your current filter criteria.
                  </p>
                </CardContent>
              </Card>
            )}

            {getFilteredByStatus(status).length > 0 && (
              <DataPagination
                currentPage={pageByTab[status as RequisitionTabValue]}
                totalItems={getFilteredByStatus(status).length}
                pageSize={pageSizeByTab[status as RequisitionTabValue]}
                onPageChange={(page) => handlePageChange(status as RequisitionTabValue, page)}
                onPageSizeChange={(pageSize) => handlePageSizeChange(status as RequisitionTabValue, pageSize)}
                pageSizeOptions={[5, 10, 20, 50]}
                itemLabel="requisitions"
              />
            )}
          </TabsContent>
        ))}

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>Complete audit trail of all requisition-related transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No transactions found</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-left py-3 px-4 font-semibold">Item Name</th>
                          <th className="text-left py-3 px-4 font-semibold">Type</th>
                          <th className="text-left py-3 px-4 font-semibold">Quantity</th>
                          <th className="text-left py-3 px-4 font-semibold">Location</th>
                          <th className="text-left py-3 px-4 font-semibold">Reference Type</th>
                          <th className="text-left py-3 px-4 font-semibold">Date</th>
                          {user?.role === 'admin' && <th className="text-left py-3 px-4 font-semibold">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {paginateItems(transactions, "transactions").map((transaction) => (
                          <tr key={transaction.id} className="border-b hover:bg-slate-50">
                            <td className="py-3 px-4 font-medium">{transaction.item_name}</td>
                            <td className="py-3 px-4">
                              <Badge className={getTransactionBadgeColor(transaction.transaction_type)}>
                                {transaction.transaction_type}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">{transaction.quantity}</td>
                            <td className="py-3 px-4">
                              <Badge variant="outline">{transaction.location}</Badge>
                            </td>
                            <td className="py-3 px-4 text-slate-600 text-xs">{transaction.reference_type}</td>
                            <td className="py-3 px-4 text-slate-600">
                              {new Date(transaction.created_at).toLocaleDateString()}
                            </td>
                            {user?.role === 'admin' && (
                              <td className="py-3 px-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTransaction(transaction)
                                    setTransactionDeleteDialog(true)
                                  }}
                                  className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <DataPagination
                    currentPage={pageByTab.transactions}
                    totalItems={transactions.length}
                    pageSize={pageSizeByTab.transactions}
                    onPageChange={(page) => handlePageChange("transactions", page)}
                    onPageSizeChange={(pageSize) => handlePageSizeChange("transactions", pageSize)}
                    pageSizeOptions={[5, 10, 20, 50]}
                    itemLabel="transactions"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve & Allocate Requisition</DialogTitle>
            <DialogDescription>
              Allocate items to {allocatingReq?.requested_by} at their location. Stock will be transferred from Head
              Office to the regional inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="allocateLocation">Allocate to Location *</Label>
              <Select value={allocateLocation} onValueChange={setAllocateLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {getLocationOptions().map((location) => (
                    <SelectItem key={location.value} value={location.value}>
                      {location.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {allocatingReq && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Items to Allocate:</p>
                {allocatingReq.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-muted/50 rounded text-sm">
                    <span>{item.itemName}</span>
                    <Badge variant="outline">
                      {item.quantity} {item.unit}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAllocateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={allocateRequisition} disabled={!allocateLocation}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve & Allocate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Issue Items - {selectedReq?.requisition_number}</DialogTitle>
            <DialogDescription>Record the issuance of items to {selectedReq?.requested_by}</DialogDescription>
          </DialogHeader>
          {selectedReq && (
            <IssueItemsForm
              requisition={selectedReq}
              onSubmit={() => {
                if (selectedReq) {
                  issueRequisition(selectedReq.id, "Store Manager")
                }
                setIssueOpen(false)
                setSelectedReq(null)
              }}
              onCancel={() => {
                setIssueOpen(false)
                setSelectedReq(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editReqOpen} onOpenChange={setEditReqOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Requisition</DialogTitle>
            <DialogDescription>Update requisition details. Items cannot be modified after creation.</DialogDescription>
          </DialogHeader>
          {editError && <div className="bg-destructive/10 text-destructive px-4 py-2 rounded">{editError}</div>}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Beneficiary/User</label>
              <Input
                value={editFormData.beneficiary}
                onChange={(e) => setEditFormData({ ...editFormData, beneficiary: e.target.value })}
                placeholder="Name of person who will use the items"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <Select
                value={editFormData.location}
                onValueChange={(value) => setEditFormData({ ...editFormData, location: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getLocationOptions().map((location) => (
                    <SelectItem key={location.value} value={location.value}>
                      {location.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes / Purpose</label>
              <Input
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                placeholder="Add any notes or purpose"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setEditReqOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRequisitionEdit} disabled={editLoading}>
              {editLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Requisition</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete requisition {deletingReq?.requisition_number}? This action cannot be undone.
              {user?.role === "admin" ? " (Admin: Can delete any requisition)" : " Only pending or rejected requisitions can be deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRequisition}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transaction Delete Dialog */}
      <Dialog open={transactionDeleteDialog} onOpenChange={setTransactionDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Transaction & Create Reversal</DialogTitle>
            <DialogDescription>
              This will delete the transaction and create a reversal entry to undo the stock movement.
              <br />
              <span className="font-semibold">{selectedTransaction?.item_name}</span> - {selectedTransaction?.quantity} units
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">Reason for deletion *</Label>
              <textarea
                placeholder="Provide reason (e.g., duplicate entry, data correction, administrative error)"
                value={transactionDeleteReason}
                onChange={(e) => setTransactionDeleteReason(e.target.value)}
                className="mt-2 w-full p-2 border rounded-md text-sm"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setTransactionDeleteDialog(false)} 
              disabled={isDeletingTransaction}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTransaction}
              disabled={isDeletingTransaction || !transactionDeleteReason.trim()}
            >
              {isDeletingTransaction ? 'Deleting...' : 'Delete & Reverse'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Approved IT Requisitions Panel ─────────────────────────────────── */}
      <Dialog open={approvedItOpen} onOpenChange={setApprovedItOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Approved IT Requisitions — Ready for Issuance
            </DialogTitle>
            <DialogDescription>
              IT Head-approved requisitions awaiting store issuance. Issue directly to Head Office staff or dispatch to regional stock.
            </DialogDescription>
          </DialogHeader>

          {approvedItLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : approvedItReqs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No pending IT requisitions</p>
              <p className="text-sm">All approved IT requisitions have been issued.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {approvedItReqs.map((req: any) => {
                const isHO = isHeadOfficeReq(req)
                return (
                  <div key={req.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{req.requisition_number}</span>
                          <Badge variant={isHO ? "default" : "secondary"} className="text-xs">
                            {isHO ? "Head Office" : (req.requester_location || req.location || "Regional")}
                          </Badge>
                        </div>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Assign to: </span>
                          <span className="font-medium">{req.requested_by || "—"}</span>
                          {req.department && (
                            <span className="text-muted-foreground"> · {req.department}</span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Items: {String(req.items_required || "").substring(0, 100)}{String(req.items_required || "").length > 100 ? "…" : ""}
                        </p>
                        {(req.it_head_approved_by_name || req.it_head_approved_by) && (
                          <p className="text-xs text-muted-foreground">
                            Approved by: {req.it_head_approved_by_name || req.it_head_approved_by}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className={isHO ? "bg-green-600 hover:bg-green-700 shrink-0" : "bg-blue-600 hover:bg-blue-700 shrink-0"}
                        onClick={() => handleItIssue(req)}
                        disabled={issuingItReq === req.id}
                      >
                        {issuingItReq === req.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            {isHO ? "Issue Directly" : "Dispatch to Region"}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovedItOpen(false)}>Close</Button>
            <Button variant="outline" onClick={loadApprovedItRequisitions} disabled={approvedItLoading}>
              {approvedItLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Refresh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── IT Issue / Dispatch Confirmation Dialog ───────────────────────── */}
      <Dialog
        open={itIssueDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRegionalHead("")
            setDispatchLocation("")
            setCentralStock([])
            setStockSearch("")
            setHeadSearch("")
            setHeadDropOpen(false)
          }
          setItIssueDialogOpen(open)
        }}
      >
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
          {/* ── Hidden title for accessibility ── */}
          <DialogTitle className="sr-only">
            {selectedItReq && !isHeadOfficeReq(selectedItReq) ? "Dispatch to Regional Stock" : "Issue Directly"} — {selectedItReq?.requisition_number}
          </DialogTitle>

          {/* ── Coloured header ── */}
          <div
            className={`px-6 py-5 rounded-t-lg text-white ${
              selectedItReq && !isHeadOfficeReq(selectedItReq)
                ? "bg-gradient-to-r from-green-500 to-green-600"
                : "bg-gradient-to-r from-emerald-600 to-emerald-700"
            }`}
          >
            <div className="flex items-center gap-3">
              {selectedItReq && !isHeadOfficeReq(selectedItReq)
                ? <Package className="h-5 w-5 opacity-90" />
                : <CheckCircle2 className="h-5 w-5 opacity-90" />}
              <div>
                <h2 className="text-base font-semibold leading-tight">
                  {selectedItReq && !isHeadOfficeReq(selectedItReq)
                    ? "Dispatch to Regional Stock"
                    : "Issue Directly to Staff"}
                </h2>
                <p className="text-xs opacity-75 mt-0.5">{selectedItReq?.requisition_number}</p>
              </div>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            {selectedItReq && (
              <>
                {/* Requisition info grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border bg-muted/30 px-5 py-4 text-sm">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Requested By</p>
                    <p className="font-semibold">{selectedItReq.requested_by || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Department</p>
                    <p className="font-semibold">{selectedItReq.department || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Origin Location</p>
                    <p className="font-semibold">{selectedItReq.requester_location || selectedItReq.location || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Items Requested</p>
                    <p className="font-semibold">{selectedItReq.items_required}</p>
                  </div>
                </div>

                {/* ── REGIONAL DISPATCH ONLY ── */}
                {!isHeadOfficeReq(selectedItReq) && (
                  <>
                    {/* Step 1: Regional IT Head selector (searchable combobox) */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700 text-[11px] font-bold shrink-0">1</span>
                        Assign Regional IT Head <span className="text-red-500">*</span>
                      </Label>

                      {/* Custom searchable dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => { setHeadDropOpen((o) => !o); setHeadSearch("") }}
                          className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {selectedRegionalHead ? (
                            <span className="font-medium">
                              {regionalHeads.find((h) => h.id === selectedRegionalHead)?.full_name}
                              <span className="ml-2 text-xs text-muted-foreground font-normal">
                                · {regionalHeads.find((h) => h.id === selectedRegionalHead)?.location}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Select regional IT head to dispatch to…</span>
                          )}
                          <svg className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${headDropOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>

                        {headDropOpen && (
                          <div className="absolute z-50 mt-1 w-full rounded-xl border bg-popover shadow-lg overflow-hidden">
                            {/* Search input inside dropdown */}
                            <div className="flex items-center border-b px-3 py-2 gap-2">
                              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                              <input
                                autoFocus
                                type="text"
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                placeholder="Search by name or location…"
                                value={headSearch}
                                onChange={(e) => setHeadSearch(e.target.value)}
                              />
                              {headSearch && (
                                <button type="button" onClick={() => setHeadSearch("")} className="text-muted-foreground hover:text-foreground">
                                  <XCircle className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                            <div className="max-h-52 overflow-y-auto">
                              {regionalHeads
                                .filter((h) =>
                                  !headSearch ||
                                  h.full_name.toLowerCase().includes(headSearch.toLowerCase()) ||
                                  (h.location || "").toLowerCase().includes(headSearch.toLowerCase())
                                )
                                .length === 0 ? (
                                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                                  {regionalHeads.length === 0 ? "No regional IT heads found" : "No matches found"}
                                </div>
                              ) : (
                                regionalHeads
                                  .filter((h) =>
                                    !headSearch ||
                                    h.full_name.toLowerCase().includes(headSearch.toLowerCase()) ||
                                    (h.location || "").toLowerCase().includes(headSearch.toLowerCase())
                                  )
                                  .map((head) => (
                                    <div
                                      key={head.id}
                                      onClick={() => {
                                        setSelectedRegionalHead(head.id)
                                        if (head.location) setDispatchLocation(head.location)
                                        setHeadDropOpen(false)
                                        setHeadSearch("")
                                      }}
                                      className={`flex flex-col px-4 py-2.5 cursor-pointer transition-colors hover:bg-green-50 dark:hover:bg-green-950/20 ${
                                        selectedRegionalHead === head.id ? "bg-green-50 dark:bg-green-950/20" : ""
                                      }`}
                                    >
                                      <span className="text-sm font-medium">{head.full_name}</span>
                                      <span className="text-xs text-muted-foreground">{head.location}</span>
                                    </div>
                                  ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Auto-populated location confirmation */}
                      {selectedRegionalHead && dispatchLocation && (
                        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20 px-3 py-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          <span className="text-green-800 dark:text-green-300">
                            Dispatching to{" "}
                            <strong>{regionalHeads.find((h) => h.id === selectedRegionalHead)?.full_name}</strong>
                            {" · "}
                            <strong>{dispatchLocation}</strong>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Step 2: Stock picker */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700 text-[11px] font-bold shrink-0">2</span>
                        Select Items from Central Store <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          className="pl-9"
                          placeholder="Search items…"
                          value={stockSearch}
                          onChange={(e) => setStockSearch(e.target.value)}
                        />
                      </div>
                      {stockLoading ? (
                        <div className="flex items-center justify-center py-8 rounded-xl border bg-muted/20">
                          <Loader2 className="h-5 w-5 animate-spin mr-2 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Loading central store…</span>
                        </div>
                      ) : centralStock.length === 0 ? (
                        <div className="flex flex-col items-center py-8 rounded-xl border bg-muted/20 text-muted-foreground text-sm gap-2">
                          <Package className="h-8 w-8 opacity-30" />
                          No items available in central store.
                        </div>
                      ) : (
                        <div className="rounded-xl border divide-y overflow-hidden max-h-52 overflow-y-auto shadow-sm">
                          {centralStock
                            .filter(
                              (item) =>
                                !stockSearch ||
                                item.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
                                (item.category || "").toLowerCase().includes(stockSearch.toLowerCase())
                            )
                            .map((item) => (
                              <div
                                key={item.id}
                                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                                  item.selected ? "bg-green-50 dark:bg-green-950/20" : "hover:bg-muted/40"
                                }`}
                                onClick={() => toggleDispatchItem(item.id)}
                              >
                                <input
                                  type="checkbox"
                                  checked={item.selected}
                                  onChange={() => toggleDispatchItem(item.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-4 w-4 rounded accent-green-600 shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.category} · Available:{" "}
                                    <span className={item.quantity <= 5 ? "text-orange-600 font-semibold" : "text-emerald-600 font-semibold"}>
                                      {item.quantity} {item.unit}
                                    </span>
                                  </p>
                                </div>
                                {item.selected && (
                                  <div
                                    className="flex items-center gap-1 shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Button
                                      type="button" variant="outline" size="icon"
                                      className="h-7 w-7 rounded-lg"
                                      onClick={() => setDispatchQty(item.id, item.dispatchQty - 1)}
                                      disabled={item.dispatchQty <= 1}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={item.quantity}
                                      value={item.dispatchQty}
                                      onChange={(e) => setDispatchQty(item.id, parseInt(e.target.value) || 1)}
                                      className="h-7 w-14 text-center text-sm p-1 rounded-lg"
                                    />
                                    <Button
                                      type="button" variant="outline" size="icon"
                                      className="h-7 w-7 rounded-lg"
                                      onClick={() => setDispatchQty(item.id, item.dispatchQty + 1)}
                                      disabled={item.dispatchQty >= item.quantity}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      )}

                      {/* Dispatch summary */}
                      {centralStock.some((i) => i.selected) && (
                        <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20 px-4 py-3 text-xs space-y-1.5">
                          <p className="font-semibold text-green-800 dark:text-green-300 mb-1">Dispatch summary:</p>
                          {centralStock.filter((i) => i.selected).map((i) => (
                            <div key={i.id} className="flex justify-between text-green-700 dark:text-green-400">
                              <span>{i.name}</span>
                              <span className="font-semibold">{i.dispatchQty} {i.unit}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Supplier + Notes — numbered for dispatch, plain for direct */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="it-supplier" className="text-sm font-semibold flex items-center gap-2">
                      {!isHeadOfficeReq(selectedItReq) && (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700 text-[11px] font-bold shrink-0">3</span>
                      )}
                      Supplier Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="it-supplier"
                      placeholder="e.g. Sievert, Electromart…"
                      value={itSupplierName}
                      onChange={(e) => setItSupplierName(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="it-notes" className="text-sm font-semibold flex items-center gap-2">
                      {!isHeadOfficeReq(selectedItReq) && (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700 text-[11px] font-bold shrink-0">4</span>
                      )}
                      Issuance Notes <span className="text-red-500">*</span>
                    </Label>
                    <textarea
                      id="it-notes"
                      className="flex min-h-[84px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={
                        !isHeadOfficeReq(selectedItReq)
                          ? "Dispatch purpose, handling instructions…"
                          : "Serial numbers, quantities, collection details…"
                      }
                      value={itIssueNotes}
                      onChange={(e) => setItIssueNotes(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Item S/N will be auto-generated on confirmation.</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Footer actions ── */}
          <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-between gap-3">
            <Button variant="outline" className="w-24" onClick={() => setItIssueDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitItIssuance}
              disabled={
                !itIssueNotes.trim() ||
                !itSupplierName.trim() ||
                issuingItReq === selectedItReq?.id ||
                (selectedItReq &&
                  !isHeadOfficeReq(selectedItReq) &&
                  (!selectedRegionalHead || !centralStock.some((i) => i.selected)))
              }
              className={`flex-1 h-10 text-white ${
                selectedItReq && !isHeadOfficeReq(selectedItReq)
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {issuingItReq === selectedItReq?.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedItReq && !isHeadOfficeReq(selectedItReq)
                ? `Dispatch to ${dispatchLocation || "Regional Stock"}`
                : "Confirm Issuance"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
