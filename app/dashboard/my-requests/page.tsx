"use client"

import { MyRequestsView } from "@/components/store/my-requests-view"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

const ALLOWED_ROLES = ["it_staff", "regional_it_head", "it_store_head", "it_head", "admin"]

export default function MyRequestsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user && !ALLOWED_ROLES.includes(user.role)) {
      router.replace("/dashboard")
    }
  }, [user, isLoading, router])

  if (isLoading) return null

  return <MyRequestsView />
}
