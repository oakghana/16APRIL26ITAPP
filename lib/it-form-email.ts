/**
 * Shared IT-form email helper.
 * Reads SMTP settings from system_settings and sends via /api/send-email.
 * Used server-side from API route handlers.
 */
import { createClient } from "@supabase/supabase-js"
import nodemailer from "nodemailer"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

async function getSmtpConfig() {
  const { data: rows } = await supabaseAdmin
    .from("system_settings")
    .select("key, value, value_type")
  if (!rows?.length) return null
  const m: Record<string, any> = {}
  rows.forEach((r: any) => {
    m[r.key] = r.value_type === "boolean"
      ? r.value === "true" || r.value === true
      : r.value_type === "number"
        ? parseInt(r.value)
        : String(r.value || "").replace(/^"|"$/g, "")
  })
  if (!m.enable_email_notifications) return null
  if (!m.smtp_server || !m.smtp_username || !m.smtp_password) return null
  return {
    host: m.smtp_server as string,
    port: (m.smtp_port as number) || 587,
    secure: (m.smtp_port as number) === 465,
    auth: { user: m.smtp_username as string, pass: m.smtp_password as string },
    from: (m.smtp_from_email || m.smtp_username) as string,
    fromName: (m.smtp_from_name || "QCC IT System") as string,
  }
}

export async function sendItFormEmail(opts: {
  to: string
  subject: string
  html: string
}) {
  try {
    const cfg = await getSmtpConfig()
    if (!cfg) return { success: false, reason: "SMTP not configured or notifications disabled" }
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.auth.user, pass: cfg.auth.pass },
    })
    const info = await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.from}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    })
    console.log("[it-form-email] sent:", info.messageId)
    return { success: true }
  } catch (e: any) {
    console.error("[it-form-email] error:", e.message)
    return { success: false, reason: e.message }
  }
}
