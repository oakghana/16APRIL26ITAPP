import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { locationsMatch } from "@/lib/location-filter"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-build-key"
)

function canManage(userRole: string | null | undefined) {
  return userRole === "admin" || userRole === "it_head" || userRole === "regional_it_head" || userRole === "it_staff"
}

export async function PUT(request: NextRequest) {
  try {
    const { deviceId, tonerType, tonerModel, userId, userRole, userLocation } = await request.json()

    if (!deviceId || !tonerType) {
      return NextResponse.json({ error: "deviceId and tonerType are required" }, { status: 400 })
    }

    if (!canManage(userRole)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { data: current, error: fetchError } = await supabaseAdmin
      .from("devices")
      .select("id, brand, model, serial_number, location")
      .eq("id", deviceId)
      .single()

    if (fetchError || !current) {
      console.error("Device fetch error:", fetchError)
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    if ((userRole === "regional_it_head" || userRole === "it_staff") && !locationsMatch(current.location, userLocation)) {
      return NextResponse.json({ error: "You can only update toner mapping for devices in your location." }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from("devices")
      .update({
        toner_type: tonerType,
        toner_model: tonerModel || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deviceId)

    if (error) {
      console.error("Update error:", error)
      return NextResponse.json({ error: error.message || "Failed to update device" }, { status: 500 })
    }

    // Fetch the updated record to return
    const { data: updated, error: fetchUpdatedError } = await supabaseAdmin
      .from("devices")
      .select("id, toner_type, toner_model")
      .eq("id", deviceId)
      .single()

    if (fetchUpdatedError || !updated) {
      console.error("Fetch updated error:", fetchUpdatedError)
      return NextResponse.json({ error: "Device updated but could not verify" }, { status: 500 })
    }

    // Audit log (non-critical, don't fail if it errors)
    supabaseAdmin.from("audit_logs").insert({
      username: userId || "unknown",
      action: "DEVICE_TONER_ASSOCIATED",
      resource: `devices/${deviceId}`,
      details: `Associated toner ${tonerType}${tonerModel ? ` (${tonerModel})` : ""} to ${current.brand} ${current.model} (${current.serial_number || "n/a"})`,
      severity: "medium",
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
      user_agent: request.headers.get("user-agent") || "unknown",
    }).then(() => {
      // Audit log created successfully
    }).catch((err: any) => {
      console.error("Audit log error:", err)
    })

    return NextResponse.json({ success: true, device: updated })
  } catch (error: any) {
    console.error("Associate toner error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
