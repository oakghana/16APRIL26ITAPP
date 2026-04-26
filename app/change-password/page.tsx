"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KeyRound, Eye, EyeOff, CheckCircle2, Loader2, ShieldAlert, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { safeJsonParse, safeStorage } from "@/lib/utils"

const MIN_LENGTH = 8

function StrengthBar({ password }: { password: string }) {
  const checks = [
    password.length >= MIN_LENGTH,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const strength = checks.filter(Boolean).length
  const labels = ["", "Weak", "Fair", "Good", "Strong"]
  const colors = ["", "bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-emerald-500"]
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-300",
              i <= strength ? colors[strength] : "bg-muted",
            )}
          />
        ))}
      </div>
      {password.length > 0 && (
        <p className={cn("text-xs font-medium", strength < 2 ? "text-red-500" : strength < 4 ? "text-orange-500" : "text-emerald-600")}>
          {labels[strength]}
        </p>
      )}
    </div>
  )
}

function ChangePasswordContent() {
  const searchParams = useSearchParams()
  const reason = searchParams.get("reason") || "required"

  const [username, setUsername] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")
  const [redirectUrl, setRedirectUrl] = useState("/dashboard")

  useEffect(() => {
    // Get the logged-in user from localStorage
    const raw = safeStorage.get("qcc_current_user")
    const user = safeJsonParse<{ username?: string; role?: string; email?: string } | null>(raw, null)
    if (user?.username) setUsername(user.username)
    if (user?.email && !user?.username) setUsername(user.email)
    // Determine redirect after change
    if (user?.role === "admin") setRedirectUrl("/dashboard/admin")
    else if (user?.role === "it_store_head") setRedirectUrl("/dashboard/store-inventory")
    else if (user?.role === "it_staff") setRedirectUrl("/dashboard/assigned-tasks")
    else if (user?.role === "staff") setRedirectUrl("/dashboard/service-desk")
    else if (user?.role?.startsWith("service_desk_")) setRedirectUrl("/dashboard/service-desk")
  }, [])

  const isNewUser = reason === "new_user"
  const isExpired = reason === "password_expired"

  const validate = () => {
    if (newPassword.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters.`
    if (newPassword !== confirmPassword) return "Passwords do not match."
    if (isNewUser && newPassword === "password") return "You cannot keep the default password. Please choose a new one."
    return ""
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, newPassword }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to change password")
      setDone(true)
      // Update localStorage to remove forceChange flag visually
      const raw = safeStorage.get("qcc_current_user")
      const user = safeJsonParse<Record<string, unknown> | null>(raw, null)
      if (user) safeStorage.set("qcc_current_user", JSON.stringify({ ...user, must_change_password: false }))
      setTimeout(() => { window.location.href = redirectUrl }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground">Password Changed!</h2>
        <p className="text-muted-foreground text-sm">Redirecting you to your dashboard…</p>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Reason banner */}
      <div className={cn(
        "rounded-xl border px-4 py-3 flex gap-3 items-start",
        isNewUser
          ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
          : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
      )}>
        {isExpired ? (
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        )}
        <p className={cn(
          "text-xs leading-relaxed",
          isNewUser ? "text-blue-800 dark:text-blue-300" : "text-amber-800 dark:text-amber-300",
        )}>
          {isNewUser
            ? "You're using the default password. You must set a personal password before accessing the app."
            : isExpired
              ? "Your password has not been changed in over 90 days (quarterly policy). Please set a new one to continue."
              : "You are required to change your password before continuing."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* New password */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">New Password</Label>
          <div className="relative">
            <Input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="h-11 pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <StrengthBar password={newPassword} />
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Confirm New Password</Label>
          <div className="relative">
            <Input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your new password"
              className={cn(
                "h-11 pr-10",
                confirmPassword && confirmPassword !== newPassword && "border-red-400 focus-visible:ring-red-400",
              )}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {confirmPassword && confirmPassword !== newPassword && (
            <p className="text-xs text-red-500">Passwords do not match</p>
          )}
        </div>

        {/* Requirements */}
        <ul className="text-xs text-muted-foreground space-y-1">
          {[
            { ok: newPassword.length >= MIN_LENGTH, text: `At least ${MIN_LENGTH} characters` },
            { ok: /[A-Z]/.test(newPassword), text: "One uppercase letter" },
            { ok: /[0-9]/.test(newPassword), text: "One number" },
            { ok: /[^A-Za-z0-9]/.test(newPassword), text: "One special character (e.g. @, #, !)" },
          ].map(({ ok, text }) => (
            <li key={text} className="flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-muted-foreground/40")} />
              <span className={ok ? "text-emerald-600 dark:text-emerald-400" : ""}>{text}</span>
            </li>
          ))}
        </ul>

        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <KeyRound className="mr-2 h-4 w-4" />
              Set New Password
            </>
          )}
        </Button>
      </form>
    </div>
  )
}

export default function ChangePasswordPage() {
  return (
    <div className="min-h-screen bg-[#f8f7f4] dark:bg-[#0f0f0f] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <img
              src="/images/qcc-logo.png"
              alt="QCC Logo"
              className="h-12 w-12 rounded-xl object-contain bg-white border shadow-sm p-1"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">QCC</p>
              <p className="font-bold text-foreground text-sm leading-tight">IT Tracking System</p>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border shadow-sm p-7">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Change Your Password</h1>
              <p className="text-xs text-muted-foreground">Required before you can access the app</p>
            </div>
          </div>

          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
            <ChangePasswordContent />
          </Suspense>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Need help?{" "}
          <a href="mailto:infor@qccgh.com" className="text-orange-600 hover:underline font-medium">
            infor@qccgh.com
          </a>
        </p>
      </div>
    </div>
  )
}
