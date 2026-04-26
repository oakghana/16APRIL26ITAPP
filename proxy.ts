import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

type SessionUser = {
  role?: string
}

const ADMIN_ONLY_PREFIXES = [
  "/dashboard/admin",
  "/dashboard/system-settings",
  "/dashboard/lookup-data",
  "/dashboard/user-approvals",
  "/dashboard/users",
]

const ADMIN_OR_IT_HEAD_PREFIXES = [
  "/dashboard/device-summary-report",
]

const ANALYTICS_PREFIXES = [
  "/dashboard/analytics",
  "/dashboard/regional-needs-analysis",
]

const STORE_HEAD_PREFIXES = [
  "/dashboard/store-inventory",
  "/dashboard/store-requisitions",
]

const STAFF_USER_ALLOWED_PREFIXES = [
  "/dashboard",
  "/dashboard/complaints",
  "/dashboard/my-requests",
  "/dashboard/store-snapshot",
  "/dashboard/service-desk",
  "/dashboard/notifications",
  "/dashboard/it-forms/approvals",
]

function normalizeRole(rawRole: string | undefined): string {
  return (rawRole || "").toLowerCase().trim()
}

function startsWithPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function isAnyPrefixMatch(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => startsWithPath(pathname, prefix))
}

function getDefaultDashboardForRole(role: string): string {
  if (role === "admin") return "/dashboard/admin"
  if (role === "it_store_head") return "/dashboard/store-inventory"
  if (role === "it_staff") return "/dashboard/assigned-tasks"
  if (role === "staff" || role === "user") return "/dashboard/service-desk"
  if (role.startsWith("service_desk_")) return "/dashboard/service-desk"
  return "/dashboard"
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!startsWithPath(pathname, "/dashboard")) {
    return NextResponse.next()
  }

  const sessionCookie = request.cookies.get("qcc_session")?.value
  if (!sessionCookie) {
    const loginUrl = new URL("/", request.url)
    return NextResponse.redirect(loginUrl)
  }

  let session: SessionUser | null = null
  try {
    session = JSON.parse(sessionCookie)
  } catch {
    const response = NextResponse.redirect(new URL("/", request.url))
    response.cookies.delete("qcc_session")
    return response
  }

  const role = normalizeRole(session?.role)
  if (!role) {
    const response = NextResponse.redirect(new URL("/", request.url))
    response.cookies.delete("qcc_session")
    return response
  }

  const isAdmin = role === "admin"
  const defaultDashboard = getDefaultDashboardForRole(role)

  if (!isAdmin && isAnyPrefixMatch(pathname, ADMIN_ONLY_PREFIXES)) {
    return NextResponse.redirect(new URL(defaultDashboard, request.url))
  }

  if (!isAdmin && role !== "it_head" && isAnyPrefixMatch(pathname, ADMIN_OR_IT_HEAD_PREFIXES)) {
    return NextResponse.redirect(new URL(defaultDashboard, request.url))
  }

  if (!isAnyPrefixMatch(pathname, ANALYTICS_PREFIXES) || isAdmin || role === "it_head" || role === "regional_it_head") {
    // allowed, continue
  } else {
    return NextResponse.redirect(new URL(defaultDashboard, request.url))
  }

  if (!isAnyPrefixMatch(pathname, STORE_HEAD_PREFIXES) || isAdmin || role === "it_store_head") {
    // allowed, continue
  } else {
    return NextResponse.redirect(new URL(defaultDashboard, request.url))
  }

  if ((role === "staff" || role === "user") && !isAnyPrefixMatch(pathname, STAFF_USER_ALLOWED_PREFIXES)) {
    return NextResponse.redirect(new URL(defaultDashboard, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"],
}
