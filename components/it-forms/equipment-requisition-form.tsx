"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, FileText, ShieldCheck } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"

export function ITEquipmentRequisitionForm({ onSubmit }: { onSubmit: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { user } = useAuth()
  const { toast } = useToast()
  const canEditOfficialSections = false

  const [formData, setFormData] = useState({
    itemSN: "",
    supplierName: "",
    itemsRequired: "",
    purpose: "",
    requestedBy: user?.full_name || "",
    requestedById: user?.id || "",
    requestedByEmail: user?.email || "",
    department: "",
    requestDate: new Date().toISOString().split("T")[0],
  })

  const departments = [
    "Finance",
    "Human Resources",
    "Operations",
    "IT",
    "Marketing",
    "Sales",
    "Procurement",
    "Administration",
    "Other",
  ]

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validation
    if (!formData.itemsRequired.trim()) {
      setError("Please specify the items required")
      return
    }

    if (!formData.purpose.trim()) {
      setError("Please specify the purpose of the requisition")
      return
    }

    if (!formData.department) {
      setError("Please select a department")
      return
    }

    setLoading(true)

    try {
      console.log("[v0] Submitting IT equipment requisition:", formData)

      const response = await fetch("/api/it-forms/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          submittedByRole: user?.role || "",
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error("[v0] Error saving requisition:", result.error)
        setError(result.error || "Failed to save requisition")
        toast({
          title: "Error",
          description: result.error || "Failed to save requisition",
          variant: "destructive",
        })
        return
      }

      console.log("[v0] IT Requisition saved successfully:", result)
      toast({
        title: "✓ Requisition Created",
        description: `Your IT equipment requisition (${result.requisitionNumber}) has been sent to your HOD for approval`,
      })

      // Reset form
      setFormData({
        itemSN: "",
        supplierName: "",
        itemsRequired: "",
        purpose: "",
        requestedBy: user?.full_name || "",
        requestedById: user?.id || "",
        requestedByEmail: user?.email || "",
        department: "",
        requestDate: new Date().toISOString().split("T")[0],
      })

      onSubmit()
    } catch (err) {
      console.error("[v0] Error:", err)
      setError("Failed to save requisition")
      toast({
        title: "Error",
        description: "Failed to save requisition",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border bg-white/95 p-5 shadow-sm dark:bg-slate-950/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/qcc-logo.png" alt="QCC Logo" className="h-12 w-12 rounded-full border bg-white object-contain p-1" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Quality Control Company Limited</p>
              <h2 className="text-lg font-bold">IT Equipment Requisition Form</h2>

            </div>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700"><FileText className="h-3 w-3" /> Form layout</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700"><ShieldCheck className="h-3 w-3" /> Reviewer lock</span>
          </div>
        </div>
      </div>
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md flex items-center gap-2 border border-destructive/20">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="border rounded-lg p-4 bg-muted/30">
        <h3 className="font-semibold text-sm mb-4">Requisition Details</h3>
        <div className="mb-4 rounded-md border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Item S/N is auto-generated during store issuance. Supplier Name is entered by IT Store Head after IT Manager / IT Head / Admin approval.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="itemSN">Item S/N</Label>
            <Input
              id="itemSN"
              name="itemSN"
              value={formData.itemSN}
              onChange={handleInputChange}
              placeholder="Auto-generated at store issuance"
              disabled
              className="opacity-70"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplierName">Supplier Name</Label>
            <Input
              id="supplierName"
              name="supplierName"
              value={formData.supplierName}
              onChange={handleInputChange}
              placeholder="Provided by IT Store Head"
              disabled
              className="opacity-70"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
        <h3 className="font-semibold text-sm mb-4">Request Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="requestedBy">Requested By *</Label>
            <Input
              id="requestedBy"
              name="requestedBy"
              value={formData.requestedBy}
              onChange={handleInputChange}
              placeholder="Your name"
              required
              disabled
              className="opacity-70"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department *</Label>
            <Select value={formData.department} onValueChange={(value) => handleSelectChange("department", value)}>
              <SelectTrigger id="department">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <Label htmlFor="requestDate">Request Date</Label>
          <Input
            id="requestDate"
            name="requestDate"
            type="date"
            value={formData.requestDate}
            onChange={handleInputChange}
            disabled
            className="opacity-70"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
        <h3 className="font-semibold text-sm mb-4">Items & Purpose</h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="itemsRequired">Items Required *</Label>
            <Textarea
              id="itemsRequired"
              name="itemsRequired"
              value={formData.itemsRequired}
              onChange={handleInputChange}
              placeholder="List all items you are requesting (e.g., 2x Toner Cartridge HP 125A, 1x USB Drive 32GB, etc.)"
              className="min-h-24"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose *</Label>
            <Textarea
              id="purpose"
              name="purpose"
              value={formData.purpose}
              onChange={handleInputChange}
              placeholder="Explain the purpose for this requisition and why these items are needed"
              className="min-h-20"
              required
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-300 bg-slate-100/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-blue-500/10 text-blue-600 px-2 py-1 rounded text-xs font-semibold">SECTION C</div>
          <h3 className="font-semibold text-sm">Authorization from Head of Department</h3>
        </div>
        <div className="mb-4 rounded-md border border-dashed border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
          This area is completed during HOD review and remains blank at submission time.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">
          <Input placeholder="Name of sectional head" disabled={!canEditOfficialSections} />
          <Input type="date" disabled={!canEditOfficialSections} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-300 bg-slate-100/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-green-500/10 text-green-600 px-2 py-1 rounded text-xs font-semibold">SECTION D</div>
          <h3 className="font-semibold text-sm">IS Manager / Office Use Only</h3>
        </div>
        <div className="mb-4 rounded-md border border-dashed border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
          This section is locked for your role.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">
          <Input placeholder="Confirmed by" disabled={!canEditOfficialSections} />
          <Input type="date" disabled={!canEditOfficialSections} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={loading} size="lg">
          {loading ? "Submitting..." : "Submit Requisition"}
        </Button>
      </div>
    </form>
  )
}
