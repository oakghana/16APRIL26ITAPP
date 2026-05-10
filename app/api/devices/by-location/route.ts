import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getCanonicalLocationName, getLocationAliases } from "@/lib/location-filter"

/**
 * Returns all raw DB variants that map to the same canonical location name.
 */
function getLocationVariants(canonicalName: string): string[] {
  return getLocationAliases(canonicalName)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const location = searchParams.get("location")
    const username = searchParams.get("username")

    if (!location) {
      return NextResponse.json({ error: "Location is required" }, { status: 400 })
    }

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 401 })
    }

    // Resolve to canonical name, then get all known aliases for the same location
    const canonical = getCanonicalLocationName(location)
    const variants = Array.from(new Set(getLocationVariants(canonical)))
    console.log("[v0] Fetching devices for location:", location, "→ canonical:", canonical, "→ variants:", variants)

    const supabase = await createServerClient()

    // Verify user exists
    const { data: userProfile } = await supabase.from("profiles").select("*").eq("username", username).single()

    if (!userProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    // Build an OR filter that matches every known variant (case-insensitive)
    const orClauses = variants.map((v) => `location.ilike.${v}`).join(",")
    const { data: devices, error } = await supabase
      .from("devices")
      .select("*")
      .or(orClauses)
      .order("brand", { ascending: true })

    if (error) {
      console.error("[v0] Error fetching location devices:", error)
      return NextResponse.json({ error: "Failed to fetch devices" }, { status: 500 })
    }

    console.log("[v0] Found", devices?.length || 0, "devices for location:", location)
    return NextResponse.json(devices || [])
  } catch (error) {
    console.error("[v0] Error in by-location route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
