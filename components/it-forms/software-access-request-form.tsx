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
import { SOFTWARE_ACCESS_OPTIONS } from "@/lib/app-system-options"
import { normalizeDepartmentName } from "@/lib/department-options"

export function SoftwareAccessRequestForm({ onSubmit }: { onSubmit: () => void }) {
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
    softwareName: "",
    otherSoftwareName: "",
    accessLevel: "standard",
    justification: "",
    urgency: "medium",
  })

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      staffName: user?.full_name || "",
      departmentName: normalizeDepartmentName(user?.department),
      requesterLocation: user?.location || "",
    }))
  }, [user?.full_name, user?.department, user?.location])

  const setValue = (name: string, value: string) => setForm((prev) => ({ ...prev, [name]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!form.softwareName || !form.justification.trim()) {
      setError("Software name and justification are required")
      return
    }
    if (form.softwareName === "Other" && !form.otherSoftwareName.trim()) {
      setError("Please provide the software/application name")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/it-forms/software-access", {
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
      if (!response.ok) throw new Error(data.error || "Failed to submit software access request")

      toast({ title: "Submitted", description: `Software access request ${data.requestNumber} sent to IT manager queue.` })
      onSubmit()

      setForm((prev) => ({
        ...prev,
        softwareName: "",
        otherSoftwareName: "",
        accessLevel: "standard",
        justification: "",
        urgency: "medium",
      }))
    } catch (err: any) {
      setError(err.message || "Failed to submit software access request")
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
          <Label>Software/Application *</Label>
          <Select value={form.softwareName} onValueChange={(value) => setValue("softwareName", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select software" />
            </SelectTrigger>
            <SelectContent>
              {SOFTWARE_ACCESS_OPTIONS.map((software) => (
                <SelectItem key={software} value={software}>{software}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Access Level *</Label>
          <Select value={form.accessLevel} onValueChange={(value) => setValue("accessLevel", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select access level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="view_only">View Only</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {form.softwareName === "Other" && (
        <div className="space-y-1">
          <Label>Other Software Name *</Label>
          <Input value={form.otherSoftwareName} onChange={(e) => setValue("otherSoftwareName", e.target.value)} required />
        </div>
      )}

      <div className="space-y-1">
        <Label>Business Justification *</Label>
        <Textarea
          value={form.justification}
          onChange={(e) => setValue("justification", e.target.value)}
          placeholder="Explain why this access is required and the expected usage."
          rows={3}
          required
        />
      </div>

      <div className="space-y-1">
        <Label>Urgency</Label>
        <Select value={form.urgency} onValueChange={(value) => setValue("urgency", value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Submitting..." : "Submit Software Access Request"}
      </Button>
    </form>
  )
}
