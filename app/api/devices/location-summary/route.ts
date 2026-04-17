import { type NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Fetching location summary")
    const supabase = getServerSupabase()

    const { data, error } = await supabase
      .from("devices")
      .select("location, id")

    if (error) {
      console.error("[v0] Error fetching devices:", error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Build statistics
    const stats: {
      totalDevices: number
      devicesWithoutLocation: number
      devicesByLocation: Record<string, number>
      locations: Array<{ name: string; count: number }>
    } = {
      totalDevices: data?.length || 0,
      devicesWithoutLocation: 0,
      devicesByLocation: {},
      locations: [],
    }

    if (data) {
      data.forEach((device: any) => {
        const location = device.location || "Unallocated"
        
        if (!device.location) {
          stats.devicesWithoutLocation++
        }
        
        stats.devicesByLocation[location] = (stats.devicesByLocation[location] || 0) + 1
      })

      // Convert to sorted array
      stats.locations = Object.entries(stats.devicesByLocation)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
    }

    console.log("[v0] Location summary:", {
      total: stats.totalDevices,
      unallocated: stats.devicesWithoutLocation,
      locations: stats.locations.length,
    })

    return NextResponse.json(stats)
  } catch (error: any) {
    console.error("[v0] Error in location-summary API:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
