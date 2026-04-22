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
  rank: number
  grading: "Excellent" | "Good" | "Average" | "Below Average" | "Poor"
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const location = searchParams.get("location")

    console.log("[v0] Fetching productivity metrics for date range:", startDate, "to", endDate)

    // Fetch all IT staff members
    let staffQuery = supabaseAdmin
      .from("profiles")
      .select("*")
      .in("role", ["it_staff", "it_head", "regional_it_head"])
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
      const memberName = (member.full_name || member.email || "").toLowerCase().trim()

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

      const repairTasks = repairs || []
      const ticketTasks = tickets || []
      const allTasks = [...repairTasks, ...ticketTasks]
      const totalTasks = allTasks.length
      const totalRepairTasks = repairTasks.length
      const totalTicketTasks = ticketTasks.length

      // Calculate completed tasks
      const completedStatuses = ["completed", "closed", "resolved", "repaired"]
      const cutoff = new Date(Date.now() - 30 * 60 * 1000)
      const isCompleted = (t: any) => {
        const status = (t.status || "").toLowerCase()
        if (completedStatuses.includes(status)) return true
        if (status === "awaiting_confirmation" && t.completed_at) {
          return new Date(t.completed_at) <= cutoff
        }
        return false
      }

      const completedRepairs = repairTasks.filter(isCompleted)
      const completedTickets = ticketTasks.filter(isCompleted)
      const completedTasks = [...completedRepairs, ...completedTickets]

      // Calculate completion times and on-time metrics
      let totalCompletionDays = 0
      let onTimeCompletions = 0

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
      const overallCompletionRate = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0

      // Blend rates so no task type is ignored and high assigned load is still reflected
      const completionRate = typeWeightedCompletionRate * 0.65 + overallCompletionRate * 0.35

      const onTimeRate = completedTasks.length > 0 ? (onTimeCompletions / completedTasks.length) * 100 : 0
      const averageCompletionDays = completedTasks.length > 0 ? totalCompletionDays / completedTasks.length : 0

      // Speed bonus
      let speedBonus = 0
      if (averageCompletionDays > 0 && averageCompletionDays <= 3) speedBonus = 20
      else if (averageCompletionDays <= 5) speedBonus = 10
      else if (averageCompletionDays <= 7) speedBonus = 5

      // Volume Score (0-100) — based on absolute number of completed tasks
      // Normalize to a 0-100 scale where 50+ completed tasks = 100
      // This ensures staff with more work output rank higher
      const volumeScore = Math.min(100, (completedTasks.length / 50) * 100)

      // Final score calculation with revised weightings:
      // 65% - Task Volume (actual number of tasks completed) — PRIMARY METRIC
      // 20% - On-Time Completion Rate (deadline adherence)
      // 10% - Speed Bonus (faster completions)
      // 5% - Completion Rate percentage (secondary metric)
      const productivityScore = Math.round(
        volumeScore * 0.65 + onTimeRate * 0.20 + speedBonus * 0.10 + completionRate * 0.05
      )

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
        totalTasksAssigned: totalTasks,
        totalRepairTasks,
        totalTicketTasks,
        completedTasks: completedTasks.length,
        completedRepairTasks: completedRepairs.length,
        completedTicketTasks: completedTickets.length,
        onTimeCompletions,
        averageCompletionDays: Math.round(averageCompletionDays * 10) / 10,
        completionRate: Math.round(completionRate * 10) / 10,
        onTimeRate: Math.round(onTimeRate * 10) / 10,
        productivityScore,
        speedBonus,
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
