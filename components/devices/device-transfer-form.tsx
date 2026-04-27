"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FormNavigation } from "@/components/ui/form-navigation"

interface Device {
  id: string
  name: string
  location: string
  assignedTo: string
}

interface DeviceTransferFormProps {
  device: Device
  onSubmit: (deviceId: string, newLocation: string, newAssignee: string) => void
  onCancel: () => void
}

export function DeviceTransferForm({ device, onSubmit, onCancel }: DeviceTransferFormProps) {
  const [newLocation, setNewLocation] = useState(device.location)
  const [newAssignee, setNewAssignee] = useState(device.assignedTo)
  const [transferReason, setTransferReason] = useState("")
  const [locations, setLocations] = useState<{ name: string; code: string }[]>([])

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch("/api/admin/lookup-data?type=locations")
        if (response.ok) {
          const data = await response.json()
          setLocations(
            data
              .filter((loc: any) => loc.is_active !== false)
              .map((loc: any) => ({ name: loc.name, code: loc.code || loc.name }))
          )
        }
      } catch (err) {
        console.error("[v0] Error fetching locations:", err)
      }
    }
    fetchLocations()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(device.id, newLocation, newAssignee)
  }

  // Build locationNames from fetched data for display
  const locationNames: Record<string, string> = locations.reduce(
    (acc, loc) => ({ ...acc, [loc.code]: loc.name }),
    { head_office: "Head Office", accra: "Accra", kumasi: "Kumasi", kaase_inland_port: "Kaase Inland Port", cape_coast: "Swedru/CR" } as Record<string, string>
  )

  return (
    <div>
      <FormNavigation currentPage="/dashboard/devices" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium text-foreground mb-2">Current Assignment</h4>
            <p className="text-sm text-muted-foreground">
              <strong>Location:</strong> {locationNames[device.location as keyof typeof locationNames]}
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Assigned To:</strong> {device.assignedTo}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newLocation">New Location</Label>
            <Select value={newLocation} onValueChange={setNewLocation}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locations.length > 0 ? (
                  locations.map((loc) => (
                    <SelectItem key={loc.code} value={loc.code}>
                      {loc.name}
                    </SelectItem>
                  ))
                ) : (
                  <>
                    <SelectItem value="head_office">Head Office</SelectItem>
                    <SelectItem value="accra">Accra</SelectItem>
                    <SelectItem value="kumasi">Kumasi</SelectItem>
                    <SelectItem value="kaase_inland_port">Kaase Inland Port</SelectItem>
                    <SelectItem value="cape_coast">Swedru/CR</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newAssignee">New Assignee</Label>
            <Input
              id="newAssignee"
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
              placeholder="Person or department name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="transferReason">Transfer Reason (Optional)</Label>
            <Textarea
              id="transferReason"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="Reason for device transfer..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Transfer Device</Button>
        </div>
      </form>
    </div>
  )
}
