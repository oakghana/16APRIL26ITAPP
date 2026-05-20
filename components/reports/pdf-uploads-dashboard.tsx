"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  FileText,
  Upload,
  Download,
  Eye,
  CheckCircle,
  Clock,
  Users,
  Filter,
  Loader2,
  Trash2,
  MessageSquare,
  FileCheck,
  Printer,
  BarChart3,
  Info,
  ExternalLink,
  Pencil,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { LOCATIONS } from "@/lib/locations"
import { getCanonicalLocationName, locationsMatch } from "@/lib/location-filter"
import { format, subDays, subMonths, subYears } from "date-fns"
import { toast } from "sonner"
import { DocumentActivityHistory } from "./document-activity-history"
import { DeletionHistoryAdmin } from "@/components/admin/deletion-history"

interface PDFUpload {
  id: string
  title: string
  description: string
  document_type: "toner" | "quarterly_report" | "information"
  file_name: string
  file_url: string
  file_size: number
  uploaded_by: string
  uploaded_by_name: string
  target_location: string | null
  is_active: boolean
  is_confirmed: boolean
  created_at: string
  confirmations: PDFConfirmation[]
}

interface PDFConfirmation {
  id: string
  user_id: string
  user_name: string
  user_location: string
  confirmed_at: string
  comments: string
}

const documentTypeLabels = {
  toner: "Toner Report",
  quarterly_report: "Quarterly Report",
  information: "Information",
}

const documentTypeIcons = {
  toner: Printer,
  quarterly_report: BarChart3,
  information: Info,
}

const documentTypeColors = {
  toner: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  quarterly_report: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  information: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
}

export function PDFUploadsDashboard() {
  const { user } = useAuth()
  const [uploads, setUploads] = useState<PDFUpload[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedType, setSelectedType] = useState("all")
  const [selectedLocation, setSelectedLocation] = useState("all")
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "quarter" | "year">("month")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showConfirmationsDialog, setShowConfirmationsDialog] = useState(false)
  const [selectedUpload, setSelectedUpload] = useState<PDFUpload | null>(null)
  const [confirmComment, setConfirmComment] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [showAdminConfirmDialog, setShowAdminConfirmDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    documentType: "information" as "toner" | "quarterly_report" | "information",
    targetLocation: "all",
    file: null as File | null,
  })
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    documentType: "information" as "toner" | "quarterly_report" | "information",
    targetLocation: "all",
  })

  // All IT staff roles can see all documents and download them
  const itStaffRoles = [
    "admin",
    "it_head",
    "regional_it_head",
    "it_staff",
    "it_store_head",
    "service_desk_head",
    "service_desk_accra",
    "service_desk_kumasi",
    "service_desk_takoradi",
    "service_desk_tema",
    "service_desk_sunyani",
    "service_desk_cape_coast",
  ]
  const isITStaff = user && itStaffRoles.includes(user.role)
  const canUpload = user && (
    ["admin", "it_head", "regional_it_head"].includes(user.role) ||
    user.role === "it_staff"  // Allow all IT staff to upload from any location
  )
  const canEdit = user && ["admin", "it_head"].includes(user.role)
  const canDelete = user && ["admin", "it_head"].includes(user.role)
  const canConfirmUploads = user && user.role === "admin"
  const isLocationRestrictedUser = !!user && !isITStaff

  useEffect(() => {
    if (!user) return

    // All IT staff can view all locations
    if (isITStaff) {
      setSelectedLocation("all")
      setUploadForm((current) => ({ ...current, targetLocation: current.targetLocation || "all" }))
    } else if (user.location) {
      setSelectedLocation(user.location)
      setUploadForm((current) => ({ ...current, targetLocation: user.location }))
    }
  }, [user, isITStaff])

  useEffect(() => {
    fetchUploads()
  }, [selectedType, selectedLocation, user])

  const fetchUploads = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      
      // Add type filter if selected
      if (selectedType !== "all") params.append("type", selectedType)
      
      // Always send user role, ID, and location for server-side access control
      if (user?.role) {
        params.append("userRole", user.role)
      }
      if (user?.id) {
        params.append("userId", user.id)
      }
      if (user?.location) {
        params.append("userLocation", user.location)
      }
      
      // All IT staff can view all documents - apply location filter only if explicitly selected
      if (isITStaff) {
        if (selectedLocation !== "all") {
          params.append("location", selectedLocation)
        }
      } else if (user && user.location) {
        // Non-IT staff are restricted to their own location
        params.append("location", user.location)
      }

      console.log("[v0] Fetching documents with params:", params.toString(), "user role:", user?.role, "location:", user?.location)
      const response = await fetch(`/api/pdf-uploads?${params.toString()}`)
      const data = await response.json()

      console.log("[v0] Documents fetched:", data)
      if (data.success) {
        setUploads(data.uploads || [])
      } else {
        toast.error(data.error || "Failed to fetch uploads")
      }
    } catch (error) {
      console.error("[v0] Error fetching uploads:", error)
      toast.error("Failed to fetch uploads")
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.title || !user) {
      toast.error("Please fill in all required fields")
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", uploadForm.file)
      formData.append("title", uploadForm.title)
      formData.append("description", uploadForm.description)
      formData.append("documentType", uploadForm.documentType)
      formData.append("targetLocation", uploadForm.targetLocation)
      formData.append("uploadedBy", user.id)
      formData.append("uploadedByName", user.full_name || user.name || user.username)
      formData.append("userRole", user.role)
      formData.append("userLocation", user.location || "")

      const response = await fetch("/api/pdf-uploads", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        toast.success("✓ Document uploaded successfully! It&apos;s now visible to all IT staff.", {
          description: `"${uploadForm.title}" is ready for download.`,
        })
        setShowUploadDialog(false)
        setUploadForm({
          title: "",
          description: "",
          documentType: "information",
          targetLocation: isLocationRestrictedUser ? user?.location || "all" : "all",
          file: null,
        })
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
        fetchUploads()
      } else {
        toast.error(data.error || "Failed to upload document")
      }
    } catch (error) {
      console.error("Error uploading:", error)
      toast.error("Failed to upload document. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  const openEditDialog = (upload: PDFUpload) => {
    setSelectedUpload(upload)
    setEditForm({
      title: upload.title,
      description: upload.description || "",
      documentType: upload.document_type,
      targetLocation: upload.target_location || "all",
    })
    setShowEditDialog(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedUpload || !user) return

    setSavingEdit(true)
    try {
      const response = await fetch("/api/pdf-uploads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedUpload.id,
          title: editForm.title,
          description: editForm.description,
          documentType: editForm.documentType,
          targetLocation: editForm.targetLocation,
          userRole: user.role,
          userLocation: user.location,
          userId: user.id,
          userName: user.full_name || user.name || user.username,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success("Document updated successfully")
        setShowEditDialog(false)
        setSelectedUpload(null)
        fetchUploads()
      } else {
        toast.error(data.error || "Failed to update document")
      }
    } catch (error) {
      console.error("Error updating document:", error)
      toast.error("Failed to update document")
    } finally {
      setSavingEdit(false)
    }
  }

  const handleConfirm = async () => {
    if (!selectedUpload || !user) return

    setConfirming(true)
    try {
      const response = await fetch("/api/pdf-uploads/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfId: selectedUpload.id,
          userId: user.id,
          userName: user.full_name || user.name || user.username,
          userLocation: user.location,
          comments: confirmComment,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success("Document confirmed successfully")
        setShowConfirmDialog(false)
        setConfirmComment("")
        setSelectedUpload(null)
        fetchUploads()
      } else {
        toast.error(data.error || "Failed to confirm document")
      }
    } catch (error) {
      console.error("Error confirming:", error)
      toast.error("Failed to confirm document")
    } finally {
      setConfirming(false)
    }
  }

  const handleAdminConfirmUpload = async () => {
    if (!selectedUpload || !user || user.role !== "admin") return

    setConfirming(true)
    try {
      const response = await fetch("/api/pdf-uploads/admin-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfId: selectedUpload.id,
          adminId: user.id,
          adminName: user.full_name || user.name || user.username,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success("Upload confirmed and is now visible to all users")
        setShowAdminConfirmDialog(false)
        setSelectedUpload(null)
        fetchUploads()
      } else {
        toast.error(data.error || "Failed to confirm upload")
      }
    } catch (error) {
      console.error("Error confirming upload:", error)
      toast.error("Failed to confirm upload")
    } finally {
      setConfirming(false)
    }
  }

  const handleDelete = async (uploadId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return

    try {
      const params = new URLSearchParams()
      params.append("id", uploadId)
      if (user?.id) {
        params.append("userId", user.id)
      }
      if (user?.full_name || user?.name || user?.username) {
        params.append("userName", user.full_name || user.name || user.username)
      }

      const response = await fetch(`/api/pdf-uploads?${params.toString()}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (data.success) {
        toast.success("Document deleted successfully")
        fetchUploads()
      } else {
        toast.error(data.error || "Failed to delete document")
      }
    } catch (error) {
      console.error("Error deleting:", error)
      toast.error("Failed to delete document")
    }
  }

  const hasUserConfirmed = (upload: PDFUpload) => {
    return upload.confirmations?.some((c) => c.user_id === user?.id)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const filteredUploads = uploads.filter((upload) => {
    const matchesType = selectedType === "all" || upload.document_type === selectedType
    if (!matchesType) return false

    const matchesSelectedLocation =
      selectedLocation === "all" ||
      !upload.target_location ||
      locationsMatch(upload.target_location, selectedLocation)

    if (!matchesSelectedLocation) return false

    const canSeeAllDocuments = isITStaff
    if (canSeeAllDocuments) {
      // IT staff always see all documents
      console.log("[v0] IT staff viewing document:", upload.id, upload.title)
      return true
    }

    const matchesUserLocation =
      !upload.target_location ||
      locationsMatch(upload.target_location, user?.location || selectedLocation)

    if (!matchesUserLocation) return false

    const isPublished = upload.is_confirmed || (upload.confirmations?.length || 0) > 0
    const isOwnUpload = upload.uploaded_by === user?.id
    const isLocationSpecificDocument = Boolean(upload.target_location)

    // Always show own uploads immediately
    if (isOwnUpload) {
      console.log("[v0] Showing own upload:", upload.id)
      return true
    }

    if (isLocationSpecificDocument) {
      console.log("[v0] Location-specific document visible:", upload.id)
      return true
    }

    console.log("[v0] Filter decision for", upload.id, "- Published:", isPublished, "- Own:", isOwnUpload, "- Show:", isPublished || isOwnUpload)
    return isPublished || isOwnUpload
  })

  // Apply period filter (week, month, quarter, year)
  const periodFilteredUploads = filteredUploads.filter((upload) => {
    if (!upload.created_at) return false
    const created = new Date(upload.created_at)
    const now = new Date()
    if (selectedPeriod === "week") {
      return created >= subDays(now, 7)
    }
    if (selectedPeriod === "month") {
      return created >= subMonths(now, 1)
    }
    if (selectedPeriod === "quarter") {
      return created >= subMonths(now, 3)
    }
    if (selectedPeriod === "year") {
      return created >= subYears(now, 1)
    }
    return true
  })

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedType, selectedLocation, selectedPeriod])

  const totalPages = Math.max(1, Math.ceil(periodFilteredUploads.length / itemsPerPage))
  const paginatedUploads = periodFilteredUploads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const stats = {
    total: filteredUploads.length,
    toner: filteredUploads.filter((u) => u.document_type === "toner").length,
    quarterly: filteredUploads.filter((u) => u.document_type === "quarterly_report").length,
    information: filteredUploads.filter((u) => u.document_type === "information").length,
    unconfirmed: filteredUploads.filter((u) => !hasUserConfirmed(u)).length,
  }

  return (
    <div className="space-y-6">
      {/* Header with Location Info for Regional Staff */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            IT Documents & Reports
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isITStaff
              ? "View and manage uploaded IT documents across all locations"
              : `View documents available for ${getCanonicalLocationName(user?.location || "your location")}`}
          </p>
        </div>
        {canUpload && (
          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Upload New Document</DialogTitle>
                <DialogDescription>
                  Upload a PDF document for IT staff to view and confirm.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                    placeholder="Enter document title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                    placeholder="Enter document description"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Document Type *</Label>
                    <Select
                      value={uploadForm.documentType}
                      onValueChange={(value) =>
                        setUploadForm({
                          ...uploadForm,
                          documentType: value as "toner" | "quarterly_report" | "information",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="toner">Toner Report</SelectItem>
                        <SelectItem value="quarterly_report">Quarterly Report</SelectItem>
                        <SelectItem value="information">Information</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Location</Label>
                    <Select
                      value={uploadForm.targetLocation}
                      onValueChange={(value) =>
                        setUploadForm({ ...uploadForm, targetLocation: value })
                      }
                      disabled={isLocationRestrictedUser}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {!isLocationRestrictedUser && <SelectItem value="all">All Locations</SelectItem>}
                        {isLocationRestrictedUser && user?.location ? (
                          <SelectItem value={user.location}>{getCanonicalLocationName(user.location)}</SelectItem>
                        ) : (
                          Object.entries(LOCATIONS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>PDF File *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          if (file.type !== "application/pdf") {
                            toast.error("Please select a PDF file")
                            return
                          }
                          setUploadForm({ ...uploadForm, file })
                        }
                      }}
                      className="flex-1"
                    />
                  </div>
                  {uploadForm.file && (
                    <p className="text-sm text-gray-500">
                      Selected: {uploadForm.file.name} ({formatFileSize(uploadForm.file.size)})
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          )}
        {!canUpload && user?.role === "it_staff" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <p>You don't have permission to upload documents in this location.</p>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Documents</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Toner Reports</p>
                <p className="text-2xl font-bold text-blue-600">{stats.toner}</p>
              </div>
              <Printer className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Quarterly Reports</p>
                <p className="text-2xl font-bold text-purple-600">{stats.quarterly}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Information</p>
                <p className="text-2xl font-bold text-green-600">{stats.information}</p>
              </div>
              <Info className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Confirmation</p>
                <p className="text-2xl font-bold text-orange-600">{stats.unconfirmed}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Document Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="toner">Toner Reports</SelectItem>
                <SelectItem value="quarterly_report">Quarterly Reports</SelectItem>
                <SelectItem value="information">Information</SelectItem>
              </SelectContent>
            </Select>
            {isITStaff && (
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {Object.entries(LOCATIONS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!isITStaff && (
              <div className="px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-800">
                {`You can view documents for ${getCanonicalLocationName(user?.location || "your location")} only.`}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            Double-click a document row to open it, or use the actions to download, edit, or confirm it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Tabs value={selectedPeriod} onValueChange={(v: any) => setSelectedPeriod(v)}>
              <TabsList>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="quarter">Quarter</TabsTrigger>
                <TabsTrigger value="year">Year</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="text-sm text-gray-600">Showing <span className="font-medium">{periodFilteredUploads.length}</span> items • Page <span className="font-medium">{currentPage}</span> of {totalPages}</div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredUploads.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No documents found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Target Location</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Confirmations</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUploads.map((upload) => {
                    const Icon = documentTypeIcons[upload.document_type]
                    const confirmed = hasUserConfirmed(upload)
                    return (
                      <TableRow
                        key={upload.id}
                        className="cursor-pointer"
                        onDoubleClick={() => window.open(upload.file_url, "_blank", "noopener,noreferrer")}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                              <FileText className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                              <p className="font-medium">{upload.title}</p>
                              <p className="text-sm text-gray-500">{upload.file_name}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={documentTypeColors[upload.document_type]}>
                            <Icon className="h-3 w-3 mr-1" />
                            {documentTypeLabels[upload.document_type]}
                          </Badge>
                        </TableCell>
                        <TableCell>{upload.uploaded_by_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {upload.target_location ? (
                              <>
                                <span className="px-2 py-1 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 rounded">
                                  {LOCATIONS[upload.target_location as keyof typeof LOCATIONS] || upload.target_location}
                                </span>
                                {locationsMatch(user?.location, upload.target_location) && (
                                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" title="This document is for your location">
                                    ✓ Your Location
                                  </Badge>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-500 italic">All Locations</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(upload.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setSelectedUpload(upload)
                              setShowConfirmationsDialog(true)
                            }}
                          >
                            <Users className="h-4 w-4" />
                            {upload.confirmations?.length || 0}
                          </Button>
                        </TableCell>
                        <TableCell>
                          {upload.is_confirmed ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Published
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending Admin Approval
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(upload.file_url, "_blank")}
                              title="View PDF"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(upload)}
                                title="Edit document"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const link = document.createElement("a")
                                link.href = upload.file_url
                                link.download = upload.file_name
                                link.click()
                              }}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {!confirmed && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 bg-transparent"
                                onClick={() => {
                                  setSelectedUpload(upload)
                                  setShowConfirmDialog(true)
                                }}
                              >
                                <FileCheck className="h-4 w-4" />
                                Confirm
                              </Button>
                            )}
                            {canConfirmUploads && !upload.is_confirmed && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 bg-green-50 text-green-700 border-green-300 hover:bg-green-100 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                                onClick={() => {
                                  setSelectedUpload(upload)
                                  setShowAdminConfirmDialog(true)
                                }}
                                title="Approve this upload to make it visible to all users"
                              >
                                <CheckCircle className="h-4 w-4" />
                                Approve
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDelete(upload.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {/* Pagination controls */}
          {periodFilteredUploads.length > itemsPerPage && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, periodFilteredUploads.length)} of {periodFilteredUploads.length}</div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  Prev
                </Button>
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <Button key={i} variant={currentPage === i + 1 ? undefined : "ghost"} size="sm" onClick={() => setCurrentPage(i + 1)}>
                      {i + 1}
                    </Button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deletion History for Admin Users */}
      {canDelete && <DeletionHistoryAdmin />}

      {/* Selected Document Activity History */}
      {selectedUpload && <DocumentActivityHistory documentId={selectedUpload.id} />}

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>
              Update the document details and target location.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm((current) => ({ ...current, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm((current) => ({ ...current, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select
                  value={editForm.documentType}
                  onValueChange={(value) =>
                    setEditForm((current) => ({
                      ...current,
                      documentType: value as "toner" | "quarterly_report" | "information",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="toner">Toner Report</SelectItem>
                    <SelectItem value="quarterly_report">Quarterly Report</SelectItem>
                    <SelectItem value="information">Information</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Location</Label>
                <Select
                  value={editForm.targetLocation}
                  onValueChange={(value) => setEditForm((current) => ({ ...current, targetLocation: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {Object.entries(LOCATIONS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit || !editForm.title.trim()}>
              {savingEdit ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Document Review</DialogTitle>
            <DialogDescription>
              Confirm that you have reviewed and understood this document.
            </DialogDescription>
          </DialogHeader>
          {selectedUpload && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-medium">{selectedUpload.title}</p>
                <p className="text-sm text-gray-500">{selectedUpload.description}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="comment">Add a comment (optional)</Label>
                <Textarea
                  id="comment"
                  value={confirmComment}
                  onChange={(e) => setConfirmComment(e.target.value)}
                  placeholder="Any notes or feedback about this document..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={confirming}>
              {confirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirm Review
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmations List Dialog */}
      <Dialog open={showConfirmationsDialog} onOpenChange={setShowConfirmationsDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Document Confirmations</DialogTitle>
            <DialogDescription>
              {selectedUpload?.title} - Staff who have confirmed this document
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {selectedUpload?.confirmations?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No confirmations yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedUpload?.confirmations?.map((conf) => (
                  <div
                    key={conf.id}
                    className="p-3 border rounded-lg flex items-start justify-between"
                  >
                    <div>
                      <p className="font-medium">{conf.user_name}</p>
                      <p className="text-sm text-gray-500">{conf.user_location}</p>
                      {conf.comments && (
                        <p className="text-sm mt-1 text-gray-600 dark:text-gray-400">
                          <MessageSquare className="h-3 w-3 inline mr-1" />
                          {conf.comments}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Confirmed
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(new Date(conf.confirmed_at), "MMM d, yyyy h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmationsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Upload Approval Dialog */}
      <Dialog open={showAdminConfirmDialog} onOpenChange={setShowAdminConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Upload</DialogTitle>
            <DialogDescription>
              Confirm this upload and make it visible to all users across the organization.
            </DialogDescription>
          </DialogHeader>
          {selectedUpload && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm">
                  <strong>Note:</strong> Once approved, this document will be visible to all users (IT Staff, Regional IT Heads, etc.). Make sure the content is appropriate before approving.
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Title</p>
                  <p className="font-medium">{selectedUpload.title}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Document Type</p>
                  <Badge className={documentTypeColors[selectedUpload.document_type]}>
                    {documentTypeLabels[selectedUpload.document_type]}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Uploaded By</p>
                  <p>{selectedUpload.uploaded_by_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Target Location</p>
                  <p>
                    {selectedUpload.target_location
                      ? LOCATIONS[selectedUpload.target_location as keyof typeof LOCATIONS] || selectedUpload.target_location
                      : "All Locations"}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdminConfirmDialog(false)} disabled={confirming}>
              Cancel
            </Button>
            <Button onClick={handleAdminConfirmUpload} disabled={confirming} className="bg-green-600 hover:bg-green-700">
              {confirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
