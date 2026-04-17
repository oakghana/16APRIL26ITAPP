import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import nodemailer from "nodemailer"

// Email transporter configuration
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })
}

// Send email to service provider
async function sendServiceProviderEmail(
  providerEmail: string,
  providerName: string,
  repairDetails: {
    taskNumber: string
    deviceInfo: string
    issueDescription: string
    priority: string
    estimatedCost?: number
    location: string
    requestedBy: string
  }
) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.log("[v0] Email not configured - skipping service provider notification")
    return { success: false, reason: "Email not configured" }
  }

  if (!providerEmail) {
    console.log("[v0] No email for service provider - skipping notification")
    return { success: false, reason: "No provider email" }
  }

  try {
    const transporter = createEmailTransporter()

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: providerEmail,
      subject: `[QCC IT] New Repair Task Assigned - ${repairDetails.taskNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2563eb, #4f46e5); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">QCC IT Department</h1>
            <p style="color: #e0e7ff; margin: 5px 0;">Repair Task Notification</p>
          </div>
          
          <div style="padding: 30px; background: #f8fafc;">
            <h2 style="color: #1e40af; margin-top: 0;">Hello ${providerName},</h2>
            
            <p style="color: #475569;">A new repair task has been assigned to you. Please arrange to pick up the device at your earliest convenience.</p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <h3 style="color: #1e40af; margin-top: 0;">Task Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; width: 140px;">Task Number:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-weight: bold;">${repairDetails.taskNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Device:</td>
                  <td style="padding: 8px 0; color: #1e293b;">${repairDetails.deviceInfo}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Issue:</td>
                  <td style="padding: 8px 0; color: #1e293b;">${repairDetails.issueDescription}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Priority:</td>
                  <td style="padding: 8px 0; color: ${
                    repairDetails.priority === 'critical' ? '#dc2626' :
                    repairDetails.priority === 'high' ? '#ea580c' :
                    repairDetails.priority === 'medium' ? '#ca8a04' : '#2563eb'
                  }; font-weight: bold; text-transform: uppercase;">${repairDetails.priority}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Location:</td>
                  <td style="padding: 8px 0; color: #1e293b;">${repairDetails.location}</td>
                </tr>
                ${repairDetails.estimatedCost ? `
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Est. Cost:</td>
                  <td style="padding: 8px 0; color: #1e293b;">GHS ${repairDetails.estimatedCost.toFixed(2)}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="color: #92400e; margin: 0;"><strong>Important:</strong> Please contact us to schedule a pickup time. After completing the repair, upload your invoice through the IT portal.</p>
            </div>
            
            <p style="color: #475569;">If you have any questions, please contact the IT department.</p>
            
            <p style="color: #475569; margin-bottom: 0;">Best regards,<br><strong>QCC IT Department</strong></p>
          </div>
          
          <div style="background: #1e293b; padding: 15px; text-align: center;">
            <p style="color: #94a3b8; margin: 0; font-size: 12px;">This is an automated message from QCC IT Device Tracker</p>
          </div>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)
    console.log("[v0] Email sent to service provider:", providerEmail)
    return { success: true }
  } catch (error) {
    console.error("[v0] Error sending email to service provider:", error)
    return { success: false, reason: String(error) }
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getServerSupabase()
    const { searchParams } = new URL(request.url)
    const location = searchParams.get("location")
    const canSeeAll = searchParams.get("canSeeAll") === "true"

    console.log("[v0] API Repair Requests - location:", location, "canSeeAll:", canSeeAll)

    // Join with service_providers to get full provider details
    let query = supabaseAdmin
      .from("repair_requests")
      .select(`
        *,
        service_provider:service_providers(
          id,
          name,
          phone,
          email,
          location,
          specialization
        )
      `)
      .order("created_at", { ascending: false })

    if (!canSeeAll && location) {
      const fuzzyLocation = location.replace(/[_-]+/g, " ").trim()
      query = query.or(`location.ilike.%${fuzzyLocation}%,requester_location.ilike.%${fuzzyLocation}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error("[v0] Error loading repair requests:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[v0] Loaded repair requests:", data?.length || 0)

    return NextResponse.json({ repairs: data || [] })
  } catch (error) {
    console.error("[v0] API Repair Requests error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getServerSupabase()
    const body = await request.json()

    console.log("[v0] Creating repair request:", body)

    if (!body.device_id || !body.issue_description) {
      return NextResponse.json({ error: "Device and issue description are required" }, { status: 400 })
    }

    // Generate a task number
    const taskNumber = `REP-${Date.now().toString(36).toUpperCase()}`
    const requestLocation = body.location || body.requester_location || "Head Office"

    // Insert the repair request with automatic assignment to NATHLAND
    // Note: service_provider_id is set to NATHLAND's ID to automatically assign repairs
    const { data, error } = await supabaseAdmin
      .from("repair_requests")
      .insert({
        device_id: body.device_id,
        device_name: body.device_name,
        description: body.description || body.issue_description,
        issue_description: body.issue_description,
        priority: body.priority || "medium",
        status: "assigned", // Automatically set to assigned since NATHLAND is assigned
        location: requestLocation,
        requester_location: requestLocation,
        requested_by: body.requested_by,
        service_provider_id: "808e21d0-8069-4687-8d40-5b5f609c0fb0", // NATHLAND COMPANY LIMITED ID
        service_provider_name: "NATHLAND COMPANY LIMITED", // Automatically assign to NATHLAND
        service_provider_assigned_by: body.service_provider_assigned_by || null,
        service_provider_assigned_date: new Date().toISOString(), // Set assignment date
        estimated_cost: body.estimated_cost || null,
        task_number: taskNumber,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating repair request:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[v0] Created repair request:", data)

    // Always send email to NATHLAND COMPANY LIMITED for every repair created
    const providerName = "NATHLAND COMPANY LIMITED"
    const providerEmail = "nathland@gmail.com"

    console.log("[v0] Sending repair notification to NATHLAND:", providerName, providerEmail)

    // Fetch device info for email
    let deviceInfo = body.device_name || "Unknown Device"
    if (body.device_id) {
      const { data: device } = await supabaseAdmin
        .from("devices")
        .select("device_type, brand, model, serial_number, asset_tag")
        .eq("id", body.device_id)
        .single()
      
      if (device) {
        deviceInfo = `${device.asset_tag || device.serial_number} - ${device.device_type} (${device.brand} ${device.model})`
      }
    }

    // Send email notification
    const emailResult = await sendServiceProviderEmail(
      providerEmail,
      providerName,
      {
        taskNumber,
        deviceInfo,
        issueDescription: body.issue_description || body.description || "No description provided",
        priority: body.priority || "medium",
        estimatedCost: body.estimated_cost,
        location: body.location || "Unknown",
        requestedBy: body.requested_by_name || "IT Department",
      }
    )

    console.log("[v0] Email notification result:", emailResult)

    // Create in-app notification for NATHLAND
    try {
      const providerId = "nathland-company"

      // Create notification record
      const { error: notifError } = await supabaseAdmin
        .from("notifications")
        .insert({
          recipient_type: "service_provider",
          recipient_id: providerId,
          title: "New Repair Task Assigned",
          message: `Task ${taskNumber}: ${body.device_name} - ${body.issue_description}`,
          type: "repair_assigned",
          related_id: data.id,
          related_type: "repair_request",
          read: false,
          created_at: new Date().toISOString(),
        })

      if (notifError) {
        console.error("[v0] Error creating in-app notification:", notifError)
      } else {
        console.log("[v0] In-app notification created for NATHLAND:", providerId)
      }
    } catch (err) {
      console.error("[v0] Error in notification creation:", err)
      // Don't fail the repair creation if notification fails
    }

    return NextResponse.json({ repair: data, taskNumber })
  } catch (error) {
    console.error("[v0] API Repair Requests POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabaseAdmin = getServerSupabase()
    const body = await request.json()
    const { id, device_id, device_name, issue_description, priority, service_provider_id, service_provider_name, location, estimated_cost } = body

    if (!id) {
      return NextResponse.json({ error: "Repair ID is required" }, { status: 400 })
    }

    console.log("[v0] Updating repair request:", id)

    const updateData: any = {
      device_id,
      device_name,
      issue_description,
      priority,
      service_provider_id: null, // Set to null - using hardcoded providers, not DB references
      service_provider_name,
      location,
      estimated_cost,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from("repair_requests")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error updating repair request:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[v0] Updated repair request:", data)

    return NextResponse.json({ repair: data })
  } catch (error) {
    console.error("[v0] API Repair Requests PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabaseAdmin = getServerSupabase()
  const body = await request.json()
  const { id, userRole } = body
  
  if (!id) {
  return NextResponse.json({ error: "Repair ID is required" }, { status: 400 })
  }

  // Only admin and it_head can delete repair requests
  if (userRole !== "admin" && userRole !== "it_head") {
    console.error("[v0] Unauthorized delete attempt - role:", userRole)
    return NextResponse.json({ error: "Unauthorized: Only Admin and IT Head can delete repair requests" }, { status: 403 })
  }
  
  console.log("[v0] Deleting repair request:", id, "by role:", userRole)

    const { error } = await supabaseAdmin
      .from("repair_requests")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[v0] Error deleting repair request:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[v0] Deleted repair request:", id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] API Repair Requests DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
