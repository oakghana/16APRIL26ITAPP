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
    const userRole = searchParams.get("userRole")

    console.log("[v0] API Service Tickets - location:", location, "canSeeAll:", canSeeAll, "role:", userRole)

    // Fetch all tickets first, then filter in memory for reliability
    const { data, error } = await supabaseAdmin
      .from("service_tickets")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error loading service tickets:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let filteredData = data || []

    // Apply filters based on user role
    if (userRole === "user" || userRole === "staff") {
      // Regular users only see their own tickets
      if (userId) {
        filteredData = filteredData.filter(t => 
          t.requested_by?.toLowerCase() === userId.toLowerCase()
        )
      }
    } else if (userRole === "admin" || userRole === "it_head") {
      // Admin and IT Head see all tickets - no filter
      console.log("[v0] Admin/IT Head - showing all tickets")
    } else if (userRole === "regional_it_head" || userRole === "service_desk_head") {
      // Regional IT Head and Service Desk Head see tickets from their region/location
      // They should see tickets matching their location or locations in the same region
      const loc = location.toLowerCase().trim()

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
      const loc = location.toLowerCase().trim()
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
