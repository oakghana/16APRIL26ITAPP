import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"

// Use service role key to bypass RLS
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getServerSupabase()
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("activeOnly") !== "false"

    console.log("[v0] Fetching service providers from service_providers table, activeOnly:", activeOnly)

    // Fetch from service_providers table which has proper foreign key relationships with repair_requests
    // Also join with profiles to get current status
    let query = supabaseAdmin
      .from("service_providers")
      .select(`
        id, 
        name, 
        email, 
        phone, 
        location, 
        is_active,
        specialization,
        user_id,
        profiles!service_providers_user_id_fkey (
          status,
          full_name,
          role
        )
      `)
      .order("name", { ascending: true })

    const { data: spData, error: spError } = await query

    console.log("[v0] Fetched service providers:", spData?.length || 0)
    console.log("[v0] Service providers data:", spData?.map(p => ({ 
      id: p.id, 
      name: p.name, 
      is_active: p.is_active,
      user_id: p.user_id,
      profile_status: (p as any).profiles?.status 
    })))

    if (spError) {
      console.error("[v0] Error fetching service providers:", spError)
      return NextResponse.json({ error: spError.message }, { status: 500 })
    }

    // Filter to active providers - check both is_active flag and profile status
    let providers = (spData || []).filter((p: any) => {
      if (activeOnly) {
        // Must be marked active in service_providers table
        if (!p.is_active) return false
        
        // If linked to a profile, check the profile status is Active
        if (p.profiles && p.profiles.status !== "Active") return false
      }
      return true
    })

    console.log("[v0] Filtered service providers count:", providers.length)

    const formattedProviders = providers.map((provider: any) => ({
      id: provider.id, // This is the service_providers.id that repair_requests foreign key expects
      name: provider.name,
      email: provider.email,
      phone: provider.phone,
      location: provider.location,
      specialization: provider.specialization || [],
      is_active: provider.is_active,
      user_id: provider.user_id,
    }))

    console.log("[v0] Returning service providers:", formattedProviders.length, "providers")

    return NextResponse.json({ providers: formattedProviders, count: formattedProviders.length })
  } catch (error) {
    console.error("[v0] API Service Providers error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log("[v0] Creating service provider:", body)

    const { data, error } = await supabaseAdmin
      .from("service_providers")
      .insert({
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        address: body.address || null,
        specialization: body.specialization || [],
        location: body.location || null,
        is_active: body.is_active !== false,
        notes: body.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating service provider:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[v0] Service provider created:", data)

    return NextResponse.json({ provider: data })
  } catch (error) {
    console.error("[v0] API Service Providers POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "Provider ID is required" }, { status: 400 })
    }

    console.log("[v0] Updating service provider:", id)

    const { data, error } = await supabaseAdmin
      .from("service_providers")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error updating service provider:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ provider: data })
  } catch (error) {
    console.error("[v0] API Service Providers PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Provider ID is required" }, { status: 400 })
    }

    console.log("[v0] Deleting service provider:", id)

    // Soft delete by setting is_active to false
    const { data, error } = await supabaseAdmin
      .from("service_providers")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error deleting service provider:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, provider: data })
  } catch (error) {
    console.error("[v0] API Service Providers DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
