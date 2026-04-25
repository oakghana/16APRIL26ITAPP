import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "service-role-key-placeholder"
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      )
    }

    // Fetch by requested_by_id (UUID match) OR by email columns as fallback
    // when the account's requestedById was not a valid UUID at submission time.
    const [byId, byEmail] = await Promise.all([
      supabaseAdmin
        .from("it_equipment_requisitions")
        .select("*")
        .eq("requested_by_id", userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("it_equipment_requisitions")
        .select("*")
        .or(`requested_by_email.eq.${userId},created_by_email.eq.${userId}`)
        .order("created_at", { ascending: false }),
    ])

    // Also try resolving the userId to an email via profiles for the email fallback
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, username")
      .eq("id", userId)
      .maybeSingle()

    let byProfileEmail: any[] = []
    if (profile?.email) {
      const { data } = await supabaseAdmin
        .from("it_equipment_requisitions")
        .select("*")
        .or(`requested_by_email.eq.${profile.email},created_by_email.eq.${profile.email}`)
        .order("created_at", { ascending: false })
      byProfileEmail = data || []
    }

    if (byId.error && byEmail.error) {
      console.error("[my-requisitions] Error fetching requisitions:", byId.error)
      return NextResponse.json(
        { error: "Failed to fetch requisitions" },
        { status: 500 }
      )
    }

    // Merge all results, deduplicate by id
    const seen = new Set<string>()
    const requisitions: any[] = []
    for (const row of [...(byId.data || []), ...(byEmail.data || []), ...byProfileEmail]) {
      if (!seen.has(row.id)) {
        seen.add(row.id)
        requisitions.push({
          ...row,
          requisition_number: row.requisition_number || row.reg_no || null,
          department: row.department || row.department_name || null,
        })
      }
    }
    // Sort merged results newest first
    requisitions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({
      success: true,
      requisitions: requisitions || [],
    })
  } catch (error) {
    console.error("[v0] API Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
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

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("it_equipment_requisitions")
      .select("id,status")
      .eq("id", id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    if (!["draft", "pending_department_head"].includes(existing.status)) {
      return NextResponse.json({ error: "This request can no longer be edited." }, { status: 403 })
    }

    const updatePayload = {
      items_required: body.items_required,
      purpose: body.purpose,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from("it_equipment_requisitions")
      .update(updatePayload)
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
