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
  unit: string
  quantity_issued: number
  previous_stock: number | null
  current_stock: number | null
  balance_estimated: boolean
  source_location: string | null
  destination: string | null
  issued_to: string | null
  requisition_number: string | null
  requisition_frequency: string | null
  requested_by: string | null
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

function formatDateTime(value: string) {
  const date = new Date(value)
  return `${date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })} ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
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

      return [record.item_name, record.requisition_number, record.issued_to, record.destination, record.issued_by]
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

      sheet.mergeCells("A1:L1")
      sheet.getCell("A1").value = "Detailed Stock Issued Report"
      sheet.getCell("A1").font = { bold: true, size: 14 }
      sheet.mergeCells("A2:L2")
      sheet.getCell("A2").value = `Period: ${periodLabel} | Generated: ${new Date().toLocaleString()} | Issuances: ${summary.issues} | Units issued: ${summary.totalUnits}`

      const header = sheet.addRow([
        "Date Issued",
        "Requisition No.",
        "Item",
        "Unit",
        "Previous Stock",
        "Quantity Issued",
        "Current Stock",
        "Balance Source",
        "Issued To",
        "Destination",
        "Frequency",
        "Issued By",
      ])
      header.font = { bold: true, color: { argb: "FFFFFFFF" } }
      header.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E3D" } }
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
      })

      for (const record of filtered) {
        sheet.addRow([
          formatDateTime(record.issued_at),
          record.requisition_number ?? "",
          record.item_name,
          record.unit,
          record.previous_stock ?? "",
          record.quantity_issued,
          record.current_stock ?? "",
          record.previous_stock === null ? "Not recorded" : record.balance_estimated ? "Reconstructed" : "Recorded",
          record.issued_to ?? "",
          record.destination ?? "",
          record.requisition_frequency ?? "",
          record.issued_by,
        ])
      }

      const widths = [20, 22, 30, 10, 15, 16, 15, 16, 26, 24, 14, 22]
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="px-4 py-3 font-semibold">Date issued</th>
                      <th className="px-4 py-3 font-semibold">Item</th>
                      <th className="px-4 py-3 font-semibold">Stock movement</th>
                      <th className="px-4 py-3 font-semibold">Issued to</th>
                      <th className="px-4 py-3 font-semibold">Issued by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((record) => (
                      <tr key={record.id} className="border-b last:border-0 align-top hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-3">
                          <p className="font-medium">{formatDateTime(record.issued_at)}</p>
                          {record.requisition_number && (
                            <p className="text-xs text-muted-foreground">{record.requisition_number}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{record.item_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {record.quantity_issued} {record.unit} issued
                          </p>
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
                        <td className="px-4 py-3">
                          <p className="font-medium">{record.issued_to || "N/A"}</p>
                          {record.destination && (
                            <Badge variant="outline" className="mt-1 font-normal">
                              {record.destination}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p>{record.issued_by}</p>
                          {record.requisition_frequency && (
                            <p className="text-xs capitalize text-muted-foreground">{record.requisition_frequency}</p>
                          )}
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
