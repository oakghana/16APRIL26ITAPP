import { NextResponse, NextRequest } from "next/server"
import { getServerSupabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getServerSupabase()
    const { department_head_id, staff_ids } = await request.json()

    if (!department_head_id || !staff_ids || staff_ids.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // First remove existing links for these staff members
    await supabaseAdmin
      .from("department_head_links")
      .delete()
      .in("staff_id", staff_ids)

    // Create new links
    const links = staff_ids.map((staff_id: string) => ({
      department_head_id,
      staff_id,
      created_at: new Date().toISOString(),
    }))

    const { error } = await supabaseAdmin
      .from("department_head_links")
      .insert(links)

    if (error) throw error

    console.log("[v0] Successfully linked", staff_ids.length, "staff to department head")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error linking staff:", error)
    return NextResponse.json(
      { error: "Failed to link staff" },
      { status: 500 }
    )
  }
}
