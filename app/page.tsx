"use client"

import { useEffect, useState } from "react"
import { safeJsonParse, safeStorage } from "@/lib/utils"
import { LoginForm } from "@/components/auth/login-form"
import Image from "next/image"
import { Activity, Laptop, LifeBuoy, Package, ShieldCheck } from "lucide-react"

const ROLE_LANDING: Record<string, string> = {
  admin: "/dashboard/admin",
  it_store_head: "/dashboard/store-inventory",
  it_staff: "/dashboard/assigned-tasks",
  department_head: "/dashboard/department-head",
  staff: "/dashboard/service-desk",
}

const HIGHLIGHTS = [
  {
    icon: LifeBuoy,
    title: "Report a problem in minutes",
    description: "Log a fault from your phone or desk and the IT team picks it up straight away.",
  },
  {
    icon: Activity,
    title: "Follow your repair live",
    description: "See each step — received, in progress, ready — without calling anyone to chase it.",
  },
  {
    icon: Package,
    title: "Request devices and stock",
    description: "Ask for a laptop, toner or accessory and track the approval as it moves.",
  },
  {
    icon: ShieldCheck,
    title: "Only what concerns you",
    description: "Your dashboard shows the tasks and records meant for your role and branch.",
  },
]

export default function HomePage() {
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const savedUser = safeStorage.get("qcc_current_user")
    if (savedUser) {
      const user = safeJsonParse<any>(savedUser, null)
      if (user?.role) {
        window.location.href = ROLE_LANDING[user.role] ?? "/dashboard"
        return
      }
      safeStorage.remove("qcc_current_user")
    }
    setIsChecking(false)
  }, [])

  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 p-2 shadow-lg flex items-center justify-center">
            <Image src="/images/qcc-logo.png" alt="" width={56} height={56} className="object-contain" priority />
          </div>
          <p className="text-base font-medium text-muted-foreground">Checking your session…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#sign-in"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to sign in
      </a>

      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* Brand panel: a compact banner on phones, a full column on large screens */}
        <header className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-zinc-900 px-6 py-8 lg:w-1/2 lg:px-12 lg:py-12">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-yellow-500/20 blur-3xl" />
            <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-amber-400/20 blur-3xl" />
          </div>

          <div className="relative z-10 flex h-full flex-col gap-8 lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 p-2 shadow-lg lg:h-16 lg:w-16">
                <Image
                  src="/images/qcc-logo.png"
                  alt="Quality Control Company logo"
                  width={56}
                  height={56}
                  className="object-contain"
                  priority
                />
              </div>
              <div>
                <p className="text-lg font-bold text-white lg:text-2xl">QCC IT Tracker</p>
                <p className="text-sm text-yellow-300">IT support for every QCC branch</p>
              </div>
            </div>

            <div className="hidden lg:block">
              <h1 className="text-balance text-4xl font-bold text-white">Get IT help without the back and forth</h1>
              <p className="mt-4 text-pretty text-lg text-slate-300">
                Report a fault, request a device and follow the progress yourself — from Head Office to every regional
                branch.
              </p>
            </div>

            <ul className="hidden gap-3 lg:grid">
              {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
                <li
                  key={title}
                  className="flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-slate-800/60 p-4 backdrop-blur-sm"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 shadow">
                    <Icon className="h-5 w-5 text-slate-900" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-semibold text-white">{title}</h2>
                    <p className="text-sm text-slate-300">{description}</p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="hidden text-sm text-slate-400 lg:block">
              © {new Date().getFullYear()} QCC IT Department · Serving all our Ghana branches.
            </p>
          </div>
        </header>

        {/* Sign-in panel: first thing a phone user reaches */}
        <main id="sign-in" className="flex flex-1 items-center justify-center px-4 py-10 lg:px-12">
          <div className="w-full max-w-md space-y-8">
            <h1 className="text-center text-2xl font-bold lg:sr-only">Sign in to QCC IT Tracker</h1>

            <LoginForm />

            {/* Repeated on small screens where the brand column's list is hidden */}
            <section aria-label="What you can do here" className="space-y-3 lg:hidden">
              {HIGHLIGHTS.slice(0, 3).map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex items-start gap-3 rounded-lg border bg-card p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/20">
                    <Icon className="h-5 w-5 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold">{title}</h2>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </section>

            <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground lg:hidden">
              <Laptop className="h-4 w-4" aria-hidden="true" />© {new Date().getFullYear()} QCC IT Department
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}

