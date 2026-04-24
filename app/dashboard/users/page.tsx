"use client"

import { UserManagement } from "@/components/admin/user-management"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader2 } from "lucide-react"

export default function UsersPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  // Allow admin and it_head to view users
  const allowedRoles = ["admin", "it_head"]

  useEffect(() => {
    if (!loading && user && !allowedRoles.includes(user.role)) {
      router.push("/dashboard")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">You do not have access to this page.</p>
      </div>
    )
  }

  return <UserManagement />
}
