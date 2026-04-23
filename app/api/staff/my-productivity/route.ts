import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

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
      .select("id, full_name, name, email, location, role")
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

    const { data: ticketTasks } = await supabase
      .from("service_tickets")
      .select("id, status, priority, created_at, updated_at, completed_at, resolved_at")
      .or(`assigned_to.eq.${staffId},assigned_to_name.ilike.%${staffName}%`)

    const tasks = [...(repairTasks || []), ...(ticketTasks || [])]
    const totalTasksAssigned = tasks.length

    // Filter completed tasks (cover all completion statuses)
    const completedStatuses = ["completed", "closed", "resolved", "repaired", "awaiting_confirmation"]
    const completedTasks = tasks.filter((task) => completedStatuses.includes((task.status || "").toLowerCase()))
    const completedCount = completedTasks.length

    // Calculate completion rate
    const completionRate = totalTasksAssigned > 0 ? Math.round((completedCount / totalTasksAssigned) * 100) : 0

    // Calculate on-time completions and average completion time
    let onTimeCompletions = 0
    let totalCompletionDays = 0

    completedTasks.forEach((task: any) => {
      if (!task.created_at) return

      const createdDate = new Date(task.created_at)
      const completedDate = new Date(task.completed_at || task.resolved_at || task.updated_at)
      const daysToComplete = Math.floor((completedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
      
      totalCompletionDays += daysToComplete

      // Determine expected completion time based on priority
      let expectedDays = 10 // Low priority
      if (task.priority === "critical") expectedDays = 1
      else if (task.priority === "high") expectedDays = 3
      else if (task.priority === "medium") expectedDays = 5

      if (daysToComplete <= expectedDays) {
        onTimeCompletions++
      }
    })

    const averageCompletionDays = completedTasks.length > 0 
      ? parseFloat((totalCompletionDays / completedTasks.length).toFixed(1)) 
      : 0
    
    const onTimeRate = completedTasks.length > 0 
      ? Math.round((onTimeCompletions / completedTasks.length) * 100) 
      : 0

    // Calculate speed bonus
    let speedBonus = 0
    if (averageCompletionDays > 0 && averageCompletionDays <= 3) speedBonus = 20
    else if (averageCompletionDays <= 5) speedBonus = 10
    else if (averageCompletionDays <= 7) speedBonus = 5

    // Calculate volume bonus
    const volumeBonus = Math.min(30, completedTasks.length * 0.5)
    
    // Calculate productivity score with volume weighting
    const baseScore = completionRate * 0.4 + onTimeRate * 0.25 + speedBonus * 0.75
    const productivityScore = Math.round(baseScore + volumeBonus)

    // Determine grading
    let grading: "Excellent" | "Good" | "Average" | "Below Average" | "Poor"
    if (productivityScore >= 90) grading = "Excellent"
    else if (productivityScore >= 75) grading = "Good"
    else if (productivityScore >= 55) grading = "Average"
    else if (productivityScore >= 35) grading = "Below Average"
    else grading = "Poor"

    // Get total IT staff count
    const { data: allStaff } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["it_staff", "it_head", "regional_it_head"])

    const totalStaff = allStaff?.length || 0

    // Remove duplicate profile fetch — use already-fetched staff data
    const rank = null

    const metrics = {
      staffId: staff.id,
      staffName: staff.full_name || staff.name,
      email: staff.email,
      location: staff.location,
      role: staff.role,
      totalTasksAssigned,
      completedTasks: completedCount,
      onTimeCompletions,
      averageCompletionDays,
      completionRate,
      onTimeRate,
      productivityScore,
      speedBonus,
      volumeBonus,
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
