"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SignaturePad } from "@/components/ui/signature-pad"
import { useAuth } from "@/lib/auth-context"
import { Loader2, PenLine, Save, RefreshCw, Upload, ImagePlus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatDisplayDateTime } from "@/lib/utils"
import { isITDDepartment } from "@/lib/department-options"

type SignatureProfile = {
  id: string
  user_id: string
  role: string
  signature_data_url: string
  updated_at: string
}

export function SignatureManagementPanel() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [storedProfile, setStoredProfile] = useState<SignatureProfile | null>(null)
  const [draftSignature, setDraftSignature] = useState<string | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadProcessing, setUploadProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canManage = ["admin", "department_head", "it_head", "regional_it_head"].includes(user?.role || "")
  const isITManager = user?.role === "department_head" && isITDDepartment(user?.department)
  
  const roleLabel = isITManager
    ? "IT Manager"
    : user?.role === "department_head"
      ? "Department Head"
      : user?.role === "regional_it_head"
        ? "Regional IT Head"
        : user?.role === "it_head"
          ? "IT Head"
          : "Admin"

  const loadSignature = async () => {
    if (!user?.id || !user?.role || !canManage) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({ 
        userId: user.id, 
        role: user.role,
        ...(user?.department && { department: user.department })
      })
      const response = await fetch(`/api/it-forms/signature-profile?${params.toString()}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to load stored signature")

      setStoredProfile(data.profile || null)
      setDraftSignature(data.profile?.signature_data_url || null)
    } catch (error: any) {
      toast({
        title: "Unable to load signature",
        description: error.message || "Please try again",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSignature()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid file", description: "Please upload a PNG, JPG, or WEBP image.", variant: "destructive" })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 5 MB.", variant: "destructive" })
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
        ctx.fillText(`${roleLabel} - ${user?.full_name || user?.email || ""}`, stampX + stampW / 2, stampY + 23)
        ctx.fillText(new Date().toLocaleString(), stampX + stampW / 2, stampY + 33)

        const result = canvas.toDataURL("image/png")
        setUploadPreview(result)
        setDraftSignature(result)
        setUploadProcessing(false)
      }
      img.onerror = () => {
        toast({ title: "Invalid image", description: "Could not read the image file.", variant: "destructive" })
        setUploadProcessing(false)
      }
      img.src = src
    }
    reader.readAsDataURL(file)
    // Reset input so same file can be re-selected
    e.target.value = ""
  }

  const saveSignature = async () => {
    if (!user?.id || !user?.role || !draftSignature) return

    setSaving(true)
    try {
      const response = await fetch("/api/it-forms/signature-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          role: user.role,
          signatureDataUrl: draftSignature,
          ...(user?.department && { department: user.department })
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to save signature")

      setStoredProfile(data.profile)
      toast({
        title: "Signature saved",
        description: `Your ${roleLabel} signature has been updated and will be used in approvals.`,
      })
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message || "Unable to save signature",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Signature Management</CardTitle>
          <CardDescription>This section is available to Department Heads (HOD/IT Manager), Regional IT Heads, IT Heads, and Admin only.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-emerald-600" />
            My Stored Signature
          </CardTitle>
          <CardDescription>
            Add, edit, or update your stored signature for IT approvals. Signature includes QCC IT APP hologram security stamp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Role: {roleLabel}</Badge>
            {storedProfile ? <Badge className="bg-emerald-600">Stored</Badge> : <Badge variant="secondary">Not yet stored</Badge>}
          </div>

          {storedProfile?.updated_at && (
            <p className="text-xs text-muted-foreground">
              Last updated: {formatDisplayDateTime(storedProfile.updated_at)}
            </p>
          )}

          <div className="space-y-2">
            <Label>Capture Signature</Label>
            <Tabs defaultValue="draw">
              <TabsList>
                <TabsTrigger value="draw" className="flex items-center gap-1.5">
                  <PenLine className="h-4 w-4" /> Draw on Screen
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex items-center gap-1.5">
                  <ImagePlus className="h-4 w-4" /> Upload Scanned Image
                </TabsTrigger>
              </TabsList>

              <TabsContent value="draw" className="mt-3">
                <SignaturePad
                  signerLabel={user?.full_name || user?.email || user?.name || "Unknown"}
                  roleLabel={roleLabel}
                  initialValue={draftSignature || undefined}
                  onSave={setDraftSignature}
                  onClear={() => setDraftSignature(null)}
                  height={160}
                />
              </TabsContent>

              <TabsContent value="upload" className="mt-3">
                <div className="space-y-3">
                  <div
                    className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadProcessing ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                        <p className="text-sm text-muted-foreground">Processing image…</p>
                      </div>
                    ) : uploadPreview ? (
                      <img src={uploadPreview} alt="Uploaded signature preview" className="max-h-28 mx-auto object-contain rounded border" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="h-8 w-8" />
                        <p className="text-sm font-medium">Click to upload scanned signature</p>
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
                  {uploadPreview && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setUploadPreview(null); setDraftSignature(null) }}
                    >
                      Clear Upload
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    The QCC IT APP hologram security stamp will be applied automatically to your uploaded image.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveSignature} disabled={!draftSignature || saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Signature
            </Button>
            <Button variant="outline" onClick={loadSignature} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
