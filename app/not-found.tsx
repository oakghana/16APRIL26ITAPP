import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, CircuitBoard, Headphones, Home, MonitorSmartphone, ShieldCheck, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"

const quickLinks = [
  {
    title: "Device Inventory",
    description: "Check your assigned devices and their status — all in one spot.",
    href: "/dashboard/devices",
    icon: MonitorSmartphone,
  },
  {
    title: "Service Desk",
    description: "Got an IT problem? Log it here and IT will handle it quick.",
    href: "/dashboard/service-desk",
    icon: Headphones,
  },
  {
    title: "Security & Control",
    description: "Your role, your access — structured and secure across all QCC branches.",
    href: "/dashboard",
    icon: ShieldCheck,
  },
]

function ItOperationsIllustration() {
  return (
    <div className="relative rounded-[1.6rem] border border-emerald-900/10 bg-[linear-gradient(160deg,_rgba(15,23,42,0.96),_rgba(12,74,45,0.88))] p-5 text-white shadow-inner dark:border-white/10">
      <div className="flex items-center justify-between">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <CircuitBoard className="h-10 w-10 text-emerald-300" />
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/80">Missing route</p>
          <p className="text-6xl font-black leading-none text-white/95">404</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
        <svg viewBox="0 0 560 340" className="h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="panelGlow" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(52,211,153,0.85)" />
              <stop offset="100%" stopColor="rgba(250,204,21,0.8)" />
            </linearGradient>
            <linearGradient id="screenTone" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(16,185,129,0.20)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
            </linearGradient>
          </defs>

          <circle cx="88" cy="46" r="8" fill="rgba(250,204,21,0.85)" />
          <circle cx="118" cy="46" r="8" fill="rgba(52,211,153,0.85)" />
          <circle cx="148" cy="46" r="8" fill="rgba(255,255,255,0.35)" />

          <path d="M100 90H240V180H100z" rx="18" fill="rgba(15,23,42,0.92)" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
          <path d="M320 72H492V174H320z" rx="18" fill="rgba(15,23,42,0.9)" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
          <path d="M210 214H344V292H210z" rx="18" fill="rgba(15,23,42,0.9)" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />

          <path d="M112 102H228V167H112z" rx="12" fill="url(#screenTone)" stroke="rgba(52,211,153,0.28)" />
          <path d="M332 84H480V162H332z" rx="12" fill="url(#screenTone)" stroke="rgba(250,204,21,0.22)" />
          <path d="M224 226H330V278H224z" rx="12" fill="url(#screenTone)" stroke="rgba(52,211,153,0.28)" />

          <path d="M170 180V204" stroke="rgba(255,255,255,0.25)" strokeWidth="5" strokeLinecap="round" />
          <path d="M146 206H194" stroke="rgba(255,255,255,0.25)" strokeWidth="5" strokeLinecap="round" />

          <path d="M406 174V202" stroke="rgba(255,255,255,0.25)" strokeWidth="5" strokeLinecap="round" />
          <path d="M378 204H434" stroke="rgba(255,255,255,0.25)" strokeWidth="5" strokeLinecap="round" />

          <path d="M272 278V298" stroke="rgba(255,255,255,0.25)" strokeWidth="5" strokeLinecap="round" />
          <path d="M240 300H304" stroke="rgba(255,255,255,0.25)" strokeWidth="5" strokeLinecap="round" />

          <path d="M170 135C232 135 218 250 272 250" fill="none" stroke="url(#panelGlow)" strokeWidth="4" strokeLinecap="round" strokeDasharray="10 10" />
          <path d="M406 124C352 124 352 250 272 250" fill="none" stroke="url(#panelGlow)" strokeWidth="4" strokeLinecap="round" strokeDasharray="10 10" />

          <circle cx="170" cy="135" r="9" fill="rgba(52,211,153,0.95)" />
          <circle cx="406" cy="124" r="9" fill="rgba(250,204,21,0.95)" />
          <circle cx="272" cy="250" r="11" fill="rgba(52,211,153,0.95)" />

          <path d="M120 122H176" stroke="rgba(255,255,255,0.24)" strokeWidth="6" strokeLinecap="round" />
          <path d="M120 140H214" stroke="rgba(255,255,255,0.12)" strokeWidth="6" strokeLinecap="round" />
          <path d="M120 156H196" stroke="rgba(255,255,255,0.12)" strokeWidth="6" strokeLinecap="round" />

          <path d="M344 102H458" stroke="rgba(255,255,255,0.24)" strokeWidth="6" strokeLinecap="round" />
          <path d="M344 120H434" stroke="rgba(255,255,255,0.12)" strokeWidth="6" strokeLinecap="round" />
          <path d="M344 138H396" stroke="rgba(255,255,255,0.12)" strokeWidth="6" strokeLinecap="round" />

          <rect x="240" y="236" width="70" height="12" rx="6" fill="rgba(255,255,255,0.2)" />
          <rect x="240" y="254" width="52" height="12" rx="6" fill="rgba(52,211,153,0.32)" />

          <path d="M68 248H146V296H68z" rx="14" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
          <path d="M80 260H134V278H80z" rx="6" fill="rgba(250,204,21,0.18)" />
          <circle cx="94" cy="287" r="4" fill="rgba(52,211,153,0.85)" />
          <circle cx="110" cy="287" r="4" fill="rgba(255,255,255,0.28)" />

          <path d="M430 226H504V296H430z" rx="16" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
          <path d="M446 242H488" stroke="rgba(52,211,153,0.75)" strokeWidth="6" strokeLinecap="round" />
          <path d="M446 258H480" stroke="rgba(255,255,255,0.16)" strokeWidth="6" strokeLinecap="round" />
          <path d="M446 274H470" stroke="rgba(250,204,21,0.55)" strokeWidth="6" strokeLinecap="round" />
        </svg>

        <div className="mt-4 flex items-center gap-2 text-xs text-emerald-100/90">
          <span className="h-2 w-2 rounded-full bg-emerald-300" />
          Redirect users to an active operational route.
        </div>
      </div>
    </div>
  )
}

export default function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(20,83,45,0.14),_transparent_34%),linear-gradient(135deg,_#f8fafc_0%,_#eefbf3_42%,_#fcf8ee_100%)] text-slate-950 dark:bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.18),_transparent_24%),linear-gradient(135deg,_#07110d_0%,_#0f1a14_42%,_#17120a_100%)] dark:text-white">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-16 h-56 w-56 rounded-full bg-emerald-500/12 blur-3xl dark:bg-emerald-400/20" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl dark:bg-amber-300/10" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-lime-300/10 blur-3xl dark:bg-lime-300/10" />

        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
        <div className="absolute left-10 top-24 hidden h-32 w-32 rounded-full border border-emerald-600/10 lg:block" />
        <div className="absolute right-16 top-36 hidden h-24 w-24 rounded-3xl border border-amber-600/10 lg:block" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 py-10 lg:px-10">
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="order-2 space-y-6 lg:order-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-600/20 bg-white/75 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-800 shadow-sm backdrop-blur dark:border-emerald-400/25 dark:bg-white/5 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              QCC IT Device Tracker
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-green-600 to-lime-500 shadow-[0_18px_50px_rgba(22,163,74,0.35)]">
                  <Image
                    src="/images/qcc-logo.png"
                    alt="QCC logo"
                    width={48}
                    height={48}
                    className="h-12 w-12 object-contain"
                    priority
                  />
                </div>
                <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Ei! This page is missing</p>
              <p className="text-base font-semibold text-slate-800 dark:text-slate-100">QCC IT — keeping Ghana's workforce connected</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.45em] text-emerald-700/80 dark:text-emerald-300/80">Error 404</p>
                <h1 className="max-w-3xl text-5xl font-black leading-none tracking-tight text-balance sm:text-6xl xl:text-7xl">
                  Charley, this page is not here!
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
                  The page has moved, been removed, or never existed. No wahala — head back to the dashboard or pick a shortcut below.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-xl bg-emerald-600 px-6 text-white hover:bg-emerald-700">
                <Link href="/dashboard">
                  <Home className="mr-2 h-4 w-4" />
                  Take Me to My Dashboard
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-slate-300 bg-white/70 px-6 backdrop-blur hover:bg-white dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10">
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Login
                </Link>
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {quickLinks.map(({ title, description, href, icon: Icon }) => (
                <Link
                  key={title}
                  href={href}
                  className="group rounded-2xl border border-slate-200/80 bg-white/75 p-4 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:shadow-[0_24px_60px_rgba(16,185,129,0.14)] dark:border-white/10 dark:bg-white/5 dark:hover:border-emerald-400/40 dark:hover:bg-white/8"
                >
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-lime-500 text-white shadow-lg">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-base font-semibold text-slate-900 transition-colors group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-300">
                    {title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="order-1 lg:order-2">
            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-emerald-500/25 via-transparent to-amber-400/20 blur-2xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/75 p-5 shadow-[0_30px_120px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-950 px-4 py-3 text-slate-50 dark:border-white/10">
                  <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">QCC IT Operations</p>
                  <p className="mt-1 text-sm text-slate-300">This route doesn't exist</p>
                  </div>
                  <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                    404 NODE
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                  <ItOperationsIllustration />

                  <div className="space-y-4">
                    <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">Recovery Actions</p>
                      <div className="mt-4 space-y-3">
                        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Go to your dashboard</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">Pick up right where you left off.</p>
                        </div>
                        <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-3">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">Open Service Desk</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">Log a problem or check your latest ticket.</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">Platform Status</p>
                      <div className="mt-4 space-y-4">
                        <div>
                          <div className="mb-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                            <span>Routing integrity</span>
                            <span>92%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10">
                            <div className="h-2 w-[92%] rounded-full bg-gradient-to-r from-emerald-500 to-lime-400" />
                          </div>
                        </div>
                        <div>
                          <div className="mb-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                            <span>Support readiness</span>
                            <span>Live</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                            All IT support channels are live
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}