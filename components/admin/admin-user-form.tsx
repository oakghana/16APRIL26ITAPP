"use client"

import { useEffect, useState } from "react"
import { Loader2, Save, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { LOCATIONS, type LocationKey } from "@/lib/locations"

type AdminFormMode = "create" | "edit"

type ManagedRole =
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

interface EditableUser {
  id?: string
  name?: string
  email?: string
  phone?: string
  role?: ManagedRole
  location?: string
  department?: string
  status?: "active" | "inactive" | "suspended" | "approved" | "pending"
}

interface AdminUserFormProps {
  mode?: AdminFormMode
  initialUser?: EditableUser | null
  onClose?: () => void
  onSuccess?: (user: any) => void
}

const ROLE_OPTIONS: { value: ManagedRole; label: string }[] = [
  { value: "staff", label: "Staff" },
  { value: "user", label: "User" },
  { value: "department_head", label: "Department Head" },
  { value: "it_staff", label: "IT Staff" },
  { value: "regional_it_head", label: "Regional IT Head" },
  { value: "it_head", label: "IT Head" },
  { value: "it_store_head", label: "IT Store Head" },
  { value: "service_desk_accra", label: "Service Desk Accra" },
  { value: "service_desk_kumasi", label: "Service Desk Kumasi" },
  { value: "service_desk_tema", label: "Service Desk Tema" },
  { value: "service_desk_takoradi", label: "Service Desk Takoradi" },
  { value: "service_desk_cape_coast", label: "Service Desk Swedru/CR" },
  { value: "service_desk_ho", label: "Service Desk Ho" },
  { value: "admin", label: "Admin" },
]

function toLocationKey(location?: string): LocationKey {
  if (!location) return "head_office"
  const normalized = location.toLowerCase().replace(/[\s-]+/g, "_")
  const match = Object.entries(LOCATIONS).find(([key, label]) => key.toLowerCase() === normalized || label.toLowerCase() === location.toLowerCase())
  return (match?.[0] as LocationKey) || "head_office"
}

function toStatusValue(status?: string): "approved" | "pending" | "suspended" {
  if (status === "active" || status === "approved") return "approved"
  if (status === "suspended") return "suspended"
  return "pending"
}

export function AdminUserForm({ mode = "create", initialUser, onClose, onSuccess }: AdminUserFormProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const isEdit = mode === "edit"

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hodList, setHodList] = useState<{ id: string; name: string }[]>([])
  const [selectedHodId, setSelectedHodId] = useState<string>("")
  const [formData, setFormData] = useState({
    name: initialUser?.name || "",
    email: initialUser?.email || "",
    phone: initialUser?.phone || "",
    department: initialUser?.department || "ITD",
    location: toLocationKey(initialUser?.location),
    role: (initialUser?.role || "staff") as ManagedRole,
    status: toStatusValue(initialUser?.status),
    password: "qcc@123",
  })

  useEffect(() => {
    const roleNeedsHod = ["staff", "user"].includes(formData.role)
    if (!roleNeedsHod) {
      setHodList([])
      setSelectedHodId("")
      return
    }

    fetch("/api/admin/create-user?list=department_heads")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setHodList((data?.users || []).map((u: any) => ({ id: u.id, name: u.name || u.email })))
      })
      .catch(() => {
        setHodList([])
      })
  }, [formData.role])

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/admin/create-user", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: initialUser?.id,
          name: formData.name,
          email: formData.email,
          username: formData.email,
          phone: formData.phone,
          department: formData.department,
          location: formData.location,
          role: formData.role,
          status: formData.status,
          password: formData.password,
          createdBy: user?.email || user?.name || "admin",
          action: isEdit ? "update" : "create",
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to save user")

      const userId = result.user?.id || initialUser?.id
      if (selectedHodId && userId && ["staff", "user"].includes(formData.role)) {
        await fetch("/api/admin/link-department-staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ department_head_id: selectedHodId, staff_ids: [userId] }),
        })
      }

      toast({
        title: isEdit ? "User updated" : "User created",
        description: isEdit
          ? "The account details have been updated successfully."
          : `The new account has been created successfully.${result.password ? ` Temporary password: ${result.password}` : ""}`,
      })

      onSuccess?.(result.user)
      onClose?.()
    } catch (error) {
      toast({
        title: isEdit ? "Update failed" : "Creation failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="admin-name">Full Name</Label>
          <Input id="admin-name" value={formData.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Enter full name" required className="input-modern" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="admin-email">Email</Label>
          <Input id="admin-email" type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)} placeholder="user@company.com" required className="input-modern" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="admin-phone">Phone</Label>
          <Input id="admin-phone" value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="+233..." className="input-modern" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="admin-department">Department</Label>
          <Input id="admin-department" value={formData.department} onChange={(e) => updateField("department", e.target.value)} placeholder="Department" required className="input-modern" />
        </div>

        <div className="space-y-2">
          <Label>Location</Label>
          <Select value={formData.location} onValueChange={(value) => updateField("location", value)}>
            <SelectTrigger className="input-modern">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LOCATIONS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={formData.role} onValueChange={(value) => updateField("role", value)}>
            <SelectTrigger className="input-modern">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((role) => (
                <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Account Status</Label>
          <Select value={formData.status} onValueChange={(value) => updateField("status", value)}>
            <SelectTrigger className="input-modern">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="approved">Active</SelectItem>
              <SelectItem value="pending">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!isEdit && (
          <div className="space-y-2">
            <Label htmlFor="admin-password">Temporary Password</Label>
            <Input id="admin-password" value={formData.password} onChange={(e) => updateField("password", e.target.value)} placeholder="Temporary password" className="input-modern" />
          </div>
        )}
      </div>

      {["staff", "user"].includes(formData.role) && hodList.length > 0 && (
        <div className="space-y-2">
          <Label>Assign Department Head (optional)</Label>
          <Select value={selectedHodId || "none"} onValueChange={(value) => setSelectedHodId(value === "none" ? "" : value)}>
            <SelectTrigger className="input-modern">
              <SelectValue placeholder="Select department head..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {hodList.map((h) => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        {onClose && (
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
        )}
        <Button type="submit" disabled={isSubmitting} className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : isEdit ? (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          ) : (
            <>
              <UserPlus className="mr-2 h-4 w-4" />
              Create User
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
