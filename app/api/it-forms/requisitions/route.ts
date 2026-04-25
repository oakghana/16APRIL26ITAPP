import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isLocationInSameRegion, normalizeLocation } from "@/lib/location-filter"
import { normalizeDepartmentName } from "@/lib/department-options"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "service-role-key-placeholder"
)

function isUuidLike(value?: string | null) {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function generateNextSequentialNumber(attempt = 0): Promise<string> {
  // Try two queries: one for reg_no (the unique-constrained column) and one for requisition_number.
  // Run them independently so a missing column in one doesn't break the other.
  const [regNoResult, reqNumResult] = await Promise.allSettled([
    supabaseAdmin
      .from("it_equipment_requisitions")
      .select("reg_no")
      .not("reg_no", "is", null)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("it_equipment_requisitions")
      .select("requisition_number")
      .not("requisition_number", "is", null)
      .order("created_at", { ascending: false })
      .limit(100),
  ])

  let maxSeq = 0
  const allValues: string[] = []

  if (regNoResult.status === "fulfilled" && regNoResult.value.data) {
    allValues.push(...regNoResult.value.data.map((r: any) => r.reg_no).filter(Boolean))
  }
  if (reqNumResult.status === "fulfilled" && reqNumResult.value.data) {
    allValues.push(...reqNumResult.value.data.map((r: any) => r.requisition_number).filter(Boolean))
  }

  for (const val of allValues) {
    if (typeof val === "string") {
      const parts = val.split("-")
      const n = Number(parts[parts.length - 1])
      if (!isNaN(n) && n > maxSeq) maxSeq = n
    }
  }

  // Add the retry attempt offset to guarantee uniqueness under concurrent submissions.
  return `IT-REQ-${String(maxSeq + 1 + attempt).padStart(4, "0")}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      itemsRequired,
      purpose,
      requestedBy,
      requestedById,
      requestedByEmail,
      department,
      requestDate,
      submittedByRole,
      submittedByEmail,
    } = body

    const normalizedDepartment = normalizeDepartmentName(department)
    if (!normalizedDepartment) {
      return NextResponse.json(
        { error: "Department is not configured for your account. Please contact admin." },
        { status: 400 }
      )
    }

    console.log("[it-requisitions] Creating new IT equipment requisition:", {
      department: normalizedDepartment,
      requestedBy,
    })

    const requisitionNumber = await generateNextSequentialNumber()

    const now = new Date().toISOString()
    const insertData: Record<string, any> = {
      requisition_number: requisitionNumber,
      // reg_no is the NOT NULL alias used in some DB deployments for the requisition number.
      reg_no: requisitionNumber,
      // Requesters cannot set these fields; they are completed at store issuance.
      item_sn: null,
      supplier_name: null,
      items_required: itemsRequired,
      purpose: purpose,
      // Some deployments store requested_by/created_by as UUID; guard all identity fields.
      requested_by: isUuidLike(requestedById) ? requestedById : null,
      requested_by_id: isUuidLike(requestedById) ? requestedById : null,
      requested_by_email: requestedByEmail || null,
      department_name: normalizedDepartment,
      request_date: requestDate || now.split("T")[0],
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
      // created_by may be UUID-typed in some deployments — only set it if we have a real UUID.
      created_by: isUuidLike(requestedById) ? requestedById : null,
      created_by_role: submittedByRole || null,
      created_by_email: submittedByEmail || requestedByEmail || null,
      created_at: now,
      updated_at: now,
    }

    let data: any[] | null = null
    let insertError: any = null

    // Handle deployments where table schema is behind code (missing columns from recent migrations).
    for (let attempt = 0; attempt < 6; attempt++) {
      const result = await supabaseAdmin
        .from("it_equipment_requisitions")
        .insert([insertData])
        .select()

      data = result.data
      insertError = result.error

      if (!insertError) break

      const message = String(insertError.message || "")
      const missingColumnMatch = message.match(/Could not find the '([^']+)' column/i)
      const missingColumn = missingColumnMatch?.[1]

      if (!missingColumn) {
        // Duplicate reg_no/requisition_number — regenerate a fresh number and retry.
        if (insertError.code === "23505" && /reg_no|requisition_number/i.test(message)) {
          const newNumber = await generateNextSequentialNumber(attempt)
          insertData.reg_no = newNumber
          insertData.requisition_number = newNumber
          continue
        }

        // Fallback for typed-column mismatches (e.g., requester fields forced to UUID on some deployments).
        if (insertError.code === "22P02" && /invalid input syntax for type uuid/i.test(message)) {
          if (insertData.requested_by !== null && insertData.requested_by !== undefined && !isUuidLike(insertData.requested_by)) {
            insertData.requested_by = isUuidLike(requestedById) ? requestedById : null
            continue
          }
          if (insertData.requested_by_id !== null && insertData.requested_by_id !== undefined && !isUuidLike(insertData.requested_by_id)) {
            insertData.requested_by_id = null
            continue
          }
          if (insertData.created_by !== null && insertData.created_by !== undefined && !isUuidLike(insertData.created_by)) {
            insertData.created_by = isUuidLike(requestedById) ? requestedById : null
            continue
          }

          // Last-resort compatibility: drop fields that can carry non-UUID requester text in strict schemas.
          const uuidSensitiveFields = ["requested_by", "requested_by_id", "created_by", "approval_timeline", "approval_chain"]
          const nextField = uuidSensitiveFields.find((field) => Object.prototype.hasOwnProperty.call(insertData, field))
          if (nextField) {
            delete insertData[nextField]
            continue
          }
        }
        break
      }

      if (missingColumn === "department_name" && department !== undefined) {
        insertData.department = normalizedDepartment
      }

      if (missingColumn === "department" && department !== undefined) {
        insertData.department_name = normalizedDepartment
      }

      // If requisition_number column doesn't exist, fall back to reg_no (and vice versa).
      if (missingColumn === "requisition_number") {
        insertData.reg_no = insertData.reg_no || requisitionNumber
        delete insertData.requisition_number
        continue
      }
      if (missingColumn === "reg_no") {
        delete insertData.reg_no
        continue
      }

      if (missingColumn === "approval_timeline" && insertData.approval_timeline) {
        insertData.approval_chain = insertData.approval_timeline
      }

      if (missingColumn === "approval_chain" && insertData.approval_chain) {
        delete insertData.approval_chain
      }

      // Remove the missing field and retry.
      delete insertData[missingColumn]
    }

    if (insertError) {
      console.error("[it-requisitions] Error creating requisition:", insertError)
      return NextResponse.json(
        { error: insertError.message || "Failed to create requisition" },
        { status: 500 }
      )
    }

    console.log("[it-requisitions] Requisition created successfully:", data)

    const createdRow = data?.[0]
    const normalizedRow = createdRow
      ? {
          ...createdRow,
          requisition_number: createdRow.requisition_number || createdRow.reg_no || requisitionNumber,
          department: createdRow.department || createdRow.department_name || null,
        }
      : null

    return NextResponse.json({
      success: true,
      message: "IT equipment requisition created successfully",
      requisition: normalizedRow,
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
    const processedBy = searchParams.get("processedBy")

    console.log("[it-requisitions] Loading IT equipment requisitions:", { status, department })

    let query = supabaseAdmin
      .from("it_equipment_requisitions")
      .select("*")
      .order("created_at", { ascending: false })

    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    if (processedBy) {
      query = query.eq("service_desk_processed_by", processedBy)
    }

    const { data, error } = await query

    if (error) {
      console.error("[it-requisitions] Error loading requisitions:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let requisitions = (data || []).map((r: any) => ({
      ...r,
      department: r.department || r.department_name || null,
      // Normalize reg_no → requisition_number for UI compatibility.
      requisition_number: r.requisition_number || r.reg_no || null,
    }))

    if (department && department !== "all") {
      const normalizedDepartment = String(department).toLowerCase().trim()
      requisitions = requisitions.filter((r: any) =>
        String(r.department || r.department_name || "").toLowerCase().trim() === normalizedDepartment
      )
    }

    if (requestedBy) {
      const normalizedRequestedBy = String(requestedBy).toLowerCase().trim()
      requisitions = requisitions.filter((r: any) => {
        const candidates = [
          r.requested_by,
          r.requested_by_name,
          r.requester_name,
          r.created_by,
        ]
        return candidates.some((v: any) => String(v || "").toLowerCase().trim() === normalizedRequestedBy)
      })
    }

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
