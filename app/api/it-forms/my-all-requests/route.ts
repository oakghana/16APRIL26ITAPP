import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

const normalize = (value?: string | null) => (value || "").trim().toLowerCase()

type RequestItem = {
  id: string
  formType: string
  requestNumber: string
  summary: string
  status: string
  createdAt: string
  assignedTo?: string
}

function identityMatch(row: any, identitySet: Set<string>) {
  const candidates = [
    row.requested_by_id,
    row.requester_id,
    row.created_by_id,
    row.staff_id,
    row.assigned_to_id,
    row.requested_by,
    row.staff_name,
    row.created_by,
    row.assigned_to,
    row.assigned_to_name,
    row.requested_by_email,
    row.requester_email,
    row.created_by_email,
    row.assigned_to_email,
  ]

  for (const candidate of candidates) {
    if (identitySet.has(normalize(candidate))) return true
  }
  return false
}

function toRequestItem(formType: string, row: any): RequestItem {
  return {
    id: row.id,
    formType,
    requestNumber: row.requisition_number || row.request_number || row.ticket_number || row.id,
    summary:
      row.items_required ||
      row.complaints_from_users ||
      row.issue_summary ||
      row.lock_description ||
      row.justification ||
      row.transfer_reason ||
      row.special_requirements ||
      row.special_notes ||
      row.other_comments ||
      "",
    status: row.status || "pending",
    createdAt: row.created_at || row.request_date || new Date().toISOString(),
    assignedTo: row.assigned_to_name || row.assigned_to || row.manager_approved_by || row.it_head_approved_by || undefined,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId") || ""
    const userName = searchParams.get("userName") || ""
    const userEmail = searchParams.get("userEmail") || ""

    const identities = [normalize(userId), normalize(userName), normalize(userEmail)].filter(Boolean)
    if (identities.length === 0) {
      return NextResponse.json({ success: true, requests: [] })
    }

    const identitySet = new Set(identities)

    const [
      requisitionsRes,
      maintenanceRes,
      gadgetRes,
      passwordResetRes,
      accountUnlockRes,
      onboardingRes,
      offboardingRes,
      softwareAccessRes,
      assetTransferRes,
    ] = await Promise.all([
      supabaseAdmin.from("it_equipment_requisitions").select("*").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("maintenance_repair_requests").select("*").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("new_gadget_requests").select("*").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("password_reset_requests").select("*").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("account_unlock_requests").select("*").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("onboarding_requests").select("*").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("offboarding_requests").select("*").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("software_access_requests").select("*").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("asset_transfer_requests").select("*").order("created_at", { ascending: false }).limit(500),
    ])

    const requests: RequestItem[] = []

    for (const row of requisitionsRes.data || []) {
      if (identityMatch(row, identitySet)) requests.push(toRequestItem("requisition", row))
    }
    for (const row of maintenanceRes.data || []) {
      if (identityMatch(row, identitySet)) requests.push(toRequestItem("maintenance", row))
    }
    for (const row of gadgetRes.data || []) {
      if (identityMatch(row, identitySet)) requests.push(toRequestItem("new-gadget", row))
    }
    for (const row of passwordResetRes.data || []) {
      if (identityMatch(row, identitySet)) requests.push(toRequestItem("password-reset", row))
    }
    for (const row of accountUnlockRes.data || []) {
      if (identityMatch(row, identitySet)) requests.push(toRequestItem("account-unlock", row))
    }
    for (const row of onboardingRes.data || []) {
      if (identityMatch(row, identitySet)) requests.push(toRequestItem("onboarding", row))
    }
    for (const row of offboardingRes.data || []) {
      if (identityMatch(row, identitySet)) requests.push(toRequestItem("offboarding", row))
    }
    for (const row of softwareAccessRes.data || []) {
      if (identityMatch(row, identitySet)) requests.push(toRequestItem("software-access", row))
    }
    for (const row of assetTransferRes.data || []) {
      if (identityMatch(row, identitySet)) requests.push(toRequestItem("asset-transfer", row))
    }

    requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ success: true, requests })
  } catch (error: any) {
    console.error("[my-all-requests] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to load requests" }, { status: 500 })
  }
}
