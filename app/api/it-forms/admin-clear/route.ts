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

    const [reqDelete, gadgetDelete, maintenanceDelete, passwordResetDelete] = await Promise.all([
      supabaseAdmin.from("it_equipment_requisitions").delete().not("id", "is", null),
      supabaseAdmin.from("new_gadget_requests").delete().not("id", "is", null),
      supabaseAdmin.from("maintenance_repair_requests").delete().not("id", "is", null),
      supabaseAdmin.from("password_reset_requests").delete().not("id", "is", null),
    ])

    if (reqDelete.error) {
      return NextResponse.json({ error: reqDelete.error.message }, { status: 500 })
    }
    if (gadgetDelete.error) {
      return NextResponse.json({ error: gadgetDelete.error.message }, { status: 500 })
    }
    if (maintenanceDelete.error) {
      return NextResponse.json({ error: maintenanceDelete.error.message }, { status: 500 })
    }
    if (passwordResetDelete.error) {
      return NextResponse.json({ error: passwordResetDelete.error.message }, { status: 500 })
    }

    const deleted = {
      requisitions: reqDelete.count || 0,
      newGadget: gadgetDelete.count || 0,
      maintenance: maintenanceDelete.count || 0,
      passwordReset: passwordResetDelete.count || 0,
    }

    const total = deleted.requisitions + deleted.newGadget + deleted.maintenance + deleted.passwordReset

    await supabaseAdmin
      .from("audit_logs")
      .insert({
        username: username || userId || "admin",
        action: "ADMIN_CLEAR_IT_FORMS",
        resource: "it_forms",
        details: `Deleted all IT forms requests. Total deleted: ${total} (Requisitions: ${deleted.requisitions}, New Gadget: ${deleted.newGadget}, Maintenance: ${deleted.maintenance}, Password Reset: ${deleted.passwordReset})`,
        severity: "critical",
        ip_address: request.headers.get("x-forwarded-for") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown",
      })
      .catch(() => null)

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
