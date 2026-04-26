"use client"
import { CreateUserForm } from "@/components/auth/create-user-form"
import { ArrowLeft, Shield, Zap, Users } from "lucide-react"

export default function PublicCreateAccountPage() {
  const handleUserCreated = (user: any) => {
    // Account is auto-approved; user can login immediately
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4] dark:bg-[#0f0f0f] flex flex-col lg:flex-row">
      {/* ── Left panel (branding) ── */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[38%] bg-gradient-to-br from-orange-600 via-amber-500 to-yellow-400 flex-col justify-between p-10 xl:p-14 relative overflow-hidden">
        {/* decorative circles */}
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-white/10 rounded-full" />
        <div className="absolute -bottom-24 -right-16 w-96 h-96 bg-white/10 rounded-full" />

        {/* Logo + brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <img src="/images/qcc-logo.png" alt="QCC Logo" className="h-12 w-12 rounded-xl bg-white/20 object-contain p-1 shadow" />
            <div>
              <p className="text-white/80 text-xs font-semibold tracking-widest uppercase">QCC</p>
              <p className="text-white font-bold text-sm leading-tight">IT Tracking System</p>
            </div>
          </div>

          <h1 className="text-white text-4xl xl:text-5xl font-extrabold leading-tight mb-4">
            Get instant<br />access today.
          </h1>
          <p className="text-white/80 text-base leading-relaxed max-w-xs">
            Register your details and your account is activated automatically — no waiting, no approvals.
          </p>
        </div>

        {/* Feature pills */}
        <div className="relative z-10 space-y-3">
          {[
            { icon: Zap, text: "Instant account activation" },
            { icon: Shield, text: "Secure default password provided" },
            { icon: Users, text: "Access IT forms & requests immediately" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3">
              <div className="bg-white/20 rounded-lg p-1.5">
                <Icon className="h-4 w-4 text-white" />
              </div>
              <span className="text-white text-sm font-medium">{text}</span>
            </div>
          ))}
          <p className="text-white/60 text-xs pt-2">Need help? infor@qccgh.com</p>
        </div>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex flex-col min-h-screen lg:min-h-0 lg:overflow-y-auto">
        {/* Mobile header */}
        <div className="lg:hidden bg-gradient-to-r from-orange-600 to-amber-500 px-5 py-4 flex items-center gap-3">
          <img src="/images/qcc-logo.png" alt="QCC Logo" className="h-9 w-9 rounded-lg bg-white/20 object-contain p-1" />
          <div>
            <p className="text-white font-bold text-sm">QCC IT Tracking System</p>
            <p className="text-white/70 text-xs">Self Registration</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-start px-5 py-6 sm:px-8 md:px-12 lg:px-10 xl:px-16 max-w-2xl w-full mx-auto">
          {/* Back link */}
          <button
            onClick={() => (window.location.href = "/")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </button>

          {/* Page heading */}
          <div className="mb-7">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Create your account</h2>
            <p className="text-muted-foreground text-sm mt-1.5">
              Fill in your details below. Your account is activated instantly with a default password.
            </p>
          </div>

          <CreateUserForm onUserCreated={handleUserCreated} />

          <p className="text-center text-xs text-muted-foreground mt-8">
            Need help?{" "}
            <a href="mailto:infor@qccgh.com" className="text-orange-600 hover:underline font-medium">
              infor@qccgh.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
