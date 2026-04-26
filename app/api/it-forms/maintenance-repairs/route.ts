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
    .from("maintenance_repair_requests")
    .select("request_number")
    .order("created_at", { ascending: false })
    .limit(1)

  const previousNumber = data?.[0]?.request_number || "MR-0000"
  const lastSequence = Number(previousNumber.split("-").pop() || "0")
  return `MR-${String(lastSequence + 1).padStart(4, "0")}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      staffName,
      departmentName,
      complaintsFromUsers,
      requestDate,
      faultItems,
      otherComments,
      hardwareSupervisorName,
      hardwareSupervisorDate,
      dateOfLastRepairs,
      dateOfPurchase,
      numberOfTimesRepaired,
      sectionalHeadName,
      sectionalHeadDate,
      confirmedBy,
      confirmedDate,
      repairStatus,
      submittedByRole,
      submittedByEmail,
    } = body

    const normalizedDepartment = normalizeDepartmentName(departmentName)
    if (!normalizedDepartment) {
      return NextResponse.json(
        { error: "Department is not configured for your account. Please contact admin." },
        { status: 400 }
      )
    }

    console.log("[maintenance-repairs] Creating new maintenance request:", {
      staffName,
      departmentName: normalizedDepartment,
    })

    const requestNumber = await generateNextSequentialNumber()
    const canEditTechnicianDetails = ["it_staff", "regional_it_head", "it_head", "admin"].includes(String(submittedByRole || "").toLowerCase())

    const insertData = {
      request_number: requestNumber,
      staff_name: staffName,
      department_name: normalizedDepartment,
      complaints_from_users: complaintsFromUsers,
      request_date: requestDate || new Date().toISOString().split("T")[0],
      diagnosis_items: canEditTechnicianDetails ? faultItems || [] : [],
      other_comments: canEditTechnicianDetails ? otherComments || null : null,
      hardware_supervisor_name: canEditTechnicianDetails ? hardwareSupervisorName || null : null,
      hardware_supervisor_date: canEditTechnicianDetails ? hardwareSupervisorDate || null : null,
      date_of_last_repairs: canEditTechnicianDetails ? dateOfLastRepairs || null : null,
      date_of_purchase: canEditTechnicianDetails ? dateOfPurchase || null : null,
      times_repaired: canEditTechnicianDetails && numberOfTimesRepaired ? parseInt(numberOfTimesRepaired) : null,
      // HOD/manager/post-repair feedback are workflow-owned and not set during requester submit.
      sectional_head_name: null,
      sectional_head_date: null,
      confirmed_by: null,
      confirmed_date: null,
      gadget_working_status: null,
      created_by: staffName || null,
      created_by_role: submittedByRole || null,
      created_by_email: submittedByEmail || null,
      status: "pending_hod",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data, error: insertError } = await supabaseAdmin
      .from("maintenance_repair_requests")
      .insert([insertData])
      .select()

    if (insertError) {
      console.error("[maintenance-repairs] Error creating request:", insertError)
      return NextResponse.json(
        { error: insertError.message || "Failed to create maintenance request" },
        { status: 500 }
      )
    }

    console.log("[maintenance-repairs] Request created successfully:", data)

    return NextResponse.json({
      success: true,
      message: "Maintenance and repairs request created successfully",
      request: data?.[0],
      requestNumber
    })

  } catch (error: any) {
    console.error("[maintenance-repairs] Error:", error)
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

    console.log("[maintenance-repairs] Loading maintenance requests:", { status, department })

    let query = supabaseAdmin
      .from("maintenance_repair_requests")
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

    if (processedBy) {
      query = query.eq("confirmed_by", processedBy)
    }

    const { data, error } = await query

    if (error) {
      console.error("[maintenance-repairs] Error loading requests:", error)
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
    console.error("[maintenance-repairs] Error:", error)
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
      .from("maintenance_repair_requests")
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
      .from("maintenance_repair_requests")
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
