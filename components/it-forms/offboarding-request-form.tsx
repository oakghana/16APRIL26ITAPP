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

const REASONS = [
  { value: "resignation", label: "Resignation" },
  { value: "transfer", label: "Transfer" },
  { value: "retirement", label: "Retirement" },
  { value: "contract_end", label: "Contract End" },
  { value: "termination", label: "Termination" },
  { value: "other", label: "Other" },
]

export function OffboardingRequestForm({ onSubmit }: { onSubmit: () => void }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const department = useMemo(() => normalizeDepartmentName(user?.department), [user?.department])

  const [form, setForm] = useState({
    staffName: user?.full_name || "",
    departmentName: department,
    requesterLocation: user?.location || "",
    requestDate: new Date().toISOString().split("T")[0],
    departingStaffName: "",
    departingStaffEmail: "",
    departingStaffRole: "",
    departingStaffDepartment: "",
    lastWorkDate: "",
    departureReason: "resignation",
    specialNotes: "",
  })

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      staffName: user?.full_name || "",
      departmentName: normalizeDepartmentName(user?.department),
      requesterLocation: user?.location || "",
      departingStaffDepartment: prev.departingStaffDepartment || normalizeDepartmentName(user?.department),
    }))
  }, [user?.full_name, user?.department, user?.location])

  const setValue = (name: string, value: string) => setForm((prev) => ({ ...prev, [name]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!form.departingStaffName.trim() || !form.departingStaffDepartment.trim() || !form.lastWorkDate) {
      setError("Please complete all required fields")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/it-forms/offboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          requestedById: user?.id,
          requestedByEmail: user?.email,
          submittedByRole: user?.role,
          submittedByEmail: user?.email,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to submit offboarding request")

      toast({ title: "Submitted", description: `Offboarding request ${data.requestNumber} sent to IT manager queue.` })
      onSubmit()

      setForm((prev) => ({
        ...prev,
        departingStaffName: "",
        departingStaffEmail: "",
        departingStaffRole: "",
        lastWorkDate: "",
        specialNotes: "",
        departureReason: "resignation",
      }))
    } catch (err: any) {
      setError(err.message || "Failed to submit offboarding request")
      toast({ title: "Submission failed", description: err.message || "Failed to submit", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Requester</Label>
          <Input value={form.staffName} disabled className="opacity-80" />
        </div>
        <div className="space-y-1">
          <Label>Requester Department</Label>
          <Input value={form.departmentName} disabled className="opacity-80" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Departing Staff Name *</Label>
          <Input value={form.departingStaffName} onChange={(e) => setValue("departingStaffName", e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>Departing Staff Email</Label>
          <Input type="email" value={form.departingStaffEmail} onChange={(e) => setValue("departingStaffEmail", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Departing Staff Role</Label>
          <Input value={form.departingStaffRole} onChange={(e) => setValue("departingStaffRole", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Department *</Label>
          <Input value={form.departingStaffDepartment} onChange={(e) => setValue("departingStaffDepartment", e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>Last Work Date *</Label>
          <Input type="date" value={form.lastWorkDate} onChange={(e) => setValue("lastWorkDate", e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>Departure Reason *</Label>
          <Select value={form.departureReason} onValueChange={(value) => setValue("departureReason", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select reason" />
            </SelectTrigger>
            <SelectContent>
              {REASONS.map((reason) => (
                <SelectItem key={reason.value} value={reason.value}>{reason.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Special Notes</Label>
        <Textarea
          value={form.specialNotes}
          onChange={(e) => setValue("specialNotes", e.target.value)}
          placeholder="Device return, access revocation priority, handover notes..."
          rows={3}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Submitting..." : "Submit Offboarding Request"}
      </Button>
    </form>
  )
}
