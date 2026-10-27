import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      requestedBy,
      requestedByRole,
      beneficiary,
      location,
      destinationLocation,
      itReqNumber,
      requisitionFrequency = "monthly",
      items,
      notes,
    } = body

    console.log("[requisitions] Creating new requisition:", {
      requestedBy,
      requestedByRole,
      beneficiary,
      location,
      destinationLocation,
      itemsCount: items?.length
    })

    // Generate requisition number
    const date = new Date()
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "")
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, "0")
    const requisitionNumber = `REQ-${dateStr}-${randomNum}`

    // Build the insert object with only columns that exist
    const insertData: Record<string, any> = {
      requisition_number: requisitionNumber,
      requested_by: requestedBy,
      beneficiary: beneficiary,
      location: location || "central_stores",
      items: items.map((item: any) => ({
        item_id: item.item_id,
        itemName: item.itemName,
        quantity: Number.parseInt(item.quantity),
        unit: item.unit,
      })),
      status: "pending",
      requisition_frequency: ["weekly", "monthly", "quarterly"].includes(requisitionFrequency)
        ? requisitionFrequency
        : "monthly",
      notes: notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Add optional columns if they have values
    if (destinationLocation) {
      insertData.destination_location = destinationLocation
    }
    if (itReqNumber) {
      insertData.it_req_number = itReqNumber
    }
    if (requestedByRole) {
      insertData.requested_by_role = requestedByRole
    }

    const { data, error: insertError } = await supabaseAdmin
      .from("store_requisitions")
      .insert([insertData])
      .select()

    if (insertError) {
      console.error("[requisitions] Error creating requisition:", insertError)
      
      // If column doesn't exist, try without optional columns
      if (insertError.message?.includes("column") || insertError.code === "42703") {
        console.log("[requisitions] Retrying with minimal columns...")
        
        const minimalData = {
          requisition_number: requisitionNumber,
          requested_by: requestedBy,
          beneficiary: beneficiary,
          location: location || "central_stores",
          items: items.map((item: any) => ({
            item_id: item.item_id,
            itemName: item.itemName,
            quantity: Number.parseInt(item.quantity),
            unit: item.unit,
          })),
          status: "pending",
          notes: notes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        const { data: retryData, error: retryError } = await supabaseAdmin
          .from("store_requisitions")
          .insert([minimalData])
          .select()

        if (retryError) {
          console.error("[requisitions] Retry also failed:", retryError)
          return NextResponse.json(
            { error: retryError.message || "Failed to create requisition" },
            { status: 500 }
          )
        }

        console.log("[requisitions] Requisition created successfully (minimal):", retryData)
        return NextResponse.json({
          success: true,
          message: "Requisition created successfully",
          requisition: retryData?.[0],
          requisitionNumber
        })
      }

      return NextResponse.json(
        { error: insertError.message || "Failed to create requisition" },
        { status: 500 }
      )
    }

    console.log("[requisitions] Requisition created successfully:", data)

    return NextResponse.json({
      success: true,
      message: "Requisition created successfully",
      requisition: data?.[0],
      requisitionNumber
    })

  } catch (error: any) {
    console.error("[requisitions] Error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const location = searchParams.get("location") || ""
    const canSeeAll = searchParams.get("canSeeAll") === "true"
    const status = searchParams.get("status")

    console.log("[requisitions] Loading requisitions:", { location, canSeeAll, status })

    let query = supabaseAdmin
      .from("store_requisitions")
      .select("*")
      .order("created_at", { ascending: false })

    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    if (!canSeeAll && location) {
      query = query.or(`location.eq.${location},destination_location.eq.${location}`)
    }

    const { data, error } = await query

    if (error) {
      console.error("[requisitions] Error loading requisitions:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      requisitions: data || []
    })

  } catch (error: any) {
    console.error("[requisitions] Error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
