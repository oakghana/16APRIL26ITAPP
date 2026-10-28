"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Requisition {
  id: string
  requisition_number: string
  requested_by: string
  beneficiary?: string
  location: string
  items: { item_id?: string; itemName: string; quantity: number; unit: string }[]
  created_at: string
  status: string
}

export function IssueItemsForm({
  requisition,
  onSubmit,
  onCancel,
}: {
  requisition: Requisition
  onSubmit: () => void
  onCancel: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [notes, setNotes] = useState("")
  const [recipientName, setRecipientName] = useState(requisition.beneficiary || "")
  const [officeLocation, setOfficeLocation] = useState("")
  const [roomNumber, setRoomNumber] = useState("")
  const supabase = createClient()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!recipientName.trim()) {
      setError("Recipient name is required so the issuance can be reported.")
      return
    }

    setLoading(true)

    try {
      console.log("[v0] Issuing items for requisition:", requisition.id)

      // Call API to handle stock deduction and device creation
      const response = await fetch("/api/store/issue-requisition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requisitionId: requisition.id,
          recipientName: recipientName.trim(),
          officeLocation: officeLocation.trim(),
          roomNumber: roomNumber.trim(),
          notes: notes.trim(),
          location: requisition.location,
          items: requisition.items,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || "Failed to issue items")
        toast({
          title: "❌ Failed to Issue Items",
          description: result.error || "Failed to issue items from the requisition",
          variant: "destructive",
        })
        setLoading(false)
        return
      }

      console.log("[v0] Items issued successfully:", result)
      toast({
        title: "✅ Items Issued Successfully",
        description: recipientName ? `Items have been issued to ${recipientName}` : "Items have been issued successfully",
      })
      onSubmit()
    } catch (err) {
      console.error("[v0] Error issuing items:", err)
      setError("Failed to issue items. Please try again.")
      toast({
        title: "❌ Error",
        description: "Failed to issue items. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground">Requester</Label>
            <p className="font-medium">{requisition.requested_by}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Requisition Location</Label>
            <p className="font-medium">{requisition.location}</p>
          </div>
        </div>

        <div>
          <Label className="text-muted-foreground mb-2 block">Items to Issue (Stock will be reduced)</Label>
          <div className="space-y-2">
            {requisition.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 bg-background rounded">
                <span className="font-medium">{item.itemName}</span>
                <Badge variant="destructive">
                  -{item.quantity} {item.unit}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 border rounded-lg">
        <h4 className="font-semibold text-sm">Recipient Details</h4>
        
        <div className="space-y-2">
          <Label htmlFor="recipientName">Recipient Name (required)</Label>
          <Input
            id="recipientName"
            required
            placeholder="Full name of person receiving items"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="officeLocation">Office Location</Label>
            <Input
              id="officeLocation"
              placeholder="e.g., Building A, Floor 2"
              value={officeLocation}
              onChange={(e) => setOfficeLocation(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="roomNumber">Room Number</Label>
            <Input
              id="roomNumber"
              placeholder="e.g., Room 205"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Issue Notes (Optional)</Label>
        <Textarea
          id="notes"
          placeholder="Add any notes about this issuance..."
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Issuing Items..." : "Issue Items & Reduce Stock"}
        </Button>
      </div>
    </form>
  )
}
