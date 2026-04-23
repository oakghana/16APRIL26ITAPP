"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { SignaturePad } from "@/components/ui/signature-pad"
import { useAuth } from "@/lib/auth-context"
import { Loader2, PenLine, Save, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatDisplayDateTime } from "@/lib/utils"

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

  const canManage = user?.role === "admin" || user?.role === "department_head"

  const loadSignature = async () => {
    if (!user?.id || !user?.role || !canManage) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({ userId: user.id, role: user.role })
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
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to save signature")

      setStoredProfile(data.profile)
      toast({
        title: "Signature saved",
        description: "Your signature has been updated and will be used in approvals.",
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
          <CardDescription>This section is available to Department Heads and Admin only.</CardDescription>
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
            <Badge variant="outline">Role: {user?.role === "department_head" ? "Department Head" : "Admin"}</Badge>
            {storedProfile ? <Badge className="bg-emerald-600">Stored</Badge> : <Badge variant="secondary">Not yet stored</Badge>}
          </div>

          {storedProfile?.updated_at && (
            <p className="text-xs text-muted-foreground">
              Last updated: {formatDisplayDateTime(storedProfile.updated_at)}
            </p>
          )}

          <div className="space-y-2">
            <Label>Capture Signature</Label>
            <SignaturePad
              signerLabel={user?.full_name || user?.email || user?.name || "Unknown"}
              roleLabel={user?.role === "department_head" ? "Department Head" : "Admin"}
              initialValue={draftSignature || undefined}
              onSave={setDraftSignature}
              onClear={() => setDraftSignature(null)}
              height={160}
            />
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
