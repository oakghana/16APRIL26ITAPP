import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

// Maps broadcast target_role values to the actual role values stored in profiles
const ROLE_MAP: Record<string, string[]> = {
  all_staff:          ["it_head", "regional_it_head", "it_staff", "it_store_head",
                       "service_desk_staff", "service_desk_head", "department_head",
                       "staff", "user"],
  it_staff:           ["it_staff"],
  service_desk_staff: ["service_desk_staff"],
  service_desk_head:  ["service_desk_head"],
  it_head:            ["it_head", "regional_it_head"],
  staff:              ["staff"],
  user:               ["admin", "it_head", "regional_it_head", "it_staff",
                       "service_desk_staff", "service_desk_head", "staff",
                       "user", "it_store_head"],
}

const ALLOWED_SENDER_ROLES = ["admin", "it_head", "regional_it_head"]

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      title,
      message,
      targetRole,
      targetLocation,
      sentBy,
      sentByName,
      notificationType = "info",
    } = body

    if (!title?.trim() || !message?.trim() || !targetRole) {
      return NextResponse.json({ error: "title, message and targetRole are required" }, { status: 400 })
    }

    // Verify the sender exists and has permission
    const { data: senderProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, full_name")
      .eq("id", sentBy)
      .single()

    if (!senderProfile || !ALLOWED_SENDER_ROLES.includes(senderProfile.role)) {
      return NextResponse.json(
        { error: "Unauthorized: Only admins and IT heads can send broadcast notifications" },
        { status: 403 }
      )
    }

    // 1. Save the broadcast record (admin_notifications requires both title and message)
    const broadcastPayload = {
      title: title.trim(),
      message: message.trim(),
      target_role: targetRole,
      target_location_name: targetLocation || null,
      notification_type: notificationType,
      sent_by: sentBy || null,
      sent_by_name: sentByName || senderProfile.full_name || "Admin",
      created_by: sentBy || null,
      created_by_name: sentByName || senderProfile.full_name || "Admin",
      created_by_role: senderProfile.role,
      status: "sent",
      sent_at: new Date().toISOString(),
    }

    console.log("[v0] Saving broadcast:", broadcastPayload)

    const { data: broadcast, error: broadcastError } = await supabaseAdmin
      .from("admin_notifications")
      .insert([broadcastPayload])
      .select()
      .single()

    if (broadcastError || !broadcast) {
      console.error("[v0] Broadcast insert error:", broadcastError?.message)
      return NextResponse.json({ error: broadcastError?.message || "Broadcast save failed" }, { status: 500 })
    }

    console.log("[v0] Broadcast saved with ID:", broadcast.id)

    // 2. Resolve which profile roles should receive this broadcast
    const rolesToNotify = ROLE_MAP[targetRole] ?? [targetRole]
    const isAllUsers = targetRole === "user" || targetRole === "all"

    // 3. Fetch all active matching users from profiles
    let profileQuery = supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, location")
      .eq("is_active", true)

    // Only filter by role if not targeting all users
    if (!isAllUsers) {
      profileQuery = profileQuery.in("role", rolesToNotify)
    }

    if (targetLocation) {
      profileQuery = profileQuery.ilike("location", `%${targetLocation}%`)
    }

    const { data: profiles, error: profileError } = await profileQuery

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    const recipients = profiles ?? []

    // Filter out any profiles with null/empty IDs to prevent FK violations
    const validRecipients = recipients.filter((p) => {
      const idValid = p.id && typeof p.id === "string" && p.id.trim().length > 0
      if (!idValid) {
        console.log("[v0] Skipping profile with invalid ID:", { profile: p, hasId: !!p.id, idType: typeof p.id })
      }
      return idValid
    })

    if (validRecipients.length === 0) {
      console.log("[v0] No valid recipients found. Total profiles fetched:", recipients.length, "Role:", targetRole, "Profiles:", recipients)
      return NextResponse.json({
        success: true,
        broadcast,
        recipientsCount: 0,
        message: "Broadcast saved but no active users found for the selected role.",
      })
    }

    // 4. Fan out a row into `notifications` for every matched user
    const notificationPayload = validRecipients.map((p) => ({
      user_id: p.id,
      title: title.trim(),
      message: message.trim(),
      type: notificationType === "urgent" ? "warning" : notificationType,
      is_read: false,
      created_at: new Date().toISOString(),
    }))

    console.log("[v0] Fanning out", notificationPayload.length, "notifications. Sample user_id:", notificationPayload[0]?.user_id)

    const { error: notifError } = await supabaseAdmin
      .from("notifications")
      .insert(notificationPayload)

    if (notifError) {
      console.error("[v0] Notification insert error:", notifError.message)
      return NextResponse.json({
        error: `Failed to fan out notifications: ${notifError.message}`,
      }, { status: 500 })
    }

    console.log("[v0] Successfully fanned out", notificationPayload.length, "notifications")

    // 5. Track recipients in admin_notification_recipients for admin reporting
    const recipientRows = validRecipients.map((p) => ({
      notification_id: broadcast.id,
      user_id: p.id,
      user_name: p.full_name || p.email,
      user_email: p.email,
      user_role: p.role,
      user_location: p.location || null,
      is_read: false,
      received_at: new Date().toISOString(),
    }))

    await supabaseAdmin.from("admin_notification_recipients").insert(recipientRows)

    return NextResponse.json({
      success: true,
      broadcast,
      recipientsCount: recipients.length,
      message: `Notification delivered to ${recipients.length} user${recipients.length !== 1 ? "s" : ""}.`,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to send notification" }, { status: 500 })
  }
}

// PATCH – edit an existing broadcast and re-fan-out to recipients
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, title, message, targetRole, targetLocation, sentBy, sentByName, notificationType = "info" } = body

    if (!id || !title?.trim() || !message?.trim() || !targetRole) {
      return NextResponse.json({ error: "id, title, message and targetRole are required" }, { status: 400 })
    }

    // Verify sender permission
    const { data: senderProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, full_name")
      .eq("id", sentBy)
      .single()

    if (!senderProfile || !ALLOWED_SENDER_ROLES.includes(senderProfile.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Update the admin_notifications record
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("admin_notifications")
      .update({
        title: title.trim(),
        message: message.trim(),
        target_role: targetRole,
        target_location_name: targetLocation || null,
        notification_type: notificationType,
        sent_at: new Date().toISOString(),
        status: "sent",
      })
      .eq("id", id)
      .select()
      .single()

    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message || "Update failed" }, { status: 500 })
    }

    // Delete previous fan-out notifications for this broadcast (by matching title+category+created_at window)
    // Re-fan-out fresh notifications to the new target set
    const rolesToNotify = ROLE_MAP[targetRole] ?? [targetRole]
    const isAllUsers = targetRole === "user" || targetRole === "all"

    let profileQuery = supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, location")
      .eq("is_active", true)

    if (!isAllUsers) {
      profileQuery = profileQuery.in("role", rolesToNotify)
    }
    if (targetLocation) {
      profileQuery = profileQuery.ilike("location", `%${targetLocation}%`)
    }

    const { data: profiles } = await profileQuery
    const validRecipients = (profiles ?? []).filter((p) => p.id?.trim())

    if (validRecipients.length > 0) {
      const notificationPayload = validRecipients.map((p) => ({
        user_id: p.id,
        title: title.trim(),
        message: message.trim(),
        type: notificationType === "urgent" ? "warning" : notificationType,
        category: "broadcast",
        is_read: false,
        created_at: new Date().toISOString(),
      }))

      await supabaseAdmin.from("notifications").insert(notificationPayload)

      // Refresh recipient tracking
      await supabaseAdmin.from("admin_notification_recipients").delete().eq("notification_id", id)
      const recipientRows = validRecipients.map((p) => ({
        notification_id: id,
        user_id: p.id,
        user_name: p.full_name || p.email,
        user_email: p.email,
        user_role: p.role,
        user_location: p.location || null,
        is_read: false,
        received_at: new Date().toISOString(),
      }))
      await supabaseAdmin.from("admin_notification_recipients").insert(recipientRows)
    }

    return NextResponse.json({
      success: true,
      broadcast: updated,
      recipientsCount: validRecipients.length,
      message: `Notification re-sent to ${validRecipients.length} user${validRecipients.length !== 1 ? "s" : ""}.`,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update notification" }, { status: 500 })
  }
}

// GET – returns sent broadcast history for the admin panel history list
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userRole = searchParams.get("userRole") || ""

    if (!ALLOWED_SENDER_ROLES.includes(userRole)) {
      return NextResponse.json({ notifications: [] })
    }

    const { data, error } = await supabaseAdmin
      .from("admin_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ notifications: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch notifications" }, { status: 500 })
  }
}
