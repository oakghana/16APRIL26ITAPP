import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isLocationInSameRegion } from "@/lib/location-filter"

// Use service role key to bypass RLS
const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const location = searchParams.get("location") || ""
    const canSeeAll = searchParams.get("canSeeAll") === "true"
    const userId = searchParams.get("userId")
    const userName = searchParams.get("userName") || ""
    const userEmail = searchParams.get("userEmail") || ""
    const userRole = searchParams.get("userRole")
    const normalizedLocation = location.toLowerCase().trim()
    const normalizedUserName = userName.toLowerCase().trim()
    const normalizedUserEmail = userEmail.toLowerCase().trim()

    console.log("[v0] API Service Tickets - location:", location, "canSeeAll:", canSeeAll, "role:", userRole)

    const buildTicketQuery = (selectClause: string) => {
      let query = supabaseAdmin
        .from("service_tickets")
        .select(selectClause)
        .order("created_at", { ascending: false })
        .limit(1000)

      // Apply coarse filters in SQL first to avoid loading the entire table.
      if (userRole === "user" || userRole === "staff") {
        if (userId) {
          query = query.or(`requested_by.eq.${userId},assigned_to.eq.${userId}`)
        }
      } else if ((userRole === "regional_it_head" || userRole === "service_desk_head") && normalizedLocation) {
        if (userId) {
          query = query.or(`location.ilike.%${normalizedLocation}%,assigned_to.eq.${userId}`)
        } else {
          query = query.ilike("location", `%${normalizedLocation}%`)
        }
      } else if (!canSeeAll && normalizedLocation) {
        if (userId) {
          query = query.or(`location.ilike.%${normalizedLocation}%,assigned_to.eq.${userId}`)
        } else {
          query = query.ilike("location", `%${normalizedLocation}%`)
        }
      }

      return query
    }

    const selectVariants = [
      // Newest schema (room number + legacy room)
      "id,ticket_number,title,category,priority,status,location,requested_by,requester_department,requester_room_number,requester_room,created_at,assigned_to,assigned_to_name",
      // Current migration baseline (room number only)
      "id,ticket_number,title,category,priority,status,location,requested_by,requester_department,requester_room_number,created_at,assigned_to,assigned_to_name",
      // Older schema fallback (legacy room only)
      "id,ticket_number,title,category,priority,status,location,requested_by,requester_department,requester_room,created_at,assigned_to,assigned_to_name",
    ]

    let data: any[] | null = null
    let error: any = null

    for (const selectClause of selectVariants) {
      const result = await buildTicketQuery(selectClause)
      data = result.data
      error = result.error

      if (!error) break

      const message = String(error.message || "")
      const missingColumnError =
        error.code === "42703" ||
        /column .* does not exist/i.test(message)

      if (!missingColumnError) break
    }

    if (error) {
      console.error("[v0] Error loading service tickets:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let filteredData = data || []

    // Apply filters based on user role
    if (userRole === "user" || userRole === "staff") {
      // Regular users only see their own tickets
      filteredData = filteredData.filter((t) => {
        const requestedBy = (t.requested_by || "").toLowerCase().trim()
        const assignedToMe = userId && (t.assigned_to || "").toLowerCase() === userId.toLowerCase()

        return (
          Boolean(assignedToMe) ||
          (userId ? requestedBy === userId.toLowerCase() : false) ||
          (normalizedUserName ? requestedBy === normalizedUserName : false) ||
          (normalizedUserEmail ? requestedBy === normalizedUserEmail : false)
        )
      })
    } else if (userRole === "admin" || userRole === "it_head") {
      // Admin and IT Head see all tickets - no filter
      console.log("[v0] Admin/IT Head - showing all tickets")
    } else if (userRole === "regional_it_head" || userRole === "service_desk_head") {
      // Regional IT Head and Service Desk Head see tickets from their region/location
      // They should see tickets matching their location or locations in the same region
      const loc = normalizedLocation

      if (loc) {
        filteredData = filteredData.filter(t => {
          const ticketLoc = (t.location || "").toLowerCase().trim()
          // Allow tickets that are in the same region OR were directly assigned to me
          const inRegion = isLocationInSameRegion(ticketLoc, loc)
          const exact = ticketLoc === loc || ticketLoc.includes(loc) || loc.includes(ticketLoc)
          const assignedToMe = userId && t.assigned_to?.toLowerCase() === userId.toLowerCase()

          return exact || inRegion || assignedToMe
        })
      }
      console.log("[v0] Regional/Service Desk Head - filtered to", filteredData.length, "tickets for", location)
    } else if (!canSeeAll && location) {
      // Other IT staff see tickets for their specific location
      const loc = normalizedLocation
      filteredData = filteredData.filter(t => {
        const ticketLoc = (t.location || "").toLowerCase().trim()
        const assignedToMe = userId && t.assigned_to?.toLowerCase() === userId.toLowerCase()
        // Exact match
        if (ticketLoc === loc) return true
        // Location contains user location
        if (ticketLoc.includes(loc) || loc.includes(ticketLoc)) return true
        // allow tasks that were explicitly assigned to the current user even if the
        // location doesn't match their own (e.g. cross‑region assignments)
        if (assignedToMe) return true
        return false
      })
    }
    // If canSeeAll is true, no location filter is applied

    console.log("[v0] Loaded service tickets:", filteredData.length, "of", data?.length || 0, "total")

    return NextResponse.json({ tickets: filteredData })
  } catch (error) {
    console.error("[v0] API Service Tickets error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log("[v0] Creating service ticket:", body)

    // Generate ticket number
    const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`

    // Map category to valid enum values
    // Database enum: 'hardware', 'software', 'network', 'printer', 'access', 'other'
    const categoryMap: Record<string, string> = {
      'hardware': 'hardware',
      'software': 'software',
      'network': 'network',
      'printer': 'printer',
      'access': 'access',
      'account': 'access', // Map account to access
      'mobile': 'hardware', // Map mobile to hardware
      'other': 'other',
    }
    
    const rawCategory = (body.category || '').toLowerCase().trim()
    const mappedCategory = categoryMap[rawCategory] || 'other'

    console.log("[v0] Category mapping:", body.category, "->", mappedCategory)

    const { data, error } = await supabaseAdmin
      .from("service_tickets")
      .insert({
        ticket_number: ticketNumber,
        title: body.title || 'IT Support Request',
        description: body.description || '',
        category: mappedCategory,
        priority: body.priority?.toLowerCase() || "medium",
        status: "open",
        location: body.location || '',
        requested_by: body.requested_by || (body.requester_name || ''),
        requester_email: body.requester_email || '',
        requester_phone: body.requester_phone || '',
        requester_department: body.requester_department || '',
        requester_room_number: body.requester_room_number || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating service ticket:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[v0] Created service ticket:", data)

    return NextResponse.json({ ticket: data })
  } catch (error) {
    console.error("[v0] API Service Tickets POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get("id")
    const userRole = searchParams.get("userRole")

    // Only admins can delete tickets
    if (userRole !== "admin") {
      return NextResponse.json(
        { error: "Only admins can delete tickets" },
        { status: 403 }
      )
    }

    if (!ticketId) {
      return NextResponse.json(
        { error: "Ticket ID is required" },
        { status: 400 }
      )
    }

    console.log("[v0] Deleting service ticket:", ticketId)

    // Delete the ticket
    const { error } = await supabaseAdmin
      .from("service_tickets")
      .delete()
      .eq("id", ticketId)

    if (error) {
      console.error("[v0] Error deleting service ticket:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[v0] Successfully deleted service ticket:", ticketId)

    return NextResponse.json({ success: true, message: "Ticket deleted successfully" })
  } catch (error) {
    console.error("[v0] API Service Tickets DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
