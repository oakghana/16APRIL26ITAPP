"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Package, AlertTriangle, Download, MapPin, Info } from "lucide-react"
import { LOCATIONS } from "@/lib/locations"
import { downloadCSV } from "@/lib/export-utils"
import StockCardDetailModal from "./stock-card-detail-modal"
import { createBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { canSeeAllLocations, locationsMatch } from "@/lib/location-filter"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface StockItem {
  id: string
  name: string
  category: string
  quantity: number
  reorder_level: number
  unit: string
  location: string
  sku: string
  siv_number: string
  supplier: string
  lastTransaction?: {
    type: string
    quantity: number
    recipient?: string
    date: string
    notes?: string
  }
}

interface LocationSummary {
  location: string
  totalItems: number
  totalValue: number
  lowStock: number
  outOfStock: number
}

export default function StoreHeadDashboard() {
  const [items, setItems] = useState<StockItem[]>([])
  const [locationSummaries, setLocationSummaries] = useState<LocationSummary[]>([])
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeLocation, setActiveLocation] = useState("")
  const { user } = useAuth()

  const locationValues = Object.values(LOCATIONS)

  useEffect(() => {
    fetchAllInventory()
  }, [user])

  useEffect(() => {
    // Listen for inventory refresh events triggered after requisition approval
    const handleInventoryRefresh = () => {
      console.log("[v0] Inventory refresh event received, refetching data...")
      fetchAllInventory()
    }

    window.addEventListener("inventory-updated", handleInventoryRefresh)
    return () => {
      window.removeEventListener("inventory-updated", handleInventoryRefresh)
    }
  }, [])

  const normalizeLocationName = (loc: string) => {
    const lower = loc.toLowerCase().replace(/[\s_-]+/g, "_").trim()
    if (lower === "head_office") return "Head Office"
    if (lower === "kumasi") return "Kumasi"
    if (lower === "kaase") return "Kaase"
    if (lower === "tema_port") return "Tema Port"
    if (lower === "takoradi_port" || lower === "takoradi") return "Takoradi Port"
    if (lower === "central_stores") return "Central Stores"
    if (lower === "wn" || lower === "western_north") return "Western North"
    if (lower === "ws" || lower === "western_south") return "Western South"
    if (lower === "cr" || lower === "cape_coast" || lower === "central_region" || lower === "swedru" || lower === "swedru_cr" || lower === "swedru/cr") return "Swedru/CR"
    if (lower === "vr" || lower === "volta") return "Ho"
    if (lower === "bar" || lower === "brong_ahafo") return "Sunyani"
    return loc.charAt(0).toUpperCase() + loc.slice(1).toLowerCase()
  }

  const fetchAllInventory = async () => {
    try {
      const supabase = createBrowserClient()

      // Fetch all store items - we'll filter on the client side for case-insensitive matching
      let query = supabase.from("store_items").select("*").order("location").order("name")

      // Note: For location filtering, we fetch all and filter client-side due to case-sensitivity issues
      // Alternatively, we could use .or() with ilike for each location, but that's complex

      const { data, error } = await query

      if (error) {
        console.error("[v0] Error fetching inventory:", error)
        setItems([])
        setLocationSummaries([])
        setLoading(false)
        return
      }

      console.log("[v0] Fetched store items from database:", data)

      if (data && data.length > 0) {
        // Filter items based on user's location (case-insensitive)
        let filteredData = data
        if (user && !canSeeAllLocations(user) && user.location) {
          console.log("[v0] Filtering items by location:", user.location, "+ Central Stores")
          filteredData = data.filter((item: any) => 
            locationsMatch(item.location, user.location) ||
            locationsMatch(item.location, "Central Stores")
          )
        }
        
        // Fetch last transactions for items with 0 or low stock
        const itemsWithLowStock = filteredData.filter((item: any) => item.quantity <= (item.reorder_level || 5))
        if (itemsWithLowStock.length > 0) {
          const itemNames = itemsWithLowStock.map((item: any) => item.name)
          
          // Fetch recent transactions for these items
          const { data: transactions } = await supabase
            .from("stock_transactions")
            .select("*")
            .in("item_name", itemNames)
            .order("created_at", { ascending: false })
          
          // Fetch recent assignments for these items  
          const { data: assignments } = await supabase
            .from("stock_assignments")
            .select("*")
            .in("item_name", itemNames)
            .order("created_at", { ascending: false })
          
          // Combine and sort by date
          const allActivities = [
            ...(transactions || []).map(t => ({
              item_name: t.item_name,
              type: t.transaction_type,
              quantity: t.quantity,
              recipient: t.recipient,
              date: t.created_at,
              notes: t.notes,
            })),
            ...(assignments || []).map(a => ({
              item_name: a.item_name,
              type: 'assignment',
              quantity: a.quantity,
              recipient: a.assigned_to,
              date: a.created_at,
              notes: a.notes,
            })),
          ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          
          // Map last activity to each item
          filteredData = filteredData.map((item: any) => {
            const lastActivity = allActivities.find(a => a.item_name === item.name)
            if (lastActivity) {
              return {
                ...item,
                lastTransaction: {
                  type: lastActivity.type,
                  quantity: lastActivity.quantity,
                  recipient: lastActivity.recipient,
                  date: lastActivity.date,
                  notes: lastActivity.notes,
                }
              }
            }
            return item
          })
        }
        
        setItems(filteredData as StockItem[])
        calculateLocationSummaries(data as StockItem[]) // Use all data for summaries
      } else {
        console.log("[v0] No store items found in database")
        setItems([])
        setLocationSummaries([])
      }
    } catch (err) {
      console.error("[v0] Exception fetching inventory:", err)
      setItems([])
      setLocationSummaries([])
    } finally {
      setLoading(false)
    }
  }

  const calculateLocationSummaries = (stockItems: StockItem[]) => {
    // First, get all unique locations from the actual data
    const uniqueLocationsInData = [...new Set(stockItems.map(item => item.location).filter(Boolean))]
    console.log("[v0] Unique locations in store_items data:", uniqueLocationsInData)
    
    // Get normalized unique locations
    const normalizedLocations = [...new Set(uniqueLocationsInData.map(normalizeLocationName))]
    
    // Use locations from data if user can see all, otherwise filter by user's location
    let locationsToShow: string[] = []
    
    if (user && !canSeeAllLocations(user) && user.location) {
      // For restricted users, show only their location and Central Stores
      locationsToShow = normalizedLocations.filter(loc => 
        loc.toLowerCase() === user.location?.toLowerCase() ||
        normalizeLocationName(user.location).toLowerCase() === loc.toLowerCase() ||
        loc.toLowerCase() === "central stores" ||
        loc.toLowerCase().includes("central")
      )
    } else {
      // For admins/IT heads, show all unique locations from the data
      locationsToShow = normalizedLocations.length > 0 ? normalizedLocations : locationValues
    }

    const summaries = locationsToShow.map((location) => {
      // Case-insensitive location matching with Head Office normalization
      const locationItems = stockItems.filter((item) => 
        normalizeLocationName(item.location)?.toLowerCase() === location?.toLowerCase()
      )

      const totalItems = locationItems.reduce((sum, item) => sum + (item.quantity || 0), 0)
      const lowStock = locationItems.filter((item) => item.quantity <= item.reorder_level && item.quantity > 0).length
      const outOfStock = locationItems.filter((item) => item.quantity === 0).length

      return {
        location,
        totalItems,
        totalValue: 0, // Removed price-based calculation
        lowStock,
        outOfStock,
      }
    })

    // Sort by location name and filter out locations with no items if there are locations with items
    const sortedSummaries = summaries.sort((a, b) => a.location.localeCompare(b.location))
    
    setLocationSummaries(sortedSummaries)
  }

  useEffect(() => {
    if (!activeLocation && locationSummaries.length > 0) {
      setActiveLocation(locationSummaries[0].location)
    }
  }, [locationSummaries, activeLocation])

  const overviewStats = useMemo(() => {
    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0)
    const lowStockCount = items.filter((item) => item.quantity <= item.reorder_level && item.quantity > 0).length
    const outOfStockCount = items.filter((item) => item.quantity === 0).length

    return {
      totalQuantity,
      totalSkus: items.length,
      lowStockCount,
      outOfStockCount,
      locationsCovered: locationSummaries.length,
    }
  }, [items, locationSummaries])

  const activeLocationItems = useMemo(() => {
    const currentLocation = activeLocation || locationSummaries[0]?.location
    if (!currentLocation) return []

    return items
      .filter((item) => normalizeLocationName(item.location)?.toLowerCase() === currentLocation.toLowerCase())
      .sort((a, b) => {
        if (a.quantity === 0 && b.quantity !== 0) return -1
        if (b.quantity === 0 && a.quantity !== 0) return 1
        if (a.quantity <= a.reorder_level && b.quantity > b.reorder_level) return -1
        if (b.quantity <= b.reorder_level && a.quantity > a.reorder_level) return 1
        return a.name.localeCompare(b.name)
      })
  }, [items, activeLocation, locationSummaries])

  const exportAllStock = () => {
    const data = {
      title: "All Locations Stock Summary",
      fileName: "all-locations-stock",
      headers: ["Location", "Item Name", "Category", "SKU", "Quantity", "Reorder Level", "Unit", "Supplier"],
      rows: items.map((item) => [
        item.location,
        item.name,
        item.category,
        item.sku,
        item.quantity,
        item.reorder_level,
        item.unit,
        item.supplier || "-",
      ]),
    }
    downloadCSV(data)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading inventory data...</div>
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Package className="h-16 w-16 text-muted-foreground" />
        <p className="text-muted-foreground text-lg">No Inventory Items Found</p>
        <p className="text-sm text-muted-foreground">
          {user && !canSeeAllLocations(user)
            ? `There are no inventory items to display for your location.`
            : `Add items to the store inventory to see them here`}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-emerald-50/40 dark:from-slate-950 dark:to-slate-900">
        <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
              <MapPin className="h-4 w-4" />
              {user && !canSeeAllLocations(user) && user.location
                ? `Viewing ${user.location} and Central Stores`
                : "All store locations overview"}
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {user && !canSeeAllLocations(user) && user.location ? "Store Overview" : "Modern Store Overview"}
              </h2>
              <p className="text-sm text-muted-foreground">
                A compact snapshot of stock health, key alerts, and location highlights.
              </p>
            </div>
          </div>
          <Button onClick={exportAllStock} className="self-start lg:self-auto">
            <Download className="mr-2 h-4 w-4" />
            Export All Stock
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total Units</p>
            <p className="mt-2 text-3xl font-bold">{overviewStats.totalQuantity}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Stock Lines</p>
            <p className="mt-2 text-3xl font-bold">{overviewStats.totalSkus}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-amber-200">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Low Stock</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">{overviewStats.lowStockCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-red-200">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Out of Stock</p>
            <p className="mt-2 text-3xl font-bold text-red-600">{overviewStats.outOfStockCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Location Snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {locationSummaries.map((summary) => (
              <button
                key={summary.location}
                type="button"
                onClick={() => setActiveLocation(summary.location)}
                className={`rounded-xl border p-4 text-left transition-all hover:shadow-sm ${activeLocation === summary.location ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-border bg-background"}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-semibold">{summary.location}</span>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Units</span>
                    <span className="font-semibold">{summary.totalItems}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Low</span>
                    <Badge variant={summary.lowStock > 0 ? "destructive" : "secondary"}>{summary.lowStock}</Badge>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>{activeLocation || "Selected Location"}</CardTitle>
            <p className="text-sm text-muted-foreground">Preview of the most important stock items for this location.</p>
          </div>
          {locationSummaries.length > 1 && (
            <Tabs value={activeLocation} onValueChange={setActiveLocation} className="w-full lg:w-auto">
              <TabsList className="h-auto flex-wrap justify-start">
                {locationSummaries.map((summary) => (
                  <TabsTrigger key={summary.location} value={summary.location}>
                    {summary.location}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>Showing {Math.min(activeLocationItems.length, 8)} of {activeLocationItems.length} items</span>
            <span>Click a card for details</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TooltipProvider>
              {activeLocationItems.slice(0, 8).map((item) => {
                const getStockRemark = () => {
                  if (item.quantity > 0 && item.quantity > item.reorder_level) return null
                  if (!item.lastTransaction) {
                    if (item.quantity === 0) return "Out of stock - No recent activity recorded"
                    return null
                  }
                  const { type, quantity, recipient, date, notes } = item.lastTransaction
                  const formattedDate = new Date(date).toLocaleDateString()

                  switch (type) {
                    case "assignment":
                      return `Assigned ${quantity} to ${recipient || "staff"} on ${formattedDate}${notes ? `. Note: ${notes}` : ""}`
                    case "requisition":
                    case "issue":
                      return `Issued ${quantity} to ${recipient || "location"} on ${formattedDate}${notes ? `. Note: ${notes}` : ""}`
                    case "transfer":
                      return `Transferred ${quantity} on ${formattedDate}${notes ? `. Note: ${notes}` : ""}`
                    default:
                      return `${type}: ${quantity} on ${formattedDate}${notes ? `. Note: ${notes}` : ""}`
                  }
                }

                const remark = getStockRemark()

                return (
                  <Card
                    key={item.id}
                    className={`cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md ${item.quantity === 0 ? "border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20" : item.quantity <= item.reorder_level ? "border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20" : ""}`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <CardContent className="p-5">
                      <div className="mb-3 flex items-start justify-between">
                        <Package className={`h-8 w-8 ${item.quantity === 0 ? "text-red-500" : "text-emerald-600"}`} />
                        <div className="flex items-center gap-1">
                          {item.quantity <= item.reorder_level && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                          {remark && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 cursor-help text-blue-500" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[300px]">
                                <p className="text-xs font-medium">Last Activity</p>
                                <p className="text-xs">{remark}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                      <h4 className="line-clamp-1 font-semibold">{item.name}</h4>
                      <p className="mb-3 text-sm text-muted-foreground">{item.category}</p>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className={`text-2xl font-bold ${item.quantity === 0 ? "text-red-600" : ""}`}>{item.quantity}</p>
                          <p className="text-xs text-muted-foreground">{item.unit}</p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          Reorder at
                          <div className="font-medium text-foreground">{item.reorder_level}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {selectedItem && (
        <StockCardDetailModal
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          item={{
            id: selectedItem.id,
            item_name: selectedItem.name,
            category: selectedItem.category,
            quantity_in_stock: selectedItem.quantity,
            reorder_level: selectedItem.reorder_level,
            unit_price: 0, // Removed price-based calculation
            location: selectedItem.location,
          }}
        />
      )}
    </div>
  )
}
