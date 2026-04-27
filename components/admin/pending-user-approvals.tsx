"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Search,
  MoreHorizontal,
  User,
  MapPin,
  Mail,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  UserCheck,
  UserX,
  AlertTriangle,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { FormNavigation } from "@/components/ui/form-navigation"
import { DataPagination } from "@/components/ui/data-pagination"
import { getRoleColorScheme } from "@/lib/role-colors"
import { cn } from "@/lib/utils"
import type { PendingUser } from "../auth/create-user-form"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface SystemUser {
  id: string
  name: string
  email: string
  phone: string
  role:
    | "admin"
    | "it_head"
    | "regional_it_head" // Added regional_it_head role
    | "it_staff"
    | "it_store_head"
    | "service_desk_head"
    | "service_desk_staff"
    | "service_provider"
    | "user"
  location: "head_office" | "accra" | "kumasi" | "kaase_inland_port" | "cape_coast"
  status: "active" | "inactive" | "suspended"
  lastLogin: string
  createdDate: string
  deviceCount: number
  isApproved: boolean
}

const departmentNames = {
  ITD: "ITD",
  Marketing: "Marketing",
  AUDIT: "AUDIT",
  ACCOUNTS: "ACCOUNTS",
  RESEARCH: "RESEARCH",
  ESTATE: "ESTATE",
  SECURITY: "SECURITY",
  OPERATIONS: "OPERATIONS",
  PROCUREMENT: "PROCUREMENT",
  HR: "HR",
}

const locationNames = {
  head_office: "Head Office",
  accra: "Accra",
  kumasi: "Kumasi",
  kaase_inland_port: "Kaase Inland Port",
  cape_coast: "Swedru/CR",
}

const statusColors = {
  pending: {
    bg: "bg-yellow-50 dark:bg-yellow-950",
    text: "text-yellow-800 dark:text-yellow-200",
    border: "border-yellow-200 dark:border-yellow-800",
  },
  approved: {
    bg: "bg-green-50 dark:bg-green-950",
    text: "text-green-800 dark:text-green-200",
    border: "border-green-200 dark:border-green-800",
  },
  rejected: {
    bg: "bg-red-50 dark:bg-red-950",
    text: "text-red-800 dark:text-red-200",
    border: "border-red-200 dark:border-red-800",
  },
}

interface ApprovalDialogProps {
  user: PendingUser
  isOpen: boolean
  onClose: () => void
  onApprove: (userId: string, role: string, notes: string) => void
  onReject: (userId: string, reason: string) => void
}

function ApprovalDialog({ user, isOpen, onClose, onApprove, onReject }: ApprovalDialogProps) {
  const { user: currentUser } = useAuth()
  const roleColors = currentUser?.role ? getRoleColorScheme(currentUser.role) : null
  const [selectedRole, setSelectedRole] = useState<string>("user")
  const [notes, setNotes] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [action, setAction] = useState<"approve" | "reject" | null>(null)

  const handleApproval = () => {
    if (selectedRole && notes.trim()) {
      onApprove(user.id, selectedRole, notes)
      onClose()
    }
  }

  const handleRejection = () => {
    if (rejectionReason.trim()) {
      onReject(user.id, rejectionReason)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <UserCheck className="mr-2 h-5 w-5" />
            Review User Request
          </DialogTitle>
          <DialogDescription>Review and process the user account request for {user.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium">{user.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{user.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{user.phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Location</p>
                  <p className="font-medium">{locationNames[user.location]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Department</p>
                  <p className="font-medium">{departmentNames[user.department as keyof typeof departmentNames]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Job Title</p>
                  <p className="font-medium">{user.jobTitle}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Supervisor</p>
                  <p className="font-medium">{user.supervisor}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Requested By</p>
                  <p className="font-medium">{user.requestedBy}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Reason for Request</p>
                <p className="text-sm bg-muted/50 p-3 rounded-lg mt-1">{user.reason}</p>
              </div>
            </CardContent>
          </Card>

          {/* Action Selection */}
          <div className="flex space-x-2">
            <Button
              variant={action === "approve" ? "default" : "outline"}
              onClick={() => setAction("approve")}
              className={cn(
                "flex-1",
                action === "approve" && roleColors
                  ? `bg-gradient-to-r ${roleColors.gradient} ${roleColors.hoverGradient} text-white`
                  : "",
              )}
            >
              <UserCheck className="mr-2 h-4 w-4" />
              Approve Request
            </Button>
            <Button
              variant={action === "reject" ? "destructive" : "outline"}
              onClick={() => setAction("reject")}
              className="flex-1"
            >
              <UserX className="mr-2 h-4 w-4" />
              Reject Request
            </Button>
          </div>

          {/* Approval Form */}
          {action === "approve" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-green-700 dark:text-green-300">Approve User Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="role">Assign Role *</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="it_staff">IT Staff</SelectItem>
                      <SelectItem value="it_store_head">IT Store Head</SelectItem>
                      <SelectItem value="service_desk_head">Service Desk Head</SelectItem>
                      <SelectItem value="service_desk_staff">Service Desk Staff</SelectItem>
                      <SelectItem value="service_provider">Service Provider</SelectItem>
                      <SelectItem value="regional_it_head">Regional IT Head</SelectItem>
                      <SelectItem value="it_head">IT Head</SelectItem>
                      {currentUser?.role === "admin" && <SelectItem value="admin">Admin</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="notes">Approval Notes *</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes about the approval..."
                    className="min-h-[80px]"
                    required
                  />
                </div>
                <Button
                  onClick={handleApproval}
                  disabled={!selectedRole || !notes.trim()}
                  className={cn(
                    "w-full text-white",
                    roleColors
                      ? `bg-gradient-to-r ${roleColors.gradient} ${roleColors.hoverGradient}`
                      : "bg-green-600 hover:bg-green-700",
                  )}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve & Create Account
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Rejection Form */}
          {action === "reject" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-red-700 dark:text-red-300">Reject User Request</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="rejectionReason">Reason for Rejection *</Label>
                  <Textarea
                    id="rejectionReason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this request is being rejected..."
                    className="min-h-[80px]"
                    required
                  />
                </div>
                <Button
                  onClick={handleRejection}
                  disabled={!rejectionReason.trim()}
                  variant="destructive"
                  className="w-full"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject Request
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function PendingUserApprovals() {
  const { user } = useAuth()
  const { toast } = useToast()
  const roleColors = user?.role ? getRoleColorScheme(user.role) : null
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null)
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Only admins can see all pending requests
  const isAdmin = user?.role === "admin"

  useEffect(() => {
    if (isAdmin) {
      loadPendingUsers()
    }
  }, [isAdmin])

  const loadPendingUsers = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("status", ["pending", "approved", "rejected"])
        .order("created_at", { ascending: false })

      if (error) throw error

      const formattedUsers: PendingUser[] = (data || []).map((profile) => ({
        id: profile.id,
        name: profile.full_name || profile.username,
        email: profile.email || profile.username,
        phone: profile.phone || "",
        location: profile.location,
        department: profile.department || "",
        supervisor: profile.supervisor || "",
        jobTitle: profile.job_title || "",
        reason: profile.request_reason || "",
        requestedBy: profile.requested_by || "Self-Registration",
        requestedDate: profile.created_at,
        status: profile.status,
        notes: "",
      }))

      setPendingUsers(formattedUsers)
    } catch (error) {
      console.error("[v0] Error loading pending users:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId: string, role: string, notes: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("profiles")
        .update({
          status: "approved",
          role: role,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)

      if (error) throw error

      toast({
        title: "✅ User Approved Successfully",
        description: "The user account has been activated",
      })

      // Reload the list
      loadPendingUsers()
    } catch (error) {
      console.error("[v0] Error approving user:", error)
      toast({
        title: "❌ Failed to Approve User",
        description: "An error occurred while approving the user",
        variant: "destructive",
      })
    }
  }

  const handleReject = async (userId: string, reason: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("profiles")
        .update({
          status: "rejected",
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)

      if (error) throw error

      toast({
        title: "❌ User Request Rejected",
        description: "The user request has been rejected",
      })

      // Reload the list
      loadPendingUsers()
    } catch (error) {
      console.error("[v0] Error rejecting user:", error)
      toast({
        title: "❌ Failed to Reject User",
        description: "An error occurred while rejecting the user",
        variant: "destructive",
      })
    }
  }

  const filteredUsers = pendingUsers.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || user.status === statusFilter

    return matchesSearch && matchesStatus
  })

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, pageSize, pendingUsers.length])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedUsers = filteredUsers.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize)

  if (!isAdmin) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
          <p className="text-muted-foreground">Only administrators can view and approve pending user requests.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <FormNavigation currentPage="/dashboard/users/approvals" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Pending User Approvals</h2>
          <p className="text-muted-foreground">Review and approve user account requests from staff members</p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {filteredUsers.filter((u) => u.status === "pending").length} Pending Reviews
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search requests by name, email, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pending Requests List */}
      <div className="grid gap-4">
        {paginatedUsers.map((pendingUser) => (
          <Card key={pendingUser.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{pendingUser.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <span>{pendingUser.id}</span>
                      <span>•</span>
                      <Mail className="h-3 w-3" />
                      <span>{pendingUser.email}</span>
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-medium",
                      statusColors[pendingUser.status].bg,
                      statusColors[pendingUser.status].text,
                      statusColors[pendingUser.status].border,
                    )}
                  >
                    {pendingUser.status === "pending" && <Clock className="mr-1 h-3 w-3" />}
                    {pendingUser.status === "approved" && <CheckCircle className="mr-1 h-3 w-3" />}
                    {pendingUser.status === "rejected" && <XCircle className="mr-1 h-3 w-3" />}
                    {pendingUser.status.charAt(0).toUpperCase() + pendingUser.status.slice(1)}
                  </Badge>

                  {pendingUser.status === "pending" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(pendingUser)
                            setApprovalDialogOpen(true)
                          }}
                          className="cursor-pointer"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Review Request
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Location</p>
                    <p className="font-medium">{locationNames[pendingUser.location]}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Department</p>
                    <p className="font-medium">
                      {departmentNames[pendingUser.department as keyof typeof departmentNames]}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Job Title</p>
                  <p className="font-medium">{pendingUser.jobTitle}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Requested</p>
                  <p className="font-medium">{new Date(pendingUser.requestedDate).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Request Reason:</p>
                <p className="text-sm">{pendingUser.reason}</p>
              </div>

              {pendingUser.notes && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Admin Notes:</strong> {pendingUser.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredUsers.length > 0 && (
        <DataPagination
          currentPage={safeCurrentPage}
          totalItems={filteredUsers.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="requests"
        />
      )}

      {filteredUsers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No requests found</h3>
            <p className="text-muted-foreground text-center">No user account requests match your current filters.</p>
          </CardContent>
        </Card>
      )}

      {/* Approval Dialog */}
      {selectedUser && (
        <ApprovalDialog
          user={selectedUser}
          isOpen={approvalDialogOpen}
          onClose={() => {
            setApprovalDialogOpen(false)
            setSelectedUser(null)
          }}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  )
}
