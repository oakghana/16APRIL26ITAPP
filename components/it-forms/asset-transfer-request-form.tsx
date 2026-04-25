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

export function AssetTransferRequestForm({ onSubmit }: { onSubmit: () => void }) {
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
    assetType: "",
    assetDescription: "",
    serialNumber: "",
    fromDepartment: department,
    fromLocation: user?.location || "",
    toDepartment: "",
    toLocation: "",
    transferReason: "",
    handoverCondition: "good",
  })

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      staffName: user?.full_name || "",
      departmentName: normalizeDepartmentName(user?.department),
      requesterLocation: user?.location || "",
      fromDepartment: prev.fromDepartment || normalizeDepartmentName(user?.department),
      fromLocation: prev.fromLocation || user?.location || "",
    }))
  }, [user?.full_name, user?.department, user?.location])

  const setValue = (name: string, value: string) => setForm((prev) => ({ ...prev, [name]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!form.assetType.trim() || !form.assetDescription.trim() || !form.fromDepartment.trim() || !form.fromLocation.trim() || !form.toDepartment.trim() || !form.toLocation.trim() || !form.transferReason.trim()) {
      setError("Please complete all required fields")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/it-forms/asset-transfer", {
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
      if (!response.ok) throw new Error(data.error || "Failed to submit asset transfer request")

      toast({ title: "Submitted", description: `Asset transfer request ${data.requestNumber} sent to IT manager queue.` })
      onSubmit()

      setForm((prev) => ({
        ...prev,
        assetType: "",
        assetDescription: "",
        serialNumber: "",
        toDepartment: "",
        toLocation: "",
        transferReason: "",
        handoverCondition: "good",
      }))
    } catch (err: any) {
      setError(err.message || "Failed to submit asset transfer request")
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
          <Label>Asset Type *</Label>
          <Input value={form.assetType} onChange={(e) => setValue("assetType", e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>Serial Number</Label>
          <Input value={form.serialNumber} onChange={(e) => setValue("serialNumber", e.target.value)} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Asset Description *</Label>
        <Textarea value={form.assetDescription} onChange={(e) => setValue("assetDescription", e.target.value)} rows={3} required />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label>From Department *</Label>
          <Input value={form.fromDepartment} onChange={(e) => setValue("fromDepartment", e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>From Location *</Label>
          <Input value={form.fromLocation} onChange={(e) => setValue("fromLocation", e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>To Department *</Label>
          <Input value={form.toDepartment} onChange={(e) => setValue("toDepartment", e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>To Location *</Label>
          <Input value={form.toLocation} onChange={(e) => setValue("toLocation", e.target.value)} required />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Transfer Reason *</Label>
        <Textarea value={form.transferReason} onChange={(e) => setValue("transferReason", e.target.value)} rows={2} required />
      </div>

      <div className="space-y-1">
        <Label>Handover Condition</Label>
        <Select value={form.handoverCondition} onValueChange={(value) => setValue("handoverCondition", value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="good">Good</SelectItem>
            <SelectItem value="fair">Fair</SelectItem>
            <SelectItem value="needs_repair">Needs Repair</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Submitting..." : "Submit Asset Transfer Request"}
      </Button>
    </form>
  )
}
