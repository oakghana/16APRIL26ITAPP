import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

interface ProductivityMetrics {
  staffId: string
  staffName: string
  email: string
  location: string
  role: string
  totalTasksAssigned: number
  completedTasks: number
  onTimeCompletions: number
  averageCompletionDays: number
  completionRate: number
  onTimeRate: number
  productivityScore: number
  speedBonus: number
  activityBonus: number
  activityActions: number
  storeIssuances: number
  serviceDeskDispatches: number
  officeUseProcesses: number
  ticketVolumeBonus: number
  lastStoreIssuanceAt: string | null
  rank: number
  grading: "Excellent" | "Good" | "Average" | "Below Average" | "Poor"
}

function normalizeText(value: string | null | undefined): string {
  return (value || "").toLowerCase().trim().replace(/\s+/g, " ")
}

function makeIdentitySet(member: any): Set<string> {
  return new Set([
    normalizeText(member?.full_name),
    normalizeText(member?.name),
    normalizeText(member?.email),
    normalizeText(member?.username),
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
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const location = searchParams.get("location")

    console.log("[v0] Fetching productivity metrics for date range:", startDate, "to", endDate)

    // Fetch all IT staff members
    let staffQuery = supabaseAdmin
      .from("profiles")
      .select("*")
      .in("role", ["it_staff", "it_head", "regional_it_head", "it_store_head", "service_desk_head"])
      .eq("status", "approved")
      .eq("is_active", true)

    if (location && location !== "all") {
      staffQuery = staffQuery.eq("location", location)
    }

    const { data: staff, error: staffError } = await staffQuery

    if (staffError) {
      console.error("[v0] Error fetching staff:", staffError)
      return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 })
    }

    // Calculate productivity metrics for each staff member
    const metricsPromises = (staff || []).map(async (member) => {
      const memberName = (member.full_name || member.name || member.email || "").toLowerCase().trim()
      const identity = makeIdentitySet(member)

      // Fetch repair requests assigned to this staff
      let repairQuery = supabaseAdmin
        .from("repair_requests")
        .select("id, status, priority, created_at, updated_at, assigned_date, completed_date")
        .eq("assigned_to", member.id)

      if (startDate) {
        repairQuery = repairQuery.gte("created_at", startDate)
      }
      if (endDate) {
        repairQuery = repairQuery.lte("created_at", endDate)
      }

      const { data: repairs } = await repairQuery

      // Fetch service tickets assigned to this staff — match by UUID or name
      let ticketQuery = supabaseAdmin
        .from("service_tickets")
        .select("id, status, priority, created_at, updated_at, assigned_at, resolved_at, completed_at, assigned_to, assigned_to_name")
        .or(`assigned_to.eq.${member.id},assigned_to_name.ilike.%${memberName}%`)

      if (startDate) {
        ticketQuery = ticketQuery.gte("created_at", startDate)
      }
      if (endDate) {
        ticketQuery = ticketQuery.lte("created_at", endDate)
      }

      const { data: tickets } = await ticketQuery

      // Store issuance actions made by this staff member (direct stock assignments)
      let assignmentQuery = supabaseAdmin
        .from("stock_assignments")
        .select("id, created_at, assigned_by, assigned_by_role")

      if (startDate) {
        assignmentQuery = assignmentQuery.gte("created_at", startDate)
      }
      if (endDate) {
        assignmentQuery = assignmentQuery.lte("created_at", endDate)
      }

      const { data: stockAssignments } = await assignmentQuery

      const myStoreAssignments = (stockAssignments || []).filter((row: any) =>
        matchesIdentity(identity, row.assigned_by)
      )

      // Service desk dispatch actions (assignment of service tickets)
      let dispatchQuery = supabaseAdmin
        .from("service_tickets")
        .select("id, created_at, assigned_at, assigned_by")
        .not("assigned_at", "is", null)

      if (startDate) {
        dispatchQuery = dispatchQuery.gte("created_at", startDate)
      }
      if (endDate) {
        dispatchQuery = dispatchQuery.lte("created_at", endDate)
      }

      const { data: dispatchRows } = await dispatchQuery

      const myDispatches = (dispatchRows || []).filter((row: any) =>
        matchesIdentity(identity, row.assigned_by)
      )

      // Office-use processing actions across IT forms
      const [itReqRes, gadgetRes, maintenanceRes] = await Promise.all([
        supabaseAdmin
          .from("it_equipment_requisitions")
          .select("id, created_at, service_desk_processed_at, service_desk_processed_by")
          .not("service_desk_processed_at", "is", null),
        supabaseAdmin
          .from("new_gadget_requests")
          .select("id, created_at, confirmed_date, confirmed_by"),
        supabaseAdmin
          .from("maintenance_repair_requests")
          .select("id, created_at, confirmed_date, confirmed_by"),
      ])

      const filteredItReq = (itReqRes.data || []).filter((row: any) => {
        const created = new Date(row.created_at)
        if (startDate && created < new Date(startDate)) return false
        if (endDate && created > new Date(endDate)) return false
        return matchesIdentity(identity, row.service_desk_processed_by)
      })

      const filteredGadget = (gadgetRes.data || []).filter((row: any) => {
        const created = new Date(row.created_at)
        if (startDate && created < new Date(startDate)) return false
        if (endDate && created > new Date(endDate)) return false
        return !!row.confirmed_date && matchesIdentity(identity, row.confirmed_by)
      })

      const filteredMaintenance = (maintenanceRes.data || []).filter((row: any) => {
        const created = new Date(row.created_at)
        if (startDate && created < new Date(startDate)) return false
        if (endDate && created > new Date(endDate)) return false
        return !!row.confirmed_date && matchesIdentity(identity, row.confirmed_by)
      })

      const officeUseActions = [...filteredItReq, ...filteredGadget, ...filteredMaintenance]

      const repairTasks = repairs || []
      const ticketTasks = tickets || []
      const allTasks = [...repairTasks, ...ticketTasks]
      const totalTasks = allTasks.length
      const totalRepairTasks = repairTasks.length
      const totalTicketTasks = ticketTasks.length

      // Calculate completed tasks
      const completedStatuses = ["completed", "closed", "resolved", "repaired"]
      const isCompleted = (t: any) => {
        const status = (t.status || "").toLowerCase()
        if (completedStatuses.includes(status)) return true
        return false
      }

      const completedRepairs = repairTasks.filter(isCompleted)
      const completedTickets = ticketTasks.filter(isCompleted)
      const completedTasks = [...completedRepairs, ...completedTickets]

      const storeIssuances = myStoreAssignments.length
      const serviceDeskDispatches = myDispatches.length
      const officeUseProcesses = officeUseActions.length
      const activityActions = storeIssuances + serviceDeskDispatches + officeUseProcesses

      // Calculate completion times and on-time metrics
      let totalCompletionDays = 0
      let onTimeCompletions = 0
      let activityTotalDays = 0
      let activityOnTimeCompletions = 0

      completedTasks.forEach((task) => {
        const start = new Date(task.created_at)
        const end = new Date(task.completed_at || task.resolved_at || task.updated_at)
        const completionDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
        totalCompletionDays += completionDays

        const priority = task.priority?.toLowerCase() || "medium"
        let expectedDays = 7
        if (priority === "critical" || priority === "urgent") expectedDays = 1
        else if (priority === "high") expectedDays = 3
        else if (priority === "medium") expectedDays = 5
        else if (priority === "low") expectedDays = 10

        if (completionDays <= expectedDays) onTimeCompletions++
      })

      // Service ticket dispatch timeliness: expected within 1 day from ticket creation
      myDispatches.forEach((dispatch: any) => {
        if (!dispatch.created_at || !dispatch.assigned_at) return
        const created = new Date(dispatch.created_at)
        const assigned = new Date(dispatch.assigned_at)
        const lagDays = Math.max(0, (assigned.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        activityTotalDays += lagDays
        if (lagDays <= 1) activityOnTimeCompletions++
      })

      // Office-use processing timeliness: expected within 2 days from request creation
      const toDate = (value: string | null | undefined) => (value ? new Date(value) : null)
      filteredItReq.forEach((row: any) => {
        if (!row.created_at || !row.service_desk_processed_at) return
        const created = new Date(row.created_at)
        const processed = new Date(row.service_desk_processed_at)
        const lagDays = Math.max(0, (processed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        activityTotalDays += lagDays
        if (lagDays <= 2) activityOnTimeCompletions++
      })

      ;[...filteredGadget, ...filteredMaintenance].forEach((row: any) => {
        const created = toDate(row.created_at)
        const confirmed = toDate(row.confirmed_date)
        if (!created || !confirmed) return
        const lagDays = Math.max(0, (confirmed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        activityTotalDays += lagDays
        if (lagDays <= 2) activityOnTimeCompletions++
      })

      // --- Scoring formula ---
      // Separate completion rates for repairs vs tickets
      const repairCompletionRate = totalRepairTasks > 0 ? (completedRepairs.length / totalRepairTasks) * 100 : 0
      const ticketCompletionRate = totalTicketTasks > 0 ? (completedTickets.length / totalTicketTasks) * 100 : 0

      // Weighted completion rate: repairs 50%, service tickets 50%
      const hasRepairs = totalRepairTasks > 0
      const hasTickets = totalTicketTasks > 0
      let typeWeightedCompletionRate: number
      if (hasRepairs && hasTickets) {
        typeWeightedCompletionRate = repairCompletionRate * 0.5 + ticketCompletionRate * 0.5
      } else if (hasTickets) {
        typeWeightedCompletionRate = ticketCompletionRate
      } else {
        typeWeightedCompletionRate = repairCompletionRate
      }

      // Overall completion rate against total assigned tasks (fair for heavy workload)
      const effectiveAssignedUnits = totalTasks + activityActions
      const effectiveCompletedUnits = completedTasks.length + activityActions

      const overallCompletionRate = effectiveAssignedUnits > 0
        ? (effectiveCompletedUnits / effectiveAssignedUnits) * 100
        : 0

      // Blend rates so no task type is ignored and high assigned load is still reflected
      const completionRate = typeWeightedCompletionRate * 0.65 + overallCompletionRate * 0.35

      const totalOnTimeCompletions = onTimeCompletions + activityOnTimeCompletions
      const totalCompletedUnits = completedTasks.length + activityActions
      const onTimeRate = totalCompletedUnits > 0 ? (totalOnTimeCompletions / totalCompletedUnits) * 100 : 0

      const allCompletionDays = totalCompletionDays + activityTotalDays
      const averageCompletionDays = totalCompletedUnits > 0 ? allCompletionDays / totalCompletedUnits : 0

      // Speed bonus
      let speedBonus = 0
      if (averageCompletionDays > 0 && averageCompletionDays <= 3) speedBonus = 20
      else if (averageCompletionDays <= 5) speedBonus = 10
      else if (averageCompletionDays <= 7) speedBonus = 5

      // Workload bonus (up to 35 points) — higher ceiling so high-volume resolvers are differentiated
      const workloadBonus = Math.min(35, Math.sqrt(totalCompletedUnits) * 3)

      // Activity bonus rewards actual in-app operational work for heads.
      // Store issuances get higher weight (1.5) since that is the store head's primary work.
      const activityBonus = Math.min(
        30,
        storeIssuances * 1.5 + serviceDeskDispatches * 1.0 + officeUseProcesses * 1.0,
      )

      // Ticket volume bonus: every IT ticket assigned earns points, even if still open.
      // Rewards staff who handle a high volume of service requests.
      const ticketVolumeBonus = Math.min(20, totalTicketTasks * 0.4)

      // Final score: completion + on-time + speed + workload throughput + activity + ticket volume
      const productivityScore = Math.round(
        completionRate * 0.4 + onTimeRate * 0.22 + speedBonus * 0.65 + workloadBonus + activityBonus + ticketVolumeBonus
      )

      const sortedIssuances = [...myStoreAssignments]
        .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      const lastStoreIssuanceAt = sortedIssuances[0]?.created_at || null

      let grading: "Excellent" | "Good" | "Average" | "Below Average" | "Poor"
      if (productivityScore >= 90) grading = "Excellent"
      else if (productivityScore >= 75) grading = "Good"
      else if (productivityScore >= 55) grading = "Average"
      else if (productivityScore >= 35) grading = "Below Average"
      else grading = "Poor"

      return {
        staffId: member.id,
        staffName: member.full_name || member.email,
        email: member.email,
        location: member.location || "Unknown",
        role: member.role,
        totalTasksAssigned: effectiveAssignedUnits,
        totalRepairTasks,
        totalTicketTasks,
        completedTasks: effectiveCompletedUnits,
        completedRepairTasks: completedRepairs.length,
        completedTicketTasks: completedTickets.length,
        onTimeCompletions: totalOnTimeCompletions,
        averageCompletionDays: Math.round(averageCompletionDays * 10) / 10,
        completionRate: Math.round(completionRate * 10) / 10,
        onTimeRate: Math.round(onTimeRate * 10) / 10,
        productivityScore,
        speedBonus,
        activityBonus: Math.round(activityBonus * 10) / 10,
        activityActions,
        storeIssuances,
        serviceDeskDispatches,
        officeUseProcesses,
        lastStoreIssuanceAt,
        ticketVolumeBonus: Math.round(ticketVolumeBonus * 10) / 10,
        rank: 0,
        grading,
      } as ProductivityMetrics
    })

    const metrics = await Promise.all(metricsPromises)

    // Sort by productivity score and assign ranks
    const rankedMetrics = metrics
      .sort((a, b) => b.productivityScore - a.productivityScore)
      .map((m, index) => ({
        ...m,
        rank: index + 1,
      }))

    console.log("[v0] Calculated productivity metrics for", rankedMetrics.length, "staff members")

    return NextResponse.json({
      success: true,
      metrics: rankedMetrics,
      summary: {
        totalStaff: rankedMetrics.length,
        avgProductivityScore:
          rankedMetrics.reduce((sum, m) => sum + m.productivityScore, 0) / rankedMetrics.length || 0,
        totalTasksAssigned: rankedMetrics.reduce((sum, m) => sum + m.totalTasksAssigned, 0),
        totalCompletedTasks: rankedMetrics.reduce((sum, m) => sum + m.completedTasks, 0),
        avgCompletionRate:
          rankedMetrics.reduce((sum, m) => sum + m.completionRate, 0) / rankedMetrics.length || 0,
        avgOnTimeRate: rankedMetrics.reduce((sum, m) => sum + m.onTimeRate, 0) / rankedMetrics.length || 0,
      },
    })
  } catch (error: any) {
    console.error("[v0] Error calculating productivity metrics:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
