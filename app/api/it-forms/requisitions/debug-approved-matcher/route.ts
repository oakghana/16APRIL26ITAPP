import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "service-role-key-placeholder"
)

const CLOSED_STATUSES = new Set([
  "issued",
  "rejected",
  "rejected_it_head",
  "rejected_admin",
  "cancelled",
  "completed",
])

const APPROVED_STATUSES = new Set([
  "pending_store",
  "ready_for_issuance",
  "pending_regional_store",
  "pending_admin",
  "approved",
  "approved_it_head",
  "approved_admin",
  "approved_manager",
])

function toLowerTrim(value: unknown): string {
  return String(value || "").toLowerCase().trim()
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== ""
}

function timelineHasApprovalByRole(timelineRaw: unknown): boolean {
  let timeline = timelineRaw
  if (typeof timeline === "string") {
    try {
      timeline = JSON.parse(timeline)
    } catch {
      timeline = null
    }
  }

  if (!Array.isArray(timeline)) return false

  const approvalRoles = new Set(["it_head", "it_manager", "admin", "manager"])
  for (const entry of timeline) {
    if (!entry || typeof entry !== "object") continue

    const role = toLowerTrim((entry as any).role || (entry as any).approver_role || (entry as any).actor_role || (entry as any).by_role)
    const action = toLowerTrim((entry as any).action || (entry as any).status || (entry as any).type)

    if (approvalRoles.has(role) && ["approve", "approved"].includes(action)) {
      return true
    }
  }

  return false
}

function evaluateMatcher(row: any) {
  const status = toLowerTrim(row.status)

  const reasons: string[] = []
  const failures: string[] = []

  const storeAlreadyProcessed = row.store_head_approved === true
  if (storeAlreadyProcessed) {
    failures.push("store_head_approved=true")
  }

  if (CLOSED_STATUSES.has(status)) {
    failures.push(`closed_status:${status}`)
  }

  const statusSaysApproved = APPROVED_STATUSES.has(status)
  if (statusSaysApproved) {
    reasons.push(`status_approved:${status}`)
  }

  const directApprovalFields = [
    "it_head_approved",
    "admin_approved",
    "it_manager_approved",
    "it_head_approved_by",
    "it_head_approved_by_name",
    "admin_approved_by",
    "admin_approved_by_name",
    "it_manager_approved_by",
    "it_manager_approved_by_name",
    "manager_approved_by",
    "manager_approved_by_name",
    "it_head_approved_at",
    "admin_approved_at",
    "it_manager_approved_at",
    "manager_approved_at",
  ]

  const directApprovalHits = directApprovalFields.filter((field) => {
    if (field.endsWith("_approved")) {
      return row[field] === true
    }
    return hasValue(row[field])
  })

  if (directApprovalHits.length > 0) {
    reasons.push(`direct_markers:${directApprovalHits.join(",")}`)
  }

  const timelineApproved = timelineHasApprovalByRole(row.approval_timeline)
  if (timelineApproved) {
    reasons.push("timeline_approved_by_role")
  }

  const hasApprovalEvidence = directApprovalHits.length > 0 || timelineApproved
  const passes = !storeAlreadyProcessed && !CLOSED_STATUSES.has(status) && (statusSaysApproved || hasApprovalEvidence)

  if (!statusSaysApproved && !hasApprovalEvidence) {
    failures.push("no_approval_evidence")
  }

  return {
    passes,
    status,
    reasons,
    failures,
    directApprovalHits,
    timelineApproved,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const only = toLowerTrim(searchParams.get("only") || "all")

    const { data, error } = await supabaseAdmin
      .from("it_equipment_requisitions")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to load requisitions" }, { status: 500 })
    }

    const evaluated = (data || []).map((row: any) => {
      const verdict = evaluateMatcher(row)
      return {
        id: row.id,
        requisition_number: row.requisition_number || row.reg_no || row.request_number || null,
        reg_no: row.reg_no || null,
        status: verdict.status,
        passes: verdict.passes,
        reasons: verdict.reasons,
        failures: verdict.failures,
        directApprovalHits: verdict.directApprovalHits,
        timelineApproved: verdict.timelineApproved,
        requested_by: row.requested_by || row.created_by_name || row.staff_name || null,
        created_at: row.created_at || null,
      }
    })

    const filtered =
      only === "pass"
        ? evaluated.filter((row) => row.passes)
        : only === "fail"
          ? evaluated.filter((row) => !row.passes)
          : evaluated

    return NextResponse.json({
      success: true,
      total: evaluated.length,
      passing: evaluated.filter((row) => row.passes).length,
      failing: evaluated.filter((row) => !row.passes).length,
      items: filtered,
      note: "Temporary debug endpoint for approved requisition matcher. Remove after validation.",
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
