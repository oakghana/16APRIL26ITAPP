"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { AlertCircle, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { normalizeDepartmentName } from "@/lib/department-options"

const SYSTEM_OPTIONS = [
  "Email System",
  "PF and Mutual System",
  "Marketing App",
  "ACCPAC",
  "PERSOL",
  "SharePoint",
  "Loan App",
  "Wireless Access",
  "Asset App",
  "Chemstore App",
  "Other",
] as const

export function PasswordResetRequestForm({ onSubmit }: { onSubmit: () => void }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const department = useMemo(() => normalizeDepartmentName(user?.department), [user?.department])

  const [formData, setFormData] = useState({
    staffName: user?.full_name || "",
    departmentName: department,
    requesterLocation: user?.location || "",
    requestDate: new Date().toISOString().split("T")[0],
    systemName: "",
    otherSystemName: "",
    accountIdentifier: user?.email || "",
    issueSummary: "",
    urgency: "medium",
  })

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      staffName: user?.full_name || "",
      departmentName: normalizeDepartmentName(user?.department),
      requesterLocation: user?.location || "",
      accountIdentifier: prev.accountIdentifier || user?.email || "",
    }))
  }, [user?.full_name, user?.department, user?.location, user?.email])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelect = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!formData.systemName) {
      setError("Please select the system/application for this password reset")
      return
    }

    if (formData.systemName === "Other" && !formData.otherSystemName.trim()) {
      setError("Please enter the custom system/application name")
      return
    }

    if (!formData.accountIdentifier.trim()) {
      setError("Please enter the affected account/email/username")
      return
    }

    if (!formData.issueSummary.trim()) {
      setError("Please provide a short issue description")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/it-forms/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          requestedById: user?.id,
          requestedByEmail: user?.email,
          submittedByRole: user?.role,
          submittedByEmail: user?.email,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit password reset request")
      }

      toast({
        title: "Password Reset Request Submitted",
        description: `Request ${result.requestNumber} has been submitted to IT manager for assignment.`,
      })

      setFormData({
        staffName: user?.full_name || "",
        departmentName: normalizeDepartmentName(user?.department),
        requesterLocation: user?.location || "",
        requestDate: new Date().toISOString().split("T")[0],
        systemName: "",
        otherSystemName: "",
        accountIdentifier: user?.email || "",
        issueSummary: "",
        urgency: "medium",
      })

      onSubmit()
    } catch (err: any) {
      setError(err.message || "Failed to submit password reset request")
      toast({
        title: "Submission Failed",
        description: err.message || "Failed to submit password reset request",
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
              <h2 className="text-lg font-bold">Password Reset Request Form</h2>
            </div>
          </div>
          <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            No HOD approval required
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-semibold">SECTION A</div>
          <h3 className="font-semibold text-sm">Requester Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="staffName">Requester Name</Label>
            <Input id="staffName" name="staffName" value={formData.staffName} disabled className="opacity-70" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="departmentName">Department</Label>
            <Input id="departmentName" name="departmentName" value={formData.departmentName} disabled className="opacity-70" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="requesterLocation">Location</Label>
            <Input id="requesterLocation" name="requesterLocation" value={formData.requesterLocation} disabled className="opacity-70" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="requestDate">Request Date</Label>
            <Input id="requestDate" name="requestDate" type="date" value={formData.requestDate} disabled className="opacity-70" />
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-semibold">SECTION B</div>
          <h3 className="font-semibold text-sm">Password Reset Details</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>System/Application *</Label>
            <Select value={formData.systemName} onValueChange={(v) => handleSelect("systemName", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose system" />
              </SelectTrigger>
              <SelectContent>
                {SYSTEM_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Urgency *</Label>
            <Select value={formData.urgency} onValueChange={(v) => handleSelect("urgency", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {formData.systemName === "Other" && (
          <div className="space-y-2 mt-4">
            <Label htmlFor="otherSystemName">Other System/Application Name *</Label>
            <Input
              id="otherSystemName"
              name="otherSystemName"
              value={formData.otherSystemName}
              onChange={handleInput}
              placeholder="Enter system name not listed above"
              required
            />
          </div>
        )}

        <div className="space-y-2 mt-4">
          <Label htmlFor="accountIdentifier">Affected Account / Email / Username *</Label>
          <Input
            id="accountIdentifier"
            name="accountIdentifier"
            value={formData.accountIdentifier}
            onChange={handleInput}
            placeholder="e.g. your.name@company.com or DOMAIN\\username"
            required
          />
        </div>

        <div className="space-y-2 mt-4">
          <Label htmlFor="issueSummary">Issue Summary *</Label>
          <Textarea
            id="issueSummary"
            name="issueSummary"
            value={formData.issueSummary}
            onChange={handleInput}
            className="min-h-24"
            placeholder="Briefly describe what is preventing access and any urgency context"
            required
          />
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={loading} className="min-w-40">
          <KeyRound className="h-4 w-4 mr-2" />
          {loading ? "Submitting..." : "Submit Request"}
        </Button>
      </div>
    </form>
  )
}
