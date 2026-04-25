import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isLocationInSameRegion, normalizeLocation } from "@/lib/location-filter"

type FormType = "new-gadget" | "maintenance"

const FORM_CONFIG: Record<FormType, { table: string; numberField: string; requesterNameField: string; relatedType: string }> = {
  "new-gadget": {
    table: "new_gadget_requests",
    numberField: "request_number",
    requesterNameField: "staff_name",
    relatedType: "new_gadget_request",
  },
  maintenance: {
    table: "maintenance_repair_requests",
    numberField: "request_number",
    requesterNameField: "staff_name",
    relatedType: "maintenance_repair_request",
  },
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "service-role-key-placeholder"
)

function canSeeNationwide(role: string, location: string) {
  const normalizedLocation = normalizeLocation(location)
  const isServiceDeskRole = role.startsWith("service_desk")
  return (
    role === "admin" ||
    role === "it_head" ||
    role === "it_store_head" ||
    (isServiceDeskRole && (normalizedLocation === "head_office" || normalizedLocation === "accra"))
  )
}

function statusAllowsSubmission(formType: FormType, status: string) {
  if (formType === "new-gadget") {
    return status === "recommended" || status === "gadget_issued"
  }
  return ["manager_confirmed", "sent_for_repair", "repaired", "confirmed_working"].includes(status)
}

export async function POST(request: NextRequest) {
  try {
    const {
      requisitionId,
      formType,
      submittedBy,
      submittedById,
      submittedByRole,
      submittedByLocation,
      notes,
    } = await request.json()

    if (!requisitionId || !formType || !submittedBy || !submittedByRole) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const config = FORM_CONFIG[formType as FormType]
    if (!config) {
      return NextResponse.json({ error: "Unsupported form type" }, { status: 400 })
    }

    const { data: reqData, error: fetchError } = await supabaseAdmin
      .from(config.table)
      .select("*")
      .eq("id", requisitionId)
      .single()

    if (fetchError || !reqData) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    if (!statusAllowsSubmission(formType as FormType, String(reqData.status || ""))) {
      return NextResponse.json(
        { error: "This request is not at an approved manager stage yet" },
        { status: 409 }
      )
    }

    const requesterName = String(reqData[config.requesterNameField] || "").trim().toLowerCase()
    let requesterLocation = ""

    if (requesterName) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("full_name, username, location")

      for (const profile of profiles || []) {
        const fullName = String(profile.full_name || "").trim().toLowerCase()
        const username = String(profile.username || "").trim().toLowerCase()
        if (fullName === requesterName || username === requesterName) {
          requesterLocation = String(profile.location || "")
          break
        }
      }
    }

    if (!canSeeNationwide(String(submittedByRole), String(submittedByLocation || ""))) {
      if (!submittedByLocation || !requesterLocation) {
        return NextResponse.json(
          { error: "Unable to validate regional access for this request" },
          { status: 403 }
        )
      }

      const sameRegion = isLocationInSameRegion(requesterLocation, submittedByLocation)
      if (!sameRegion) {
        return NextResponse.json({ error: "You can only act on requests from your region" }, { status: 403 })
      }
    }

    const alreadySubmitted =
      reqData.submitted_to_management === true ||
      reqData.it_submitted_to_management === true ||
      /submitted to management/i.test(String(reqData.other_comments || ""))

    if (alreadySubmitted) {
      return NextResponse.json({ error: "This request has already been submitted to management" }, { status: 409 })
    }

    const nowIso = new Date().toISOString()
    const updateData: Record<string, any> = {
      updated_at: nowIso,
      other_comments: [
        reqData.other_comments,
        `IT Office confirmed submission to management: ${notes?.trim() || "Forwarded for management action"} (by ${submittedBy} on ${nowIso})`,
      ]
        .filter(Boolean)
        .join("\n"),
    }

    if (Object.prototype.hasOwnProperty.call(reqData, "submitted_to_management")) {
      updateData.submitted_to_management = true
    }
    if (Object.prototype.hasOwnProperty.call(reqData, "submitted_to_management_at")) {
      updateData.submitted_to_management_at = nowIso
    }
    if (Object.prototype.hasOwnProperty.call(reqData, "submitted_to_management_by")) {
      updateData.submitted_to_management_by = submittedById || submittedBy
    }
    if (Object.prototype.hasOwnProperty.call(reqData, "submitted_to_management_by_name")) {
      updateData.submitted_to_management_by_name = submittedBy
    }
    if (Object.prototype.hasOwnProperty.call(reqData, "it_submitted_to_management")) {
      updateData.it_submitted_to_management = true
    }
    if (Object.prototype.hasOwnProperty.call(reqData, "it_submitted_to_management_at")) {
      updateData.it_submitted_to_management_at = nowIso
    }
    if (Object.prototype.hasOwnProperty.call(reqData, "it_submitted_to_management_by")) {
      updateData.it_submitted_to_management_by = submittedById || submittedBy
    }

    let updated: any = null
    let updateError: any = null

    for (let attempt = 0; attempt < 6; attempt++) {
      const result = await supabaseAdmin
        .from(config.table)
        .update(updateData)
        .eq("id", requisitionId)
        .select()
        .single()

      updated = result.data
      updateError = result.error

      if (!updateError) break

      const message = String(updateError.message || "")
      const missingColumnMatch = message.match(/Could not find the '([^']+)' column/i)
      const missingColumn = missingColumnMatch?.[1]

      if (missingColumn) {
        delete updateData[missingColumn]
        continue
      }

      break
    }

    if (updateError) {
      return NextResponse.json({ error: updateError.message || "Failed to update request" }, { status: 500 })
    }

    try {
      const requestNumber = reqData?.[config.numberField] || requisitionId
      const { data: adminUsers } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .eq("is_active", true)

      if (adminUsers && adminUsers.length > 0) {
        await supabaseAdmin.from("notifications").insert(
          adminUsers.map((admin) => ({
            user_id: admin.id,
            title: "IT Form Submitted to Management",
            message: `Request ${requestNumber} has been confirmed as submitted to management by ${submittedBy}.`,
            type: "info",
            category: "approval",
            reference_type: config.relatedType,
            reference_id: requisitionId,
            is_read: false,
          }))
        )
      }
    } catch (notifyError) {
      console.error("[management-submission] Notification error:", notifyError)
    }

    return NextResponse.json({ success: true, request: updated })
  } catch (error) {
    console.error("[management-submission] API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}