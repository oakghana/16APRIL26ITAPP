"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { Users, CheckCircle, AlertCircle, PhoneCall } from "lucide-react"
import { cn } from "@/lib/utils"

interface HODInfo {
  name: string
  email: string
  department?: string
}

export function HODStatusWidget() {
  const { user } = useAuth()
  const [hod, setHod] = useState<HODInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const isStaff = user?.role === "staff" || user?.role === "user"

  useEffect(() => {
    if (!isStaff || !user?.id) return

    const fetchHOD = async () => {
      try {
        const res = await fetch(`/api/staff/my-hod?userId=${user.id}`)
        const data = await res.json()
        setHod(data.hod || null)
      } catch {
        setHod(null)
      } finally {
        setLoading(false)
      }
    }

    fetchHOD()
  }, [user, isStaff])

  if (!isStaff || loading) return null

  return (
    <Card
      className={cn(
        "border-l-4",
        hod
          ? "border-l-green-500 bg-green-50/60 dark:bg-green-950/20"
          : "border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/20"
      )}
    >
      <CardContent className="p-4 flex items-start gap-4">
        <div
          className={cn(
            "mt-0.5 rounded-full p-2 shrink-0",
            hod
              ? "bg-green-100 dark:bg-green-900/40"
              : "bg-amber-100 dark:bg-amber-900/40"
          )}
        >
          {hod ? (
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your Department Head
            </p>
          </div>

          {hod ? (
            <>
              <p className="font-semibold text-green-800 dark:text-green-200 text-base leading-tight">
                {hod.name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{hod.email}</p>
              {hod.department && (
                <p className="text-xs text-muted-foreground">{hod.department}</p>
              )}
            </>
          ) : (
            <>
              <p className="font-semibold text-amber-800 dark:text-amber-200 text-base leading-tight">
                Not linked to a Department Head
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 flex items-center gap-1">
                <PhoneCall className="h-3 w-3 shrink-0" />
                Please contact your IT office to get properly linked to your department head.
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
