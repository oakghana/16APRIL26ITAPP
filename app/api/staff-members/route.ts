import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Use service role key to bypass RLS
const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    // sanitize roles to avoid passing invalid enum values to Postgres
    const includeRoles = searchParams.get("roles") || "it_staff,service_desk_head,regional_it_head"
    const onlyActive = searchParams.get("onlyActive") !== "false"

    const allowedRoles = [
      'admin',
      'it_head',
      'regional_it_head',
      'it_staff',
      'it_store_head',
      'service_desk_head',
      'service_desk_staff',
      'service_provider',
      'user',
      'staff'
    ]

    const roles = includeRoles
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean)
      .filter((r) => allowedRoles.includes(r))

    console.log("[v0] API Staff Members - roles:", roles, "onlyActive:", onlyActive)

    // Fetch staff members from profiles table
    // Note: use `full_name` (some schemas don't have `name` column)
    let query = supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, status, location")
      .in("role", roles)

    if (onlyActive) {
      // Active users are stored with status="approved" and is_active=true (see create-user mapStatus).
      // Filter by is_active to catch both naming variants across DB deployments.
      query = query.eq("is_active", true)
    }

    const { data, error } = await query.order("full_name", { ascending: true })

    if (error) {
      console.error("[v0] Error loading staff members:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[v0] Staff members loaded:", data?.length || 0)

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    console.error("[v0] Unexpected error in staff members API:", error)
    return NextResponse.json(
      { error: "Failed to load staff members" },
      { status: 500 }
    )
  }
}
