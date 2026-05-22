"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PenLine, Trash2, Check, Upload, ImagePlus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface SignaturePadProps {
  onSave: (dataUrl: string) => void
  onClear?: () => void
  initialValue?: string
  className?: string
  height?: number
  disabled?: boolean
  signerLabel?: string
  roleLabel?: string
  allowUpload?: boolean
}

export function SignaturePad({
  onSave,
  onClear,
  initialValue,
  className,
  height = 160,
  disabled = false,
  signerLabel,
  roleLabel,
  allowUpload = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const [isDrawing, setIsDrawing] = useState(false)
  const [isEmpty, setIsEmpty] = useState(!initialValue)
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadProcessing, setUploadProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState("draw")

  const exportWithHologram = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const exportCanvas = document.createElement("canvas")
    exportCanvas.width = canvas.width
    exportCanvas.height = canvas.height
    const exportCtx = exportCanvas.getContext("2d")
    if (!exportCtx) return null

    exportCtx.clearRect(0, 0, exportCanvas.width, exportCanvas.height)
    exportCtx.drawImage(canvas, 0, 0)

    // Lightweight hologram-like overlay pattern to secure exported signature image.
    exportCtx.save()
    exportCtx.translate(exportCanvas.width / 2, exportCanvas.height / 2)
    exportCtx.rotate((-25 * Math.PI) / 180)
    exportCtx.textAlign = "center"
    exportCtx.textBaseline = "middle"
    exportCtx.font = "bold 28px sans-serif"
    exportCtx.fillStyle = "rgba(16, 185, 129, 0.11)"
    for (let y = -exportCanvas.height; y <= exportCanvas.height; y += 100) {
      for (let x = -exportCanvas.width; x <= exportCanvas.width; x += 280) {
        exportCtx.fillText("QCC IT APP HOLOGRAM", x, y)
      }
    }
    exportCtx.restore()

    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19)
    const signerText = signerLabel?.trim() ? signerLabel.trim() : "Authorized User"
    const roleText = roleLabel?.trim() ? roleLabel.trim() : "Digital Signature"

    exportCtx.fillStyle = "rgba(4, 120, 87, 0.9)"
    exportCtx.fillRect(exportCanvas.width - 274, exportCanvas.height - 58, 264, 48)
    exportCtx.strokeStyle = "rgba(16, 185, 129, 0.95)"
    exportCtx.lineWidth = 1
    exportCtx.strokeRect(exportCanvas.width - 274, exportCanvas.height - 58, 264, 48)

    exportCtx.fillStyle = "#e8fff8"
    exportCtx.font = "bold 11px sans-serif"
    exportCtx.fillText("QCC IT APP VERIFIED", exportCanvas.width - 142, exportCanvas.height - 40)
    exportCtx.font = "9px sans-serif"
    exportCtx.fillText(`${roleText} • ${signerText}`, exportCanvas.width - 142, exportCanvas.height - 27)
    exportCtx.fillText(timestamp, exportCanvas.width - 142, exportCanvas.height - 15)

    return exportCanvas.toDataURL("image/png")
  }, [roleLabel, signerLabel])

  // Load initial value
  useEffect(() => {
    if (initialValue && canvasRef.current) {
      const img = new Image()
      img.onload = () => {
        const ctx = canvasRef.current?.getContext("2d")
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
          ctx.drawImage(img, 0, 0)
          setIsEmpty(false)
        }
      }
      img.src = initialValue
    }
  }, [initialValue])

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ("touches" in e) {
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const startDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return
      const pos = getPos(e, canvas)
      setIsDrawing(true)
      setLastPos(pos)
      setIsEmpty(false)
    },
    [disabled]
  )

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || disabled) return
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas || !lastPos) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      const pos = getPos(e, canvas)
      ctx.beginPath()
      ctx.moveTo(lastPos.x, lastPos.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.strokeStyle = "#1a1a2e"
      ctx.lineWidth = 2.5
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.stroke()
      setLastPos(pos)
    },
    [isDrawing, lastPos, disabled]
  )

  const endDraw = useCallback(() => {
    if (!isDrawing) return
    setIsDrawing(false)
    setLastPos(null)
    // Auto-save after drawing
    const canvas = canvasRef.current
    if (canvas && !isEmpty) {
      const securedDataUrl = exportWithHologram()
      if (securedDataUrl) {
        onSave(securedDataUrl)
      }
    }
  }, [isDrawing, isEmpty, onSave, exportWithHologram])

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
    setUploadPreview(null)
    setActiveTab("draw")
    onClear?.()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file",
        description: "Please upload a PNG, JPG, or WEBP image.",
        variant: "destructive",
      })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 5 MB.",
        variant: "destructive",
      })
      return
    }

    setUploadProcessing(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const src = ev.target?.result as string
      const img = new Image()
      img.onload = () => {
        // Composite hologram stamp over the uploaded image
        const canvas = document.createElement("canvas")
        const maxW = 600
        const scale = img.width > maxW ? maxW / img.width : 1
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext("2d")!

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // Hologram watermark pattern
        ctx.save()
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate((-25 * Math.PI) / 180)
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.font = `bold ${Math.max(16, canvas.width / 20)}px sans-serif`
        ctx.fillStyle = "rgba(16, 185, 129, 0.11)"
        for (let y = -canvas.height; y <= canvas.height; y += 80) {
          for (let x = -canvas.width; x <= canvas.width; x += 260) {
            ctx.fillText("QCC IT APP HOLOGRAM", x, y)
          }
        }
        ctx.restore()

        // Verification stamp
        const stampW = Math.min(180, canvas.width * 0.42)
        const stampH = 38
        const stampX = canvas.width - stampW - 8
        const stampY = canvas.height - stampH - 8
        ctx.fillStyle = "#065f46"
        ctx.beginPath()
        ctx.roundRect(stampX, stampY, stampW, stampH, 6)
        ctx.fill()
        ctx.fillStyle = "#ffffff"
        ctx.font = `bold ${Math.max(8, stampW / 16)}px sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText("QCC IT APP VERIFIED", stampX + stampW / 2, stampY + 10)
        ctx.font = `${Math.max(7, stampW / 20)}px sans-serif`
        ctx.fillText(`${roleLabel} - ${signerLabel || ""}`, stampX + stampW / 2, stampY + 23)
        ctx.fillText(new Date().toLocaleString(), stampX + stampW / 2, stampY + 33)

        const result = canvas.toDataURL("image/png")
        setUploadPreview(result)
        setIsEmpty(false)
        setUploadProcessing(false)
      }
      img.onerror = () => {
        toast({
          title: "Invalid image",
          description: "Could not read the image file.",
          variant: "destructive",
        })
        setUploadProcessing(false)
      }
      img.src = src
    }
    reader.readAsDataURL(file)
    // Reset input so same file can be re-selected
    e.target.value = ""
  }

  const saveUploadedSignature = () => {
    if (uploadPreview) {
      onSave(uploadPreview)
    }
  }

  const saveSignature = () => {
    const canvas = canvasRef.current
    if (!canvas || isEmpty) return
    const securedDataUrl = exportWithHologram()
    if (securedDataUrl) {
      onSave(securedDataUrl)
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {allowUpload ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="draw" className="flex items-center gap-1.5">
              <PenLine className="h-4 w-4" /> Draw
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-1.5">
              <ImagePlus className="h-4 w-4" /> Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="draw" className="mt-3">
            <div className="relative rounded-md border-2 border-dashed border-orange-300 dark:border-orange-700 bg-white dark:bg-slate-950 overflow-hidden">
              <div className="pointer-events-none absolute inset-0 z-[1] bg-[repeating-linear-gradient(-25deg,rgba(16,185,129,0.06)_0px,rgba(16,185,129,0.06)_2px,transparent_2px,transparent_34px)]" />
              <canvas
                ref={canvasRef}
                width={600}
                height={height}
                className={cn(
                  "w-full cursor-crosshair block touch-none relative z-[2]",
                  disabled && "cursor-not-allowed opacity-60"
                )}
                style={{ height }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
              {isEmpty && !disabled && (
                <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center pointer-events-none text-muted-foreground gap-1">
                  <PenLine className="h-6 w-6 opacity-40" />
                  <span className="text-xs opacity-60">Sign here</span>
                </div>
              )}
              <div className="absolute right-2 top-2 z-[3] rounded-md border border-emerald-300/80 bg-emerald-50/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-200">
                IT APP Hologram
              </div>
              {/* Baseline */}
              <div className="absolute bottom-8 left-8 right-8 z-[3] border-b border-orange-200 dark:border-orange-800 pointer-events-none" />
            </div>
            {!disabled && (
              <div className="flex gap-2 justify-end mt-2">
                <Button type="button" variant="ghost" size="sm" onClick={clearCanvas} className="text-xs h-7">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={saveSignature}
                  disabled={isEmpty}
                  className="text-xs h-7 border-orange-300 text-orange-700"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Confirm Signature
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload" className="mt-3">
            <div className="space-y-3">
              <div
                className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-colors"
                onClick={() => !uploadProcessing && fileInputRef.current?.click()}
              >
                {uploadProcessing ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin h-8 w-8 border-2 border-emerald-600 border-t-transparent rounded-full" />
                    <p className="text-sm text-muted-foreground">Processing image…</p>
                  </div>
                ) : uploadPreview ? (
                  <img
                    src={uploadPreview}
                    alt="Uploaded signature preview"
                    className="max-h-40 mx-auto object-contain rounded border"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="h-8 w-8" />
                    <p className="text-sm font-medium">Click to upload signature image</p>
                    <p className="text-xs">PNG, JPG or WEBP · max 5 MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="flex gap-2 justify-end">
                {uploadPreview && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setUploadPreview(null)
                      setIsEmpty(true)
                    }}
                    className="text-xs h-7"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={saveUploadedSignature}
                  disabled={!uploadPreview || uploadProcessing}
                  className="text-xs h-7 border-orange-300 text-orange-700"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Confirm Upload
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The QCC IT APP hologram security stamp will be applied automatically to your uploaded signature image.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <div className="relative rounded-md border-2 border-dashed border-orange-300 dark:border-orange-700 bg-white dark:bg-slate-950 overflow-hidden">
            <div className="pointer-events-none absolute inset-0 z-[1] bg-[repeating-linear-gradient(-25deg,rgba(16,185,129,0.06)_0px,rgba(16,185,129,0.06)_2px,transparent_2px,transparent_34px)]" />
            <canvas
              ref={canvasRef}
              width={600}
              height={height}
              className={cn(
                "w-full cursor-crosshair block touch-none relative z-[2]",
                disabled && "cursor-not-allowed opacity-60"
              )}
              style={{ height }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
            {isEmpty && !disabled && (
              <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center pointer-events-none text-muted-foreground gap-1">
                <PenLine className="h-6 w-6 opacity-40" />
                <span className="text-xs opacity-60">Sign here</span>
              </div>
            )}
            <div className="absolute right-2 top-2 z-[3] rounded-md border border-emerald-300/80 bg-emerald-50/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-200">
              IT APP Hologram
            </div>
            {/* Baseline */}
            <div className="absolute bottom-8 left-8 right-8 z-[3] border-b border-orange-200 dark:border-orange-800 pointer-events-none" />
          </div>
          {!disabled && (
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={clearCanvas} className="text-xs h-7">
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={saveSignature}
                disabled={isEmpty}
                className="text-xs h-7 border-orange-300 text-orange-700"
              >
                <Check className="h-3 w-3 mr-1" />
                Confirm Signature
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
