"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { normalizeDepartmentName } from "@/lib/department-options"

export function OnboardingRequestForm({ onSubmit }: { onSubmit: () => void }) {
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
    newStaffName: "",
    newStaffEmail: "",
    newStaffRole: "",
    newStaffDepartment: "",
    newStaffLocation: "",
    startDate: "",
    specialRequirements: "",
  })

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      staffName: user?.full_name || "",
      departmentName: normalizeDepartmentName(user?.department),
      requesterLocation: user?.location || "",
      newStaffDepartment: prev.newStaffDepartment || normalizeDepartmentName(user?.department),
      newStaffLocation: prev.newStaffLocation || user?.location || "",
    }))
  }, [user?.full_name, user?.department, user?.location])

  const setValue = (name: string, value: string) => setForm((prev) => ({ ...prev, [name]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!form.newStaffName.trim() || !form.newStaffDepartment.trim() || !form.newStaffLocation.trim() || !form.startDate) {
      setError("Please complete all required fields")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/it-forms/onboarding", {
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
      if (!response.ok) throw new Error(data.error || "Failed to submit onboarding request")

      toast({ title: "Submitted", description: `Onboarding request ${data.requestNumber} sent to IT manager queue.` })
      onSubmit()

      setForm((prev) => ({
        ...prev,
        newStaffName: "",
        newStaffEmail: "",
        newStaffRole: "",
        startDate: "",
        specialRequirements: "",
      }))
    } catch (err: any) {
      setError(err.message || "Failed to submit onboarding request")
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
          <Label>New Staff Name *</Label>
          <Input value={form.newStaffName} onChange={(e) => setValue("newStaffName", e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>New Staff Email</Label>
          <Input type="email" value={form.newStaffEmail} onChange={(e) => setValue("newStaffEmail", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>New Staff Role</Label>
          <Input value={form.newStaffRole} onChange={(e) => setValue("newStaffRole", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Department *</Label>
          <Input value={form.newStaffDepartment} onChange={(e) => setValue("newStaffDepartment", e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>Location *</Label>
          <Input value={form.newStaffLocation} onChange={(e) => setValue("newStaffLocation", e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>Start Date *</Label>
          <Input type="date" value={form.startDate} onChange={(e) => setValue("startDate", e.target.value)} required />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Special Requirements</Label>
        <Textarea
          value={form.specialRequirements}
          onChange={(e) => setValue("specialRequirements", e.target.value)}
          placeholder="Access systems, devices, software, induction details..."
          rows={3}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Submitting..." : "Submit Onboarding Request"}
      </Button>
    </form>
  )
}
