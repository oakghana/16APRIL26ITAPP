import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getServerSupabase()
    // Get all tables for backup
    const tables = [
      "users",
      "profiles",
      "service_providers",
      "devices",
      "device_categories",
      "repair_requests",
      "repair_assignments",
      "repair_invoices",
      "store_items",
      "store_requisitions",
      "stock_levels",
      "stock_transactions",
      "service_desk_tickets",
      "audit_logs",
    ]

    const backup: Record<string, any[]> = {}

    console.log("[v0] Starting database backup...")

    for (const table of tables) {
      try {
        const { data, error } = await supabaseAdmin.from(table).select("*")

        if (error) {
          console.warn(`[v0] Warning backing up ${table}:`, error.message)
          backup[table] = []
        } else {
          backup[table] = data || []
          console.log(`[v0] Backed up ${table}: ${(data || []).length} records`)
        }
      } catch (err) {
        console.warn(`[v0] Error backing up ${table}:`, err)
        backup[table] = []
      }
    }

    const backupData = {
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: backup,
    }

    console.log("[v0] Backup completed successfully")

    return NextResponse.json({
      success: true,
      message: "Database backup completed successfully",
      backup: backupData,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Error creating backup:", error)
    return NextResponse.json({ error: "Failed to create backup" }, { status: 500 })
  }
}
