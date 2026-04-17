import { type NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"

// Use service role key to bypass RLS
export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabase()
    const searchParams = request.nextUrl.searchParams
    const location = searchParams.get("location")
    const canSeeAll = searchParams.get("canSeeAll") === "true"
    const userId = searchParams.get("userId")
    const userRole = searchParams.get("userRole")

    console.log("[v0] Dashboard stats API - location:", location, "canSeeAll:", canSeeAll, "role:", userRole)

    // Helper function to filter repairs by location
    const applyRepairLocationFilter = (query: any) => {
      if (!canSeeAll && location) {
        // Repairs use requester_location field
        return query.ilike("requester_location", `%${location}%`)
      }
      return query
    }

    // Helper function to filter devices by location
    const applyDeviceLocationFilter = (query: any) => {
      if (!canSeeAll && location) {
        return query.ilike("location", `%${location}%`)
      }
      return query
    }

    // Fetch total devices
    let devicesQuery = supabase
      .from("devices")
      .select("*", { count: "exact", head: true })
    
    devicesQuery = applyDeviceLocationFilter(devicesQuery)
    
    const { count: devicesCount, error: devicesError } = await devicesQuery
    if (devicesError) console.error("[v0] Error fetching devices:", devicesError)

    // Fetch active repairs (in_progress status)
    let repairsQuery = supabase
      .from("repair_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "in_progress")
    
    repairsQuery = applyRepairLocationFilter(repairsQuery)
    
    const { count: activeRepairsCount, error: repairsError } = await repairsQuery
    if (repairsError) console.error("[v0] Error fetching repairs:", repairsError.message || repairsError)

    // Fetch completed repairs this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    let completedQuery = supabase
      .from("repair_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("updated_at", startOfMonth.toISOString())
    
    completedQuery = applyRepairLocationFilter(completedQuery)
    
    const { count: completedRepairsCount, error: completedError } = await completedQuery
    if (completedError) console.error("[v0] Error fetching completed repairs:", completedError.message || completedError)

    // Fetch pending approvals (users with pending status)
    const { count: pendingApprovalsCount, error: pendingError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
    if (pendingError) console.error("[v0] Error fetching pending approvals:", pendingError.message || pendingError)

    // For IT staff - fetch assigned tasks
    let assignedTasksCount = 0
    let inProgressTasksCount = 0
    let completedTasksCount = 0
    let pendingReviewCount = 0

    if (userRole === "it_staff" && userId) {
      const { count: assigned } = await supabase
        .from("repair_requests")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", userId)
        .in("status", ["pending", "in_progress"])
      assignedTasksCount = assigned || 0

      const { count: inProgress } = await supabase
        .from("repair_requests")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", userId)
        .eq("status", "in_progress")
      inProgressTasksCount = inProgress || 0

      const { count: completed } = await supabase
        .from("repair_requests")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", userId)
        .eq("status", "completed")
        .gte("updated_at", startOfMonth.toISOString())
      completedTasksCount = completed || 0

      const { count: review } = await supabase
        .from("repair_requests")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", userId)
        .eq("status", "pending_review")
      pendingReviewCount = review || 0
    }

    const stats = {
      totalDevices: devicesCount || 0,
      activeRepairs: activeRepairsCount || 0,
      completedRepairs: completedRepairsCount || 0,
      pendingApprovals: pendingApprovalsCount || 0,
      assignedTasks: assignedTasksCount,
      inProgressTasks: inProgressTasksCount,
      completedTasks: completedTasksCount,
      pendingReview: pendingReviewCount,
    }

    console.log("[v0] Dashboard stats:", stats)
    return NextResponse.json(stats)
  } catch (error: any) {
    console.error("[v0] Error in dashboard stats API:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
