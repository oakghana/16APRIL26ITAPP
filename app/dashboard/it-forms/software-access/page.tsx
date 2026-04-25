"use client"

import { useState } from "react"
import { ShieldCheck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SoftwareAccessRequestForm } from "@/components/it-forms/software-access-request-form"
import { RequestStatusTracker } from "@/components/it-forms/request-status-tracker"

export default function SoftwareAccessPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-cyan-500/10 p-2">
          <ShieldCheck className="h-6 w-6 text-cyan-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Software Access Request</h1>
          <p className="mt-1 text-muted-foreground">Request application/system access with manager assignment workflow.</p>
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
              <CardTitle>Software Access Form</CardTitle>
              <CardDescription>Submit software and access-level needs for approval and assignment.</CardDescription>
            </CardHeader>
            <CardContent>
              <SoftwareAccessRequestForm onSubmit={() => setRefreshKey((p) => p + 1)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Software Access Requests</CardTitle>
              <CardDescription>Track review, assignment and final confirmation status.</CardDescription>
            </CardHeader>
            <CardContent>
              <RequestStatusTracker key={refreshKey} formType="software-access" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
