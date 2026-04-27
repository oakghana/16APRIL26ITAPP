"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Search,
  Plus,
  MoreHorizontal,
  User,
  Users,
  MapPin,
  Mail,
  Phone,
  Smartphone,
  Download,
  KeyRound,
  Pencil,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { FormNavigation } from "@/components/ui/form-navigation"
import { AdminUserForm } from "@/components/admin/admin-user-form"
import { usePWAInstall } from "@/components/ui/pwa-install"
import { DataPagination } from "@/components/ui/data-pagination"
import { SortControls } from "@/components/ui/sort-controls"
import { getRoleColorScheme } from "@/lib/role-colors"
import { cn, formatDisplayDate } from "@/lib/utils"
import { sortItems } from "@/lib/sort-utils"
import { getLocationOptions, LOCATIONS } from "@/lib/locations"
import { getCanonicalLocationName } from "@/lib/location-filter"
import { useToast } from "@/hooks/use-toast"

interface SystemUser {
  id: string
  name: string
  email: string
  phone: string
  role:
    | "admin"
    | "regional_it_head"
    | "it_head"
    | "it_staff"
    | "staff"
    | "user"
    | "it_store_head"
    | "department_head"
    | "service_desk_accra"
    | "service_desk_kumasi"
    | "service_desk_tema"
    | "service_desk_takoradi"
    | "service_desk_cape_coast"
    | "service_desk_ho"
  location: string
  department?: string
  status: "active" | "inactive" | "suspended"
  lastLogin: string
  createdDate: string
  deviceCount: number
}

const roleBadgeColors = {
  admin: "destructive",
  regional_it_head: "default",
  it_head: "default",
  it_staff: "secondary",
  staff: "outline",
  user: "outline",
  it_store_head: "secondary",
  department_head: "secondary",
  service_desk_accra: "outline",
  service_desk_kumasi: "outline",
  service_desk_tema: "outline",
  service_desk_takoradi: "outline",
  service_desk_cape_coast: "outline",
  service_desk_ho: "outline",
} as const

const statusColors = {
  active: "default",
  inactive: "secondary",
  suspended: "destructive",
} as const

const locationNames = LOCATIONS

const canSeeAllLocations = (user: any) => {
  return user.role === "admin" || user.location === "Head Office"
}

export function UserManagement() {
  const { user: currentUser } = useAuth()
  const { toast } = useToast()
  const { isInstalled, isInstallable } = usePWAInstall()
  const [users, setUsers] = useState<SystemUser[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [locationFilter, setLocationFilter] = useState<string>("all")
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const roleColors = currentUser?.role ? getRoleColorScheme(currentUser.role) : null
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false)
  const [selectedUserForReset, setSelectedUserForReset] = useState<SystemUser | null>(null)
  const [resetPasswordValue, setResetPasswordValue] = useState("qcc@123")
  const [editUserOpen, setEditUserOpen] = useState(false)
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<SystemUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const mapProfileToSystemUser = (profile: any): SystemUser => ({
    id: profile.id,
    name: profile.full_name || profile.name || profile.username || "Unnamed User",
    email: profile.email || profile.username || "",
    phone: profile.phone || "",
    role: (profile.role || "staff") as SystemUser["role"],
    location: profile.location || "Head Office",
    department: profile.department || "",
    status:
      !profile.is_active || profile.status === "suspended"
        ? "suspended"
        : profile.status === "approved"
          ? "active"
          : "inactive",
    lastLogin: profile.updated_at || "",
    createdDate: formatDisplayDate(profile.created_at, "N/A"),
    deviceCount: 0,
  })

  const handleInstallPWA = () => {
    deferredPrompt.prompt()
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === "accepted") {
        console.log("User accepted the A2HS prompt")
      } else {
        console.log("User dismissed the A2HS prompt")
      }
      setDeferredPrompt(null)
    })
  }

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true)
        console.log("[v0] Loading users from API...")

        const response = await fetch("/api/users/list")

        if (!response.ok) {
          console.error("[v0] Error loading users:", await response.text())
          return
        }

        const { users: fetchedUsers } = await response.json()
        console.log("[v0] Loaded users from API:", fetchedUsers)

        setUsers((fetchedUsers || []).map(mapProfileToSystemUser))
      } catch (error) {
        console.error("[v0] Error loading users:", error)
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [])

  const getFilteredUsers = () => {
    let filteredByAccess = users

    if (currentUser && !canSeeAllLocations(currentUser) && currentUser?.location) {
      filteredByAccess = users.filter((u) => u.location === currentUser.location)
    }

    return filteredByAccess.filter((user) => {
      const normalizedSearch = searchTerm.toLowerCase()
      const matchesSearch =
        (user.name || "").toLowerCase().includes(normalizedSearch) ||
        (user.email || "").toLowerCase().includes(normalizedSearch) ||
        (user.id || "").toLowerCase().includes(normalizedSearch)

      const matchesRole = roleFilter === "all" || user.role === roleFilter
      const matchesLocation = locationFilter === "all" || getCanonicalLocationName(user.location) === locationFilter

      return matchesSearch && matchesRole && matchesLocation
    })
  }

  const filteredUsers = getFilteredUsers()
  const sortedUsers = useMemo(
    () => sortItems(filteredUsers, sortField, sortDirection),
    [filteredUsers, sortField, sortDirection],
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, roleFilter, locationFilter, pageSize, users.length, sortField, sortDirection])

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedUsers = sortedUsers.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize)

  const getLocationFilterOptions = () => {
    const allOptions = getLocationOptions()

    if (currentUser?.role === "it_head" && currentUser?.location !== "Head Office") {
      return [
        { value: "all", label: "All Locations" },
        { value: currentUser.location, label: currentUser.location },
      ]
    }

    return [{ value: "all", label: "All Locations" }, ...allOptions]
  }

  const locationOptions = getLocationFilterOptions()

  const formatRoleLabel = (role: string) => role.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())

  const handleUserAction = async (userId: string, action: "activate" | "deactivate" | "suspend" | "delete") => {
    try {
      if (action === "delete") {
        const response = await fetch("/api/admin/create-user", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: userId }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "Failed to delete user")
        }

        setUsers((prev) => prev.filter((user) => user.id !== userId))
        toast({
          title: "🗑️ User Deleted Successfully",
          description: "The user account has been removed.",
        })
        return
      }

      const newStatus = action === "activate" ? "approved" : action === "deactivate" ? "pending" : "suspended"
      const response = await fetch("/api/admin/create-user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userId,
          status: newStatus,
          action: "update",
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to update user")
      }

      setUsers((prev) => prev.map((user) => (user.id === userId ? mapProfileToSystemUser(result.user) : user)))

      const actionNames = {
        activate: "activated",
        deactivate: "deactivated",
        suspend: "suspended",
      }

      toast({
        title: `✅ User ${actionNames[action]}`,
        description: `User account has been ${actionNames[action]} successfully.`,
      })
    } catch (error) {
      console.error("[v0] Error in handleUserAction:", error)
      toast({
        title: "❌ Error",
        description: error instanceof Error ? error.message : "An error occurred. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleResetPassword = (user: SystemUser) => {
    setSelectedUserForReset(user)
    setResetPasswordOpen(true)
  }

  const handleEditUser = (user: SystemUser) => {
    setSelectedUserForEdit(user)
    setEditUserOpen(true)
  }

  const handleAssignAsHOD = async (selectedUser: SystemUser) => {
    if (selectedUser.role === "department_head") {
      toast({
        title: "Already a Department Head",
        description: `${selectedUser.name} is already assigned as a department head.`,
      })
      return
    }

    try {
      const response = await fetch("/api/admin/create-user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedUser.id,
          role: "department_head",
          action: "update",
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to assign department head role")
      }

      setUsers((prev) => prev.map((entry) => (entry.id === selectedUser.id ? mapProfileToSystemUser(result.user) : entry)))

      toast({
        title: "Department Head Assigned",
        description: `${selectedUser.name} is now assigned as a department head.`,
      })
    } catch (error) {
      toast({
        title: "Assignment Failed",
        description: error instanceof Error ? error.message : "Unable to assign department head role.",
        variant: "destructive",
      })
    }
  }

  const submitPasswordReset = async () => {
    if (!selectedUserForReset) return

    try {
      const response = await fetch("/api/admin/create-user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedUserForReset.id,
          action: "reset_password",
          password: resetPasswordValue,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to reset password")
      }

      toast({
        title: "🔐 Password Reset Successful",
        description: `Password updated for ${selectedUserForReset.name}.`,
      })
      setResetPasswordOpen(false)
      setSelectedUserForReset(null)
      setResetPasswordValue("qcc@123")
    } catch (error) {
      toast({
        title: "❌ Password Reset Failed",
        description: error instanceof Error ? error.message : "Unable to reset password.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <FormNavigation currentPage="/dashboard/users" />

      {!isInstalled && isInstallable && deferredPrompt && (
        <Card
          className={cn(
            "border-primary/20",
            roleColors
              ? `${roleColors.background}`
              : "bg-gradient-to-br from-orange-50 to-amber-50 dark:bg-gradient-to-br dark:from-orange-950 dark:to-amber-950",
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    roleColors ? `${roleColors.background}` : "bg-orange-100 dark:bg-orange-800",
                  )}
                >
                  <Smartphone
                    className={cn(
                      "h-5 w-5",
                      roleColors ? roleColors.textSecondary : "text-orange-600 dark:text-orange-400",
                    )}
                  />
                </div>
                <div>
                  <h3
                    className={cn(
                      "font-semibold",
                      roleColors ? roleColors.textPrimary : "text-orange-900 dark:text-orange-100",
                    )}
                  >
                    Install Mobile App
                  </h3>
                  <p
                    className={cn(
                      "text-sm",
                      roleColors ? roleColors.textSecondary : "text-orange-700 dark:text-orange-300",
                    )}
                  >
                    Install QCC IT Tracker as a mobile app for quick access and offline functionality
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 text-xs"
                >
                  PWA
                </Badge>
              </div>
              <Button
                onClick={handleInstallPWA}
                size="sm"
                className={cn(
                  "text-white",
                  roleColors
                    ? `bg-gradient-to-r ${roleColors.gradient} ${roleColors.hoverGradient}`
                    : "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600",
                )}
              >
                <Download className="mr-2 h-4 w-4" />
                Install
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">User Management</h2>
          <p className="text-muted-foreground">
            {currentUser?.role === "it_head" && currentUser?.location !== "Head Office"
              ? `Manage users in ${currentUser.location}`
              : "Manage system users and access permissions"}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {currentUser?.role === "admin" && (
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/dashboard/user-accounts")}
              className="hover:bg-blue-50 hover:border-blue-300"
            >
              <User className="mr-2 h-4 w-4" />
              Account Requests
            </Button>
          )}


          {currentUser?.role === "admin" && (
            <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white">
                  <Plus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription>Create a new system user account</DialogDescription>
                </DialogHeader>
                <AdminUserForm
                  mode="create"
                  onClose={() => setAddUserOpen(false)}
                  onSuccess={(newUser) => {
                    setUsers((prev) => [mapProfileToSystemUser(newUser), ...prev])
                    setAddUserOpen(false)
                  }}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

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
                  placeholder="Search users by name, email, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="regional_it_head">Regional IT Head</SelectItem>
                <SelectItem value="it_head">IT Head</SelectItem>
                <SelectItem value="it_staff">IT Staff</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="department_head">Department Head</SelectItem>
                <SelectItem value="it_store_head">IT Store Head</SelectItem>
                <SelectItem value="service_desk_accra">Service Desk (Accra)</SelectItem>
                <SelectItem value="service_desk_kumasi">Service Desk (Kumasi)</SelectItem>
                <SelectItem value="service_desk_tema">Service Desk (Tema)</SelectItem>
                <SelectItem value="service_desk_takoradi">Service Desk (Takoradi)</SelectItem>
                <SelectItem value="service_desk_cape_coast">Service Desk (Swedru/CR)</SelectItem>
                <SelectItem value="service_desk_ho">Service Desk (Ho)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by location" />
              </SelectTrigger>
              <SelectContent>
                {locationOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SortControls
              sortField={sortField}
              sortDirection={sortDirection}
              onSortFieldChange={setSortField}
              onSortDirectionChange={setSortDirection}
              options={[
                { value: "name", label: "Name" },
                { value: "email", label: "Email" },
                { value: "role", label: "Role" },
                { value: "location", label: "Location" },
                { value: "status", label: "Status" },
                { value: "createdDate", label: "Created Date" },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* User Table */}
      <Card className="border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Users className="h-5 w-5" />
            Users Directory
          </CardTitle>
          <CardDescription>
            {sortedUsers.length} of {users.length} users shown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10 text-muted-foreground">Loading users...</div>
          ) : sortedUsers.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No users matched the selected filters.
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                      {user.name
                        .split(" ")
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{user.name}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{user.email || "No email"}</span>
                        <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{user.phone || "No phone"}</span>
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{getCanonicalLocationName(user.location)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Department: {user.department || "Not assigned"} • Created: {user.createdDate}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Badge variant={roleBadgeColors[user.role] as any}>{formatRoleLabel(user.role)}</Badge>
                    <Badge variant={statusColors[user.status] as any}>{formatRoleLabel(user.status)}</Badge>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditUser(user)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                          <KeyRound className="mr-2 h-4 w-4" />
                          Reset Password
                        </DropdownMenuItem>
                        {currentUser?.role === "admin" && (
                          <DropdownMenuItem
                            onClick={() => handleAssignAsHOD(user)}
                            disabled={user.role === "department_head"}
                          >
                            <Users className="mr-2 h-4 w-4" />
                            Assign as HOD
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleUserAction(user.id, user.status === "active" ? "deactivate" : "activate")}>
                          <User className="mr-2 h-4 w-4" />
                          {user.status === "active" ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUserAction(user.id, "suspend")}>
                          Suspend User
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUserAction(user.id, "delete")} className="text-red-600 focus:text-red-600">
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sortedUsers.length > 0 && (
            <DataPagination
              currentPage={safeCurrentPage}
              totalItems={sortedUsers.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel="users"
              className="mt-4"
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update account details, role, location, and access status.</DialogDescription>
          </DialogHeader>
          {selectedUserForEdit && (
            <AdminUserForm
              mode="edit"
              initialUser={selectedUserForEdit}
              onClose={() => setEditUserOpen(false)}
              onSuccess={(updatedUser) => {
                setUsers((prev) => prev.map((user) => (user.id === updatedUser.id ? mapProfileToSystemUser(updatedUser) : user)))
                setEditUserOpen(false)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new temporary password for {selectedUserForReset?.name || "this user"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password">Temporary Password</Label>
              <Input
                id="reset-password"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                placeholder="Enter temporary password"
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setResetPasswordOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600"
                onClick={submitPasswordReset}
              >
                Reset Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
