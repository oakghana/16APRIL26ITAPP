import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-build-key"
)

const REQUISITION_APPROVED_STATUSES = ["pending_store", "approved", "issued", "completed"]
const GADGET_APPROVED_STATUSES = ["recommended", "gadget_issued"]
const MAINTENANCE_APPROVED_STATUSES = ["manager_confirmed", "sent_for_repair", "repaired", "confirmed_working"]
const PASSWORD_APPROVED_STATUSES = ["assigned", "in_progress", "awaiting_user_confirmation", "completed"]

function getStatusFilter(mode: string) {
  return mode === "approved" ? "approved" : "all"
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = getStatusFilter(searchParams.get("mode") || "all")
    const userRole = String(searchParams.get("userRole") || "")
    const username = String(searchParams.get("username") || "admin")

    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [reqRes, gadgetRes, maintenanceRes, passwordRes] = await Promise.all([
      supabaseAdmin.from("it_equipment_requisitions").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("new_gadget_requests").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("maintenance_repair_requests").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("password_reset_requests").select("*").order("created_at", { ascending: false }),
    ])

    const errors = [reqRes.error, gadgetRes.error, maintenanceRes.error, passwordRes.error].filter(Boolean)
    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0]?.message || "Failed to fetch IT form records" }, { status: 500 })
    }

    const requisitions = (reqRes.data || []).filter((row: any) =>
      mode === "all" ? true : REQUISITION_APPROVED_STATUSES.includes(String(row.status || ""))
    )
    const newGadget = (gadgetRes.data || []).filter((row: any) =>
      mode === "all" ? true : GADGET_APPROVED_STATUSES.includes(String(row.status || ""))
    )
    const maintenance = (maintenanceRes.data || []).filter((row: any) =>
      mode === "all" ? true : MAINTENANCE_APPROVED_STATUSES.includes(String(row.status || ""))
    )
    const passwordReset = (passwordRes.data || []).filter((row: any) =>
      mode === "all" ? true : PASSWORD_APPROVED_STATUSES.includes(String(row.status || ""))
    )

    const total = requisitions.length + newGadget.length + maintenance.length + passwordReset.length

    await supabaseAdmin
      .from("audit_logs")
      .insert({
        username,
        action: mode === "approved" ? "ADMIN_EXPORT_APPROVED_IT_FORMS" : "ADMIN_FETCH_IT_FORMS",
        resource: "it_forms",
        details: `${mode === "approved" ? "Exported approved" : "Fetched all"} IT form records (${total} rows)`,
        severity: "medium",
        ip_address: request.headers.get("x-forwarded-for") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown",
      })
      .catch(() => null)

    return NextResponse.json({
      success: true,
      mode,
      counts: {
        requisitions: requisitions.length,
        newGadget: newGadget.length,
        maintenance: maintenance.length,
        passwordReset: passwordReset.length,
        total,
      },
      records: {
        requisitions,
        newGadget,
        maintenance,
        passwordReset,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
