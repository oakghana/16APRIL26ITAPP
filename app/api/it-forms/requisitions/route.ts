import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isLocationInSameRegion, normalizeLocation } from "@/lib/location-filter"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "service-role-key-placeholder"
)

async function generateNextSequentialNumber() {
  const { data } = await supabaseAdmin
    .from("it_equipment_requisitions")
    .select("requisition_number")
    .order("created_at", { ascending: false })
    .limit(1)

  const previousNumber = data?.[0]?.requisition_number || "IT-REQ-0000"
  const lastSequence = Number(previousNumber.split("-").pop() || "0")
  return `IT-REQ-${String(lastSequence + 1).padStart(4, "0")}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      itemSN,
      supplierName,
      itemsRequired,
      purpose,
      requestedBy,
      requestedById,
      requestedByEmail,
      department,
      requestDate,
    } = body

    console.log("[it-requisitions] Creating new IT equipment requisition:", {
      itemSN,
      supplierName,
      department,
      requestedBy,
    })

    const requisitionNumber = await generateNextSequentialNumber()

    const now = new Date().toISOString()
    const insertData = {
      requisition_number: requisitionNumber,
      item_sn: itemSN,
      supplier_name: supplierName,
      items_required: itemsRequired,
      purpose: purpose,
      requested_by: requestedBy,
      requested_by_id: requestedById || null,
      requested_by_email: requestedByEmail || null,
      department: department,
      request_date: requestDate || now,
      status: "pending_department_head",
      approval_timeline: [
        {
          approver: requestedBy,
          role: "requester",
          action: "submitted",
          notes: "Request submitted and routed to Department Head for review",
          timestamp: now,
        },
      ],
      created_at: now,
      updated_at: now,
    }

    const { data, error: insertError } = await supabaseAdmin
      .from("it_equipment_requisitions")
      .insert([insertData])
      .select()

    if (insertError) {
      console.error("[it-requisitions] Error creating requisition:", insertError)
      return NextResponse.json(
        { error: insertError.message || "Failed to create requisition" },
        { status: 500 }
      )
    }

    console.log("[it-requisitions] Requisition created successfully:", data)

    return NextResponse.json({
      success: true,
      message: "IT equipment requisition created successfully",
      requisition: data?.[0],
      requisitionNumber
    })

  } catch (error: any) {
    console.error("[it-requisitions] Error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const department = searchParams.get("department")
    const requestedBy = searchParams.get("requestedBy")
    const officeUseLocation = searchParams.get("officeUseLocation")
    const officeUseRole = searchParams.get("officeUseRole")

    console.log("[it-requisitions] Loading IT equipment requisitions:", { status, department })

    let query = supabaseAdmin
      .from("it_equipment_requisitions")
      .select("*")
      .order("created_at", { ascending: false })

    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    if (department && department !== "all") {
      query = query.eq("department", department)
    }

    if (requestedBy) {
      query = query.eq("requested_by", requestedBy)
    }

    const { data, error } = await query

    if (error) {
      console.error("[it-requisitions] Error loading requisitions:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let requisitions = data || []

    if (officeUseLocation && requisitions.length > 0) {
      const requesterIds = [...new Set(requisitions.map((r: any) => r.requested_by_id).filter(Boolean))]
      const { data: requesterProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, username, location")

      const locationById = new Map((requesterProfiles || []).map((p: any) => [p.id, String(p.location || "")]))
      const locationByName = new Map<string, string>()

      for (const p of requesterProfiles || []) {
        if (p.full_name) {
          locationByName.set(String(p.full_name).toLowerCase().trim(), String(p.location || ""))
        }
        if (p.username) {
          locationByName.set(String(p.username).toLowerCase().trim(), String(p.location || ""))
        }
      }

      requisitions = requisitions.map((r: any) => ({
        ...r,
        requester_location:
          (r.requested_by_id ? locationById.get(r.requested_by_id) : "") ||
          locationByName.get(String(r.requested_by || "").toLowerCase().trim()) ||
          null,
      }))

      const normalizedOfficeLocation = normalizeLocation(officeUseLocation)
      const canSeeNationwide =
        officeUseRole === "admin" ||
        officeUseRole === "it_head" ||
        (officeUseRole === "it_staff" && (normalizedOfficeLocation === "head_office" || normalizedOfficeLocation === "accra"))

      if (!canSeeNationwide) {
        requisitions = requisitions.filter((r: any) => {
          const requesterLocation = String(r.requester_location || "")

          if (!requesterLocation) return false

          if (officeUseRole === "regional_it_head" || officeUseRole === "it_staff") {
            return isLocationInSameRegion(requesterLocation, officeUseLocation)
          }

          return normalizeLocation(requesterLocation) === normalizedOfficeLocation
        })
      }
    }

    return NextResponse.json({
      success: true,
      requisitions
    })

  } catch (error: any) {
    console.error("[it-requisitions] Error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
