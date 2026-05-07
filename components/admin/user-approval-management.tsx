"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, XCircle, Clock, Mail, MapPin, Phone, Briefcase, Search, Eye, EyeOff } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getLocationLabel } from "@/lib/locations"
import { formatDisplayDate } from "@/lib/utils"

interface PendingUser {
  id: string
  username: string
  email: string
  fullName: string
  phone?: string
  department?: string
  location: string
  createdAt: string
  status: "pending" | "approved" | "rejected"
  role?: string
}

export function UserApprovalManagement() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [approvedUsers, setApprovedUsers] = useState<PendingUser[]>([])
  const [rejectedUsers, setRejectedUsers] = useState<PendingUser[]>([])
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null)
  const [selectedRole, setSelectedRole] = useState("")
  const [selectedLocation, setSelectedLocation] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [actionType, setActionType] = useState<"approve" | "reject">("approve")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      // Fetch pending users
      const pendingRes = await fetch("/api/admin/pending-users?status=pending")
      const pendingData = await pendingRes.json()

      // Fetch approved users
      const approvedRes = await fetch("/api/admin/pending-users?status=approved")
      const approvedData = await approvedRes.json()

      // Fetch rejected users
      const rejectedRes = await fetch("/api/admin/pending-users?status=rejected")
      const rejectedData = await rejectedRes.json()

      // Map the data to the expected format
      setPendingUsers(
        (pendingData.users || []).map((user: any) => ({
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
          department: user.department,
          location: user.location,
          createdAt: user.created_at,
          status: user.status,
          role: user.role,
        })),
      )

      setApprovedUsers(
        (approvedData.users || []).map((user: any) => ({
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
          department: user.department,
          location: user.location,
          createdAt: user.created_at,
          status: user.status,
          role: user.role,
        })),
      )

      setRejectedUsers(
        (rejectedData.users || []).map((user: any) => ({
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
          department: user.department,
          location: user.location,
          createdAt: user.created_at,
          status: user.status,
          role: user.role,
        })),
      )
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }

  const handleApprove = (user: PendingUser) => {
    setSelectedUser(user)
    setSelectedLocation(user.location)
    setActionType("approve")
    setIsDialogOpen(true)
  }

  const handleReject = (user: PendingUser) => {
    setSelectedUser(user)
    setActionType("reject")
    setIsDialogOpen(true)
  }

  const confirmAction = async () => {
    if (!selectedUser) return

    setIsLoading(true)
    try {
      if (actionType === "approve") {
        const response = await fetch("/api/admin/approve-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedUser.id,
            role: selectedRole,
            location: selectedLocation,
            password: newPassword || undefined,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to approve user")
        }
      } else {
        const response = await fetch("/api/admin/reject-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: selectedUser.id }),
        })

        if (!response.ok) {
          throw new Error("Failed to reject user")
        }
      }

      await fetchUsers()
      setIsDialogOpen(false)
      setSelectedUser(null)
      setSelectedRole("")
      setSelectedLocation("")
      setNewPassword("")
      setShowPassword(false)
    } catch (error) {
      console.error("Error processing user action:", error)
      alert("Failed to process user action. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      admin: "Admin",
      regional_it_head: "Regional IT Head",
      it_head: "IT Head",
      it_staff: "IT Staff",
      it_store_head: "IT Store Head",
      staff: "Staff",
      service_provider: "Service Provider",
      user: "User",
      service_desk_head: "Service Desk Head",
      service_desk_staff: "Service Desk Staff",
    }
    return roles[role] || role
  }

  const filteredPendingUsers = pendingUsers.filter((user) => {
    const normalizedSearch = searchQuery.toLowerCase()

    return (
      (user.fullName || "").toLowerCase().includes(normalizedSearch) ||
      (user.email || "").toLowerCase().includes(normalizedSearch) ||
      (user.username || "").toLowerCase().includes(normalizedSearch)
    )
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>User Approval Management</CardTitle>
          <CardDescription>Review and approve user registration requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search users by name, email, or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Tabs defaultValue="pending">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">Pending ({pendingUsers.length})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({approvedUsers.length})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({rejectedUsers.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {filteredPendingUsers.length === 0 ? (
                <Alert>
                  <AlertDescription>No pending user approvals at this time.</AlertDescription>
                </Alert>
              ) : (
                filteredPendingUsers.map((user) => (
                  <Card key={user.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white font-semibold text-lg">
                              {user.fullName.charAt(0)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{user.fullName}</h3>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="w-4 h-4" />
                                {user.email}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-muted-foreground" />
                              <span>{getLocationLabel(user.location)}</span>
                            </div>
                            {user.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-muted-foreground" />
                                <span>{user.phone}</span>
                              </div>
                            )}
                            {user.department && (
                              <div className="flex items-center gap-2">
                                <Briefcase className="w-4 h-4 text-muted-foreground" />
                                <span>{user.department}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span>{formatDisplayDate(user.createdAt)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(user)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleReject(user)}>
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="approved" className="space-y-4">
              {approvedUsers.length === 0 ? (
                <Alert>
                  <AlertDescription>No approved users yet.</AlertDescription>
                </Alert>
              ) : (
                approvedUsers.map((user) => (
                  <Card key={user.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{user.fullName}</h3>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <Badge className="bg-green-100 text-green-800">{getRoleLabel(user.role || "")}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="rejected" className="space-y-4">
              {rejectedUsers.length === 0 ? (
                <Alert>
                  <AlertDescription>No rejected users.</AlertDescription>
                </Alert>
              ) : (
                rejectedUsers.map((user) => (
                  <Card key={user.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{user.fullName}</h3>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <Badge variant="destructive">Rejected</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl">
              {actionType === "approve" ? "Approve User Access" : "Reject User Request"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {actionType === "approve"
                ? "Assign role and optionally set a new password"
                : "Confirm rejection of this registration request"}
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 p-3 bg-muted/50 rounded-lg text-sm">
                <span className="font-medium">Name:</span>
                <span>{selectedUser.fullName}</span>

                <span className="font-medium">Email:</span>
                <span className="text-muted-foreground truncate">{selectedUser.email}</span>

                <span className="font-medium">Location:</span>
                <span>{getLocationLabel(selectedUser.location)}</span>

                {selectedUser.department && (
                  <>
                    <span className="font-medium">Department:</span>
                    <span>{selectedUser.department}</span>
                  </>
                )}
              </div>

              {actionType === "approve" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="role" className="text-sm font-medium">
                      Assign Role *
                    </Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger id="role" className="h-9">
                        <SelectValue placeholder="Select role" />
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
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="location" className="text-sm font-medium">
                      Location *
                    </Label>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                      <SelectTrigger id="location" className="h-9">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="head_office">Head Office</SelectItem>
                        <SelectItem value="tema_port">Tema Port</SelectItem>
                        <SelectItem value="Takoradi Port">Takoradi Port</SelectItem>
                        <SelectItem value="tema_research">Tema Research</SelectItem>
                        <SelectItem value="tema_training_school">Tema Training School</SelectItem>
                        <SelectItem value="kumasi">Kumasi</SelectItem>
                        <SelectItem value="kaase">Kaase</SelectItem>
                        <SelectItem value="ws">WS</SelectItem>
                        <SelectItem value="wn">WN</SelectItem>
                        <SelectItem value="vr">VR</SelectItem>
                        <SelectItem value="bar">BAR</SelectItem>
                        <SelectItem value="nsawam">Nsawam</SelectItem>
                        <SelectItem value="cr">CR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Set New Password (Optional)
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Leave empty for default: pa$$w0rd"
                        className="h-9 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      If left empty, user will be assigned default password:{" "}
                      <span className="font-medium">pa$$w0rd</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading} size="sm">
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              disabled={isLoading || (actionType === "approve" && (!selectedRole || !selectedLocation))}
              className={actionType === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
              variant={actionType === "reject" ? "destructive" : "default"}
              size="sm"
            >
              {isLoading ? "Processing..." : actionType === "approve" ? "Approve User" : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
