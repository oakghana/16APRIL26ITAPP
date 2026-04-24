import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

// Roles that may use this endpoint to view only their own involved requests
const ALLOWED_ROLES = ["it_staff", "regional_it_head", "it_store_head", "it_head", "admin"]

const normalize = (value?: string | null) => (value || "").trim().toLowerCase()

const isExactIdentityMatch = (candidate?: string | null, identities: string[] = []) => {
  const target = normalize(candidate)
  if (!target) return false
  return identities.includes(target)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userRole = searchParams.get("userRole") || ""
    const userName = searchParams.get("userName") || ""
    const userEmail = searchParams.get("userEmail") || ""
    const userId = searchParams.get("userId") || ""

    if (!ALLOWED_ROLES.includes(userRole)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (!userName && !userEmail && !userId) {
      return NextResponse.json({ error: "User identity required" }, { status: 400 })
    }

    const results: {
      assignments: any[]
      storeRequisitions: any[]
      itRequisitions: any[]
      serviceTickets: any[]
      repairRequests: any[]
    } = {
      assignments: [],
      storeRequisitions: [],
      itRequisitions: [],
      serviceTickets: [],
      repairRequests: [],
    }

    const identities = [normalize(userName), normalize(userEmail), normalize(userId)].filter(Boolean)

    // 1. Stock assignments assigned to this user only
    if (identities.length > 0) {
      const { data: assignments } = await supabaseAdmin
        .from("stock_assignments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500)

      results.assignments = (assignments || []).filter((row: any) =>
        isExactIdentityMatch(row.assigned_to, identities) ||
        isExactIdentityMatch(row.assigned_to_email, identities) ||
        isExactIdentityMatch(row.assigned_to_id, identities),
      )
    }

    // 2. Store requisitions where user is requester or beneficiary only
    if (identities.length > 0) {
      const { data: storeReqs } = await supabaseAdmin
        .from("store_requisitions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500)

      results.storeRequisitions = (storeReqs || []).filter((row: any) =>
        isExactIdentityMatch(row.requested_by, identities) ||
        isExactIdentityMatch(row.requested_by_email, identities) ||
        isExactIdentityMatch(row.requested_by_id, identities) ||
        isExactIdentityMatch(row.beneficiary, identities) ||
        isExactIdentityMatch(row.beneficiary_email, identities) ||
        isExactIdentityMatch(row.beneficiary_id, identities),
      )
    }

    // 3. IT equipment requisitions submitted by this user only
    if (identities.length > 0) {
      const { data: itReqs } = await supabaseAdmin
        .from("it_equipment_requisitions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500)

      results.itRequisitions = (itReqs || [])
        .filter((row: any) =>
          isExactIdentityMatch(row.requested_by_id, identities) ||
          isExactIdentityMatch(row.requested_by, identities) ||
          isExactIdentityMatch(row.requester_email, identities),
        )
        .map((r: any) => ({
        ...r,
        _source: "it_equipment_requisitions",
      }))
    }

    // 4. Service tickets assigned to or requested by this user only
    if (identities.length > 0) {
      const { data: tickets } = await supabaseAdmin
        .from("service_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500)

      results.serviceTickets = (tickets || []).filter((row: any) =>
        isExactIdentityMatch(row.assigned_to, identities) ||
        isExactIdentityMatch(row.assigned_to_name, identities) ||
        isExactIdentityMatch(row.requested_by, identities) ||
        isExactIdentityMatch(row.requested_by_name, identities) ||
        isExactIdentityMatch(row.requester_email, identities),
      )
    }

    // 5. Repair requests assigned to or submitted by this user only
    if (identities.length > 0) {
      const { data: repairs } = await supabaseAdmin
        .from("repair_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500)

      results.repairRequests = (repairs || []).filter((row: any) =>
        isExactIdentityMatch(row.assigned_to, identities) ||
        isExactIdentityMatch(row.assigned_to_name, identities) ||
        isExactIdentityMatch(row.requested_by, identities) ||
        isExactIdentityMatch(row.requested_by_name, identities) ||
        isExactIdentityMatch(row.requester_email, identities),
      )
    }

    return NextResponse.json({ success: true, ...results })
  } catch (error: any) {
    console.error("[my-involved-requests] Error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
