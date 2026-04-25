"use client"

import { useState } from "react"
import { ArrowLeftRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AssetTransferRequestForm } from "@/components/it-forms/asset-transfer-request-form"
import { RequestStatusTracker } from "@/components/it-forms/request-status-tracker"

export default function AssetTransferPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-violet-500/10 p-2">
          <ArrowLeftRight className="h-6 w-6 text-violet-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">IT Asset Transfer Request</h1>
          <p className="mt-1 text-muted-foreground">Request inter-department transfer of IT assets and accessories.</p>
        </div>
      </div>

      <Tabs defaultValue="new-request" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="new-request">New Request</TabsTrigger>
          <TabsTrigger value="my-requests">My Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="new-request" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Asset Transfer Form</CardTitle>
              <CardDescription>Provide transfer details for movement and ownership updates.</CardDescription>
            </CardHeader>
            <CardContent>
              <AssetTransferRequestForm onSubmit={() => setRefreshKey((p) => p + 1)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Asset Transfer Requests</CardTitle>
              <CardDescription>Track manager review and fulfillment progress.</CardDescription>
            </CardHeader>
            <CardContent>
              <RequestStatusTracker key={refreshKey} formType="asset-transfer" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
