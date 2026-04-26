import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getCanonicalLocationName, locationsMatch } from "@/lib/location-filter"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key"
)

const PRINTER_TYPES = ["printer", "photocopier", "copier", "multifunction", "laserjet", "inkjet", "fax", "scanner"]

function isPrinterLike(deviceType: string) {
  if (!deviceType) return false
  const t = deviceType.toLowerCase()
  return PRINTER_TYPES.some((pt) => t.includes(pt))
}

/**
 * GET /api/devices/my-devices
 * Returns devices assigned to the requesting user plus toner stock for printer-type devices.
 * Query params: userId, userName, userEmail, userLocation
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const userId = searchParams.get("userId") || ""
    const userName = searchParams.get("userName") || ""
    const userEmail = searchParams.get("userEmail") || ""
    const userLocation = searchParams.get("userLocation") || ""

    if (!userId && !userName && !userEmail) {
      return NextResponse.json({ error: "userId, userName, or userEmail is required" }, { status: 400 })
    }

    // Build OR clauses to match devices assigned to this user by ID, name, or email
    const orClauses: string[] = []
    if (userId) orClauses.push(`assigned_to.eq.${userId}`)
    if (userName) orClauses.push(`assigned_to.ilike.%${userName}%`)
    if (userEmail) orClauses.push(`assigned_to.ilike.%${userEmail}%`)

    const { data: devices, error: devError } = await supabaseAdmin
      .from("devices")
      .select("id, device_type, brand, model, serial_number, asset_tag, status, location, assigned_to, toner_type, toner_model, purchase_date, warranty_expiry")
      .or(orClauses.join(","))
      .order("created_at", { ascending: false })

    if (devError) {
      console.error("[v0] my-devices: Error fetching devices:", devError)
      return NextResponse.json({ error: devError.message }, { status: 500 })
    }

    const myDevices = devices || []

    // Collect toner types used by printer-like devices
    const printerDevices = myDevices.filter((d) => isPrinterLike(d.device_type))
    const tonerTypes = Array.from(
      new Set(printerDevices.map((d) => d.toner_type || d.toner_model).filter(Boolean) as string[])
    )

    // Fetch toner stock at the user's location for these toner types
    const tonerStockMap: Record<string, { qty: number; items: any[] }> = {}

    if (tonerTypes.length > 0 && userLocation) {
      const canonicalLoc = getCanonicalLocationName(userLocation)

      // Fetch all potentially matching store items
      const { data: storeItems } = await supabaseAdmin
        .from("store_items")
        .select("id, name, sku, category, quantity, quantity_in_stock, location")
        .or("category.ilike.%toner%,name.ilike.%toner%,category.ilike.%cartridge%,name.ilike.%cartridge%")

      // Also fetch central store items
      const { data: centralItems } = await supabaseAdmin
        .from("central_store_items")
        .select("id, name, sku, category, quantity, location")
        .or("category.ilike.%toner%,name.ilike.%toner%,category.ilike.%cartridge%,name.ilike.%cartridge%")

      const allItems = [...(storeItems || []), ...(centralItems || [])]

      for (const tonerType of tonerTypes) {
        const tt = tonerType.toLowerCase()
        const matching = allItems.filter((item) => {
          const locationMatch =
            locationsMatch(item.location, userLocation) || locationsMatch(item.location, "Central Stores")
          const nameMatch =
            (item.name || "").toLowerCase().includes(tt) || (item.sku || "").toLowerCase().includes(tt)
          return locationMatch && nameMatch
        })
        const qty = matching.reduce((sum, i) => sum + (i.quantity_in_stock ?? i.quantity ?? 0), 0)
        tonerStockMap[tonerType] = { qty, items: matching }
      }
    }

    // Enrich each device with toner stock info
    const enriched = myDevices.map((d) => {
      const stock =
        isPrinterLike(d.device_type) && (d.toner_type || d.toner_model)
          ? (tonerStockMap[d.toner_type || d.toner_model] ?? { qty: 0, items: [] })
          : null

      return {
        id: d.id,
        deviceType: d.device_type || "Unknown",
        brand: d.brand || "",
        model: d.model || "",
        serialNumber: d.serial_number || "",
        assetTag: d.asset_tag || "",
        status: d.status || "active",
        location: getCanonicalLocationName(d.location || ""),
        assignedTo: d.assigned_to || "",
        isPrinter: isPrinterLike(d.device_type),
        tonerType: d.toner_type || d.toner_model || null,
        tonerModel: d.toner_model || null,
        tonerStock: stock
          ? {
              qty: stock.qty,
              status: stock.qty <= 0 ? "out" : stock.qty <= 2 ? "low" : "ok",
            }
          : null,
        purchaseDate: d.purchase_date || null,
        warrantyExpiry: d.warranty_expiry || null,
      }
    })

    return NextResponse.json({ devices: enriched })
  } catch (err: any) {
    console.error("[v0] my-devices error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
