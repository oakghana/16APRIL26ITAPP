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
    const canEditOfficialSections = false

    const insertData = {
      request_number: requestNumber,
      staff_name: staffName,
      department_name: normalizedDepartment,
      complaints_from_users: complaintsFromUsers,
      request_date: requestDate || new Date().toISOString().split("T")[0],
      diagnosis_items: canEditOfficialSections ? faultItems || [] : [],
      other_comments: canEditOfficialSections ? otherComments || null : null,
      hardware_supervisor_name: canEditOfficialSections ? hardwareSupervisorName || null : null,
      hardware_supervisor_date: canEditOfficialSections ? hardwareSupervisorDate || null : null,
      date_of_last_repairs: canEditOfficialSections ? dateOfLastRepairs || null : null,
      date_of_purchase: canEditOfficialSections ? dateOfPurchase || null : null,
      times_repaired: canEditOfficialSections && numberOfTimesRepaired ? parseInt(numberOfTimesRepaired) : null,
      sectional_head_name: canEditOfficialSections ? sectionalHeadName || null : null,
      sectional_head_date: canEditOfficialSections ? sectionalHeadDate || null : null,
      confirmed_by: canEditOfficialSections ? confirmedBy || null : null,
      confirmed_date: canEditOfficialSections ? confirmedDate || null : null,
      gadget_working_status: canEditOfficialSections ? repairStatus || null : null,
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
        .select("full_name, username, location")

      const staffLocationMap = new Map<string, string>()
      for (const profile of profiles || []) {
        if (profile.full_name) staffLocationMap.set(String(profile.full_name).toLowerCase().trim(), String(profile.location || ""))
        if (profile.username) staffLocationMap.set(String(profile.username).toLowerCase().trim(), String(profile.location || ""))
      }

      requests = requests.map((req: any) => ({
        ...req,
        requester_location: staffLocationMap.get(String(req.staff_name || "").toLowerCase().trim()) || null,
      }))

      if (officeUseLocation) {
        const normalizedOfficeLocation = normalizeLocation(officeUseLocation)
        const canSeeNationwide =
          officeUseRole === "admin" ||
          officeUseRole === "it_head" ||
          (officeUseRole === "it_staff" && (normalizedOfficeLocation === "head_office" || normalizedOfficeLocation === "accra"))

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
