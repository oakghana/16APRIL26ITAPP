import { type NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"

// Use service role key to bypass RLS
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getServerSupabase()
    const { searchParams } = new URL(request.url)
    const location = searchParams.get("location") || ""
    const canSeeAll = searchParams.get("canSeeAll") === "true"
    const userId = searchParams.get("userId") || ""
    const userRole = searchParams.get("userRole") || ""

    console.log("[v0] API Badge Counts - location:", location, "canSeeAll:", canSeeAll, "role:", userRole)

    const counts: Record<string, number> = {
      serviceDeskTickets: 0,
      repairs: 0,
      devices: 0,
      storeRequisitions: 0,
      stockAllocations: 0,
      lowStockItems: 0,
      serviceProviders: 0,
      itStaffStatus: 0,
      pendingUserApprovals: 0,
      assignedTasks: 0,
      readyForPickup: 0,
      notifications: 0,
      userAccounts: 0,
      updates: 0,
      itEquipmentRequisitions: 0,
      devicesUnderRepair: 0,
    }

    // 1. Service Desk Tickets (open status)
    try {
      const { data, error } = await supabaseAdmin.from("service_tickets").select("id, status, location")

      if (error) {
        console.error("[v0] Error fetching service tickets:", error.message || error)
      } else if (data) {
        const filtered = data.filter((t) => matchesStatus(t.status, ["open", "new", "in_triage"]))
        counts.serviceDeskTickets = filterByLocation(filtered, location, canSeeAll).length
      }
    } catch (e: any) {
      console.error("[v0] Exception fetching service tickets:", e?.message || e)
    }

    // 2. Repairs (pending + in_progress)
    try {
      const { data, error } = await supabaseAdmin.from("repair_requests").select("id, status, requester_location")

      if (error) {
        console.error("[v0] Error fetching repairs:", error.message || error)
      } else if (data) {
        const filtered = data.filter((r) => matchesStatus(r.status, ["pending", "in_progress", "in_repair"]))
        counts.repairs = filterByLocation(filtered, location, canSeeAll, "requester_location").length
      }
    } catch (e: any) {
      console.error("[v0] Exception fetching repairs:", e?.message || e)
    }

    // 3. Devices (count all or active)
    try {
      const { count, error } = await supabaseAdmin
        .from("devices")
        .select("id", { count: "exact", head: true })

      if (error) {
        console.error("[v0] Error fetching devices:", error.message || error)
      } else {
        // Count all devices from database directly (matches system-overview)
        // This provides the most accurate count
        counts.devices = count || 0
        console.log("[v0] Total devices count:", counts.devices)
      }
    } catch (e: any) {
      console.error("[v0] Exception fetching devices:", e?.message || e)
    }

    // 4. Store Requisitions (pending approval)
    try {
      const { data, error } = await supabaseAdmin.from("store_requisitions").select("id, status, location, requires_approval")

      if (!error && data) {
        // Count requisitions pending approval (status = "pending" and requires_approval = true)
        const filtered = data.filter(
          (r) => matchesStatus(r.status, ["pending", "submitted", "pending_approval"]) && r.requires_approval === true
        )
        counts.storeRequisitions = filterByLocation(filtered, location, canSeeAll).length
      }
    } catch (e) {
      console.error("[v0] Error fetching store requisitions:", e)
    }

    // 5. Stock Allocations (allocated/in_transit)
    try {
      const { data, error } = await supabaseAdmin.from("stock_allocations").select("id, status")

      if (!error && data) {
        const filtered = data.filter((a) => matchesStatus(a.status, ["allocated", "in_transit"]))
        // Don't filter by location since table doesn't have location column
        counts.stockAllocations = filtered.length
      }
    } catch (e) {
      console.error("[v0] Error fetching allocations:", e)
    }

    // 6. Low Stock Items
    try {
      const { data, error } = await supabaseAdmin.from("store_items").select("id, quantity, reorder_level, location")

      if (!error && data) {
        const lowStock = data.filter((item) => (item.quantity || 0) <= (item.reorder_level || 0))
        counts.lowStockItems = filterByLocation(lowStock, location, canSeeAll).length
      }
    } catch (e) {
      console.error("[v0] Error fetching low stock:", e)
    }

    // 7. Service Providers (active)
    try {
      const { count, error } = await supabaseAdmin
        .from("service_providers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)

      if (!error) counts.serviceProviders = count || 0
    } catch (e) {
      console.error("[v0] Error fetching providers:", e)
    }

    // 8. IT Staff Status
    try {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, role, location")
        .in("role", ["it_staff", "regional_it_head", "it_head", "admin"])

      if (!error && data) {
        counts.itStaffStatus = filterByLocation(data, location, canSeeAll).length
      }
    } catch (e) {
      console.error("[v0] Error fetching IT staff:", e)
    }

    // 9. Pending User Approvals
    try {
      const { count, error } = await supabaseAdmin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")

      if (!error) counts.pendingUserApprovals = count || 0
    } catch (e) {
      console.error("[v0] Error fetching pending approvals:", e)
    }

    // 10. Assigned Tasks (in_progress tickets)
    try {
      const { data, error } = await supabaseAdmin.from("service_tickets").select("id, status, location")

      if (!error && data) {
        const filtered = data.filter((t) => matchesStatus(t.status, ["in_progress"]))
        counts.assignedTasks = filterByLocation(filtered, location, canSeeAll).length
      }
    } catch (e) {
      console.error("[v0] Error fetching assigned tasks:", e)
    }

    // 11. Ready for Pickup
    try {
      const { data, error } = await supabaseAdmin.from("repair_requests").select("id, status, requester_location")

      if (!error && data) {
        const filtered = data.filter((r) => matchesStatus(r.status, ["ready_for_pickup", "completed"]))
        counts.readyForPickup = filterByLocation(filtered, location, canSeeAll, "requester_location").length
      }
    } catch (e) {
      console.error("[v0] Error fetching ready for pickup:", e)
    }

    // 12. Notifications (unread for user)
    if (userId) {
      try {
        const { count, error } = await supabaseAdmin
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_read", false)

        if (!error) counts.notifications = count || 0
      } catch (e) {
        console.error("[v0] Error fetching notifications:", e)
      }
    }

    // 13. User Accounts (total)
    try {
      const { data, error } = await supabaseAdmin.from("profiles").select("id, location")

      if (!error && data) {
        counts.userAccounts = filterByLocation(data, location, canSeeAll).length
      }
    } catch (e) {
      console.error("[v0] Error fetching user accounts:", e)
    }

    // 14. IT Equipment Requisitions (pending approval)
    try {
      const { data, error } = await supabaseAdmin.from("it_equipment_requisitions").select("id, status")

      if (!error && data) {
        const pending = data.filter((r) => matchesStatus(r.status, ["pending", "draft", "pending_approval"]))
        counts.itEquipmentRequisitions = pending.length
      }
    } catch (e) {
      console.error("[v0] Error fetching IT equipment requisitions:", e)
    }

    // 15. Devices Under Repair
    try {
      const { data, error } = await supabaseAdmin.from("devices").select("id, status, location")

      if (!error && data) {
        const underRepair = data.filter((d) => d.status === "repair")
        counts.devicesUnderRepair = filterByLocation(underRepair, location, canSeeAll).length
      }
    } catch (e) {
      console.error("[v0] Error fetching devices under repair:", e)
    }

    console.log("[v0] Badge counts result:", counts)

    return NextResponse.json(counts)
  } catch (error) {
    console.error("[v0] API Badge Counts error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Helper to filter data by location
function filterByLocation(data: any[], location: string, canSeeAll: boolean, field = "location"): any[] {
  if (canSeeAll || !location) return data
  const loc = location.toLowerCase()
  return data.filter((item: any) => {
    const itemLoc = (item[field] || "").toLowerCase()
    return itemLoc.includes(loc) || loc.includes(itemLoc)
  })
}

// Helper to check if status matches any in list (case-insensitive)
function matchesStatus(itemStatus: string | null | undefined, statusList: string[]): boolean {
  if (!itemStatus) return false
  const normalized = itemStatus.toLowerCase()
  return statusList.some((s) => s.toLowerCase() === normalized)
}
