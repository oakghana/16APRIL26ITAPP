"use client"

import { useEffect, useState } from "react"
import { safeJsonParse, safeStorage } from "@/lib/utils"
import { LoginForm } from "@/components/auth/login-form"
import Image from "next/image"

export default function HomePage() {
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Check if user is already logged in
    const savedUser = safeStorage.get("qcc_current_user")
    if (savedUser) {
      try {
        const user = safeJsonParse<any>(savedUser, null)
        if (!user) throw new Error("Invalid saved session")
        // Redirect to appropriate dashboard
        let redirectUrl = "/dashboard"
        if (user.role === "admin") {
          redirectUrl = "/dashboard/admin"
        } else if (user.role === "it_store_head") {
          redirectUrl = "/dashboard/store-inventory"
        } else if (user.role === "it_staff") {
          redirectUrl = "/dashboard/assigned-tasks"
        } else if (user.role === "department_head") {
          redirectUrl = "/dashboard/department-head"
        } else if (user.role === "staff") {
          redirectUrl = "/dashboard/service-desk"
        }
        window.location.href = redirectUrl
        return
      } catch (e) {
        safeStorage.remove("qcc_current_user")
      }
    }
    setIsChecking(false)
  }, [])

  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-800 via-slate-900 to-zinc-900 p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-30">
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="circuit" width="100" height="100" patternUnits="userSpaceOnUse">
                <line x1="0" y1="20" x2="100" y2="20" stroke="rgb(234, 179, 8)" strokeWidth="1.5" opacity="0.6" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="rgb(234, 179, 8)" strokeWidth="1.5" opacity="0.6" />
                <line x1="0" y1="80" x2="100" y2="80" stroke="rgb(234, 179, 8)" strokeWidth="1.5" opacity="0.6" />
                <line x1="30" y1="0" x2="30" y2="100" stroke="rgb(251, 191, 36)" strokeWidth="1.5" opacity="0.6" />
                <line x1="70" y1="0" x2="70" y2="100" stroke="rgb(251, 191, 36)" strokeWidth="1.5" opacity="0.6" />
                <circle cx="30" cy="20" r="3" fill="rgb(234, 179, 8)" opacity="0.8" />
                <circle cx="70" cy="20" r="3" fill="rgb(251, 191, 36)" opacity="0.8" />
                <circle cx="30" cy="50" r="3" fill="rgb(251, 191, 36)" opacity="0.8" />
                <circle cx="70" cy="50" r="3" fill="rgb(234, 179, 8)" opacity="0.8" />
                <circle cx="30" cy="80" r="3" fill="rgb(234, 179, 8)" opacity="0.8" />
                <circle cx="70" cy="80" r="3" fill="rgb(251, 191, 36)" opacity="0.8" />
                <path d="M 10 10 L 15 5 L 20 10 L 15 15 Z" fill="rgb(234, 179, 8)" opacity="0.5" />
                <rect x="85" y="85" width="10" height="10" fill="rgb(251, 191, 36)" opacity="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#circuit)" />
          </svg>
          <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-600/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-yellow-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-16 w-16 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl p-2 shadow-xl flex items-center justify-center">
              <Image src="/images/qcc-logo.png" alt="QCC Logo" width={56} height={56} className="object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">QCC IT TRACKER</h1>
              <p className="text-yellow-400 text-sm">Your IT support family across all QCC branches</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-bold text-white mb-4 text-balance">Your IT Help, Fast & Simple</h2>
            <p className="text-xl text-slate-300 text-pretty">
              Whether your laptop is misbehaving or you need a new account — the QCC IT team has got you, from Accra to every branch.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="flex items-start gap-3 bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-yellow-500/20 hover:border-yellow-500/40 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">See Everything Live</h3>
                <p className="text-sm text-slate-400">Know exactly where your device is and how your repair is going — no chasing!</p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-yellow-500/20 hover:border-yellow-500/40 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Safe & Trustworthy</h3>
                <p className="text-sm text-slate-400">Your data stays in the right hands — each role sees only what's meant for them.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-yellow-500/20 hover:border-yellow-500/40 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Smart Reporting</h3>
                <p className="text-sm text-slate-400">All the numbers you need to make sharp decisions — in one place.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-slate-400 text-sm">
          <p>© 2026 QCC IT Department · Serving all our Ghana branches with pride.</p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-12">
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
