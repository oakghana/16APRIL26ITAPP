"use client"

import { useState } from "react"
import { UserMinus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OffboardingRequestForm } from "@/components/it-forms/offboarding-request-form"
import { RequestStatusTracker } from "@/components/it-forms/request-status-tracker"

export default function OffboardingPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-red-500/10 p-2">
          <UserMinus className="h-6 w-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Offboarding Request</h1>
          <p className="mt-1 text-muted-foreground">Request access revocation and handover for staff exit or transfer.</p>
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
              <CardTitle>Offboarding Form</CardTitle>
              <CardDescription>Provide departure details for account closure and IT deprovisioning.</CardDescription>
            </CardHeader>
            <CardContent>
              <OffboardingRequestForm onSubmit={() => setRefreshKey((p) => p + 1)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Offboarding Requests</CardTitle>
              <CardDescription>Track assignment and completion of offboarding work.</CardDescription>
            </CardHeader>
            <CardContent>
              <RequestStatusTracker key={refreshKey} formType="offboarding" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
