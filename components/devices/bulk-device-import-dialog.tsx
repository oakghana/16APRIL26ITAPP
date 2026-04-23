"use client"

import type React from "react"
import { useCallback, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Download, FileDown, Loader2, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { toast } from "@/hooks/use-toast"

interface BulkDeviceImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportSuccess: () => void
}

interface ImportError {
  row: number
  field: string
  message: string
  value?: string
}

function isDuplicateError(error: ImportError) {
  const field = (error.field || "").toLowerCase()
  const message = (error.message || "").toLowerCase()
  return field === "serial_number" && (message.includes("duplicate") || message.includes("already exists"))
}

function getFixSteps(errors: ImportError[], skipDuplicates: boolean) {
  const duplicateCount = errors.filter(isDuplicateError).length
  const hasRowErrors = errors.length > duplicateCount

  const steps: string[] = [
    "Download the Template and keep the same header names.",
    "Check row numbers from the error list and correct only those rows.",
  ]

  if (duplicateCount > 0) {
    steps.push(
      skipDuplicates
        ? "Duplicate serials were skipped. If those devices are genuinely new, change serial_number values and re-upload."
        : "Duplicate serials blocked import. Either change serial_number values or enable Skip Duplicates."
    )
  }

  if (hasRowErrors) {
    steps.push("Fix invalid values in the listed field (for example date format, required column, or malformed value).")
  }

  steps.push("Re-upload the corrected file and confirm Imported/Skipped counts in the summary.")
  return steps
}

const ACCEPTED_FILE_EXTENSIONS = [".csv", ".txt", ".json", ".tsv"]

function hasAcceptedExtension(fileName: string) {
  const lower = fileName.toLowerCase()
  return ACCEPTED_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function BulkDeviceImportDialog({ open, onOpenChange, onImportSuccess }: BulkDeviceImportDialogProps) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [showInstructions, setShowInstructions] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState(0)
  const [validationErrors, setValidationErrors] = useState<ImportError[]>([])
  const [step, setStep] = useState<"upload" | "uploading" | "results">("upload")
  const [importResult, setImportResult] = useState<{
    success: boolean
    importedCount: number
    skippedCount?: number
    totalRows: number
    message: string
  } | null>(null)

  const resetState = () => {
    setSelectedFile(null)
    setLoading(false)
    setProgress(0)
    setValidationErrors([])
    setImportResult(null)
    setStep("upload")
  }

  const handleClose = () => {
    resetState()
    onOpenChange(false)
  }

  const pickFile = (file: File) => {
    if (!hasAcceptedExtension(file.name)) {
      toast({
        title: "Unsupported file type",
        description: "Upload CSV, TXT, JSON, or TSV file formats.",
        variant: "destructive",
      })
      return
    }

    setSelectedFile(file)
    setValidationErrors([])
    setImportResult(null)
    setStep("upload")
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) pickFile(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) pickFile(file)
  }

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch("/api/devices/bulk-import?action=template")
      const csv = await response.text()
      const blob = new Blob([csv], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "device-import-template.csv"
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast({ title: "Error", description: "Failed to download template", variant: "destructive" })
    }
  }

  const handleExportForReimport = async () => {
    if (!user?.location) return
    try {
      const response = await fetch(`/api/devices/bulk-import?action=export&location=${encodeURIComponent(user.location)}`)
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        toast({
          title: "Export failed",
          description: err.error || "Failed to export location devices",
          variant: "destructive",
        })
        return
      }

      const csv = await response.text()
      const blob = new Blob([csv], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `devices-${user.location.replace(/\s+/g, "_")}-${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      toast({ title: "Export complete", description: "Exported current location devices." })
    } catch {
      toast({ title: "Export failed", description: "Could not export devices", variant: "destructive" })
    }
  }

  const handleDownloadErrors = useCallback(() => {
    if (validationErrors.length === 0) return
    const csv = [
      ["Row", "Field", "Error", "Value"].join(","),
      ...validationErrors.map((e) => [e.row, e.field, `"${e.message}"`, `"${e.value || ""}"`].join(",")),
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "import-errors.csv"
    a.click()
    window.URL.revokeObjectURL(url)
  }, [validationErrors])

  const handleValidateOnly = async () => {
    if (!selectedFile || !user?.location) {
      toast({ title: "Error", description: "File and location are required", variant: "destructive" })
      return
    }

    setLoading(true)
    setStep("uploading")
    setProgress(20)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("userLocation", user.location)
      formData.append("userRole", user.role || "")
      formData.append("validateOnly", "true")

      setProgress(45)
      const response = await fetch("/api/devices/bulk-import", {
        method: "POST",
        body: formData,
      })

      setProgress(90)
      const result = await response.json()
      setProgress(100)

      if (!response.ok) {
        setValidationErrors(result.validationErrors || [])
        setImportResult({
          success: false,
          importedCount: 0,
          skippedCount: 0,
          totalRows: result.totalRows || 0,
          message: result.error || "Validation failed",
        })
        setStep("results")
        toast({ title: "Validation complete", description: result.error || "Please review the errors", variant: "default" })
        return
      }

      setValidationErrors(result.warnings || [])
      setImportResult({
        success: true,
        importedCount: result.validatedCount || 0,
        skippedCount: 0,
        totalRows: result.totalRows || 0,
        message: `Validation complete: ${result.validatedCount || 0} rows validated successfully`,
      })
      setStep("results")
      toast({ title: "Validation complete", description: result.message || "All rows validated successfully. Ready to import!", variant: "default" })
    } catch (error: any) {
      setStep("results")
      setImportResult({
        success: false,
        importedCount: 0,
        skippedCount: 0,
        totalRows: 0,
        message: error?.message || "Unexpected validation error",
      })
      toast({ title: "Validation error", description: error?.message || "Unexpected error", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!selectedFile || !user?.location) {
      toast({ title: "Error", description: "File and location are required", variant: "destructive" })
      return
    }

    setLoading(true)
    setStep("uploading")
    setProgress(20)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("userLocation", user.location)
      formData.append("userRole", user.role || "")
      formData.append("skipDuplicates", String(skipDuplicates))

      setProgress(45)
      const response = await fetch("/api/devices/bulk-import", {
        method: "POST",
        body: formData,
      })

      setProgress(90)
      const result = await response.json()
      setProgress(100)

      if (!response.ok) {
        setValidationErrors(result.validationErrors || [])
        setImportResult({
          success: false,
          importedCount: 0,
          skippedCount: 0,
          totalRows: result.totalRows || 0,
          message: result.error || "Import failed",
        })
        setStep("results")
        toast({ title: "Import failed", description: result.error || "Please review the errors", variant: "destructive" })
        return
      }

      setValidationErrors(result.warnings || [])
      setImportResult({
        success: true,
        importedCount: result.importedCount || 0,
        skippedCount: result.skippedCount || 0,
        totalRows: result.totalRows || 0,
        message: result.message || "Import completed",
      })
      setStep("results")
      toast({ title: "Import complete", description: result.message || "Devices imported successfully" })
      onImportSuccess()
    } catch (error: any) {
      setStep("results")
      setImportResult({
        success: false,
        importedCount: 0,
        skippedCount: 0,
        totalRows: 0,
        message: error?.message || "Unexpected import error",
      })
      toast({ title: "Import error", description: error?.message || "Unexpected error", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Bulk Import Devices</DialogTitle>
          <DialogDescription className="text-xs">
            Upload mixed-format files and import devices to {user?.location || "your location"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {(step === "upload" || step === "results") && (
            <>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all",
                  dragOver ? "border-orange-400 bg-orange-50" : "border-gray-300 bg-gray-50 hover:border-orange-300"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept=".csv,.txt,.json,.tsv" onChange={handleFileSelect} className="hidden" />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div className="min-w-0 text-left">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      className="ml-auto text-muted-foreground hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedFile(null)
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-8 w-8 text-gray-400 mb-1" />
                    <p className="text-sm font-medium text-gray-700">Drop file here or click to browse</p>
                    <p className="text-xs text-muted-foreground">Accepted: CSV, TXT, JSON, TSV</p>
                  </>
                )}
              </div>

              <button
                type="button"
                className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground py-1"
                onClick={() => setShowInstructions((p) => !p)}
              >
                {showInstructions ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Import rules and hints
                <span className="ml-auto">{showInstructions ? "Hide" : "Show"}</span>
              </button>

              {showInstructions && (
                <div className="rounded-lg bg-gray-50 p-3 text-xs text-muted-foreground space-y-1">
                  <p>All fields are optional. Missing values are auto-filled safely during import.</p>
                  <p>Supported file layouts: CSV, TXT delimited, JSON array/object, TSV.</p>
                  <p>Duplicate serial numbers are skipped when Skip Duplicates is enabled.</p>
                  <p className="pt-1 font-medium text-foreground">Before clicking Upload &amp; Import:</p>
                  <p>1. Download Template and paste your rows under the headers.</p>
                  <p>2. Ensure each serial_number is unique for new devices.</p>
                  <p>3. Keep date fields as YYYY-MM-DD.</p>
                  <p>4. Start with Skip Duplicates ON for first pass, then review skipped rows.</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs flex-1" onClick={handleDownloadTemplate}>
                  <Download className="h-3 w-3 mr-1" />Template
                </Button>
                <Button variant="outline" size="sm" className="text-xs flex-1" onClick={handleExportForReimport}>
                  <FileDown className="h-3 w-3 mr-1" />Export Current
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <div>
                  <Label htmlFor="skip-dups" className="text-xs font-medium">Skip Duplicates</Label>
                  <p className="text-xs text-muted-foreground">Existing serial numbers are skipped instead of blocking import.</p>
                </div>
                <Switch id="skip-dups" checked={skipDuplicates} onCheckedChange={setSkipDuplicates} />
              </div>

              {step === "results" && importResult && (
                <div className={cn("rounded-lg border p-3 text-sm", importResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
                  <p className={cn("font-medium", importResult.success ? "text-green-800" : "text-red-700")}>{importResult.message}</p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    Imported: {importResult.importedCount} · Skipped: {importResult.skippedCount || 0} · Rows: {importResult.totalRows}
                  </p>
                  {validationErrors.length > 0 && (
                    <div className="mt-3 rounded border border-border bg-background p-2">
                      <p className="text-xs font-semibold text-foreground mb-1">How to correct and re-upload</p>
                      {getFixSteps(validationErrors, skipDuplicates).map((step, idx) => (
                        <p key={`${idx}-${step}`} className="text-xs text-muted-foreground">
                          {idx + 1}. {step}
                        </p>
                      ))}
                    </div>
                  )}
                  {validationErrors.length > 0 && (
                    <div className="mt-3 rounded border border-border bg-background p-2 max-h-40 overflow-y-auto">
                      <p className="text-xs font-semibold text-foreground mb-1">Detected issues</p>
                      {validationErrors.slice(0, 12).map((issue, idx) => (
                        <p key={`${issue.row}-${issue.field}-${idx}`} className="text-xs text-muted-foreground">
                          Row {issue.row} · {issue.field}: {issue.message}{issue.value ? ` (${issue.value})` : ""}
                        </p>
                      ))}
                      {validationErrors.length > 12 && (
                        <p className="text-xs text-muted-foreground mt-1">+ {validationErrors.length - 12} more issues in the downloadable report.</p>
                      )}
                    </div>
                  )}
                  {validationErrors.length > 0 && (
                    <div className="mt-2">
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleDownloadErrors}>
                        <Download className="h-3 w-3 mr-1" />Download Details
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 flex-col sm:flex-row">
                <Button variant="outline" className="flex-1" onClick={handleClose}>Close</Button>
                <Button variant="outline" className="flex-1" disabled={!selectedFile || loading} onClick={handleValidateOnly}>
                  {loading ? "Validating..." : "Validate Only"}
                </Button>
                <Button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white" disabled={!selectedFile || loading} onClick={handleImport}>
                  {loading ? "Importing..." : "Upload & Import"}
                </Button>
              </div>
            </>
          )}

          {step === "uploading" && (
            <div className="py-8 flex flex-col items-center gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-orange-600" />
              <p className="text-sm font-medium">Importing file...</p>
              <Progress value={progress} className="w-full max-w-xs h-2" />
            </div>
          )}

          {!user?.location && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Your account has no location. Please contact admin before importing.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
