import nodemailer from 'nodemailer'

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export interface SMTPConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

/**
 * Send email using configured SMTP settings
 */
export async function sendEmail(options: EmailOptions, smtpConfig: SMTPConfig) {
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure, // true for 465, false for other ports
      auth: {
        user: smtpConfig.auth.user,
        pass: smtpConfig.auth.pass,
      },
    })

    // Send email
    const info = await transporter.sendMail({
      from: `"QCC IT System" <${smtpConfig.auth.user}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    })

    console.log('[v0] Email sent successfully:', info.messageId)
    return {
      success: true,
      messageId: info.messageId,
    }
  } catch (error: any) {
    console.error('[v0] Error sending email:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Generate HTML email template for ticket assignment
 */
export function generateAssignmentEmailHTML(data: {
  staffName: string
  ticketNumber: string
  ticketTitle: string
  priority: string
  dueDate?: string
  instructions?: string
  assignedBy: string
  dashboardUrl: string
}) {
  const priorityColors: Record<string, string> = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#f97316',
    urgent: '#ef4444',
  }

  const priorityColor = priorityColors[data.priority.toLowerCase()] || '#3b82f6'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Ticket Assignment</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">New Ticket Assigned</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
                Hello <strong>${data.staffName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
                You have been assigned a new ticket by <strong>${data.assignedBy}</strong>.
              </p>
              
              <!-- Ticket Details Card -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 6px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Ticket Number:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: bold;">${data.ticketNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Title:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${data.ticketTitle}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Priority:</td>
                        <td style="padding: 8px 0;">
                          <span style="display: inline-block; padding: 4px 12px; background-color: ${priorityColor}; color: #ffffff; font-size: 12px; font-weight: bold; border-radius: 12px; text-transform: uppercase;">
                            ${data.priority}
                          </span>
                        </td>
                      </tr>
                      ${data.dueDate ? `
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Due Date:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px;">${new Date(data.dueDate).toLocaleDateString()}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
              
              ${data.instructions ? `
              <!-- Instructions -->
              <div style="margin: 20px 0; padding: 15px; background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
                <p style="margin: 0 0 8px; color: #1e40af; font-size: 14px; font-weight: bold;">Instructions:</p>
                <p style="margin: 0; color: #1e3a8a; font-size: 14px; line-height: 1.5;">${data.instructions}</p>
              </div>
              ` : ''}
              
              <!-- CTA Button -->
              <table role="presentation" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${data.dashboardUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 6px;">
                      View in Dashboard
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px;">
                Please log in to the system to view complete details and start working on this ticket.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                This is an automated message from QCC IT Management System.<br>
                Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

// ---------------------------------------------------------------------------
// IT Form notification emails
// ---------------------------------------------------------------------------

export function generateITFormDeptHeadRequestHTML(data: {
  deptHeadName: string
  requesterName: string
  requestNumber: string
  formTitle: string
  summary: string
  dashboardUrl: string
}) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
<table role="presentation" style="width:100%;border-collapse:collapse;">
<tr><td align="center" style="padding:40px 0;">
<table role="presentation" style="width:600px;background:#fff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,.1);">
<tr><td style="padding:30px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:8px 8px 0 0;">
  <h1 style="margin:0;color:#fff;font-size:22px;">IT Request Awaiting Your Approval</h1>
</td></tr>
<tr><td style="padding:30px;">
  <p style="color:#374151;">Hello <strong>${data.deptHeadName}</strong>,</p>
  <p style="color:#374151;">A staff member in your department has submitted an IT request that requires your approval before it proceeds to the IT Team.</p>
  <table style="width:100%;background:#f9fafb;border-radius:6px;padding:16px;margin:16px 0;">
    <tr><td style="color:#6b7280;font-size:13px;width:140px;">Request Number:</td><td style="font-weight:bold;color:#111827;">${data.requestNumber}</td></tr>
    <tr><td style="color:#6b7280;font-size:13px;">Type:</td><td style="color:#111827;">${data.formTitle}</td></tr>
    <tr><td style="color:#6b7280;font-size:13px;">Submitted by:</td><td style="color:#111827;">${data.requesterName}</td></tr>
    <tr><td style="color:#6b7280;font-size:13px;vertical-align:top;">Summary:</td><td style="color:#111827;">${data.summary}</td></tr>
  </table>
  <p style="color:#374151;">Please log in to approve or reject this request:</p>
  <a href="${data.dashboardUrl}" style="display:inline-block;padding:12px 24px;background:#667eea;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Review Request</a>
  <p style="color:#9ca3af;font-size:12px;margin-top:24px;">QCC IT Management System — automated notification, do not reply.</p>
</td></tr>
</table></td></tr></table>
</body></html>`
}

export function generateITFormCompletionHTML(data: {
  requesterName: string
  requestNumber: string
  formTitle: string
  summary: string
  workNotes: string
  dashboardUrl: string
}) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
<table role="presentation" style="width:100%;border-collapse:collapse;">
<tr><td align="center" style="padding:40px 0;">
<table role="presentation" style="width:600px;background:#fff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,.1);">
<tr><td style="padding:30px;background:linear-gradient(135deg,#10b981 0%,#059669 100%);border-radius:8px 8px 0 0;">
  <h1 style="margin:0;color:#fff;font-size:22px;">✅ Your IT Request Has Been Completed</h1>
</td></tr>
<tr><td style="padding:30px;">
  <p style="color:#374151;">Hello <strong>${data.requesterName}</strong>,</p>
  <p style="color:#374151;">Great news! Your IT request has been completed by the IT Team.</p>
  <table style="width:100%;background:#f9fafb;border-radius:6px;padding:16px;margin:16px 0;">
    <tr><td style="color:#6b7280;font-size:13px;width:140px;">Request Number:</td><td style="font-weight:bold;color:#111827;">${data.requestNumber}</td></tr>
    <tr><td style="color:#6b7280;font-size:13px;">Type:</td><td style="color:#111827;">${data.formTitle}</td></tr>
    <tr><td style="color:#6b7280;font-size:13px;vertical-align:top;">Your Request:</td><td style="color:#111827;">${data.summary}</td></tr>
    <tr><td style="color:#6b7280;font-size:13px;vertical-align:top;">Work Done:</td><td style="color:#111827;">${data.workNotes}</td></tr>
  </table>
  <a href="${data.dashboardUrl}" style="display:inline-block;padding:12px 24px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">View Request</a>
  <p style="color:#9ca3af;font-size:12px;margin-top:24px;">QCC IT Management System — automated notification, do not reply.</p>
</td></tr>
</table></td></tr></table>
</body></html>`
}

/**
 * Generate plain text version of assignment email
 */
export function generateAssignmentEmailText(data: {
  staffName: string
  ticketNumber: string
  ticketTitle: string
  priority: string
  dueDate?: string
  instructions?: string
  assignedBy: string
  dashboardUrl: string
}) {
  let text = `Hello ${data.staffName},

You have been assigned a new ticket by ${data.assignedBy}.

Ticket Details:
- Ticket Number: ${data.ticketNumber}
- Title: ${data.ticketTitle}
- Priority: ${data.priority.toUpperCase()}
${data.dueDate ? `- Due Date: ${new Date(data.dueDate).toLocaleDateString()}` : ''}

${data.instructions ? `Instructions:\n${data.instructions}\n` : ''}
Please log in to the system to view complete details and start working on this ticket.

Dashboard: ${data.dashboardUrl}

---
This is an automated message from QCC IT Management System.
Please do not reply to this email.
`
  return text
}
