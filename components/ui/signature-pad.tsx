"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PenLine, Trash2, Check } from "lucide-react"

interface SignaturePadProps {
  onSave: (dataUrl: string) => void
  onClear?: () => void
  initialValue?: string
  className?: string
  height?: number
  disabled?: boolean
  signerLabel?: string
  roleLabel?: string
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
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isEmpty, setIsEmpty] = useState(!initialValue)
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null)

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
    onClear?.()
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
        <div
          className="absolute bottom-8 left-8 right-8 z-[3] border-b border-orange-200 dark:border-orange-800 pointer-events-none"
        />
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
    </div>
  )
}
