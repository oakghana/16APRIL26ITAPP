import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

function normalizeText(value: string | null | undefined): string {
  return (value || "").toLowerCase().trim().replace(/\s+/g, " ")
}

function makeIdentitySet(staff: any): Set<string> {
  return new Set([
    normalizeText(staff?.full_name),
    normalizeText(staff?.name),
    normalizeText(staff?.email),
    normalizeText(staff?.username),
  ].filter(Boolean))
}

function matchesIdentity(identity: Set<string>, raw: string | null | undefined): boolean {
  const value = normalizeText(raw)
  if (!value) return false
  if (identity.has(value)) return true
  for (const key of identity) {
    if (!key) continue
    if (value.includes(key) || key.includes(value)) return true
  }
  return false
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const staffId = searchParams.get("staffId")

    if (!staffId) {
      return NextResponse.json({ error: "Staff ID is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get staff details
    const { data: staff, error: staffError } = await supabase
      .from("profiles")
      .select("id, full_name, name, email, username, location, role")
      .eq("id", staffId)
      .single()

    if (staffError || !staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 })
    }

    // Get all repair tasks assigned to this staff member
    const { data: repairTasks, error: tasksError } = await supabase
      .from("repair_requests")
      .select("id, status, priority, created_at, updated_at")
      .eq("assigned_to", staffId)

    if (tasksError) {
      console.error("[v0] Error fetching repair tasks:", tasksError)
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
    }

    // Get service tickets assigned to this staff (by id or name)
    const staffName = (staff.name || staff.full_name || staff.email || "").toLowerCase().trim()
    const identity = makeIdentitySet(staff)

    const { data: ticketTasks } = await supabase
      .from("service_tickets")
      .select("id, status, priority, created_at, updated_at, completed_at, resolved_at")
      .or(`assigned_to.eq.${staffId},assigned_to_name.ilike.%${staffName}%`)

    const { data: passwordResetTasks } = await supabase
      .from("password_reset_requests")
      .select("id, status, urgency, created_at, updated_at, assigned_at, submitted_for_confirmation_at, user_confirmed_at, closed_at, assigned_to, assigned_to_id")
      .or(`assigned_to_id.eq.${staffId},assigned_to.ilike.%${staffName}%`)

    // Store issuance actions (stock assignments made by this staff)
    const { data: stockAssignments } = await supabase
      .from("stock_assignments")
      .select("id, created_at, assigned_by")

    const myStoreAssignments = (stockAssignments || []).filter((row: any) =>
      matchesIdentity(identity, row.assigned_by)
    )

    // Service desk dispatch actions (ticket assignment actions)
    const { data: dispatchRows } = await supabase
      .from("service_tickets")
      .select("id, created_at, assigned_at, assigned_by")
      .not("assigned_at", "is", null)

    const myDispatches = (dispatchRows || []).filter((row: any) =>
      matchesIdentity(identity, row.assigned_by)
    )

    // Office-use processing actions across IT forms
    const [itReqRes, gadgetRes, maintenanceRes] = await Promise.all([
      supabase
        .from("it_equipment_requisitions")
        .select("id, created_at, service_desk_processed_at, service_desk_processed_by")
        .not("service_desk_processed_at", "is", null),
      supabase
        .from("new_gadget_requests")
        .select("id, created_at, confirmed_date, confirmed_by"),
      supabase
        .from("maintenance_repair_requests")
        .select("id, created_at, confirmed_date, confirmed_by"),
    ])

    const processedRequisitions = (itReqRes.data || []).filter((row: any) =>
      matchesIdentity(identity, row.service_desk_processed_by)
    )
    const processedGadget = (gadgetRes.data || []).filter((row: any) =>
      !!row.confirmed_date && matchesIdentity(identity, row.confirmed_by)
    )
    const processedMaintenance = (maintenanceRes.data || []).filter((row: any) =>
      !!row.confirmed_date && matchesIdentity(identity, row.confirmed_by)
    )

    const officeUseActions = [...processedRequisitions, ...processedGadget, ...processedMaintenance]

    const tasks = [...(repairTasks || []), ...(ticketTasks || []), ...(passwordResetTasks || [])]
    const totalTasksAssigned = tasks.length

    // Filter completed tasks (cover all completion statuses)
    const completedStatuses = ["completed", "closed", "resolved", "repaired", "awaiting_confirmation"]
    const completedTasks = tasks.filter((task) => completedStatuses.includes((task.status || "").toLowerCase()))
    const completedCount = completedTasks.length

    const storeIssuances = myStoreAssignments.length
    const serviceDeskDispatches = myDispatches.length
    const officeUseProcesses = officeUseActions.length
    const activityActions = storeIssuances + serviceDeskDispatches + officeUseProcesses

    const effectiveAssignedUnits = totalTasksAssigned + activityActions
    const effectiveCompletedUnits = completedCount + activityActions

    // Calculate completion rate
    const completionRate = effectiveAssignedUnits > 0
      ? Math.round((effectiveCompletedUnits / effectiveAssignedUnits) * 100)
      : 0

    // Calculate on-time completions and average completion time
    let onTimeCompletions = 0
    let totalCompletionDays = 0
    let activityOnTimeCompletions = 0
    let activityTotalDays = 0

    completedTasks.forEach((task: any) => {
      if (!task.created_at) return

      const createdDate = new Date(task.created_at)
      const completedDate = new Date(task.completed_at || task.resolved_at || task.user_confirmed_at || task.closed_at || task.submitted_for_confirmation_at || task.updated_at)
      const daysToComplete = Math.floor((completedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
      
      totalCompletionDays += daysToComplete

      // Determine expected completion time based on priority
      let expectedDays = 10 // Low priority
      const normalizedPriority = (task.priority || task.urgency || "").toLowerCase()
      if (normalizedPriority === "critical") expectedDays = 1
      else if (normalizedPriority === "high") expectedDays = 3
      else if (normalizedPriority === "medium") expectedDays = 5

      if (daysToComplete <= expectedDays) {
        onTimeCompletions++
      }
    })

    // Ticket dispatch lag: expected <= 1 day
    myDispatches.forEach((dispatch: any) => {
      if (!dispatch.created_at || !dispatch.assigned_at) return
      const createdDate = new Date(dispatch.created_at)
      const assignedDate = new Date(dispatch.assigned_at)
      const lagDays = Math.max(0, (assignedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
      activityTotalDays += lagDays
      if (lagDays <= 1) activityOnTimeCompletions++
    })

    // Office-use processing lag: expected <= 2 days
    const toDate = (value: string | null | undefined) => (value ? new Date(value) : null)

    processedRequisitions.forEach((row: any) => {
      if (!row.created_at || !row.service_desk_processed_at) return
      const createdDate = new Date(row.created_at)
      const processedDate = new Date(row.service_desk_processed_at)
      const lagDays = Math.max(0, (processedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
      activityTotalDays += lagDays
      if (lagDays <= 2) activityOnTimeCompletions++
    })

    ;[...processedGadget, ...processedMaintenance].forEach((row: any) => {
      const createdDate = toDate(row.created_at)
      const confirmedDate = toDate(row.confirmed_date)
      if (!createdDate || !confirmedDate) return
      const lagDays = Math.max(0, (confirmedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
      activityTotalDays += lagDays
      if (lagDays <= 2) activityOnTimeCompletions++
    })

    const totalCompletedUnits = completedCount + activityActions
    const totalOnTimeCompletions = onTimeCompletions + activityOnTimeCompletions

    const averageCompletionDays = totalCompletedUnits > 0 
      ? parseFloat(((totalCompletionDays + activityTotalDays) / totalCompletedUnits).toFixed(1)) 
      : 0
    
    const onTimeRate = totalCompletedUnits > 0 
      ? Math.round((totalOnTimeCompletions / totalCompletedUnits) * 100) 
      : 0

    // Calculate speed bonus
    let speedBonus = 0
    if (averageCompletionDays > 0 && averageCompletionDays <= 3) speedBonus = 20
    else if (averageCompletionDays <= 5) speedBonus = 10
    else if (averageCompletionDays <= 7) speedBonus = 5

    // Calculate volume bonus
    const volumeBonus = Math.min(30, totalCompletedUnits * 0.5)

    // Activity bonus rewards real operational work captured in app flows.
    // Store issuances get higher weight (1.5) since that is the store head's primary work.
    const activityBonus = Math.min(
      30,
      storeIssuances * 1.5 + serviceDeskDispatches * 1.0 + officeUseProcesses * 1.0,
    )

    // Ticket volume bonus: every IT ticket assigned counts, even if still open.
    // Rewards staff who handle a high volume of requests.
    const totalTicketCount = (ticketTasks || []).length
    const ticketVolumeBonus = Math.min(20, totalTicketCount * 0.4)

    // Calculate productivity score with volume weighting
    const baseScore = completionRate * 0.4 + onTimeRate * 0.25 + speedBonus * 0.75
    const productivityScore = Math.round(baseScore + volumeBonus + activityBonus + ticketVolumeBonus)

    // Determine grading
    let grading: "Excellent" | "Good" | "Average" | "Below Average" | "Poor"
    if (productivityScore >= 90) grading = "Excellent"
    else if (productivityScore >= 75) grading = "Good"
    else if (productivityScore >= 55) grading = "Average"
    else if (productivityScore >= 35) grading = "Below Average"
    else grading = "Poor"

    // Get total IT staff count — include all roles measured by the productivity engine
    const { data: allStaff } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["it_staff", "it_head", "regional_it_head", "it_store_head", "service_desk_head"])

    const totalStaff = allStaff?.length || 0

    // Remove duplicate profile fetch — use already-fetched staff data
    const rank = null

    const metrics = {
      staffId: staff.id,
      staffName: staff.full_name || staff.name,
      email: staff.email,
      location: staff.location,
      role: staff.role,
      totalTasksAssigned: effectiveAssignedUnits,
      completedTasks: effectiveCompletedUnits,
      onTimeCompletions: totalOnTimeCompletions,
      averageCompletionDays,
      completionRate,
      onTimeRate,
      productivityScore,
      speedBonus,
      volumeBonus,
      activityBonus: Math.round(activityBonus * 10) / 10,
      ticketVolumeBonus: Math.round(ticketVolumeBonus * 10) / 10,
      activityActions,
      storeIssuances,
      serviceDeskDispatches,
      officeUseProcesses,
      totalTicketCount,
      totalPasswordResetCount: (passwordResetTasks || []).length,
      grading,
      rank,
      totalStaff,
    }

    return NextResponse.json({ success: true, metrics })
  } catch (error: any) {
    console.error("[v0] Error calculating productivity metrics:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
