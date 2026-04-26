import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-build-key"
)

export async function DELETE(request: NextRequest) {
  try {
    const { userRole, userId, username } = await request.json()

    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const deletePlan: Array<{ table: string; key: string }> = [
      { table: "it_equipment_requisitions", key: "requisitions" },
      { table: "new_gadget_requests", key: "newGadget" },
      { table: "maintenance_repair_requests", key: "maintenance" },
      { table: "password_reset_requests", key: "passwordReset" },
      { table: "account_unlock_requests", key: "accountUnlock" },
      { table: "software_access_requests", key: "softwareAccess" },
      { table: "onboarding_requests", key: "onboarding" },
      { table: "offboarding_requests", key: "offboarding" },
      { table: "asset_transfer_requests", key: "assetTransfer" },
    ]

    const deleted: Record<string, number> = {}

    for (const step of deletePlan) {
      const { error } = await supabaseAdmin
        .from(step.table)
        .delete()
        .not("id", "is", null)

      if (error) {
        return NextResponse.json({ error: `Failed clearing ${step.table}: ${error.message}` }, { status: 500 })
      }

      deleted[step.key] = 0
    }

    const { error: notifError } = await supabaseAdmin
      .from("notifications")
      .delete()
      .in("reference_type", [
        "it_equipment_requisition",
        "new_gadget_request",
        "maintenance_repair_request",
        "password_reset_request",
        "account_unlock_request",
        "software_access_request",
        "onboarding_request",
        "offboarding_request",
        "asset_transfer_request",
      ])

    if (notifError) {
      console.error("[admin-clear] notification cleanup warning:", notifError.message)
    }

    const total = Object.values(deleted).reduce((sum, count) => sum + count, 0)

    const { error: auditError } = await supabaseAdmin
      .from("audit_logs")
      .insert({
        username: username || userId || "admin",
        action: "ADMIN_CLEAR_IT_FORMS",
        resource: "it_forms",
        details: `Cleared all IT form request tables (and related notifications).`,
        severity: "critical",
        ip_address: request.headers.get("x-forwarded-for") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown",
      })

    if (auditError) {
      console.error("[admin-clear] audit log warning:", auditError.message)
    }

    return NextResponse.json({
      success: true,
      deleted: {
        ...deleted,
        total,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
