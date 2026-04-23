import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-build-key"
)

function canManage(userRole: string | null | undefined) {
  return userRole === "admin" || userRole === "it_head" || userRole === "regional_it_head" || userRole === "it_staff"
}

export async function PUT(request: NextRequest) {
  try {
    const { deviceId, tonerType, tonerModel, userId, userRole } = await request.json()

    if (!deviceId || !tonerType) {
      return NextResponse.json({ error: "deviceId and tonerType are required" }, { status: 400 })
    }

    if (!canManage(userRole)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { data: current, error: fetchError } = await supabaseAdmin
      .from("devices")
      .select("id, brand, model, serial_number")
      .eq("id", deviceId)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin
      .from("devices")
      .update({
        toner_type: tonerType,
        toner_model: tonerModel || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deviceId)
      .select("id, toner_type, toner_model")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { error: auditError } = await supabaseAdmin.from("audit_logs").insert({
      username: userId || "unknown",
      action: "DEVICE_TONER_ASSOCIATED",
      resource: `devices/${deviceId}`,
      details: `Associated toner ${tonerType}${tonerModel ? ` (${tonerModel})` : ""} to ${current.brand} ${current.model} (${current.serial_number || "n/a"})`,
      severity: "medium",
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
      user_agent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ success: true, device: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
