import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isITDDepartment } from "@/lib/department-options"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-build-key"
)

function isAllowedRole(role: string | null) {
  return (
    role === "admin" ||
    role === "department_head" ||
    role === "it_head" ||
    role === "regional_it_head" ||
    role === "it_manager" // IT Manager (typically department_head of IT department)
  )
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")
    const role = request.nextUrl.searchParams.get("role")
    const department = request.nextUrl.searchParams.get("department")

    if (!userId || !role) {
      return NextResponse.json({ error: "userId and role are required" }, { status: 400 })
    }

    if (!isAllowedRole(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // For department_head, check if they're IT Manager (IT department head)
    let queryRole = role
    if (role === "department_head" && isITDDepartment(department)) {
      queryRole = "it_manager"
    }

    const { data, error } = await supabaseAdmin
      .from("it_form_signature_profiles")
      .select("*")
      .eq("user_id", userId)
      .eq("role", queryRole)
      .single()

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, profile: data || null })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId, role, signatureDataUrl, department } = await request.json()

    if (!userId || !role || !signatureDataUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!isAllowedRole(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // For department_head, check if they're IT Manager (IT department head)
    let storageRole = role
    if (role === "department_head" && isITDDepartment(department)) {
      storageRole = "it_manager"
    }

    const now = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from("it_form_signature_profiles")
      .upsert(
        {
          user_id: userId,
          role: storageRole,
          signature_data_url: signatureDataUrl,
          updated_at: now,
        },
        { onConflict: "user_id,role" }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, profile: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
