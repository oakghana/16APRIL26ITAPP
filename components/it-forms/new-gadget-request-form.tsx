"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { AlertCircle, Laptop } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { normalizeDepartmentName } from "@/lib/department-options"

export function NewGadgetRequestForm({ onSubmit }: { onSubmit: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { user } = useAuth()
  const { toast } = useToast()
  const userDepartment = normalizeDepartmentName(user?.department)

  const [formData, setFormData] = useState({
    // Section A - Requesting Staff Information
    staffName: user?.full_name || "",
    departmentName: userDepartment,
    complaintsFromUsers: "",
    requestDate: new Date().toISOString().split("T")[0],
    
    // Section B - Previous IT Gadget History
    makeOfGadget: "",
    serialNumber: "",
    yearOfPurchase: "",
    otherComments: "",
    
    // Section C - HOD Authorization
    departmentalHeadName: "",
    departmentalHeadDate: "",
    
    // Section D - IS Manager
    recommended: "",
    confirmedBy: "",
    confirmedDate: "",
  })

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      staffName: user?.full_name || "",
      departmentName: normalizeDepartmentName(user?.department),
    }))
  }, [user?.full_name, user?.department])

  const gadgetTypes = [
    "Laptop",
    "Desktop Computer",
    "Monitor",
    "Printer",
    "Scanner",
    "Keyboard",
    "Mouse",
    "UPS",
    "External Hard Drive",
    "USB Flash Drive",
    "Webcam",
    "Headset",
    "Network Switch",
    "Router",
    "Projector",
    "Other",
  ]

  const canEditOfficialSections = false

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
    if (!formData.complaintsFromUsers.trim()) {
      setError("Please describe the reason for requesting a new gadget")
      return
    }

    if (!formData.departmentName) {
      setError("Your department is not configured. Please contact admin to update your profile department.")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/it-forms/new-gadget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          submittedByRole: user?.role || "",
          submittedByEmail: user?.email || "",
          ...(canEditOfficialSections
            ? {}
            : {
                makeOfGadget: "",
                serialNumber: "",
                yearOfPurchase: "",
                otherComments: "",
                departmentalHeadName: "",
                departmentalHeadDate: "",
                recommended: "",
                confirmedBy: "",
                confirmedDate: "",
              }),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || "Failed to submit gadget request")
        toast({
          title: "Error",
          description: result.error || "Failed to submit gadget request",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Request Submitted",
        description: `Your new gadget request (${result.requestNumber}) has been sent to your HOD for approval`,
      })

      // Reset form
      setFormData({
        staffName: user?.full_name || "",
        departmentName: normalizeDepartmentName(user?.department),
        complaintsFromUsers: "",
        requestDate: new Date().toISOString().split("T")[0],
        makeOfGadget: "",
        serialNumber: "",
        yearOfPurchase: "",
        otherComments: "",
        departmentalHeadName: "",
        departmentalHeadDate: "",
        recommended: "",
        confirmedBy: "",
        confirmedDate: "",
      })

      onSubmit()
    } catch (err) {
      setError("Failed to submit gadget request")
      toast({
        title: "Error",
        description: "Failed to submit gadget request",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Generate year options from 2010 to current year
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: currentYear - 2009 }, (_, i) => (currentYear - i).toString())

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border bg-white/95 p-5 shadow-sm dark:bg-slate-950/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/qcc-logo.png" alt="QCC Logo" className="h-12 w-12 rounded-full border bg-white object-contain p-1" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Quality Control Company Limited</p>
              <h2 className="text-lg font-bold">New IT Gadget Request Form</h2>

            </div>
          </div>
          <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            Review fields are locked for staff submissions
          </div>
        </div>
      </div>
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md flex items-center gap-2 border border-destructive/20">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Section A - Requesting Staff Information */}
      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-semibold">SECTION A</div>
          <h3 className="font-semibold text-sm">Requesting Staff Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="staffName">Name of Staff Making Request *</Label>
            <Input
              id="staffName"
              name="staffName"
              value={formData.staffName}
              onChange={handleInputChange}
              placeholder="Your name"
              required
              disabled
              className="opacity-70"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="departmentName">Department Name *</Label>
            <Input
              id="departmentName"
              name="departmentName"
              value={formData.departmentName}
              disabled
              className="opacity-70"
            />
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <Label htmlFor="complaintsFromUsers">Reason for Request / Complaints *</Label>
          <Textarea
            id="complaintsFromUsers"
            name="complaintsFromUsers"
            value={formData.complaintsFromUsers}
            onChange={handleInputChange}
            placeholder="Describe why you need a new IT gadget (e.g., current device is beyond repair, need for new role, etc.)..."
            className="min-h-24"
            required
          />
        </div>

        <div className="space-y-2 mt-4">
          <Label htmlFor="requestDate">Date of Request</Label>
          <Input
            id="requestDate"
            name="requestDate"
            type="date"
            value={formData.requestDate}
            onChange={handleInputChange}
            disabled
            className="opacity-70 w-48"
          />
        </div>
      </div>

      {/* Section B - Previous IT Gadget History */}
      <div className="border rounded-lg p-4 bg-slate-100/80 dark:bg-slate-900/60 border-slate-300 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-orange-500/10 text-orange-600 px-2 py-1 rounded text-xs font-semibold">SECTION B</div>
          <h3 className="font-semibold text-sm">Previous IT Gadget History</h3>
          <span className="text-xs text-muted-foreground">(To be filled by IT Hardware Group)</span>
        </div>

        {!canEditOfficialSections && (
          <div className="mb-4 rounded-md border border-dashed border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300">
            This history block stays blank for staff submissions and is completed during technical review.
          </div>
        )}

        <fieldset disabled={!canEditOfficialSections} className={!canEditOfficialSections ? "opacity-60" : ""}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
            <Label htmlFor="makeOfGadget">Make of IT Gadget</Label>
            <Select value={formData.makeOfGadget} onValueChange={(value) => handleSelectChange("makeOfGadget", value)}>
              <SelectTrigger id="makeOfGadget">
                <SelectValue placeholder="Select gadget type" />
              </SelectTrigger>
              <SelectContent>
                {gadgetTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="serialNumber">Serial Number</Label>
            <Input
              id="serialNumber"
              name="serialNumber"
              value={formData.serialNumber}
              onChange={handleInputChange}
              placeholder="Enter serial number of current gadget"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="yearOfPurchase">Year of Purchase</Label>
            <Select value={formData.yearOfPurchase} onValueChange={(value) => handleSelectChange("yearOfPurchase", value)}>
              <SelectTrigger id="yearOfPurchase">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

          <div className="space-y-2 mt-4">
            <Label htmlFor="otherComments">Any Other Comments</Label>
            <Textarea
              id="otherComments"
              name="otherComments"
              value={formData.otherComments}
              onChange={handleInputChange}
              placeholder="Additional comments about the previous gadget condition..."
              className="min-h-16"
            />
          </div>
        </div>
        </fieldset>
      </div>

      {/* Section C - HOD Authorization */}
      <div className="border rounded-lg p-4 bg-slate-100/80 dark:bg-slate-900/60 border-slate-300 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-blue-500/10 text-blue-600 px-2 py-1 rounded text-xs font-semibold">SECTION C</div>
          <h3 className="font-semibold text-sm">Authorization from Head of Department</h3>
        </div>

        {!canEditOfficialSections && (
          <div className="mb-4 rounded-md border border-dashed border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
            This approval block is reserved for the review workflow and stays blank for staff submissions.
          </div>
        )}

        <fieldset disabled={!canEditOfficialSections} className={!canEditOfficialSections ? "opacity-60" : ""}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="departmentalHeadName">Name of Departmental Head</Label>
              <Input
                id="departmentalHeadName"
                name="departmentalHeadName"
                value={formData.departmentalHeadName}
                onChange={handleInputChange}
                placeholder="HOD name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departmentalHeadDate">Date</Label>
              <Input
                id="departmentalHeadDate"
                name="departmentalHeadDate"
                type="date"
                value={formData.departmentalHeadDate}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </fieldset>
      </div>

      {/* Section D - IS Manager */}
      <div className="border rounded-lg p-4 bg-slate-100/80 dark:bg-slate-900/60 border-slate-300 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-green-500/10 text-green-600 px-2 py-1 rounded text-xs font-semibold">SECTION D</div>
          <h3 className="font-semibold text-sm">IS Manager / Office Use Only</h3>
        </div>

        {!canEditOfficialSections && (
          <div className="mb-4 rounded-md border border-dashed border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
            This section is locked for your role.
          </div>
        )}

        <fieldset disabled={!canEditOfficialSections} className={!canEditOfficialSections ? "opacity-60" : ""}>
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Recommended?</Label>
              <RadioGroup
                value={formData.recommended}
                onValueChange={(value) => handleSelectChange("recommended", value)}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="recommended_yes" />
                  <Label htmlFor="recommended_yes" className="font-normal cursor-pointer">
                    Yes
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="recommended_no" />
                  <Label htmlFor="recommended_no" className="font-normal cursor-pointer">
                    No
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="confirmedBy">Confirmed By</Label>
                <Input
                  id="confirmedBy"
                  name="confirmedBy"
                  value={formData.confirmedBy}
                  onChange={handleInputChange}
                  placeholder="IS Manager name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmedDate">Date</Label>
                <Input
                  id="confirmedDate"
                  name="confirmedDate"
                  type="date"
                  value={formData.confirmedDate}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
        </fieldset>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={loading} size="lg" className="gap-2">
          <Laptop className="h-4 w-4" />
          {loading ? "Submitting..." : "Submit New Gadget Request"}
        </Button>
      </div>
    </form>
  )
}
