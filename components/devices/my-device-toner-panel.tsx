"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Monitor,
  Printer,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Droplets,
  Send,
  Info,
  Cpu,
  Package,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"

interface TonerStock {
  qty: number
  status: "out" | "low" | "ok"
}

interface MyDevice {
  id: string
  deviceType: string
  brand: string
  model: string
  serialNumber: string
  assetTag: string
  status: string
  location: string
  assignedTo: string
  isPrinter: boolean
  tonerType: string | null
  tonerModel: string | null
  tonerStock: TonerStock | null
  purchaseDate: string | null
  warrantyExpiry: string | null
}

const PRIORITY_OPTIONS = ["low", "medium", "high"] as const

export function MyDeviceTonerPanel() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [devices, setDevices] = useState<MyDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [requestOpen, setRequestOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<MyDevice | null>(null)
  const [requestNote, setRequestNote] = useState("")
  const [requestPriority, setRequestPriority] = useState<"low" | "medium" | "high">("medium")
  const [requestQty, setRequestQty] = useState("1")
  const [submitting, setSubmitting] = useState(false)

  const loadDevices = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        userId: user.id || "",
        userName: user.name || user.full_name || "",
        userEmail: user.email || "",
        userLocation: user.location || "",
      })
      const res = await fetch(`/api/devices/my-devices?${params}`)
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Failed to load devices")
      setDevices(result.devices || [])
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [user, toast])

  useEffect(() => {
    loadDevices()
  }, [loadDevices])

  const openRestockRequest = (device: MyDevice) => {
    setSelectedDevice(device)
    setRequestNote("")
    setRequestPriority("medium")
    setRequestQty("1")
    setRequestOpen(true)
  }

  const submitRestockRequest = async () => {
    if (!selectedDevice || !user) return
    setSubmitting(true)
    try {
      const tonerLabel = selectedDevice.tonerType || selectedDevice.tonerModel || "Unknown toner"
      const body = {
        title: `Toner Restock Request – ${tonerLabel} for ${selectedDevice.brand} ${selectedDevice.model}`,
        description: [
          `Device: ${selectedDevice.brand} ${selectedDevice.model} (S/N: ${selectedDevice.serialNumber || "N/A"})`,
          `Asset Tag: ${selectedDevice.assetTag || "N/A"}`,
          `Toner Type: ${tonerLabel}`,
          `Current Stock at ${selectedDevice.location}: ${selectedDevice.tonerStock?.qty ?? "Unknown"}`,
          `Quantity Requested: ${requestQty}`,
          requestNote ? `\nAdditional Notes:\n${requestNote}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        category: "printer",
        priority: requestPriority,
        location: user.location || selectedDevice.location,
        requested_by: user.id,
        requester_name: user.name || user.full_name || user.email,
        requester_email: user.email || "",
        requester_department: user.department || "",
      }

      const res = await fetch("/api/service-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Failed to submit request")

      toast({
        title: "Request Submitted",
        description: `Your restock request for ${tonerLabel} has been submitted. Ticket: ${result.ticket?.ticket_number || ""}`,
      })
      setRequestOpen(false)
      loadDevices()
    } catch (err: any) {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const tonerBadge = (stock: TonerStock | null) => {
    if (!stock) return null
    if (stock.status === "out")
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Out of Stock
        </Badge>
      )
    if (stock.status === "low")
      return (
        <Badge className="gap-1 bg-amber-500 text-white">
          <AlertTriangle className="h-3 w-3" /> Low Stock ({stock.qty})
        </Badge>
      )
    return (
      <Badge className="gap-1 bg-emerald-600 text-white">
        <CheckCircle2 className="h-3 w-3" /> In Stock ({stock.qty})
      </Badge>
    )
  }

  const deviceIcon = (type: string) => {
    const t = type.toLowerCase()
    if (t.includes("printer") || t.includes("copier") || t.includes("photocopier"))
      return <Printer className="h-5 w-5 text-blue-500" />
    if (t.includes("laptop") || t.includes("computer") || t.includes("desktop") || t.includes("pc"))
      return <Cpu className="h-5 w-5 text-purple-500" />
    return <Monitor className="h-5 w-5 text-slate-500" />
  }

  const printers = devices.filter((d) => d.isPrinter)
  const otherDevices = devices.filter((d) => !d.isPrinter)
  const urgentPrinters = printers.filter((d) => d.tonerStock && d.tonerStock.status !== "ok")

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
        <span className="text-muted-foreground">Loading your devices…</span>
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Monitor className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No devices assigned to you yet.</p>
          <p className="text-sm mt-1">Contact your IT team if you believe this is an error.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary banner */}
      {urgentPrinters.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
              {urgentPrinters.length} printer{urgentPrinters.length > 1 ? "s" : ""} need toner attention.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Use the <strong>Request Restock</strong> button on each printer to notify IT.
            </p>
          </div>
        </div>
      )}

      {/* Printers with toner info */}
      {printers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Printer className="h-4 w-4" /> Printers & Copiers
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {printers.map((device) => (
              <Card key={device.id} className="relative overflow-hidden">
                {device.tonerStock?.status === "out" && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
                )}
                {device.tonerStock?.status === "low" && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Printer className="h-5 w-5 text-blue-500 shrink-0" />
                      <div>
                        <CardTitle className="text-sm font-semibold leading-tight">
                          {device.brand} {device.model}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {device.deviceType} · {device.location}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={device.status === "active" ? "default" : "secondary"}
                      className="text-xs shrink-0"
                    >
                      {device.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Device info */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    {device.serialNumber && (
                      <p>
                        <span className="font-medium">S/N:</span> {device.serialNumber}
                      </p>
                    )}
                    {device.assetTag && (
                      <p>
                        <span className="font-medium">Asset Tag:</span> {device.assetTag}
                      </p>
                    )}
                    {device.warrantyExpiry && (
                      <p>
                        <span className="font-medium">Warranty:</span>{" "}
                        {new Date(device.warrantyExpiry) > new Date() ? (
                          <span className="text-emerald-600">{new Date(device.warrantyExpiry).toLocaleDateString()}</span>
                        ) : (
                          <span className="text-red-500">Expired {new Date(device.warrantyExpiry).toLocaleDateString()}</span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Toner section */}
                  <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <Droplets className="h-3.5 w-3.5 text-blue-500" />
                      Toner Information
                    </div>
                    {device.tonerType ? (
                      <>
                        <p className="text-xs">
                          <span className="text-muted-foreground font-medium">Type: </span>
                          {device.tonerType}
                        </p>
                        {device.tonerModel && device.tonerModel !== device.tonerType && (
                          <p className="text-xs">
                            <span className="text-muted-foreground font-medium">Model: </span>
                            {device.tonerModel}
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">Stock at {device.location}:</span>
                          {tonerBadge(device.tonerStock)}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground italic flex items-center gap-1">
                        <Info className="h-3 w-3" /> Toner type not mapped yet. Contact IT.
                      </p>
                    )}
                  </div>

                  {/* How to request guide */}
                  {device.tonerStock && device.tonerStock.status !== "ok" && (
                    <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-2 text-xs text-blue-800 dark:text-blue-300 space-y-1">
                      <p className="font-semibold flex items-center gap-1">
                        <Info className="h-3 w-3" /> How to request restock
                      </p>
                      <ol className="list-decimal list-inside space-y-0.5 pl-1">
                        <li>Click <strong>Request Restock</strong> below.</li>
                        <li>Confirm the toner type and enter the quantity.</li>
                        <li>Add any notes (e.g. urgency, room number).</li>
                        <li>Submit — IT will receive the request immediately.</li>
                      </ol>
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant={device.tonerStock?.status !== "ok" ? "default" : "outline"}
                    className={`w-full gap-1 ${device.tonerStock?.status === "out" ? "bg-red-600 hover:bg-red-700 text-white" : device.tonerStock?.status === "low" ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
                    onClick={() => openRestockRequest(device)}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Request Restock
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Other devices */}
      {otherDevices.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Monitor className="h-4 w-4" /> Other Assigned Devices
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {otherDevices.map((device) => (
              <Card key={device.id}>
                <CardContent className="pt-4 pb-4 space-y-2">
                  <div className="flex items-center gap-2">
                    {deviceIcon(device.deviceType)}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {device.brand} {device.model}
                      </p>
                      <p className="text-xs text-muted-foreground">{device.deviceType}</p>
                    </div>
                    <Badge variant={device.status === "active" ? "default" : "secondary"} className="ml-auto text-xs shrink-0">
                      {device.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {device.serialNumber && <p>S/N: {device.serialNumber}</p>}
                    {device.assetTag && <p>Asset Tag: {device.assetTag}</p>}
                    <p>Location: {device.location}</p>
                    {device.warrantyExpiry && (
                      <p>
                        Warranty:{" "}
                        {new Date(device.warrantyExpiry) > new Date() ? (
                          <span className="text-emerald-600">{new Date(device.warrantyExpiry).toLocaleDateString()}</span>
                        ) : (
                          <span className="text-red-500">Expired</span>
                        )}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* How to request guide – general */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10">
        <CardContent className="py-4 space-y-2">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
            <Package className="h-4 w-4" /> How to Request a Toner Restock
          </p>
          <ol className="text-xs text-blue-700 dark:text-blue-400 list-decimal list-inside space-y-1 pl-1">
            <li>Find your printer in the <strong>Printers & Copiers</strong> section above.</li>
            <li>Click the <strong>Request Restock</strong> button on that printer's card.</li>
            <li>Review the auto-filled toner details and enter the quantity you need.</li>
            <li>Add any extra notes (urgency, room number, etc.) then submit.</li>
            <li>Your IT team will be notified and will process the request promptly.</li>
          </ol>
          <p className="text-xs text-blue-600 dark:text-blue-500 mt-2">
            For urgent printer issues, please also call or message IT support directly.
          </p>
        </CardContent>
      </Card>

      {/* Restock Request Dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Request Toner Restock
            </DialogTitle>
          </DialogHeader>

          {selectedDevice && (
            <div className="space-y-4">
              {/* Device summary */}
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                <p>
                  <span className="font-medium">Device:</span> {selectedDevice.brand} {selectedDevice.model}
                </p>
                <p>
                  <span className="font-medium">Toner Type:</span>{" "}
                  {selectedDevice.tonerType || "Not mapped"}
                </p>
                <p>
                  <span className="font-medium">Current Stock:</span>{" "}
                  {selectedDevice.tonerStock ? (
                    <span
                      className={
                        selectedDevice.tonerStock.status === "out"
                          ? "text-red-600 font-semibold"
                          : selectedDevice.tonerStock.status === "low"
                          ? "text-amber-600 font-semibold"
                          : "text-emerald-600"
                      }
                    >
                      {selectedDevice.tonerStock.qty} unit{selectedDevice.tonerStock.qty !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    "Unknown"
                  )}
                </p>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <Label htmlFor="req-qty">Quantity Needed</Label>
                <input
                  id="req-qty"
                  type="number"
                  min={1}
                  max={20}
                  value={requestQty}
                  onChange={(e) => setRequestQty(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={requestPriority} onValueChange={(v: any) => setRequestPriority(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="req-notes">Additional Notes (optional)</Label>
                <Textarea
                  id="req-notes"
                  placeholder="E.g. Printer is completely out, urgent for department meeting…"
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submitRestockRequest} disabled={submitting} className="gap-1">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refresh */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={loadDevices}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>
    </div>
  )
}
