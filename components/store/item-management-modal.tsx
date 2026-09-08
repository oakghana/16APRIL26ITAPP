"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Trash2, Merge, Edit, AlertTriangle, CheckCircle } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

interface StockItem {
  id: string
  name: string
  sku: string
  quantity: number
  category: string
  location: string
}

interface ItemManagementModalProps {
  item: StockItem | null
  duplicateItems: StockItem[]
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialTab?: ItemManagementTab
}

type ItemManagementTab = "edit" | "merge" | "delete"

export function ItemManagementModal({
  item,
  duplicateItems,
  isOpen,
  onClose,
  onSuccess,
  initialTab = "edit",
}: ItemManagementModalProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<ItemManagementTab>(initialTab)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showForceDeleteConfirm, setShowForceDeleteConfirm] = useState(false)
  const [deleteReason, setDeleteReason] = useState("")
  const [editedName, setEditedName] = useState(item?.name || "")
  const [editedQuantity, setEditedQuantity] = useState(item?.quantity?.toString() || "0")
  const [selectedMergeTarget, setSelectedMergeTarget] = useState<string | null>(null)
  const [mergeReason, setMergeReason] = useState("")
  const [mergeSearch, setMergeSearch] = useState("")
  const [deleteBlockers, setDeleteBlockers] = useState<string[] | null>(null)

  const isAdmin = user?.role === "admin"

  // Re-seed the form whenever the modal is opened for a (different) item.
  useEffect(() => {
    if (!isOpen || !item) return
    setActiveTab(initialTab)
    setEditedName(item.name || "")
    setEditedQuantity(item.quantity?.toString() || "0")
    setSelectedMergeTarget(null)
    setMergeReason("")
    setMergeSearch("")
    setDeleteReason("")
    setDeleteBlockers(null)
  }, [isOpen, item?.id, initialTab])

  const mergeCandidates = useMemo(() => {
    const others = duplicateItems.filter((candidate) => candidate.id && candidate.id !== item?.id)
    const query = mergeSearch.trim().toLowerCase()
    const filtered = query
      ? others.filter(
          (candidate) =>
            candidate.name?.toLowerCase().includes(query) ||
            candidate.sku?.toLowerCase().includes(query) ||
            candidate.location?.toLowerCase().includes(query),
        )
      : others

    // Surface same-name duplicates first — they are the usual merge target.
    const exactName = item?.name?.toLowerCase()
    return [...filtered].sort((a, b) => {
      const aExact = a.name?.toLowerCase() === exactName ? 0 : 1
      const bExact = b.name?.toLowerCase() === exactName ? 0 : 1
      return aExact - bExact || (a.name || "").localeCompare(b.name || "")
    })
  }, [duplicateItems, item?.id, item?.name, mergeSearch])

  if (!item) return null

  const handleEdit = async () => {
    if (!editedName.trim()) {
      toast({ title: "Error", description: "Item name cannot be empty", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/store/update-item", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          updates: {
            name: editedName,
            quantity: parseInt(editedQuantity) || 0,
          },
          updatedBy: user?.id,
          reason: "Admin item management - edit",
          userRole: user?.role,
          userLocation: user?.location,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to update item")
      }

      toast({
        title: "Success",
        description: `Updated "${editedName}" successfully`,
      })

      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleMerge = async () => {
    if (!selectedMergeTarget) {
      toast({ title: "Error", description: "Please select an item to merge into", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/store/merge-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceItemId: item.id,
          targetItemId: selectedMergeTarget,
          mergeReason: mergeReason || "Duplicate consolidation",
          userRole: user?.role,
          userLocation: user?.location,
          userId: user?.id,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to merge items")
      }

      toast({
        title: "Success",
        description: result.message,
      })

      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteReason.trim()) {
      toast({ title: "Error", description: "Please provide a reason for deletion", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/store/delete-item", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          deletedBy: user?.id,
          reason: deleteReason,
          userRole: user?.role,
          userLocation: user?.location,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          setDeleteBlockers(result.blockers?.length ? result.blockers : [result.reason || "Item is still in use."])
          toast({
            title: "Cannot delete this item",
            description: result.reason || "The item is still linked to other records.",
            variant: "destructive",
          })
          return
        }
        throw new Error(result.error || "Failed to delete item")
      }

      setDeleteBlockers(null)
      toast({
        title: "Success",
        description: `Deleted "${item.name}" successfully`,
      })

      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  // Admin-only override: removes the item together with its linked stock records.
  const handleForceDelete = async () => {
    if (!deleteReason.trim()) {
      toast({ title: "Error", description: "Please provide a reason for deletion", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/store/force-delete-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          deletedBy: user?.id,
          reason: deleteReason,
          userRole: user?.role,
          userLocation: user?.location,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to force delete item")
      }

      toast({
        title: "Item removed",
        description: result.message || `Deleted "${item.name}" and all linked stock records`,
      })

      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setShowForceDeleteConfirm(false)
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Store Item</DialogTitle>
            <DialogDescription asChild>
              <div className="mt-2 space-y-1">
                <div>
                  <strong>Item:</strong> {item.name}
                </div>
                <div>
                  <strong>SKU:</strong> {item.sku}
                </div>
                <div>
                  <strong>Current Stock:</strong> {item.quantity} units
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="edit">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </TabsTrigger>
              <TabsTrigger value="merge">
                <Merge className="h-4 w-4 mr-2" />
                Merge
              </TabsTrigger>
              <TabsTrigger value="delete">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </TabsTrigger>
            </TabsList>

            {/* Edit Tab */}
            <TabsContent value="edit" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="item-name">Item Name</Label>
                <Input
                  id="item-name"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Enter item name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-quantity">Quantity</Label>
                <Input
                  id="item-quantity"
                  type="number"
                  value={editedQuantity}
                  onChange={(e) => setEditedQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  min="0"
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                <p className="font-semibold mb-1">ℹ Edit Tip</p>
                <p>Update the item name or quantity. All changes are logged for audit purposes.</p>
              </div>
            </TabsContent>

            {/* Merge Tab */}
            <TabsContent value="merge" className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                <p className="font-semibold mb-1">⚠ Merge Warning</p>
                <p>
                  <strong>{item.name}</strong> will be combined into the item you select: quantities are added
                  together and all of its stock history moves to the target. This item is then removed.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="merge-search">Search for the item to merge into</Label>
                <Input
                  id="merge-search"
                  value={mergeSearch}
                  onChange={(e) => setMergeSearch(e.target.value)}
                  placeholder="Search by name, SKU or location..."
                />
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {mergeCandidates.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    {duplicateItems.length === 0
                      ? "No other stock items are available to merge into."
                      : "No items match your search."}
                  </p>
                ) : (
                  mergeCandidates.map((dup) => (
                    <div
                      key={dup.id}
                      className={`p-3 border rounded cursor-pointer transition-colors ${
                        selectedMergeTarget === dup.id
                          ? "bg-blue-50 border-blue-500 ring-2 ring-blue-200"
                          : "border-gray-300 hover:border-blue-300"
                      }`}
                      onClick={() => setSelectedMergeTarget(dup.id)}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          checked={selectedMergeTarget === dup.id}
                          onChange={() => setSelectedMergeTarget(dup.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <p className="font-semibold">
                            {dup.name}
                            {dup.name?.toLowerCase() === item.name?.toLowerCase() && (
                              <span className="ml-2 text-xs font-normal text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                                same name
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-600">
                            SKU: {dup.sku} • Stock: {dup.quantity} units • Location: {dup.location}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="merge-reason">Merge Reason</Label>
                <Textarea
                  id="merge-reason"
                  value={mergeReason}
                  onChange={(e) => setMergeReason(e.target.value)}
                  placeholder="e.g., Duplicate entry, consolidating similar items..."
                  className="min-h-20"
                />
              </div>
            </TabsContent>

            {/* Delete Tab */}
            <TabsContent value="delete" className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 mb-4">
                <div className="flex gap-2 items-start">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Deletion Warning</p>
                    <p>This action is permanent and cannot be undone. The item will be removed from all locations.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delete-reason">Reason for Deletion</Label>
                <Textarea
                  id="delete-reason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g., Item no longer in use, incorrect entry, damaged beyond repair..."
                  className="min-h-20"
                />
              </div>

              {deleteBlockers && (
                <div className="bg-amber-50 border border-amber-300 rounded p-3 text-sm text-amber-900 space-y-2">
                  <p className="font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    This item is still linked to other records
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {deleteBlockers.map((blocker, index) => (
                      <li key={index}>{blocker}</li>
                    ))}
                  </ul>
                  {isAdmin ? (
                    <p>
                      As an Admin you can remove the item together with those linked records using{" "}
                      <strong>Force Delete</strong> below. This cannot be undone.
                    </p>
                  ) : (
                    <p>Ask an Admin to remove this item, or clear the linked records first.</p>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {activeTab === "edit" && (
              <Button onClick={handleEdit} disabled={loading}>
                {loading ? "Updating..." : "Update Item"}
              </Button>
            )}
            {activeTab === "merge" && (
              <Button onClick={handleMerge} disabled={loading || !selectedMergeTarget} variant="secondary">
                {loading ? "Merging..." : "Merge Items"}
              </Button>
            )}
            {activeTab === "delete" && (
              <>
                {deleteBlockers && isAdmin && (
                  <Button
                    onClick={() => setShowForceDeleteConfirm(true)}
                    disabled={loading || !deleteReason.trim()}
                    variant="destructive"
                  >
                    Force Delete
                  </Button>
                )}
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={loading || !deleteReason.trim()}
                  variant={deleteBlockers && isAdmin ? "outline" : "destructive"}
                >
                  Delete Item
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{item.name}"</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Force Delete Confirmation Dialog (Admin only) */}
      <AlertDialog open={showForceDeleteConfirm} onOpenChange={setShowForceDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Force delete "{item.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the item along with its transfer requests, transactions, assignments and stock
              audit entries. The action is recorded in the audit log and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleForceDelete} className="bg-red-600 hover:bg-red-700">
              {loading ? "Deleting..." : "Force Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
