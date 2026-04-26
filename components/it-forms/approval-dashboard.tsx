"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"
import { Laptop, Wrench, ClipboardList, ShieldCheck, Lock, ArrowRight, Users, Loader2, Trash2, LockKeyhole, UserPlus, UserMinus, KeySquare, ArrowLeftRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { isITDDepartment } from "@/lib/department-options"
import { DepartmentHeadApprovalModule } from "./department-head-approval"
import { ITServiceDeskProcessingPanel } from "./service-desk-processing"
import { ITHeadAdminPanel } from "./it-head-admin-panel"
import { HodApprovalTracker } from "./hod-approval-tracker"
import { SignatureManagementPanel } from "./signature-management"
import { PasswordResetWorkQueue } from "./password-reset-work-queue"

function LockedSection({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed border-slate-300 bg-slate-100/70 dark:border-slate-700 dark:bg-slate-900/50">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="rounded-full bg-slate-200 p-3 dark:bg-slate-800">
          <Lock className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function ITFormsApprovalDashboard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const role = user?.role || ""
  const department = user?.department || ""
  const [verifiedRole, setVerifiedRole] = useState<string | null>(null)
  const [verifiedDepartment, setVerifiedDepartment] = useState<string | null>(null)
  const [isDeletingAll, setIsDeletingAll] = useState(false)
  const [isDownloadingAllRecords, setIsDownloadingAllRecords] = useState(false)
  const [isDownloadingApprovedBackup, setIsDownloadingApprovedBackup] = useState(false)

  useEffect(() => {
    let active = true

    const loadVerifiedProfile = async () => {
      if (!user?.id) {
        if (active) {
          setVerifiedRole(null)
          setVerifiedDepartment(null)
        }
        return
      }

      try {
        const response = await fetch(`/api/profile/summary?userId=${encodeURIComponent(user.id)}`)
        const data = await response.json()
        if (!response.ok) return

        if (active) {
          setVerifiedRole(String(data?.profile?.role || ""))
          setVerifiedDepartment(String(data?.profile?.department || ""))
        }
      } catch {
        // Keep local auth values as fallback.
      }
    }

    void loadVerifiedProfile()

    return () => {
      active = false
    }
  }, [user?.id])

  const effectiveRole = verifiedRole || role
  const effectiveDepartment = verifiedDepartment ?? department

  // ITD (IT Department) Department Head can act as IT Manager
  const isITDepartmentHead = effectiveRole === "department_head" && isITDDepartment(effectiveDepartment)

  const canUseHODDesk = ["department_head", "admin"].includes(effectiveRole)
  const canUseOfficeUseDesk =
    effectiveRole === "admin" ||
    effectiveRole === "it_staff" ||
    effectiveRole === "regional_it_head" ||
    effectiveRole === "it_store_head" ||
    effectiveRole.startsWith("service_desk")
  const canUseManagerDesk = effectiveRole === "admin" || isITDepartmentHead
  const canUseHODTracker = ["it_head", "admin"].includes(effectiveRole) || isITDepartmentHead
  const canUseSignatureDesk = ["department_head", "admin", "it_head", "regional_it_head"].includes(effectiveRole) || isITDepartmentHead
  const canUsePasswordWorkDesk = ["it_staff", "it_head", "regional_it_head", "admin"].includes(effectiveRole) || isITDepartmentHead

  const defaultTab = useMemo(() => {
    if (canUseHODDesk) return "hod"
    if (canUseOfficeUseDesk) return "service-desk"
    if (canUseManagerDesk) return "manager"
    return "request"
  }, [canUseHODDesk, canUseOfficeUseDesk, canUseManagerDesk])

  const [activeTab, setActiveTab] = useState(defaultTab)

  const requestLinks = [
    {
      title: "Equipment Requisition",
      description: "Request laptops, printers, accessories, and other IT equipment.",
      href: "/dashboard/it-forms/equipment-requisition",
      icon: Laptop,
    },
    {
      title: "Maintenance and Repairs",
      description: "Log faults and request technical support through the approved workflow.",
      href: "/dashboard/it-forms/maintenance-repairs",
      icon: Wrench,
    },
    {
      title: "New Gadget Request",
      description: "Submit new gadget needs for approval and onward IT processing.",
      href: "/dashboard/it-forms/new-gadget",
      icon: ClipboardList,
    },
    {
      title: "Password Reset Request",
      description: "Request password resets for enterprise systems with IT manager assignment workflow.",
      href: "/dashboard/it-forms/password-reset",
      icon: ShieldCheck,
    },
    {
      title: "Account Unlock Request",
      description: "Request account unlock support with manager assignment and completion workflow.",
      href: "/dashboard/it-forms/account-unlock",
      icon: LockKeyhole,
    },
    {
      title: "New User Onboarding",
      description: "Submit onboarding setup requests for new employees and required systems access.",
      href: "/dashboard/it-forms/onboarding",
      icon: UserPlus,
    },
    {
      title: "User Offboarding",
      description: "Submit access deprovisioning and handover requests for departing staff.",
      href: "/dashboard/it-forms/offboarding",
      icon: UserMinus,
    },
    {
      title: "Software Access Request",
      description: "Request software/application access levels with IT manager assignment.",
      href: "/dashboard/it-forms/software-access",
      icon: KeySquare,
    },
    {
      title: "IT Asset Transfer",
      description: "Request transfer of IT assets across departments and locations.",
      href: "/dashboard/it-forms/asset-transfer",
      icon: ArrowLeftRight,
    },
  ]

  const deleteAllITForms = async () => {
    if (effectiveRole !== "admin") return

    const confirmed = window.confirm(
      "This will permanently delete ALL IT form requests (Requisitions, New Gadget, Maintenance & Repairs, Password Reset). Continue?"
    )
    if (!confirmed) return

    const secondCheck = window.prompt('Type DELETE ALL to confirm this irreversible action:')
    if (secondCheck !== "DELETE ALL") {
      toast({
        title: "Cancelled",
        description: "Confirmation text did not match. No records were deleted.",
        variant: "destructive",
      })
      return
    }

    setIsDeletingAll(true)
    try {
      const response = await fetch("/api/it-forms/admin-clear", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userRole: effectiveRole, userId: user?.id, username: user?.full_name || user?.email || user?.username || "admin" }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to clear IT forms")

      toast({
        title: "All IT forms deleted",
        description: `Deleted ${data.deleted?.total || 0} records across all IT form modules.`,
      })

      window.location.reload()
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message || "Unable to delete all IT forms",
        variant: "destructive",
      })
    } finally {
      setIsDeletingAll(false)
    }
  }

  const downloadAdminRecords = async (mode: "all" | "approved") => {
    const isApproved = mode === "approved"
    if (isApproved) {
      setIsDownloadingApprovedBackup(true)
    } else {
      setIsDownloadingAllRecords(true)
    }

    try {
      const params = new URLSearchParams({
        mode,
        userRole: effectiveRole,
        username: user?.full_name || user?.email || user?.username || "admin",
      })

      const response = await fetch(`/api/it-forms/admin-records?${params.toString()}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to fetch IT form records")

      const fileDate = new Date().toISOString().replace(/[:.]/g, "-")
      const fileName = isApproved ? `it-forms-approved-backup-${fileDate}.json` : `it-forms-records-${fileDate}.json`
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      toast({
        title: isApproved ? "Approved backup downloaded" : "Previous records downloaded",
        description: `Saved ${data?.counts?.total || 0} records to ${fileName}.`,
      })
    } catch (error: any) {
      toast({
        title: isApproved ? "Approved backup failed" : "Fetch records failed",
        description: error.message || "Unable to export IT form records",
        variant: "destructive",
      })
    } finally {
      if (isApproved) {
        setIsDownloadingApprovedBackup(false)
      } else {
        setIsDownloadingAllRecords(false)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">IT Forms and Approvals</h1>
        <p className="text-muted-foreground">
          All staff can request IT services here. Staff requests move through the Department Head first, then IT Office Use by IT staff in location, and finally to IT Head or Admin review.
        </p>
      </div>

      {effectiveRole === "admin" && (
        <Card className="border-red-200 bg-red-50/70">
          <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-red-700">Admin Emergency Reset</p>
              <p className="text-sm text-red-700/90">
                Delete all submitted IT form requests when there is a critical fault in form processing.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => downloadAdminRecords("all")} disabled={isDownloadingAllRecords || isDownloadingApprovedBackup || isDeletingAll}>
                {isDownloadingAllRecords ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Fetch Previous Records
              </Button>
              <Button variant="outline" onClick={() => downloadAdminRecords("approved")} disabled={isDownloadingApprovedBackup || isDownloadingAllRecords || isDeletingAll}>
                {isDownloadingApprovedBackup ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Backup Approved Records
              </Button>
              <Button variant="destructive" onClick={deleteAllITForms} disabled={isDeletingAll || isDownloadingAllRecords || isDownloadingApprovedBackup}>
                {isDeletingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Delete All IT Forms
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Request Access</p>
                <p className="mt-2 text-lg font-semibold">All Staff</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card className={canUseHODDesk ? "shadow-sm border-emerald-200" : "shadow-sm opacity-60 bg-slate-50 dark:bg-slate-900"}>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">HOD Desk</p>
            <p className="mt-2 text-lg font-semibold">{canUseHODDesk ? "Enabled" : "Locked"}</p>
          </CardContent>
        </Card>
        <Card className={canUseOfficeUseDesk ? "shadow-sm border-emerald-200" : "shadow-sm opacity-60 bg-slate-50 dark:bg-slate-900"}>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">IT Office</p>
            <p className="mt-2 text-lg font-semibold">{canUseOfficeUseDesk ? "Enabled" : "Locked"}</p>
          </CardContent>
        </Card>
        <Card className={canUseManagerDesk ? "shadow-sm border-emerald-200" : "shadow-sm opacity-60 bg-slate-50 dark:bg-slate-900"}>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">IT Manager</p>
            <p className="mt-2 text-lg font-semibold">{canUseManagerDesk ? "Enabled" : "Locked"}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="w-full overflow-x-auto pb-1">
          <TabsList className="inline-flex h-9 min-w-max gap-1 px-1">
            <TabsTrigger value="request" className="px-3 text-xs">Requests</TabsTrigger>
            <TabsTrigger value="hod" disabled={!canUseHODDesk} className="px-3 text-xs">HOD</TabsTrigger>
            <TabsTrigger value="service-desk" disabled={!canUseOfficeUseDesk} className="px-3 text-xs">IT Office</TabsTrigger>
            {canUseManagerDesk ? <TabsTrigger value="manager" className="px-3 text-xs">Manager</TabsTrigger> : null}
            <TabsTrigger value="password-work" disabled={!canUsePasswordWorkDesk} className="px-3 text-xs">Resets</TabsTrigger>
            <TabsTrigger value="hod-tracker" disabled={!canUseHODTracker} className="px-3 text-xs">Tracker</TabsTrigger>
            <TabsTrigger value="signature" disabled={!canUseSignatureDesk} className="px-3 text-xs">Signature</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="request" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Request IT Services</CardTitle>
              <CardDescription>Choose a form below to submit your request. Reviewer sections remain greyed out until the proper approver stage.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {requestLinks.map((link) => {
                  const Icon = link.icon
                  return (
                    <Card key={link.href} className="border shadow-none">
                      <CardContent className="p-5">
                        <div className="mb-3 flex items-center justify-between">
                          <Icon className="h-5 w-5 text-emerald-600" />
                          <Badge variant="secondary">Available</Badge>
                        </div>
                        <h3 className="font-semibold">{link.title}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">{link.description}</p>
                        <Button asChild className="mt-4 w-full">
                          <Link href={link.href}>
                            Open Form
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hod" className="space-y-4">
          {canUseHODDesk ? (
            <DepartmentHeadApprovalModule />
          ) : (
            <LockedSection
              title="HOD Desk"
              description="This section is only for Department Heads and Admin users."
            />
          )}
        </TabsContent>

        <TabsContent value="service-desk" className="space-y-4">
          {canUseOfficeUseDesk ? (
            <ITServiceDeskProcessingPanel />
          ) : (
            <LockedSection
              title="IT Office"
              description="This section is only for IT staff teams and Admin users."
            />
          )}
        </TabsContent>

        <TabsContent value="manager" className="space-y-4">
          {canUseManagerDesk ? (
            <ITHeadAdminPanel />
          ) : (
            <LockedSection
              title="IT Manager"
              description="This section is only for IT Head and Admin users."
            />
          )}
        </TabsContent>

        <TabsContent value="password-work" className="space-y-4">
          {canUsePasswordWorkDesk ? (
            <PasswordResetWorkQueue />
          ) : (
            <LockedSection
              title="Password Resets"
              description="This section is only for IT teams and Admin users."
            />
          )}
        </TabsContent>

        <TabsContent value="hod-tracker" className="space-y-4">
          {canUseHODTracker ? (
            <HodApprovalTracker />
          ) : (
            <LockedSection
              title="HOD Tracker"
              description="This section is only for IT Head and Admin users."
            />
          )}
        </TabsContent>

        <TabsContent value="signature" className="space-y-4">
          {canUseSignatureDesk ? (
            <SignatureManagementPanel />
          ) : (
            <LockedSection
              title="Signature"
              description="This section is only for Department Heads and Admin users."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
