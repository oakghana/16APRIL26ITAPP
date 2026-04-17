import { type NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"

// Use service role key to bypass RLS
export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabase()
    const searchParams = request.nextUrl.searchParams
    const location = searchParams.get("location")
    const canSeeAll = searchParams.get("canSeeAll") === "true"
    const q = searchParams.get("q")
    const field = searchParams.get("field")

    console.log("[v0] API Devices - location:", location, "canSeeAll:", canSeeAll, "field:", field, "q:", q)

    let query = supabase
      .from("devices")
      .select("*")
      .order("created_at", { ascending: false })

    // If a free-text search is provided, apply it according to `field`
    if (q) {
      const likeQ = `%${q}%`
      if (field === "type") {
        // match device_type
        // @ts-ignore
        query = query.ilike("device_type", likeQ)
      } else if (field === "name") {
        // search brand or model
        // @ts-ignore
        query = query.or(`brand.ilike.%${q}%,model.ilike.%${q}%`)
      } else {
        // default to location search
        // @ts-ignore
        query = query.ilike("location", likeQ)
      }
    } else if (!canSeeAll && location) {
      const locationClauses = getLocationFilterClauses(location)
      // @ts-ignore
      query = query.or(locationClauses.join(","))
    }

    const { data, error } = await query

    if (error) {
      console.error("[v0] Error loading devices:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[v0] Loaded devices:", data?.length)
    return NextResponse.json({ devices: data || [], count: data?.length || 0 })
  } catch (error: any) {
    console.error("[v0] Error in devices API:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log("[v0] Creating device:", body)

    // Validate required fields
    if (!body.location || body.location.trim() === "") {
      console.error("[v0] Location is required but not provided")
      return NextResponse.json({ 
        error: "Location is required. Please select a valid location before adding a device." 
      }, { status: 400 })
    }

    if (!body.device_type || !body.brand || !body.model || !body.serial_number) {
      console.error("[v0] Missing required fields")
      return NextResponse.json({ 
        error: "All required fields (device type, brand, model, serial number, and location) must be provided." 
      }, { status: 400 })
    }

    // Check for duplicate location + serial number combo
    const { data: existingDevice, error: checkError } = await supabase
      .from("devices")
      .select("id, serial_number, brand, model, location")
      .eq("serial_number", body.serial_number)
      .eq("location", body.location)
      .single()

    if (checkError && checkError.code !== "PGRST116") { // PGRST116 = no rows
      console.error("[v0] Error checking for duplicates:", checkError)
    }

    if (existingDevice && !existingDevice.error) {
      console.warn("[v0] Duplicate device detected at same location:", {
        serialNumber: body.serial_number,
        location: body.location,
        existing: `${existingDevice.brand} ${existingDevice.model}`
      })
      return NextResponse.json({
        error: `Device with serial number "${body.serial_number}" already exists at location "${body.location}". Please use a different serial number or location.`,
        isDuplicate: true,
        existingDevice: existingDevice
      }, { status: 409 })
    }

    const { data, error } = await supabase
      .from("devices")
      .insert([{
        device_type: body.device_type,
        brand: body.brand,
        model: body.model,
        serial_number: body.serial_number,
        asset_tag: body.asset_tag || null,
        location: body.location,
        region_id: body.region_id || null,
        district_id: body.district_id || null,
        assigned_to: body.assigned_to || null,
        status: body.status || "active",
        purchase_date: body.purchase_date || null,
        warranty_expiry: body.warranty_expiry || null,
        room_number: body.room_number || null,
        building: body.building || null,
        floor_level: body.floor || null,
        toner_type: body.toner_type || null,
        toner_model: body.toner_model || null,
        toner_yield: body.toner_yield || null,
        monthly_print_volume: body.monthly_print_volume || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating device:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[v0] Device created successfully:", {
      id: data?.id,
      serial_number: data?.serial_number,
      location: data?.location,
      brand: data?.brand,
      model: data?.model
    })
    
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("[v0] Error in devices API:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
