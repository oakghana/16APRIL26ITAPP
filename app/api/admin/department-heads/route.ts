import { NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"

export async function GET() {
  try {
    const supabaseAdmin = getServerSupabase()
    // Get all department heads with staff count
    const { data: heads, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name as name, email, department")
      .eq("role", "department_head")
      .eq("is_active", true)

    if (error) throw error

    // Count staff for each head
    const headsWithCounts = await Promise.all(
      (heads || []).map(async (head: any) => {
        const { count } = await supabaseAdmin
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("department", head.department)
          .eq("role", "staff")
          .eq("is_active", true)

        return {
          ...head,
          staff_count: count || 0,
        }
      })
    )

    return NextResponse.json({ department_heads: headsWithCounts })
  } catch (error) {
    console.error("[v0] Error fetching department heads:", error)
    return NextResponse.json(
      { error: "Failed to fetch department heads" },
      { status: 500 }
    )
  }
}
