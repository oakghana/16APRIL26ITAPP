import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getServerSupabase()
    const { backupData } = await request.json()

    if (!backupData || !backupData.data) {
      return NextResponse.json({ error: "Invalid backup data format" }, { status: 400 })
    }

    console.log("[v0] Starting database restore from backup timestamp:", backupData.timestamp)

    let restoredTables = 0
    let restoredRecords = 0

    for (const [table, records] of Object.entries(backupData.data)) {
      if (!Array.isArray(records) || records.length === 0) {
        console.log(`[v0] Skipping ${table}: no records to restore`)
        continue
      }

      try {
        console.log(`[v0] Restoring ${table}: ${(records as any[]).length} records...`)

        // Insert records in batches to avoid overwhelming the database
        const batchSize = 100
        for (let i = 0; i < (records as any[]).length; i += batchSize) {
          const batch = (records as any[]).slice(i, i + batchSize)

          const { error } = await supabaseAdmin.from(table).insert(batch)

          if (error) {
            console.warn(`[v0] Warning restoring ${table} batch:`, error.message)
            // Continue with next batch even if this one fails
          } else {
            restoredRecords += batch.length
          }
        }

        restoredTables++
      } catch (err) {
        console.warn(`[v0] Error restoring ${table}:`, err)
        // Continue with next table even if this one fails
      }
    }

    console.log(`[v0] Restore completed: ${restoredTables} tables, ${restoredRecords} total records`)

    return NextResponse.json({
      success: true,
      message: "Database restore completed successfully",
      tablesRestored: restoredTables,
      recordsRestored: restoredRecords,
    })
  } catch (error) {
    console.error("[v0] Error restoring backup:", error)
    return NextResponse.json({ error: "Failed to restore database from backup" }, { status: 500 })
  }
}
