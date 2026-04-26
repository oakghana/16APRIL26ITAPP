"use client"

import { MyRequestsView } from "@/components/store/my-requests-view"
import { MyITFormsRequests } from "@/components/it-forms/my-it-forms-requests"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

const ALLOWED_ROLES = ["it_staff", "regional_it_head", "it_store_head", "it_head", "admin", "staff", "user"]

export default function MyRequestsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user && !ALLOWED_ROLES.includes(user.role)) {
      router.replace("/dashboard")
    }
  }, [user, isLoading, router])

  if (isLoading) return null

  if (user?.role === "staff" || user?.role === "user") {
    return <MyITFormsRequests />
  }

  return <MyRequestsView />
}
