import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getCanonicalLocationName, locationsMatch } from "@/lib/location-filter"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-build-key"
)

type DeviceRow = {
  id: string
  device_type?: string | null
  type?: string | null
  brand?: string | null
  model?: string | null
  serial_number?: string | null
  asset_tag?: string | null
  location?: string | null
  status?: string | null
  assigned_to?: string | null
  toner_type?: string | null
  toner_model?: string | null
  toner_yield?: number | string | null
  monthly_print_volume?: number | string | null
}

type StoreItemRow = {
  id: string
  name?: string | null
  item_name?: string | null
  category?: string | null
  sku?: string | null
  siv_number?: string | null
  location?: string | null
  quantity?: number | null
  quantity_in_stock?: number | null
  reorder_level?: number | null
}

function normalizeToken(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim()
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function isPrinterLikeType(device: DeviceRow): boolean {
  const t = String(device.device_type || device.type || "").toLowerCase().trim()
  return t === "printer" || t === "photocopier"
}

function isTonerLikeItem(item: StoreItemRow): boolean {
  const text = `${item.name || item.item_name || ""} ${item.category || ""}`.toLowerCase()
  return (
    text.includes("toner") ||
    text.includes("cartridge") ||
    text.includes("ink") ||
    text.includes("developer")
  )
}

function getItemQty(item: StoreItemRow): number {
  return toNumber(item.quantity_in_stock ?? item.quantity ?? 0)
}

function tonerNeedStatus(locationQty: number, reorderLevel: number): "ok" | "low" | "needs_now" {
  if (locationQty <= 0) return "needs_now"
  if (locationQty <= Math.max(1, reorderLevel)) return "low"
  return "ok"
}

function buildTonerSearchTokens(device: DeviceRow): string[] {
  const tokens = [
    device.toner_type,
    device.toner_model,
    `${device.brand || ""} ${device.model || ""}`,
    device.model,
    device.brand,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)

  return Array.from(new Set(tokens.map(normalizeToken).filter(Boolean)))
}

function matchTonerItems(device: DeviceRow, tonerItems: StoreItemRow[]): StoreItemRow[] {
  const tokens = buildTonerSearchTokens(device)
  if (tokens.length === 0) return []

  return tonerItems.filter((item) => {
    const itemBlob = normalizeToken(`${item.name || item.item_name || ""} ${item.category || ""} ${item.sku || ""} ${item.siv_number || ""}`)
    return tokens.some((token) => itemBlob.includes(token) || token.includes(itemBlob))
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const userRole = searchParams.get("userRole")

    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 })
    }

    const { data: devicesData, error: devicesError } = await supabaseAdmin
      .from("devices")
      .select("*")

    if (devicesError) {
      return NextResponse.json({ error: devicesError.message }, { status: 500 })
    }

    const { data: storeItemsData, error: storeItemsError } = await supabaseAdmin
      .from("store_items")
      .select("*")

    let centralItems: StoreItemRow[] = []
    const { data: centralStoreData } = await supabaseAdmin
      .from("central_store_items")
      .select("*")
      .limit(5000)

    if (Array.isArray(centralStoreData)) {
      centralItems = centralStoreData as StoreItemRow[]
    }

    if (storeItemsError) {
      return NextResponse.json({ error: storeItemsError.message }, { status: 500 })
    }

    const allDevices = (devicesData || []) as DeviceRow[]
    const printerLikeDevices = allDevices.filter(isPrinterLikeType)

    const tonerItems = ([...(storeItemsData || []), ...centralItems] as StoreItemRow[])
      .filter(isTonerLikeItem)

    const locationMap = new Map<string, any>()

    printerLikeDevices.forEach((device) => {
      const locationName = getCanonicalLocationName(device.location || "Unspecified")
      const matchedToners = matchTonerItems(device, tonerItems)

      const locationMatched = matchedToners.filter((item) => locationsMatch(item.location, locationName))
      const globalQty = matchedToners.reduce((sum, item) => sum + getItemQty(item), 0)
      const locationQty = locationMatched.reduce((sum, item) => sum + getItemQty(item), 0)
      const reorderLevel = locationMatched.length > 0
        ? Math.max(...locationMatched.map((item) => toNumber(item.reorder_level || 0)))
        : 0

      const status = tonerNeedStatus(locationQty, reorderLevel)

      const payloadDevice = {
        id: device.id,
        deviceType: String(device.device_type || device.type || "unknown"),
        brand: device.brand || "Unknown",
        model: device.model || "Unknown",
        serialNumber: device.serial_number || "N/A",
        assetTag: device.asset_tag || "N/A",
        location: locationName,
        status: device.status || "active",
        assignedTo: device.assigned_to || "Unassigned",
        tonerType: device.toner_type || device.toner_model || "Not Set",
        monthlyPrintVolume: toNumber(device.monthly_print_volume || 0),
        tonerYield: toNumber(device.toner_yield || 0),
        matchedToners: matchedToners.map((item) => ({
          id: item.id,
          name: item.name || item.item_name || "Unknown",
          category: item.category || "Unknown",
          location: getCanonicalLocationName(item.location || "Unspecified"),
          quantity: getItemQty(item),
          reorderLevel: toNumber(item.reorder_level || 0),
        })),
        tonerSignal: {
          locationQty,
          globalQty,
          reorderLevel,
          status,
          needsTonerNow: status === "needs_now",
        },
      }

      const existing = locationMap.get(locationName) || {
        location: locationName,
        printers: [],
        photocopiers: [],
        totalDevices: 0,
        needsNow: 0,
        lowStock: 0,
      }

      if (String(payloadDevice.deviceType).toLowerCase() === "photocopier") {
        existing.photocopiers.push(payloadDevice)
      } else {
        existing.printers.push(payloadDevice)
      }

      existing.totalDevices += 1
      if (status === "needs_now") existing.needsNow += 1
      if (status === "low") existing.lowStock += 1

      locationMap.set(locationName, existing)
    })

    const locations = Array.from(locationMap.values()).sort((a, b) => a.location.localeCompare(b.location))

    const summary = {
      totalLocations: locations.length,
      totalDevices: locations.reduce((sum, loc) => sum + loc.totalDevices, 0),
      totalPrinters: locations.reduce((sum, loc) => sum + loc.printers.length, 0),
      totalPhotocopiers: locations.reduce((sum, loc) => sum + loc.photocopiers.length, 0),
      totalNeedsNow: locations.reduce((sum, loc) => sum + loc.needsNow, 0),
      totalLowStock: locations.reduce((sum, loc) => sum + loc.lowStock, 0),
    }

    return NextResponse.json({
      success: true,
      summary,
      locations,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
