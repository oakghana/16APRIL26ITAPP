"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { normalizeDepartmentName } from "@/lib/department-options"

const SYSTEM_OPTIONS = [
  "Email System", "PF and Mutual System", "Marketing App", "ACCPAC", "PERSOL",
  "SharePoint", "Loan App", "Wireless Access", "Asset App", "Chemstore App", "Other",
] as const

export function AccountUnlockRequestForm({ onSubmit }: { onSubmit: () => void }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const dept = useMemo(() => normalizeDepartmentName(user?.department), [user?.department])

  const [form, setForm] = useState({
    staffName: user?.full_name || "",
    departmentName: dept,
    requesterLocation: user?.location || "",
    requestDate: new Date().toISOString().split("T")[0],
    lockedSystem: "",
    otherSystemName: "",
    accountIdentifier: user?.email || "",
    lockDescription: "",
    urgency: "medium",
  })

  useEffect(() => {
    setForm((p) => ({
      ...p,
      staffName: user?.full_name || "",
      departmentName: normalizeDepartmentName(user?.department),
      requesterLocation: user?.location || "",
      accountIdentifier: p.accountIdentifier || user?.email || "",
    }))
  }, [user?.full_name, user?.department, user?.location, user?.email])

  const set = (name: string, value: string) => setForm((p) => ({ ...p, [name]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!form.lockedSystem) { setError("Please select the locked system"); return }
    if (form.lockedSystem === "Other" && !form.otherSystemName.trim()) { setError("Enter custom system name"); return }
    if (!form.accountIdentifier.trim()) { setError("Account identifier is required"); return }
    if (!form.lockDescription.trim()) { setError("Please describe the lock issue"); return }

    setLoading(true)
    try {
      const res = await fetch("/api/it-forms/account-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffName: form.staffName,
          requestedById: user?.id,
          requestedByEmail: user?.email,
          departmentName: form.departmentName,
          requesterLocation: form.requesterLocation,
          requestDate: form.requestDate,
          lockedSystem: form.lockedSystem,
          otherSystemName: form.otherSystemName,
          accountIdentifier: form.accountIdentifier,
          lockDescription: form.lockDescription,
          urgency: form.urgency,
          submittedByRole: user?.role,
          submittedByEmail: user?.email,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Submission failed")
      toast({ title: "Submitted", description: `Account unlock request ${data.requestNumber} sent to IT Manager` })
      onSubmit()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Staff Name</Label>
          <Input value={form.staffName} onChange={(e) => set("staffName", e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>Department</Label>
          <Input value={form.departmentName} onChange={(e) => set("departmentName", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Location</Label>
          <Input value={form.requesterLocation} onChange={(e) => set("requesterLocation", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Date</Label>
          <Input type="date" value={form.requestDate} onChange={(e) => set("requestDate", e.target.value)} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Locked System / Application *</Label>
        <Select value={form.lockedSystem} onValueChange={(v) => set("lockedSystem", v)}>
          <SelectTrigger><SelectValue placeholder="Select system" /></SelectTrigger>
          <SelectContent>{SYSTEM_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {form.lockedSystem === "Other" && (
        <div className="space-y-1">
          <Label>Custom System Name *</Label>
          <Input value={form.otherSystemName} onChange={(e) => set("otherSystemName", e.target.value)} placeholder="Enter system name" />
        </div>
      )}

      <div className="space-y-1">
        <Label>Account / Username / Email *</Label>
        <Input value={form.accountIdentifier} onChange={(e) => set("accountIdentifier", e.target.value)} placeholder="Enter account email or username" required />
      </div>

      <div className="space-y-1">
        <Label>Describe the Lock Issue *</Label>
        <Textarea value={form.lockDescription} onChange={(e) => set("lockDescription", e.target.value)} placeholder="Describe what happened — e.g. too many failed attempts, admin lock, expired account..." rows={3} required />
      </div>

      <div className="space-y-1">
        <Label>Urgency</Label>
        <Select value={form.urgency} onValueChange={(v) => set("urgency", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
        No HOD approval required — request goes directly to IT Manager queue.
      </p>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Submitting…" : "Submit Account Unlock Request"}
      </Button>
    </form>
  )
}
