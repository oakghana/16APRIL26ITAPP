"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  User,
  Mail,
  MapPin,
  Building2,
  Briefcase,
  CheckCircle2,
  Copy,
  Check,
  LogIn,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { LOCATIONS, type LocationKey } from "@/lib/locations"
import { useToast } from "@/hooks/use-toast"

export interface PendingUser {
  id: string
  name: string
  email: string
  phone: string
  location: LocationKey
  department: string
  supervisor: string
  jobTitle: string
  reason: string
  requestedBy: string
  requestedDate: string
  status: "pending" | "approved" | "rejected"
  notes?: string
  temporaryPassword?: string
}

interface CreateUserFormProps {
  onUserCreated: (user: PendingUser) => void
  onClose?: () => void
}

const DEFAULT_PASSWORD = "password"

const DEPARTMENTS = [
  "ITD", "Marketing", "Audit", "Accounts", "Research",
  "Estate", "Security", "Operations", "Procurement", "HR",
  "Legal", "Finance", "Customer Service", "Administration", "Other",
]

function FieldRow({ label, icon: Icon, children, className }: {
  label: string
  icon: React.ElementType
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </Label>
      {children}
    </div>
  )
}

export function CreateUserForm({ onUserCreated, onClose }: CreateUserFormProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const isPublicAccess = !user
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showDefaultPw, setShowDefaultPw] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    location: (user?.location || "head_office") as LocationKey,
    department: "",
    supervisor: "",
    jobTitle: "",
    reason: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.email,
          email: formData.email,
          fullName: formData.name,
          phone: formData.phone,
          department: formData.department,
          location: formData.location,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || "Registration failed")
      }

      const newPendingUser: PendingUser = {
        id: result.userId || `USR-${String(Date.now()).slice(-6)}`,
        ...formData,
        requestedBy: user?.name || "Self-Registration",
        requestedDate: new Date().toISOString(),
        status: "approved",
        temporaryPassword: DEFAULT_PASSWORD,
      }

      onUserCreated(newPendingUser)
      setSubmitted(true)
    } catch (error) {
      toast({
        title: "Registration Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const copyPassword = () => {
    navigator.clipboard.writeText(DEFAULT_PASSWORD).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="space-y-6">
        {/* Green success banner */}
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-6 text-center">
          <div className="flex justify-center mb-3">
            <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100 mb-1">
            Account Created Successfully!
          </h3>
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Welcome, <strong>{formData.name}</strong>. Your account is active and ready to use.
          </p>
        </div>

        {/* Password card */}
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-5">
          <div className="flex items-center gap-2 mb-3">
            <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Your Default Login Password</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-700 px-4 py-3 font-mono text-lg font-bold tracking-widest text-amber-700 dark:text-amber-300 select-all">
              {showDefaultPw ? DEFAULT_PASSWORD : "•".repeat(DEFAULT_PASSWORD.length)}
            </div>
            <button
              type="button"
              onClick={() => setShowDefaultPw((v) => !v)}
              className="p-2.5 rounded-xl border border-amber-200 dark:border-amber-700 bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
            >
              {showDefaultPw ? <EyeOff className="h-4 w-4 text-amber-600" /> : <Eye className="h-4 w-4 text-amber-600" />}
            </button>
            <button
              type="button"
              onClick={copyPassword}
              className="p-2.5 rounded-xl border border-amber-200 dark:border-amber-700 bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-amber-600" />}
            </button>
          </div>
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            Use this password to log in. You will be asked to <strong>change it immediately</strong> on first login for security.
          </p>
        </div>

        {/* Account summary */}
        <div className="rounded-2xl border bg-muted/30 p-4 space-y-2 text-sm">
          <p className="font-semibold text-foreground mb-2">Account Summary</p>
          {[
            { label: "Name", value: formData.name },
            { label: "Email / Username", value: formData.email },
            { label: "Location", value: LOCATIONS[formData.location] },
            { label: "Department", value: formData.department },
            { label: "Status", value: "Active — registered by you" },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-4">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium text-right">{value}</span>
            </div>
          ))}
        </div>

        <Button
          className="w-full h-11 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold"
          onClick={() => (window.location.href = "/")}
        >
          <LogIn className="mr-2 h-4 w-4" />
          Go to Login
        </Button>
      </div>
    )
  }

  // ── Registration form ───────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Info banner */}
      <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-4 py-3 flex gap-3 items-start">
        <KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
          Your account is activated <strong>instantly</strong>. A default password of{" "}
          <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded font-mono font-bold">password</code> will be
          assigned — you must change it on first login.
        </p>
      </div>

      {/* Section: Personal */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Personal Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldRow label="Full Name *" icon={User}>
            <Input
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="e.g. Kwame Asante"
              required
              className="h-10"
            />
          </FieldRow>
          <FieldRow label="Email Address *" icon={Mail}>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              placeholder="kwame@qcc.com.gh"
              required
              className="h-10"
            />
          </FieldRow>
          <FieldRow label="Phone Number *" icon={Mail}>
            <Input
              value={formData.phone}
              onChange={(e) => handleInputChange("phone", e.target.value)}
              placeholder="+233 XX XXX XXXX"
              required
              className="h-10"
            />
          </FieldRow>
          <FieldRow label="Location *" icon={MapPin}>
            <Select value={formData.location} onValueChange={(v) => handleInputChange("location", v)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LOCATIONS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
      </div>

      {/* Section: Job */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Job Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldRow label="Job Title *" icon={Briefcase}>
            <Input
              value={formData.jobTitle}
              onChange={(e) => handleInputChange("jobTitle", e.target.value)}
              placeholder="e.g. Administrative Assistant"
              required
              className="h-10"
            />
          </FieldRow>
          <FieldRow label="Department *" icon={Building2}>
            <Select value={formData.department} onValueChange={(v) => handleInputChange("department", v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Direct Supervisor / Manager *" icon={User} className="sm:col-span-2">
            <Input
              value={formData.supervisor}
              onChange={(e) => handleInputChange("supervisor", e.target.value)}
              placeholder="Name of your direct supervisor"
              required
              className="h-10"
            />
          </FieldRow>
        </div>
      </div>

      {/* Section: Justification */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Justification</p>
        <FieldRow label="Reason for Account Request *" icon={Mail}>
          <Textarea
            value={formData.reason}
            onChange={(e) => handleInputChange("reason", e.target.value)}
            placeholder="Briefly explain your job responsibilities and why you need access..."
            className="min-h-[90px] resize-none"
            required
          />
        </FieldRow>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {onClose && (
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 h-11 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Account…
            </>
          ) : (
            <>
              <User className="mr-2 h-4 w-4" />
              Create My Account
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
