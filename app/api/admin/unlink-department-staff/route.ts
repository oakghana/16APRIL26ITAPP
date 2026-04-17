import { NextResponse, NextRequest } from "next/server"
import { getServerSupabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getServerSupabase()
    const { department_head_id, staff_id } = await request.json()

    if (!department_head_id || !staff_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from("department_head_links")
      .delete()
      .eq("department_head_id", department_head_id)
      .eq("staff_id", staff_id)

    if (error) throw error

    console.log("[v0] Successfully unlinked staff from department head")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error unlinking staff:", error)
    return NextResponse.json(
      { error: "Failed to unlink staff" },
      { status: 500 }
    )
  }
}
