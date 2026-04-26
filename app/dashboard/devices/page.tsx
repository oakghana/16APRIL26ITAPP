"use client"

import { DeviceInventory } from "@/components/devices/device-inventory"
import { DuplicateDeviceChecker } from "@/components/devices/duplicate-device-checker"
import { DeviceTonerIntelligence } from "@/components/devices/device-toner-intelligence"
import { useAuth } from "@/lib/auth-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Monitor, Copy, Droplets } from "lucide-react"

export default function DevicesPage() {
  const { user } = useAuth()
  const canSeeDuplicates =
    user?.role === "admin" ||
    user?.role === "regional_it_head" ||
    user?.role === "it_head" ||
    user?.role === "it_staff"
  const canSeeTonerIntelligence =
    user?.role === "admin" ||
    user?.role === "regional_it_head" ||
    user?.role === "it_head" ||
    user?.role === "it_staff"

  if (!canSeeDuplicates) {
    return (
      <div className="space-y-6">
        <DeviceInventory />
      </div>
    )
  }

  return (
    <Tabs defaultValue="inventory" className="space-y-4">
      <TabsList className="bg-green-50 border border-green-200 dark:bg-green-950/40 dark:border-green-800">
        <TabsTrigger
          value="inventory"
          className="flex items-center gap-2 data-[state=active]:bg-green-500 data-[state=active]:text-white"
        >
          <Monitor className="h-4 w-4" />
          Device Inventory
        </TabsTrigger>
        <TabsTrigger
          value="duplicates"
          className="flex items-center gap-2 data-[state=active]:bg-green-500 data-[state=active]:text-white"
        >
          <Copy className="h-4 w-4" />
          Duplicate Checker
        </TabsTrigger>
        {canSeeTonerIntelligence && (
          <TabsTrigger
            value="toner-intelligence"
            className="flex items-center gap-2 data-[state=active]:bg-green-500 data-[state=active]:text-white"
          >
            <Droplets className="h-4 w-4" />
            Toner Intelligence
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="inventory" className="mt-0">
        <DeviceInventory />
      </TabsContent>

      <TabsContent value="duplicates" className="mt-0">
        <DuplicateDeviceChecker />
      </TabsContent>

      {canSeeTonerIntelligence && (
        <TabsContent value="toner-intelligence" className="mt-0">
          <DeviceTonerIntelligence />
        </TabsContent>
      )}
    </Tabs>
  )
}
