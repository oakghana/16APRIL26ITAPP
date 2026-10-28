"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { ArrowRight, Boxes, Download, Loader2, PackageMinus, RefreshCw, Search, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataPagination } from "@/components/ui/data-pagination"
import { useToast } from "@/hooks/use-toast"

interface IssueRecord {
  id: string
  issued_at: string
  item_id: string | null
  item_name: string
  category: string | null
  sku: string | null
  unit: string
  quantity_issued: number
  unit_price: number | null
  total_value: number | null
  previous_stock: number | null
  current_stock: number | null
  balance_estimated: boolean
  source_location: string | null
  destination: string | null
  issued_to: string | null
  office_location: string | null
  room_number: string | null
  department: string | null
  requisition_number: string | null
  requisition_frequency: string | null
  requisition_date: string | null
  requested_by: string | null
  approved_by: string | null
  issued_by: string
  notes: string | null
}

type PeriodValue = "all" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom"

const PERIOD_OPTIONS: { value: PeriodValue; label: string; days?: number }[] = [
  { value: "all", label: "All time" },
  { value: "weekly", label: "Weekly (last 7 days)", days: 7 },
  { value: "monthly", label: "Monthly (last 30 days)", days: 30 },
  { value: "quarterly", label: "Quarterly (last 90 days)", days: 90 },
  { value: "yearly", label: "Yearly (last 365 days)", days: 365 },
  { value: "custom", label: "Custom range" },
]

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || "Failed to load stock issue report")
  return payload.records as IssueRecord[]
}

function formatDate(value: string | null) {
  if (!value) return ""
  return new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
}

function formatTime(value: string | null) {
  if (!value) return ""
  return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
}

function formatMoney(value: number | null) {
  return value === null ? "" : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function recipientLocation(record: IssueRecord) {
  return [record.office_location, record.room_number ? `Room ${record.room_number}` : null].filter(Boolean).join(", ")
}

function StockMovement({ previous, current, issued }: { previous: number | null; current: number | null; issued: number }) {
  if (previous === null || current === null) {
    return <span className="text-xs text-muted-foreground">Balance not recorded</span>
  }
  const remainingShare = previous > 0 ? Math.max(0, Math.min(100, (current / previous) * 100)) : 0
  return (
    <div className="flex min-w-[220px] flex-col gap-1.5">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold tabular-nums">{previous}</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="font-semibold tabular-nums text-primary">{current}</span>
        <span className="text-xs font-medium text-destructive tabular-nums">(-{issued})</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-destructive/20"
        role="img"
        aria-label={`${current} of ${previous} remaining after issuing ${issued}`}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${remainingShare}%` }} />
      </div>
    </div>
  )
}

export function StockIssueReport() {
  const { toast } = useToast()
  const { data, error, isLoading, isValidating, mutate } = useSWR("/api/store/stock-issue-report", fetcher, {
    revalidateOnFocus: false,
  })

  const [search, setSearch] = useState("")
  const [period, setPeriod] = useState<PeriodValue>("monthly")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [itemFilter, setItemFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [exporting, setExporting] = useState(false)

  const records = data ?? []

  const itemOptions = useMemo(
    () => Array.from(new Set(records.map((record) => record.item_name))).sort((a, b) => a.localeCompare(b)),
    [records],
  )

  const filtered = useMemo(() => {
    const selected = PERIOD_OPTIONS.find((option) => option.value === period)
    const now = Date.now()
    const term = search.trim().toLowerCase()

    return records.filter((record) => {
      const issuedAt = new Date(record.issued_at).getTime()

      if (selected?.days && issuedAt < now - selected.days * 24 * 60 * 60 * 1000) return false
      if (period === "custom") {
        if (fromDate && issuedAt < new Date(`${fromDate}T00:00:00`).getTime()) return false
        if (toDate && issuedAt > new Date(`${toDate}T23:59:59`).getTime()) return false
      }
      if (itemFilter !== "all" && record.item_name !== itemFilter) return false
      if (!term) return true

      return [
        record.item_name,
        record.requisition_number,
        record.issued_to,
        record.destination,
        record.department,
        record.office_location,
        record.requested_by,
        record.issued_by,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })
  }, [records, period, fromDate, toDate, itemFilter, search])

  const summary = useMemo(() => {
    const totalUnits = filtered.reduce((sum, record) => sum + record.quantity_issued, 0)
    const items = new Set(filtered.map((record) => record.item_name)).size
    const recipients = new Set(filtered.map((record) => record.issued_to || record.destination).filter(Boolean)).size
    return { totalUnits, items, recipients, issues: filtered.length }
  }, [filtered])

  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize)

  const resetPage = () => setPage(1)

  const exportReport = async () => {
    if (filtered.length === 0) {
      toast({ title: "Nothing to export", description: "No issuances match the current filters.", variant: "destructive" })
      return
    }

    setExporting(true)
    try {
      const ExcelJS = (await import("exceljs")).default
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet("Stock Issued")
      const periodLabel = PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "All time"

      sheet.mergeCells("A1:V1")
      sheet.getCell("A1").value = "Detailed Stock Issued Report"
      sheet.getCell("A1").font = { bold: true, size: 14 }
      sheet.mergeCells("A2:V2")
      sheet.getCell("A2").value = `Period: ${periodLabel} | Generated: ${new Date().toLocaleString()} | Issuances: ${summary.issues} | Units issued: ${summary.totalUnits}`

      const header = sheet.addRow([
        "Date Issued",
        "Time Issued",
        "Requisition No.",
        "Requisition Date",
        "Frequency",
        "Item",
        "Category",
        "SKU",
        "Unit",
        "Quantity Issued",
        "Previous Stock",
        "Current Stock",
        "Balance Source",
        "Unit Price",
        "Total Value",
        "Issued To",
        "Office Location",
        "Room Number",
        "Department / Destination",
        "Requested By",
        "Approved By",
        "Issued By",
      ])
      header.font = { bold: true, color: { argb: "FFFFFFFF" } }
      header.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E3D" } }
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
      })

      for (const record of filtered) {
        sheet.addRow([
          formatDate(record.issued_at),
          formatTime(record.issued_at),
          record.requisition_number ?? "",
          formatDate(record.requisition_date),
          record.requisition_frequency ?? "",
          record.item_name,
          record.category ?? "",
          record.sku ?? "",
          record.unit,
          record.quantity_issued,
          record.previous_stock ?? "",
          record.current_stock ?? "",
          record.previous_stock === null ? "Not recorded" : record.balance_estimated ? "Reconstructed" : "Recorded",
          record.unit_price ?? "",
          record.total_value ?? "",
          record.issued_to ?? "",
          record.office_location ?? "",
          record.room_number ?? "",
          record.department || record.destination || "",
          record.requested_by ?? "",
          record.approved_by ?? "",
          record.issued_by,
        ])
      }

      const widths = [14, 11, 22, 15, 13, 30, 18, 16, 9, 16, 15, 15, 16, 12, 14, 28, 24, 14, 24, 24, 22, 22]
      widths.forEach((width, index) => {
        sheet.getColumn(index + 1).width = width
      })
      sheet.views = [{ state: "frozen", ySplit: 3 }]

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `stock-issued-report-${period}-${new Date().toISOString().slice(0, 10)}.xlsx`
      link.click()
      URL.revokeObjectURL(url)

      toast({ title: "Report exported", description: `${filtered.length} issuance record(s) exported to Excel.` })
    } catch (exportError: any) {
      toast({ title: "Export failed", description: exportError?.message || "Could not create the Excel file.", variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  const summaryCards = [
    { label: "Issuances", value: summary.issues, icon: PackageMinus },
    { label: "Units issued", value: summary.totalUnits, icon: Boxes },
    { label: "Distinct items", value: summary.items, icon: Boxes },
    { label: "Recipients / locations", value: summary.recipients, icon: Users },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
              </div>
              <div className="rounded-md bg-muted p-2">
                <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Stock Issued Report</CardTitle>
              <CardDescription>
                Every issuance by the store head, with the stock level before and after each issue.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isValidating}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isValidating ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={exportReport} disabled={exporting || isLoading}>
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Export Excel
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label="Search issuances"
                placeholder="Search item, requisition, recipient..."
                className="pl-9"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  resetPage()
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Duration</Label>
              <Select
                value={period}
                onValueChange={(value) => {
                  setPeriod(value as PeriodValue)
                  resetPage()
                }}
              >
                <SelectTrigger className="w-[210px]" aria-label="Report duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {period === "custom" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="issue-from" className="text-xs text-muted-foreground">From</Label>
                  <Input
                    id="issue-from"
                    type="date"
                    value={fromDate}
                    onChange={(event) => {
                      setFromDate(event.target.value)
                      resetPage()
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="issue-to" className="text-xs text-muted-foreground">To</Label>
                  <Input
                    id="issue-to"
                    type="date"
                    value={toDate}
                    onChange={(event) => {
                      setToDate(event.target.value)
                      resetPage()
                    }}
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Item</Label>
              <Select
                value={itemFilter}
                onValueChange={(value) => {
                  setItemFilter(value)
                  resetPage()
                }}
              >
                <SelectTrigger className="w-[200px]" aria-label="Filter by item">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All items</SelectItem>
                  {itemOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading stock issue report...
            </div>
          ) : error ? (
            <div className="py-12 text-center text-destructive">{error.message}</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No issuances found for the selected filters.</div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="px-4 py-3 font-semibold">Date issued</th>
                      <th className="px-4 py-3 font-semibold">Issued to</th>
                      <th className="px-4 py-3 font-semibold">Item</th>
                      <th className="px-4 py-3 text-right font-semibold">Quantity</th>
                      <th className="px-4 py-3 font-semibold">Stock movement</th>
                      <th className="px-4 py-3 font-semibold">Requisition</th>
                      <th className="px-4 py-3 font-semibold">Department</th>
                      <th className="px-4 py-3 font-semibold">Requested / approved / issued by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((record) => (
                      <tr key={record.id} className="border-b last:border-0 align-top hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-3">
                          <p className="font-semibold">{formatDate(record.issued_at)}</p>
                          <p className="text-xs text-muted-foreground">{formatTime(record.issued_at)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{record.issued_to || "Not recorded"}</p>
                          {recipientLocation(record) && (
                            <p className="text-xs text-muted-foreground">{recipientLocation(record)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{record.item_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[record.category, record.sku].filter(Boolean).join(" | ")}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <p className="text-lg font-semibold tabular-nums">{record.quantity_issued}</p>
                          <p className="text-xs text-muted-foreground">{record.unit}</p>
                          {record.total_value !== null && (
                            <p className="text-xs text-muted-foreground tabular-nums">{formatMoney(record.total_value)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StockMovement
                            previous={record.previous_stock}
                            current={record.current_stock}
                            issued={record.quantity_issued}
                          />
                          {record.balance_estimated && record.previous_stock !== null && (
                            <p className="mt-1 text-[11px] text-muted-foreground">Reconstructed from history</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <p className="font-medium">{record.requisition_number || "N/A"}</p>
                          {record.requisition_date && (
                            <p className="text-xs text-muted-foreground">Requested {formatDate(record.requisition_date)}</p>
                          )}
                          {record.requisition_frequency && (
                            <p className="text-xs capitalize text-muted-foreground">{record.requisition_frequency}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {record.department || record.destination ? (
                            <Badge variant="outline" className="font-normal">
                              {record.department || record.destination}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <p>
                            <span className="text-muted-foreground">Requested: </span>
                            {record.requested_by || "N/A"}
                          </p>
                          {record.approved_by && (
                            <p>
                              <span className="text-muted-foreground">Approved: </span>
                              {record.approved_by}
                            </p>
                          )}
                          <p>
                            <span className="text-muted-foreground">Issued: </span>
                            {record.issued_by}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <DataPagination
                currentPage={page}
                totalItems={filtered.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
                pageSizeOptions={[10, 20, 50, 100]}
                itemLabel="issuances"
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
