import { type NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const supabase = getServerSupabase()
    const body = await request.json()
    const { deviceIds, newLocation } = body

    console.log("[v0] Reallocating devices:", {
      count: deviceIds.length,
      newLocation,
    })

    // Validate input
    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return NextResponse.json(
        { error: "Invalid deviceIds provided" },
        { status: 400 }
      )
    }

    if (!newLocation || newLocation.trim() === "") {
      return NextResponse.json(
        { error: "Location is required" },
        { status: 400 }
      )
    }

    // Update all devices
    const { data, error } = await supabase
      .from("devices")
      .update({
        location: newLocation,
        updated_at: new Date().toISOString(),
      })
      .in("id", deviceIds)
      .select()

    if (error) {
      console.error("[v0] Error reallocating devices:", error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    console.log("[v0] Devices reallocated successfully:", {
      count: data?.length,
      newLocation,
    })

    return NextResponse.json({
      success: true,
      message: "Devices reallocated successfully",
      reallocated: data?.length || 0,
      failed: deviceIds.length - (data?.length || 0),
    })
  } catch (error: any) {
    console.error("[v0] Error in reallocate-locations API:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
