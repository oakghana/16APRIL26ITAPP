import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isLocationInSameRegion, normalizeLocation } from "@/lib/location-filter"
import { normalizeDepartmentName } from "@/lib/department-options"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "service-role-key-placeholder"
)

async function generateNextSequentialNumber() {
  const { data } = await supabaseAdmin
    .from("new_gadget_requests")
    .select("request_number")
    .order("created_at", { ascending: false })
    .limit(1)

  const previousNumber = data?.[0]?.request_number || "NG-0000"
  const lastSequence = Number(previousNumber.split("-").pop() || "0")
  return `NG-${String(lastSequence + 1).padStart(4, "0")}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      staffName,
      departmentName,
      complaintsFromUsers,
      requestDate,
      makeOfGadget,
      serialNumber,
      yearOfPurchase,
      otherComments,
      departmentalHeadName,
      departmentalHeadDate,
      recommended,
      confirmedBy,
      confirmedDate,
      submittedByRole,
      submittedByEmail, // Email of the person who initiated the request
    } = body

    const normalizedDepartment = normalizeDepartmentName(departmentName)
    if (!normalizedDepartment) {
      return NextResponse.json(
        { error: "Department is not configured for your account. Please contact admin." },
        { status: 400 }
      )
    }

    console.log("[new-gadget] Creating new gadget request:", {
      staffName,
      departmentName: normalizedDepartment,
      makeOfGadget,
    })

    const requestNumber = await generateNextSequentialNumber()
    const canEditTechnicalDetails = ["it_staff", "regional_it_head", "it_head", "admin"].includes(String(submittedByRole || "").toLowerCase())

    const insertData = {
      request_number: requestNumber,
      staff_name: staffName,
      department_name: normalizedDepartment,
      complaints_from_users: complaintsFromUsers,
      request_date: requestDate || new Date().toISOString().split("T")[0],
      gadget_make: canEditTechnicalDetails ? makeOfGadget || null : null,
      serial_number: canEditTechnicalDetails ? serialNumber || null : null,
      year_of_purchase: canEditTechnicalDetails && yearOfPurchase ? parseInt(yearOfPurchase) : null,
      other_comments: canEditTechnicalDetails ? otherComments || null : null,
      // HOD and manager approval fields remain workflow-owned and are never set at requester submit time.
      departmental_head_name: null,
      departmental_head_date: null,
      recommended: null,
      confirmed_by: null,
      confirmed_date: null,
      // Initiator tracking - who submitted this form
      created_by: staffName,
      created_by_role: submittedByRole,
      created_by_email: submittedByEmail,
      status: "pending_hod",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data, error: insertError } = await supabaseAdmin
      .from("new_gadget_requests")
      .insert([insertData])
      .select()

    if (insertError) {
      console.error("[new-gadget] Error creating request:", insertError)
      return NextResponse.json(
        { error: insertError.message || "Failed to create gadget request" },
        { status: 500 }
      )
    }

    console.log("[new-gadget] Request created successfully:", data)

    return NextResponse.json({
      success: true,
      message: "New gadget request created successfully",
      request: data?.[0],
      requestNumber
    })

  } catch (error: any) {
    console.error("[new-gadget] Error:", error)
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
    const staffName = searchParams.get("staffName")
    const officeUseLocation = searchParams.get("officeUseLocation")
    const officeUseRole = searchParams.get("officeUseRole")
    const processedBy = searchParams.get("processedBy")
    const processedById = searchParams.get("processedById")

    console.log("[new-gadget] Loading gadget requests:", { status, department })

    let query = supabaseAdmin
      .from("new_gadget_requests")
      .select("*")
      .order("created_at", { ascending: false })

    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    if (department && department !== "all") {
      query = query.eq("department_name", department)
    }

    if (staffName) {
      query = query.eq("staff_name", staffName)
    }

    if (processedById && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(processedById)) {
      query = query.eq("confirmed_by", processedById)
    } else if (processedBy) {
      query = query.eq("confirmed_by", processedBy)
    }

    const { data, error } = await query

    if (error) {
      console.error("[new-gadget] Error loading requests:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let requests = data || []

    if (requests.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, username, email, location")

      const locationByIdentity = new Map<string, string>()
      for (const profile of profiles || []) {
        const loc = String(profile.location || "")
        if (profile.id) locationByIdentity.set(String(profile.id).toLowerCase().trim(), loc)
        if (profile.email) locationByIdentity.set(String(profile.email).toLowerCase().trim(), loc)
        if (profile.full_name) locationByIdentity.set(String(profile.full_name).toLowerCase().trim(), loc)
        if (profile.username) locationByIdentity.set(String(profile.username).toLowerCase().trim(), loc)
      }

      requests = requests.map((req: any) => {
        const requesterLocation =
          locationByIdentity.get(String(req.requested_by_id || req.created_by_id || "").toLowerCase().trim()) ||
          locationByIdentity.get(String(req.requested_by_email || req.created_by_email || "").toLowerCase().trim()) ||
          locationByIdentity.get(String(req.staff_name || req.requested_by || req.created_by || "").toLowerCase().trim()) ||
          // Fallback: resolve via the HOD who approved, when requester identity is unknown
          locationByIdentity.get(String(req.departmental_head_name || "").toLowerCase().trim()) ||
          null

        return {
          ...req,
          requester_location: requesterLocation,
        }
      })

      if (officeUseLocation) {
        const normalizedOfficeLocation = normalizeLocation(officeUseLocation)
        const isServiceDeskRole = (officeUseRole || "").startsWith("service_desk")
        const canSeeNationwide =
          officeUseRole === "admin" ||
          officeUseRole === "it_head" ||
          officeUseRole === "it_store_head" ||
          (isServiceDeskRole && (normalizedOfficeLocation === "head_office" || normalizedOfficeLocation === "accra"))

        if (!canSeeNationwide) {
          requests = requests.filter((req: any) => {
            const requesterLocation = String(req.requester_location || "")
            if (!requesterLocation) return false
            if (officeUseRole === "regional_it_head" || officeUseRole === "it_staff") {
              return isLocationInSameRegion(requesterLocation, officeUseLocation)
            }
            return normalizeLocation(requesterLocation) === normalizedOfficeLocation
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      requests
    })

  } catch (error: any) {
    console.error("[new-gadget] Error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const body = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Request id is required" }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from("new_gadget_requests")
      .select("id,status")
      .eq("id", id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    if (!["draft", "pending_department_head", "pending", "pending_hod"].includes(existing.status)) {
      return NextResponse.json({ error: "This request is already under review and cannot be edited." }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from("new_gadget_requests")
      .update({
        complaints_from_users: body.items_required,
        other_comments: body.purpose,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to update request" }, { status: 500 })
    }

    return NextResponse.json({ success: true, requisition: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
