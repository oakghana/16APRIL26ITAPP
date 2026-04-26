"use client"

import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { StoreHeadIssuanceModule } from "@/components/it-forms/store-head-issuance"

export default function StoreHeadPage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && !["it_store_head", "admin", "regional_it_head"].includes(user.role)) {
      router.replace("/dashboard")
    }
  }, [user])

  return (
    <div className="container mx-auto py-6">
      <StoreHeadIssuanceModule />
    </div>
  )
}
