import { NextResponse, NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

function normalizeValue(value: string | null | undefined) {
  return (value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
    )

    const { department_head_id } = await request.json()

    if (!department_head_id) {
      return NextResponse.json(
        { error: "department_head_id is required" },
        { status: 400 }
      )
    }

    // Get the department head details
    const { data: headProfile, error: headError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, department, location, role")
      .eq("id", department_head_id)
      .eq("role", "department_head")
      .single()

    if (headError || !headProfile) {
      return NextResponse.json(
        { error: "Department head not found" },
        { status: 404 }
      )
    }

    // Fetch all eligible users, then match department/location in code so case/spacing mismatches do not break linking.
    const { data: candidates, error: staffError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, department, location, role, is_active, status")
      .or("is_active.eq.true,status.eq.approved")

    if (staffError) {
      console.error("[v0] Error fetching staff members:", staffError)
      return NextResponse.json(
        { error: "Failed to fetch staff members" },
        { status: 500 }
      )
    }

    const excludedRoles = new Set(["admin", "it_head", "regional_it_head", "service_provider", "department_head"])
    const targetDepartment = normalizeValue(headProfile.department)
    const targetLocation = normalizeValue(headProfile.location)

    const staffMembers = (candidates || []).filter((member: any) => {
      if (!member || member.id === department_head_id) return false
      if (excludedRoles.has(member.role)) return false
      return (
        normalizeValue(member.department) === targetDepartment &&
        normalizeValue(member.location) === targetLocation
      )
    })

    if (!staffMembers || staffMembers.length === 0) {
      return NextResponse.json({
        success: true,
        linked_count: 0,
        message: `No staff members found in ${headProfile.department} at ${headProfile.location}`,
      })
    }

    const staffIds = staffMembers.map((s) => s.id)

    // First, remove existing links for these staff members (to reassign them)
    await supabaseAdmin
      .from("department_head_links")
      .delete()
      .in("staff_id", staffIds)

    // Create new automatic links
    const links = staffIds.map((staff_id: string) => ({
      department_head_id,
      staff_id,
    }))

    const { data: insertedLinks, error: insertError } = await supabaseAdmin
      .from("department_head_links")
      .insert(links)
      .select()

    if (insertError) {
      console.error("[v0] Error creating automatic links:", insertError)
      return NextResponse.json(
        { error: "Failed to create automatic links" },
        { status: 500 }
      )
    }

    console.log(
      "[v0] Successfully auto-linked",
      staffIds.length,
      `eligible users to ${headProfile.full_name} (${headProfile.department} @ ${headProfile.location})`
    )

    return NextResponse.json({
      success: true,
      linked_count: staffIds.length,
      department: headProfile.department,
      location: headProfile.location,
      message: `Successfully linked ${staffIds.length} staff member(s) from ${headProfile.department} at ${headProfile.location} to ${headProfile.full_name}`,
    })
  } catch (error) {
    console.error("[v0] Error in auto-link department staff:", error)
    return NextResponse.json(
      { error: "Failed to auto-link staff" },
      { status: 500 }
    )
  }
}
