"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Calendar, FileText, Filter, Package, Send, CheckCircle, XCircle, AlertCircle, Loader2, MoreVertical, Edit, Trash2, Merge } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { FormNavigation } from "@/components/ui/form-navigation"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { CentralStoresActivityLog } from "@/components/dashboard/CentralStoresActivityLog"
import { ItemManagementModal } from "@/components/store/item-management-modal"
import { safeJsonParse, safeStorage } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface StockBalanceItem {
  id?: string
  code: string
  itemName: string
  category: string
  unitOfMeasure: string
  openingBalance: number
  receipts: number
  issues: number
  closingBalance: number
  location: string
  remarks: string
  localStock?: number // User's location stock for this item
}

export default function StoreSummaryReportPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<StockBalanceItem[]>([])
  const [selectedLocation, setSelectedLocation] = useState("all")
  const [selectedDeviceType, setSelectedDeviceType] = useState("all")
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(1) // First day of current month
    return date.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0]
  })
  const [locations, setLocations] = useState<string[]>([])
  const [deviceTypes, setDeviceTypes] = useState<any[]>([])
  
  // Stock request dialog state
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StockBalanceItem | null>(null)
  const [requestQuantity, setRequestQuantity] = useState("")
  const [requestNotes, setRequestNotes] = useState("")
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestError, setRequestError] = useState("")
  const [requestSuccess, setRequestSuccess] = useState("")
  
  // User's local stock cache
  const [localStockMap, setLocalStockMap] = useState<Record<string, number>>({})

  // Admin item management state
  const [itemManagementOpen, setItemManagementOpen] = useState(false)
  const [selectedItemForManagement, setSelectedItemForManagement] = useState<any>(null)
  const [duplicateItems, setDuplicateItems] = useState<any[]>([])
  const [itemManagementTab, setItemManagementTab] = useState<"edit" | "merge" | "delete">("edit")

  // Check if user is admin or can manage stock
  const isAdmin = user?.role === "admin"
  const isITStoreHead = user?.role === "it_store_head"
  const isITHead = user?.role === "it_head"
  const canManageItems = isAdmin || isITStoreHead || isITHead

  // Check if user is regional_it_head or it_store_head viewing Central Stores
  const isRegionalHead = user?.role === "regional_it_head"
  const viewingCentralStores = selectedLocation === "Central Stores"
  // ONLY IT Store Head can request stock transfers from Central Stores to Head Office
  const canRequestStock = isITStoreHead && viewingCentralStores

  // Load user's local stock when viewing Central Stores as it_store_head
  useEffect(() => {
    if (isITStoreHead && viewingCentralStores && user?.location) {
      loadLocalStock()
    }
  }, [isITStoreHead, viewingCentralStores, user?.location])

  async function loadLocalStock() {
    if (!user?.location) return
    try {
      const response = await fetch(`/api/store/items?location=${encodeURIComponent(user.location)}&canSeeAll=false`)
      if (response.ok) {
        const { items } = await response.json()
        const stockMap: Record<string, number> = {}
        items?.forEach((item: any) => {
          stockMap[item.name?.toLowerCase() || ""] = item.quantity || 0
        })
        setLocalStockMap(stockMap)
        console.log("[v0] Local stock map loaded:", Object.keys(stockMap).length, "items")
      }
    } catch (error) {
      console.error("[v0] Error loading local stock:", error)
    }
  }

  // Get local stock for an item (check if user's location has zero stock)
  function getLocalStockForItem(itemName: string): number {
    return localStockMap[itemName?.toLowerCase() || ""] || 0
  }

  // Items with the same name but a different SKU — the obvious merge candidates
  function findDuplicateItems(itemName: string, currentId?: string): any[] {
    return report
      .filter((item) => 
        item.itemName?.toLowerCase() === itemName?.toLowerCase() && 
        (!currentId || item.id !== currentId)
      )
      .map((item) => ({
        id: item.id,
        name: item.itemName,
        sku: item.code,
        quantity: item.closingBalance || 0,
        category: item.category,
        location: item.location,
      }))
  }

  // Every other item in the report can be a merge target, not just exact-name duplicates
  function getMergeCandidates(currentId?: string): any[] {
    return report
      .filter((item) => item.id && item.id !== currentId)
      .map((item) => ({
        id: item.id,
        name: item.itemName,
        sku: item.code,
        quantity: item.closingBalance || 0,
        category: item.category,
        location: item.location,
      }))
  }

  // Open item management modal for admin actions
  function openItemManagement(item: StockBalanceItem, tab: "edit" | "merge" | "delete" = "edit") {
    setSelectedItemForManagement({
      id: item.id,
      name: item.itemName,
      sku: item.code,
      quantity: item.closingBalance || 0,
      category: item.category,
      location: item.location,
    })
    setDuplicateItems(getMergeCandidates(item.id))
    setItemManagementTab(tab)
    setItemManagementOpen(true)
  }

  function handleManagementSuccess() {
    // Reload report data
    loadReport()
    setItemManagementOpen(false)
  }

  // Open request dialog for an item
  function openRequestDialog(item: StockBalanceItem) {
    if (item.closingBalance <= 0) {
      alert(`No stock available for "${item.itemName}" at Central Stores.`)
      return
    }
    setSelectedItem(item)
    setRequestQuantity("")
    setRequestNotes("")
    setRequestError("")
    setRequestSuccess("")
    setRequestDialogOpen(true)
  }

  // Submit stock transfer request
  async function handleSubmitRequest() {
    if (!selectedItem || !requestQuantity) {
      setRequestError("Please enter a quantity")
      return
    }

    const qty = parseInt(requestQuantity)
    if (isNaN(qty) || qty <= 0) {
      setRequestError("Please enter a valid quantity")
      return
    }

    if (qty > selectedItem.closingBalance) {
      setRequestError(`Requested quantity (${qty}) exceeds available stock (${selectedItem.closingBalance})`)
      return
    }

    setRequestLoading(true)
    setRequestError("")

    try {
      // IT Store Head requests go to Head Office, Regional IT Head requests go to their location
      const targetLocation = isITStoreHead ? "Head Office" : user?.location
      
      const response = await fetch("/api/store/stock-transfer-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedItem.id,
          itemName: selectedItem.itemName,
          itemCode: selectedItem.code,
          requestedQuantity: qty,
          requestedBy: user?.full_name || user?.name || "Unknown",
          requestingLocation: targetLocation,
          userRole: user?.role,
          notes: requestNotes,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setRequestError(result.error || "Failed to submit request")
        return
      }

      setRequestSuccess(`Request ${result.request?.request_number} submitted successfully! Awaiting approval from Admin.`)
      setTimeout(() => {
        setRequestDialogOpen(false)
        setRequestSuccess("")
      }, 3000)
    } catch (error) {
      console.error("[v0] Error submitting request:", error)
      setRequestError("Failed to submit request. Please try again.")
    } finally {
      setRequestLoading(false)
    }
  }

  useEffect(() => {
    async function fetchFilters() {
      try {
        console.log("[v0] Fetching filter options...")

        // Fetch locations
        const locResponse = await fetch("/api/admin/lookup-data?type=locations")
        const locData = await locResponse.json()
        console.log("[v0] Locations response:", locData)

        // API returns array directly, not wrapped in object
        if (Array.isArray(locData)) {
          setLocations(locData.map((loc: any) => loc.name))
        }

        // Fetch device types
        const typeResponse = await fetch("/api/admin/lookup-data?type=device_types")
        const typeData = await typeResponse.json()
        console.log("[v0] Device types response:", typeData)

        // API returns array directly, not wrapped in object
        if (Array.isArray(typeData)) {
          setDeviceTypes(typeData)
        }
      } catch (error) {
        console.error("[v0] Error loading filter options:", error)
      }
    }
    fetchFilters()
  }, [])

  useEffect(() => {
    loadReport()
  }, [selectedLocation, selectedDeviceType, startDate, endDate])

  async function loadReport() {
    try {
      setLoading(true)
      console.log("[v0] Loading stock balance report with filters:", {
        location: selectedLocation,
        deviceType: selectedDeviceType,
        startDate,
        endDate,
      })

      const params = new URLSearchParams({
        location: selectedLocation,
        deviceType: selectedDeviceType,
        startDate,
        endDate,
      })

      // Get current user from localStorage for authentication
      const currentUser = safeStorage.get("qcc_current_user")
      const parsedUser = safeJsonParse<any>(currentUser, null)
      const username = parsedUser?.username || ""

      const response = await fetch(`/api/store/stock-balance-report?${params}`, {
        headers: {
          "x-username": username,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("[v0] Error loading stock balance report:", errorData)
        setReport([])
        return
      }

      const { report: data } = await response.json()
      console.log("[v0] Stock balance report loaded, items:", data?.length || 0)
      setReport(data || [])
    } catch (error) {
      console.error("[v0] Error loading stock balance report:", error)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    const locationName = selectedLocation === "all" ? "ALL LOCATIONS" : selectedLocation.toUpperCase()
    const deviceTypeName =
      selectedDeviceType === "all"
        ? "ALL ITEMS"
        : deviceTypes.find((dt) => dt.code === selectedDeviceType)?.name.toUpperCase() || ""
    const periodEnd = new Date(endDate).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })

    const title = `${locationName}\nSTOCK BALANCE AS AT ${periodEnd.toUpperCase()}\n${deviceTypeName}`

    const headers = [
      "S/N",
      "CODE",
      "STOCK ITEM",
      "CATEGORY",
      "UNIT OF MEAS.",
      "OPENING BALANCE",
      "RECEIPT",
      "ISSUES",
      "CLOSING BALANCE",
      "REMARKS",
    ]

    const rows = report.map((item, index) => [
      (index + 1).toString(),
      item.code,
      item.itemName,
      item.category || "IT Accessories",
      item.unitOfMeasure,
      item.openingBalance.toString(),
      item.receipts.toString(),
      item.issues.toString(),
      item.closingBalance.toString(),
      item.remarks || "",
    ])

    const csv = [title.split("\n"), [], headers, ...rows].map((row) => row.join(",")).join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `stock-balance-${selectedLocation}-${selectedDeviceType}-${endDate}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const [pdfLoading, setPdfLoading] = useState(false)

  const exportToPDF = async () => {
    if (report.length === 0) {
      alert("No data to export")
      return
    }

    setPdfLoading(true)
    
    try {
      // Create PDF in landscape mode
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      })

      // Get location and period info
      const locationName = selectedLocation === "all" ? "ALL LOCATIONS" : selectedLocation.toUpperCase()
      const periodEnd = new Date(endDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })

      // Add header (logo + company name)
      try {
        // attempt to load logo from public folder
        const fetchRes = await fetch("/images/qcc-logo.png")
        if (fetchRes.ok) {
          const blob = await fetchRes.blob()
          const reader = new FileReader()
          const imgData: Promise<string> = new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          const dataUrl = await imgData
          // place logo at top-left of header
          doc.addImage(dataUrl, "PNG", 10, 6, 24, 24)
        }
      } catch (err) {
        // continue without logo if loading fails
        console.warn("Could not load logo for PDF header:", err)
      }

      doc.setFontSize(16)
      doc.setFont("helvetica", "bold")
      doc.text("QUALITY CONTROL COMPANY LIMITED", 148.5, 15, { align: "center" })

      doc.setFontSize(12)
      doc.text(locationName, 148.5, 23, { align: "center" })

      doc.setFontSize(11)
      doc.setFont("helvetica", "normal")
      doc.text(`STOCK BALANCE AS AT ${periodEnd.toUpperCase()}`, 148.5, 30, { align: "center" })

      // Prepare table data
      const tableHeaders = [
        "S/N",
        "CODE",
        "STOCK ITEM",
        "CATEGORY",
        "UNIT",
        "OPENING BAL.",
        "RECEIPT",
        "ISSUES",
        "CLOSING BAL.",
        "REMARKS",
      ]

      const tableData = report.map((item, index) => [
        (index + 1).toString(),
        item.code,
        item.itemName,
        item.category || "IT Accessories",
        item.unitOfMeasure,
        item.openingBalance.toString(),
        item.receipts.toString(),
        item.issues.toString(),
        item.closingBalance.toString(),
        item.remarks || "",
      ])

      // Add totals row
      tableData.push([
        "",
        "",
        "",
        "",
        "TOTALS:",
        report.reduce((sum, item) => sum + item.openingBalance, 0).toString(),
        report.reduce((sum, item) => sum + item.receipts, 0).toString(),
        report.reduce((sum, item) => sum + item.issues, 0).toString(),
        report.reduce((sum, item) => sum + item.closingBalance, 0).toString(),
        "",
      ])

      // Generate table
      autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
        startY: 38,
        theme: "grid",
        headStyles: {
          fillColor: [0, 0, 0],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 8,
          halign: "center",
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 2,
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 12 },
          1: { cellWidth: 22 },
          2: { cellWidth: 50 },
          3: { cellWidth: 30 },
          4: { halign: "center", cellWidth: 15 },
          5: { halign: "right", cellWidth: 25 },
          6: { halign: "right", cellWidth: 20 },
          7: { halign: "right", cellWidth: 20 },
          8: { halign: "right", cellWidth: 25 },
          9: { cellWidth: 40 },
        },
        didParseCell: (data) => {
          // Style totals row
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = "bold"
            data.cell.styles.fillColor = [240, 240, 240]
          }
        },
        margin: { left: 10, right: 10 },
      })

      // Add footer
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setFont("helvetica", "normal")
        doc.text(
          `Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`,
          148.5,
          200,
          { align: "center" }
        )
      }

      // Save the PDF - instant download
      const fileName = `Stock-Balance-${selectedLocation.replace(/\s+/g, "-")}-${endDate}.pdf`
      doc.save(fileName)
    } catch (error) {
      console.error("[v0] Error generating PDF:", error)
      alert("Error generating PDF. Please try again.")
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <FormNavigation currentPage="/dashboard/store-summary-report" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-stone-50 p-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Balance Report</h2>
          <p className="text-muted-foreground">Stock movement tracking with opening and closing balances</p>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={exportToPDF} 
            variant="outline" 
            className="gap-2 bg-red-50 hover:bg-red-100 border-red-200"
            disabled={pdfLoading || report.length === 0}
          >
            {pdfLoading ? (
              <Loader2 className="h-4 w-4 text-red-600 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 text-red-600" />
            )}
            <span className="text-red-600">{pdfLoading ? "Generating..." : "Download PDF"}</span>
          </Button>
          <Button onClick={exportToCSV} className="bg-green-600 hover:bg-green-700 gap-2" disabled={report.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border-emerald-100 shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">From Date</Label>
              <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-modern" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">To Date</Label>
              <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-modern" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger id="location" className="input-modern">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="device-type">Device Type / Category</Label>
              <Select value={selectedDeviceType} onValueChange={setSelectedDeviceType}>
                <SelectTrigger id="device-type" className="input-modern">
                  <SelectValue placeholder="Select device type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {deviceTypes.map((type) => (
                    <SelectItem key={type.code} value={type.code}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                setStartDate(firstDay.toISOString().split("T")[0])
                setEndDate(now.toISOString().split("T")[0])
              }}
            >
              <Calendar className="h-3 w-3 mr-1" />
              This Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
                setStartDate(firstDay.toISOString().split("T")[0])
                setEndDate(lastDay.toISOString().split("T")[0])
              }}
            >
              <Calendar className="h-3 w-3 mr-1" />
              Last Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), 0, 1)
                setStartDate(firstDay.toISOString().split("T")[0])
                setEndDate(now.toISOString().split("T")[0])
              }}
            >
              <Calendar className="h-3 w-3 mr-1" />
              Year to Date
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card className="rounded-2xl border-emerald-100 shadow-sm bg-white">
          <CardContent className="p-8 text-center">
            <p>Loading stock balance report...</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="print:shadow-none rounded-2xl border-emerald-100 shadow-sm bg-white">
          <CardHeader className="print:text-center">
            <CardTitle className="print:text-2xl">
              {selectedLocation === "all" ? "ALL LOCATIONS" : selectedLocation.toUpperCase()}
            </CardTitle>
            <CardDescription className="print:text-lg print:text-black">
              STOCK BALANCE AS AT{" "}
              {new Date(endDate)
                .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                .toUpperCase()}
              <br />
              {selectedDeviceType === "all"
                ? "IT ACCESSORIES - ALL CATEGORIES"
                : deviceTypes.find((dt) => dt.code === selectedDeviceType)?.name.toUpperCase() || "IT ACCESSORIES"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full table-modern">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-2 text-left font-semibold">S/N</th>
                    <th className="border border-gray-300 p-2 text-left font-semibold">CODE</th>
                    <th className="border border-gray-300 p-2 text-left font-semibold">STOCK ITEM</th>
                    <th className="border border-gray-300 p-2 text-left font-semibold">CATEGORY</th>
                    <th className="border border-gray-300 p-2 text-left font-semibold">UNIT OF MEAS.</th>
                    <th className="border border-gray-300 p-2 text-right font-semibold">OPENING BALANCE</th>
                    <th className="border border-gray-300 p-2 text-right font-semibold">RECEIPT</th>
                    <th className="border border-gray-300 p-2 text-right font-semibold">ISSUES</th>
                    <th className="border border-gray-300 p-2 text-right font-semibold">CLOSING BALANCE</th>
                    <th className="border border-gray-300 p-2 text-left font-semibold print:hidden">REMARKS</th>
                    {canRequestStock && (
                      <th className="border border-gray-300 p-2 text-center font-semibold print:hidden bg-emerald-50">REQUEST</th>
                    )}
                    {canManageItems && (
                      <th className="border border-gray-300 p-2 text-center font-semibold print:hidden bg-emerald-50">MANAGE</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {report.length === 0 ? (
                    <tr>
                      <td colSpan={canRequestStock && canManageItems ? 12 : canRequestStock ? 11 : canManageItems ? 11 : 10} className="border border-gray-300 p-4 text-center text-muted-foreground">
                        No stock data available for the selected filters
                      </td>
                    </tr>
                  ) : (
                    report.map((item, index) => {
                      const canRequest = item.closingBalance > 0
                      const rowClickable = canRequestStock && canRequest
                      
                      return (
                        <tr 
                          key={item.code} 
                          className={`hover:bg-gray-50 ${rowClickable ? 'cursor-pointer hover:bg-emerald-50 transition-colors' : ''}`}
                          onClick={rowClickable ? () => openRequestDialog(item) : undefined}
                          title={rowClickable ? `Click to request "${item.itemName}" from Central Stores` : undefined}
                        >
                          <td className="border border-gray-300 p-2">{index + 1}</td>
                          <td className="border border-gray-300 p-2 font-medium">{item.code}</td>
                          <td className="border border-gray-300 p-2">
                            {item.itemName}
                            {rowClickable && (
                              <span className="ml-2 text-emerald-700 text-xs">(Click to request)</span>
                            )}
                          </td>
                          <td className="border border-gray-300 p-2 text-sm">{item.category || "Accessories"}</td>
                          <td className="border border-gray-300 p-2 text-center">{item.unitOfMeasure}</td>
                          <td className="border border-gray-300 p-2 text-right">{item.openingBalance}</td>
                          <td className="border border-gray-300 p-2 text-right">{item.receipts}</td>
                          <td className="border border-gray-300 p-2 text-right">{item.issues}</td>
                          <td className="border border-gray-300 p-2 text-right font-semibold">{item.closingBalance}</td>
                          <td className="border border-gray-300 p-2 text-sm print:hidden max-w-[200px]">
                            {item.issues > 0 ? (
                              <span className="text-red-600 text-xs">
                                -{item.issues} issued
                                {item.remarks && ` (${item.remarks})`}
                              </span>
                            ) : item.receipts > 0 ? (
                              <span className="text-green-600 text-xs">
                                +{item.receipts} received
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                {item.remarks || "No changes"}
                              </span>
                            )}
                          </td>
                          {canRequestStock && (
                            <td className="border border-gray-300 p-2 text-center print:hidden">
                              {canRequest ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-green-100 hover:bg-green-200 border-green-300 text-green-900"
                                  onClick={(e) => {
                                    e.stopPropagation() // Prevent double-trigger from row click
                                    openRequestDialog(item)
                                  }}
                                >
                                  <Send className="h-3 w-3 mr-1" />
                                  Request
                                </Button>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  No stock
                                </Badge>
                              )}
                            </td>
                          )}
                          {canManageItems && (
                            <td className="border border-gray-300 p-2 text-center print:hidden">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openItemManagement(item, "edit")}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit Item
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openItemManagement(item, "merge")}>
                                    <Merge className="h-4 w-4 mr-2" />
                                    {findDuplicateItems(item.itemName, item.id).length > 0
                                      ? "Merge Duplicate"
                                      : "Merge Into..."}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => openItemManagement(item, "delete")}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Item
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          )}
                        </tr>
                      )
                    })
                  )}
                </tbody>
                {report.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-100 font-bold">
                      <td colSpan={5} className="border border-gray-300 p-2 text-right">
                        TOTALS:
                      </td>
                      <td className="border border-gray-300 p-2 text-right">
                        {report.reduce((sum, item) => sum + item.openingBalance, 0)}
                      </td>
                      <td className="border border-gray-300 p-2 text-right">
                        {report.reduce((sum, item) => sum + item.receipts, 0)}
                      </td>
                      <td className="border border-gray-300 p-2 text-right">
                        {report.reduce((sum, item) => sum + item.issues, 0)}
                      </td>
                      <td className="border border-gray-300 p-2 text-right">
                        {report.reduce((sum, item) => sum + item.closingBalance, 0)}
                      </td>
                      <td className="border border-gray-300 p-2 print:hidden"></td>
                      {canRequestStock && <td className="border border-gray-300 p-2 print:hidden"></td>}
                      {canManageItems && <td className="border border-gray-300 p-2 print:hidden"></td>}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info box for Regional IT Heads and IT Store Heads */}
      {(isRegionalHead || isITStoreHead) && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Package className="h-5 w-5 text-emerald-800 mt-0.5" />
              <div>
                <p className="font-medium text-emerald-900">Stock Transfer Request</p>
                <p className="text-sm text-emerald-800">
                  {isITStoreHead 
                    ? "To request items from Central Stores to Head Office, select \"Central Stores\" in the Location filter above. You can only request items when Head Office stock is zero. Only Admin can approve these requests."
                    : `To request items from Central Stores, select "Central Stores" in the Location filter above. You can only request items when your local stock (${user?.location}) is zero.`
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock Request Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-emerald-800" />
              Request Stock from Central Stores
            </DialogTitle>
            <DialogDescription>
              Request items to be transferred to {isITStoreHead ? "Head Office" : `your location (${user?.location})`}.
              {isITStoreHead && " Only Admin can approve this request."}
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4">
              {/* Item Info */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Item:</span>
                    <p className="font-medium">{selectedItem.itemName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Code:</span>
                    <p className="font-medium">{selectedItem.code}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Available at Central:</span>
                    <p className="font-medium text-green-600">{selectedItem.closingBalance} {selectedItem.unitOfMeasure}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Your Location Stock:</span>
                    <p className="font-medium text-red-600">0 {selectedItem.unitOfMeasure}</p>
                  </div>
                </div>
              </div>

              {/* Request Quantity */}
              <div className="space-y-2">
                <Label htmlFor="request-qty">Quantity to Request *</Label>
                <Input
                  id="request-qty"
                  type="number"
                  min="1"
                  max={selectedItem.closingBalance}
                  value={requestQuantity}
                  onChange={(e) => setRequestQuantity(e.target.value)}
                  placeholder={`Max: ${selectedItem.closingBalance}`}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="request-notes">Notes (Optional)</Label>
                <Textarea
                  id="request-notes"
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="Reason for request..."
                  rows={2}
                />
              </div>

              {/* Error Message */}
              {requestError && (
                <div className="bg-red-50 text-red-700 px-3 py-2 rounded flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {requestError}
                </div>
              )}

              {/* Success Message */}
              {requestSuccess && (
                <div className="bg-green-50 text-green-700 px-3 py-2 rounded flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  {requestSuccess}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)} disabled={requestLoading}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitRequest} 
              disabled={requestLoading || !!requestSuccess}
              className="bg-green-100 hover:bg-green-200 text-green-900 border border-green-300"
            >
              {requestLoading ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Central Stores Activity Log */}
      {selectedLocation === "Central Stores" && (
        <CentralStoresActivityLog location={selectedLocation} limit={15} />
      )}

      {/* Item Management Modal for Admin Actions */}
      <ItemManagementModal
        item={selectedItemForManagement}
        duplicateItems={duplicateItems}
        isOpen={itemManagementOpen}
        initialTab={itemManagementTab}
        onClose={() => setItemManagementOpen(false)}
        onSuccess={handleManagementSuccess}
      />

      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 1cm;
          }
          body * {
            visibility: hidden;
          }
          .print\\:shadow-none,
          .print\\:shadow-none * {
            visibility: visible;
          }
          .print\\:shadow-none {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:text-center {
            text-align: center;
          }
          .print\\:text-2xl {
            font-size: 1.5rem;
          }
          .print\\:text-lg {
            font-size: 1.125rem;
          }
          .print\\:text-black {
            color: black !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  )
}
