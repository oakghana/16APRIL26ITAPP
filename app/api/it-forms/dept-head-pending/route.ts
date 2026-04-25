/**
 * GET /api/it-forms/dept-head-pending
 * Returns all IT form requests that are pending dept-head approval
 * for the authenticated department head's department.
 *
 * PATCH /api/it-forms/dept-head-pending
 * Proxies approve/reject actions to the individual form API routes.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

const TABLES = [
  { table: "onboarding_requests", label: "Onboarding", route: "onboarding" },
  { table: "software_access_requests", label: "Software Access", route: "software-access" },
  { table: "asset_transfer_requests", label: "Asset Transfer", route: "asset-transfer" },
]

function isUuid(v?: string | null) {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")
    const department = searchParams.get("department")

    if (!userId || !department) {
      return NextResponse.json({ error: "userId and department required" }, { status: 400 })
    }

    // Verify requester is a dept head
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, role, department")
      .eq("id", userId)
      .single()

    if (!profile || profile.role !== "department_head") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const dept = department.trim().toLowerCase()
    const results: any[] = []

    for (const { table, label, route } of TABLES) {
      const { data } = await supabaseAdmin
        .from(table)
        .select("*")
        .eq("status", "pending_dept_head")
        .order("created_at", { ascending: false })

      if (data) {
        const filtered = data.filter(
          (r: any) => (r.department_name || "").trim().toLowerCase() === dept
        )
        filtered.forEach((r: any) => {
          results.push({ ...r, _formType: route, _formLabel: label })
        })
      }
    }

    // Sort by created_at desc
    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({ success: true, requests: results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { formType, requestId, action, actorId, actorName, actorRole, notes } = body

    if (!formType || !requestId || !action) {
      return NextResponse.json({ error: "formType, requestId, action required" }, { status: 400 })
    }

    if (!["dept_head_approve", "dept_head_reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Forward to the individual form API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const res = await fetch(`${baseUrl}/api/it-forms/${formType}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action, actorId, actorName, actorRole, notes }),
    })

    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error || "Action failed" }, { status: res.status })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
