import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateCsvTemplate, validateCsvImport } from "@/lib/device-import/csv-validator"
import { normalizeDeviceTypeCode } from "@/lib/device-types"
import { getCanonicalLocationName, getLocationAliases } from "@/lib/location-filter"

// Use service role key to bypass RLS
const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData()
    const file = formData.get("file") as File
    const userLocation = formData.get("userLocation") as string
    const userRole = formData.get("userRole") as string
    const skipDuplicates = formData.get("skipDuplicates") === "true"

    console.log("[v0] Bulk import started - userLocation:", userLocation, "userRole:", userRole, "skipDuplicates:", skipDuplicates, "Time:", new Date().toISOString())

    // Permission check - only IT staff and admins can import
    if (!["admin", "it_staff", "regional_it_head"].includes(userRole)) {
      console.log("[v0] Unauthorized import attempt - role:", userRole)
      return NextResponse.json(
        { error: "You do not have permission to import devices" },
        { status: 403 }
      )
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!userLocation) {
      return NextResponse.json({ error: "User location is required" }, { status: 400 })
    }

    const effectiveLocation = getCanonicalLocationName(userLocation)
    const locationAliases = getLocationAliases(userLocation)

    // Fetch location details to capture location_id, region_id, district_id
    let locationData: any = null
    let locationError: any = null

    if (locationAliases.length > 0) {
      const locationClauses = locationAliases
        .map((alias) => alias.replace(/[,%()]/g, "").trim())
        .filter(Boolean)
        .map((alias) => `name.ilike.%${alias}%`)

      const locationLookup = await supabase
        .from("locations")
        .select("id, region_id, district_id, name, region, type")
        .or(locationClauses.join(","))
        .limit(1)

      locationData = locationLookup.data?.[0] ?? null
      locationError = locationLookup.error
    }

    if (locationError || !locationData) {
      console.log("[v0] Could not find location:", userLocation, "using effective location:", effectiveLocation)
    }

    const locationId = locationData?.id
    const regionId = locationData?.region_id
    const districtId = locationData?.district_id

    console.log("[v0] Location metadata - locationId:", locationId, "regionId:", regionId, "districtId:", districtId)

    // Fetch existing serial numbers to check for duplicates
    const { data: existingDevices, error: fetchError } = await supabase
      .from("devices")
      .select("serial_number")

    if (fetchError) {
      console.error("[v0] Error fetching existing devices:", fetchError)
      return NextResponse.json({ error: "Failed to check for duplicates" }, { status: 500 })
    }

    const existingSerialNumbers = new Set(
      existingDevices?.map((d: any) => d.serial_number?.toLowerCase()) || []
    )

    const { data: lookupDeviceTypes } = await supabase
      .from("lookup_device_types")
      .select("code")
      .eq("is_active", true)

    // Read file content as text so papaparse can parse it in Node.js
    // (File objects with FileReaderSync are not supported in Node.js)
    const fileText = await file.text()

    // Validate CSV
    const validationResult = await validateCsvImport(fileText, existingSerialNumbers, {
      skipDuplicates,
      allowedDeviceTypes: (lookupDeviceTypes || []).map((type: any) => normalizeDeviceTypeCode(type.code)),
    })

    console.log(
      "[v0] Validation complete - Valid records:",
      validationResult.records.length,
      "Errors:",
      validationResult.errors.length
    )

    // If there are errors, return them without importing
    if (!validationResult.isValid) {
      console.log("[v0] Import validation failed - returning errors to user")
      return NextResponse.json(
        {
          success: false,
          validationErrors: validationResult.errors,
          importedCount: 0,
          totalRows: validationResult.records.length + validationResult.errors.length,
        },
        { status: 400 }
      )
    }

    // Insert all valid records in batch with location metadata
    const devicesToInsert = validationResult.records.map((record) => ({
      device_type: record.device_type,
      brand: record.brand,
      model: record.model,
      serial_number: record.serial_number,
      status: record.status || "active",
      location: effectiveLocation, // Force location to canonical user location
      location_id: locationId || null, // Add location_id if available
      region_id: regionId || null, // Add region_id if available
      district_id: districtId || null, // Add district_id if available
      assigned_to: record.assigned_to || null,
      purchase_date: record.purchase_date || null,
      warranty_expiry: record.warranty_expiry || null,
      room_number: record.room_number || null,
      building: record.building || null,
      floor_level: record.floor || null,
      toner_type: record.toner_type || null,
      toner_model: record.toner_model || null,
      toner_yield: record.toner_yield || null,
      monthly_print_volume: record.monthly_print_volume || null,
    }))

    const { data, error: insertError } = await supabase
      .from("devices")
      .insert(devicesToInsert)

    if (insertError) {
      console.error("[v0] Error inserting devices:", insertError)
      return NextResponse.json(
        { error: "Failed to import devices: " + insertError.message },
        { status: 500 }
      )
    }

    console.log("[v0] Successfully imported", validationResult.records.length, "devices to location:", effectiveLocation, "at", new Date().toISOString())

    // Create audit log entry for the bulk import
    try {
      await supabase.from("audit_logs").insert({
        action: "bulk_device_import",
        resource: "devices",
        details: JSON.stringify({
          location: effectiveLocation,
          location_id: locationId,
          region_id: regionId,
          district_id: districtId,
          devices_imported: validationResult.records.length,
          device_types: validationResult.records.map((r) => r.device_type),
        }),
        severity: "info",
      })
    } catch (auditError) {
      console.log("[v0] Could not create audit log entry:", auditError)
      // Don't fail the import if audit logging fails
    }

    const skippedCount = validationResult.warnings?.length || 0
    const skippedMsg = skippedCount > 0 ? ` (${skippedCount} duplicate(s) skipped)` : ""

    return NextResponse.json({
      success: true,
      importedCount: validationResult.records.length,
      skippedCount,
      totalRows: validationResult.records.length + skippedCount,
      warnings: validationResult.warnings || [],
      message: `Successfully imported ${validationResult.records.length} device(s) to ${effectiveLocation}${skippedMsg}`,
    })
  } catch (error: any) {
    console.error("[v0] Bulk import error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred: " + error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const action = searchParams.get("action")

    if (action === "template") {
      const template = generateCsvTemplate()

      return new NextResponse(template, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=device-import-template.csv",
        },
      })
    }

    if (action === "export") {
      // Export location devices in re-importable CSV format
      const location = searchParams.get("location")
      
      if (!location) {
        return NextResponse.json({ error: "Location parameter is required" }, { status: 400 })
      }

      let query = supabase
        .from("devices")
        .select("device_type, brand, model, serial_number, status, purchase_date, warranty_expiry, assigned_to, room_number, building, floor_level, toner_type, toner_model, toner_yield, monthly_print_volume, location")
        .order("device_type")
        .order("brand")

      // Filter by location using aliases so Head Office/Accra and CR/Cape Coast stay aligned
      if (location !== "all") {
        const aliases = getLocationAliases(location)
        const clauses = aliases
          .map((alias) => alias.replace(/[,%()]/g, "").trim())
          .filter(Boolean)
          .map((alias) => `location.ilike.%${alias}%`)

        if (clauses.length > 0) {
          query = query.or(clauses.join(","))
        }
      }

      const { data: devices, error: fetchError } = await query

      if (fetchError) {
        console.error("[v0] Error exporting devices:", fetchError)
        return NextResponse.json({ error: "Failed to export devices" }, { status: 500 })
      }

      if (!devices || devices.length === 0) {
        return NextResponse.json({ error: "No devices found for this location" }, { status: 404 })
      }

      // Build CSV with import-compatible headers
      const headers = [
        "device_type",
        "brand",
        "model",
        "serial_number",
        "status",
        "purchase_date",
        "warranty_expiry",
        "assigned_to",
        "room_number",
        "building",
        "floor",
        "toner_type",
        "toner_model",
        "toner_yield",
        "monthly_print_volume",
      ]

      const csvRows = [
        headers.join(","),
        ...devices.map((device: any) => {
          return headers.map((header) => {
            const key = header === "floor" ? "floor_level" : header
            const value = device[key] ?? ""
            // Escape commas and quotes in values
            const strValue = String(value)
            if (strValue.includes(",") || strValue.includes('"') || strValue.includes("\n")) {
              return `"${strValue.replace(/"/g, '""')}"`
            }
            return strValue
          }).join(",")
        }),
      ]

      const csvContent = csvRows.join("\n")
      const locationName = location.replace(/\s+/g, "_")
      const filename = `devices-${locationName}-${new Date().toISOString().split("T")[0]}.csv`

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename=${filename}`,
        },
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error("[v0] Error in bulk import GET:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
