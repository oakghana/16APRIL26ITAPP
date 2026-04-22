import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
    )

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const location = searchParams.get("location")
    const year = searchParams.get("year") || new Date().getFullYear().toString()
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "20")
    const role = searchParams.get("role")

    let query = supabaseAdmin
      .from("weekly_internet_reports")
      .select("*")
      .order("week_start_date", { ascending: false })
      .limit(limit)

    // Regional IT heads only see their own reports
    if (role === "regional_it_head" && userId) {
      query = query.eq("submitted_by", userId)
    } else if (location && location !== "all" && role !== "admin" && role !== "it_head") {
      query = query.eq("location", location)
    }

    if (status) query = query.eq("status", status)
    if (year) query = query.eq("year", parseInt(year))

    const { data, error } = await query

    if (error) {
      console.error("[weekly-reports] Fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, reports: data || [] })
  } catch (error) {
    console.error("[weekly-reports] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
    )

    const body = await request.json()
    const {
      submitted_by,
      submitted_by_name,
      location,
      region,
      week_start_date,
      week_end_date,
      overall_status,
      uptime_percentage,
      primary_isp,
      primary_isp_status,
      primary_isp_notes,
      backup_isp,
      backup_isp_status,
      backup_isp_notes,
      downtime_incidents,
      downtime_total_hours,
      downtime_details,
      users_affected,
      departments_affected,
      issues_reported,
      resolutions_taken,
      escalated_to_head_office,
      escalation_details,
      avg_download_speed_mbps,
      avg_upload_speed_mbps,
      speed_test_tool,
      planned_maintenance,
      maintenance_window,
      additional_notes,
      status: reportStatus,
    } = body

    if (!submitted_by || !location || !week_start_date) {
      return NextResponse.json({ error: "submitted_by, location, and week_start_date are required" }, { status: 400 })
    }

    const weekDate = new Date(week_start_date)
    const weekNumber = getWeekNumber(weekDate)
    const year = weekDate.getFullYear()
    const weekEndDate = week_end_date || getWeekEndDate(weekDate)

    const reportData = {
      submitted_by,
      submitted_by_name,
      location,
      region: region || null,
      week_start_date,
      week_end_date: weekEndDate,
      week_number: weekNumber,
      year,
      overall_status: overall_status || "operational",
      uptime_percentage: uptime_percentage ?? null,
      primary_isp: primary_isp || null,
      primary_isp_status: primary_isp_status || "operational",
      primary_isp_notes: primary_isp_notes || null,
      backup_isp: backup_isp || null,
      backup_isp_status: backup_isp_status || "operational",
      backup_isp_notes: backup_isp_notes || null,
      downtime_incidents: downtime_incidents || 0,
      downtime_total_hours: downtime_total_hours || 0,
      downtime_details: downtime_details || null,
      users_affected: users_affected || 0,
      departments_affected: departments_affected || [],
      issues_reported: issues_reported || null,
      resolutions_taken: resolutions_taken || null,
      escalated_to_head_office: escalated_to_head_office || false,
      escalation_details: escalation_details || null,
      avg_download_speed_mbps: avg_download_speed_mbps ?? null,
      avg_upload_speed_mbps: avg_upload_speed_mbps ?? null,
      speed_test_tool: speed_test_tool || null,
      planned_maintenance: planned_maintenance || null,
      maintenance_window: maintenance_window || null,
      additional_notes: additional_notes || null,
      status: reportStatus || "submitted",
      submitted_at: reportStatus === "submitted" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }

    // Upsert (update if same user+week already exists)
    const { data, error } = await supabaseAdmin
      .from("weekly_internet_reports")
      .upsert(reportData, { onConflict: "submitted_by,week_start_date" })
      .select()
      .single()

    if (error) {
      console.error("[weekly-reports] Insert error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create notification for admin and IT head when report is submitted
    if (reportStatus === "submitted") {
      const { data: admins } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .in("role", ["admin", "it_head"])
        .eq("is_active", true)

      if (admins && admins.length > 0) {
        const notifications = admins.map((admin) => ({
          user_id: admin.id,
          title: "Weekly Internet Report Submitted",
          message: `${submitted_by_name} (${location}) has submitted the weekly internet services report for week ${weekNumber}/${year}.`,
          type: "info",
          category: "weekly_report",
          is_read: false,
          read_at: null,
          reference_type: "weekly_internet_report",
          reference_id: data.id,
        }))

        await supabaseAdmin.from("notifications").insert(notifications)
      }
    }

    return NextResponse.json({ success: true, report: data })
  } catch (error) {
    console.error("[weekly-reports] POST error:", error)
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
    )

    const body = await request.json()
    const { id, acknowledged_by, acknowledged_by_name, acknowledgement_notes } = body

    if (!id || !acknowledged_by) {
      return NextResponse.json({ error: "id and acknowledged_by are required" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("weekly_internet_reports")
      .update({
        status: "acknowledged",
        acknowledged_by,
        acknowledged_by_name,
        acknowledgement_notes: acknowledgement_notes || null,
        acknowledged_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Notify the submitter their report was acknowledged
    await supabaseAdmin.from("notifications").insert({
      user_id: data.submitted_by,
      title: "Weekly Report Acknowledged",
      message: `Your weekly internet services report for week ${data.week_number}/${data.year} has been acknowledged by ${acknowledged_by_name}.`,
      type: "success",
      category: "weekly_report",
      is_read: false,
      read_at: null,
      reference_type: "weekly_internet_report",
      reference_id: id,
    })

    return NextResponse.json({ success: true, report: data })
  } catch (error) {
    console.error("[weekly-reports] PATCH error:", error)
    return NextResponse.json({ error: "Failed to acknowledge report" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
    )

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const requestedBy = searchParams.get("requestedBy")
    const requestedByRole = searchParams.get("requestedByRole")

    if (!id || !requestedBy) {
      return NextResponse.json({ error: "id and requestedBy are required" }, { status: 400 })
    }

    if (requestedByRole !== "admin") {
      return NextResponse.json({ error: "Only admins can delete weekly reports" }, { status: 403 })
    }

    const { data: existingReport, error: fetchError } = await supabaseAdmin
      .from("weekly_internet_reports")
      .select("id, submitted_by, submitted_by_name, week_number, year, location")
      .eq("id", id)
      .single()

    if (fetchError || !existingReport) {
      return NextResponse.json({ error: fetchError?.message || "Report not found" }, { status: 404 })
    }

    const { error: notificationsError } = await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("reference_type", "weekly_internet_report")
      .eq("reference_id", id)

    if (notificationsError) {
      console.warn("[weekly-reports] Failed to delete linked notifications:", notificationsError)
    }

    const { error } = await supabaseAdmin
      .from("weekly_internet_reports")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: existingReport.submitted_by,
      title: "Weekly Report Removed",
      message: `Your weekly internet services report for week ${existingReport.week_number}/${existingReport.year} was removed by admin.`,
      type: "warning",
      category: "weekly_report",
      is_read: false,
      read_at: null,
      reference_type: "weekly_internet_report",
      reference_id: id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[weekly-reports] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete report" }, { status: 500 })
  }
}

// Helper: get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// Helper: given week start (Monday), return Friday date string
function getWeekEndDate(weekStart: Date): string {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 4) // Monday + 4 = Friday
  return end.toISOString().split("T")[0]
}
