import { type NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import { canAssignDevices, logAuthzFailure } from "@/lib/authz"

// Use service role key to bypass RLS
interface AssignmentRequest {
  deviceId: string
  staffUserId: string
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getServerSupabase()
    const body: AssignmentRequest = await request.json()

    // Validate required fields
    if (!body.deviceId || !body.staffUserId) {
      return NextResponse.json(
        { error: "Device ID and Staff User ID are required" },
        { status: 400 }
      )
    }

    // Get staff user details
    const { data: staffUser, error: staffError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", body.staffUserId)
      .single()

    if (staffError || !staffUser) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      )
    }

    // Get device details
    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .select("*")
      .eq("id", body.deviceId)
      .single()

    if (deviceError || !device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      )
    }

    // Check if device is already assigned to someone else
    if (device.assigned_to_user_id && device.assigned_to_user_id !== body.staffUserId) {
      const { data: currentOwner } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", device.assigned_to_user_id)
        .single()

      return NextResponse.json(
        {
          error: `Device is already assigned to ${currentOwner?.full_name || "another user"}. Please reassign or release it first.`,
        },
        { status: 409 }
      )
    }

    // Update device assignment
    const { error: updateError } = await supabase
      .from("devices")
      .update({
        assigned_to_user_id: body.staffUserId,
        status: "assigned",
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.deviceId)

    if (updateError) {
      console.error("[v0] Error assigning device:", updateError)
      return NextResponse.json(
        { error: "Failed to assign device" },
        { status: 500 }
      )
    }

    // Log the assignment in audit_logs
    await supabase
      .from("audit_logs")
      .insert({
        action: "device_assigned",
        resource: "devices",
        details: JSON.stringify({
          deviceId: body.deviceId,
          staffUserId: body.staffUserId,
          staffName: staffUser.full_name,
          staffEmail: staffUser.email,
          deviceSerialNumber: device.serial_number,
          deviceType: device.device_type,
          notes: body.notes,
        }),
        severity: "info",
      })

    // Get updated device info
    const { data: updatedDevice } = await supabase
      .from("devices")
      .select("*")
      .eq("id", body.deviceId)
      .single()

    return NextResponse.json({
      success: true,
      message: `Device successfully assigned to ${staffUser.full_name}`,
      device: updatedDevice,
    })
  } catch (error: any) {
    console.error("[v0] Error in device assignment API:", error)
    return NextResponse.json(
      { error: error.message || "Failed to process request" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabase()
    // Get all staff users for dropdown
    const { data: staff, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, location, department")
      .eq("is_active", true)
      .neq("role", "admin")
      .order("full_name", { ascending: true })

    if (error) {
      console.error("[v0] Error fetching staff:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ staff: staff || [] })
  } catch (error: any) {
    console.error("[v0] Error in staff list API:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

