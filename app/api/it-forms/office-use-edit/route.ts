import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

type FormType = "requisition" | "new-gadget" | "maintenance"

const FORM_CONFIG: Record<FormType, { table: string; numberField: string }> = {
  requisition: { table: "it_equipment_requisitions", numberField: "requisition_number" },
  "new-gadget": { table: "new_gadget_requests", numberField: "request_number" },
  maintenance: { table: "maintenance_repair_requests", numberField: "request_number" },
}

// Statuses that mean the next stage has already acted — edits are locked
const NEXT_STAGE_ACTED: Record<FormType, string[]> = {
  requisition: ["pending_admin", "pending_store", "approved", "issued", "completed", "rejected_it_head", "rejected_admin"],
  "new-gadget": ["recommended", "not_recommended", "gadget_issued", "rejected"],
  maintenance: ["manager_confirmed", "sent_for_repair", "repaired", "confirmed_working", "rejected"],
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key"
)

export async function PATCH(request: NextRequest) {
  try {
    const { requisitionId, formType, newNotes, processedBy } = await request.json()

    if (!requisitionId || !formType || !newNotes || !processedBy) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const config = FORM_CONFIG[formType as FormType]
    if (!config) {
      return NextResponse.json({ error: "Unsupported form type" }, { status: 400 })
    }

    const { data: record, error: fetchError } = await supabaseAdmin
      .from(config.table)
      .select("*")
      .eq("id", requisitionId)
      .single()

    if (fetchError || !record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }

    // Gate: check if next stage has already acted
    const lockedStatuses = NEXT_STAGE_ACTED[formType as FormType] || []
    if (lockedStatuses.includes(record.status)) {
      return NextResponse.json(
        { error: "This form has already been reviewed by the next stage and can no longer be edited." },
        { status: 403 }
      )
    }

    // Verify the requester is actually the person who processed it
    const processedByField = formType === "requisition" ? record.service_desk_processed_by : record.confirmed_by
    if (processedByField && processedByField !== processedBy) {
      return NextResponse.json({ error: "Only the original IT processor can edit their notes." }, { status: 403 })
    }

    const updateData: any = { updated_at: new Date().toISOString() }
    if (formType === "requisition") {
      updateData.service_desk_notes = newNotes
    } else {
      // Append to other_comments rather than wiping it
      const baseComments = record.other_comments || ""
      const withoutOldNote = baseComments.replace(/IT Office Use (completed|hold) note:.*(\n|$)/g, "").trim()
      updateData.other_comments = withoutOldNote
        ? `${withoutOldNote}\nIT Office Use updated note: ${newNotes}`
        : `IT Office Use updated note: ${newNotes}`
      updateData.confirmed_by = processedBy
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from(config.table)
      .update(updateData)
      .eq("id", requisitionId)
      .select()
      .single()

    if (updateError) {
      console.error("[office-use-edit] Update error:", updateError)
      return NextResponse.json({ error: updateError.message || "Failed to update notes" }, { status: 500 })
    }

    return NextResponse.json({ success: true, record: updated })
  } catch (error: any) {
    console.error("[office-use-edit] Error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
