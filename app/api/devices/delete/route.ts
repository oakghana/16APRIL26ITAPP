import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"

// Use service role key to bypass RLS
export async function DELETE(request: NextRequest) {
  try {
    const supabaseAdmin = getServerSupabase()
    const body = await request.json()
    const { deviceId, userId, userRole, userLocation, reason } = body

    console.log("[v0] Deleting device:", deviceId, "by:", userId, "role:", userRole)

    if (!deviceId || !userId || !userRole) {
      return NextResponse.json({ error: "Device ID, user ID, and role are required" }, { status: 400 })
    }

    // Fetch the device to verify assignment status
    const { data: device, error: fetchError } = await supabaseAdmin
      .from("devices")
      .select("id, serial_number, brand, model, assigned_to, status, location")
      .eq("id", deviceId)
      .single()

    if (fetchError) {
      console.error("[v0] Error fetching device:", fetchError)
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    // Authorization checks:
    // 1. Users can delete unassigned devices in their location
    // 2. Regional IT Heads can delete devices in their location (assigned or not)
    // 3. Admin and IT Head can always delete
    const canAlwaysDelete = userRole === "admin" || userRole === "it_head"
    const isUnassigned = !device.assigned_to || device.status === "available" || device.status === "in_stock"
    const isInUserLocation = device.location === userLocation
    const isRegionalHead = userRole === "regional_it_head"

    if (!canAlwaysDelete) {
      if (isRegionalHead && isInUserLocation) {
        // Regional IT Head can delete devices in their location
      } else if (isUnassigned && isInUserLocation) {
        // User can delete unassigned devices in their location
      } else {
        console.error("[v0] Unauthorized delete attempt")
        return NextResponse.json(
          { 
            error: "You can only delete unassigned devices in your location. Contact Admin or IT Head to delete assigned devices." 
          }, 
          { status: 403 }
        )
      }
    }

    // Delete the device
    const { data, error } = await supabaseAdmin
      .from("devices")
      .delete()
      .eq("id", deviceId)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error deleting device:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log the deletion
    await supabaseAdmin.from("audit_logs").insert({
      username: userId,
      action: "DELETE_DEVICE",
      resource: `devices/${deviceId}`,
      details: `Deleted device: ${device.brand} ${device.model} (${device.serial_number}). Reason: ${reason || "Not provided"}`,
      severity: "high",
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
      user_agent: request.headers.get("user-agent") || "unknown",
    })

    console.log("[v0] Device deleted successfully:", deviceId)

    return NextResponse.json({ 
      success: true, 
      message: `Device ${device.serial_number} has been deleted`
    })
  } catch (error) {
    console.error("[v0] API Devices Delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
