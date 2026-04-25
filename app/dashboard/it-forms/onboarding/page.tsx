"use client"

import { useState } from "react"
import { UserPlus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OnboardingRequestForm } from "@/components/it-forms/onboarding-request-form"
import { RequestStatusTracker } from "@/components/it-forms/request-status-tracker"

export default function OnboardingPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-emerald-500/10 p-2">
          <UserPlus className="h-6 w-6 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New User Onboarding Request</h1>
          <p className="mt-1 text-muted-foreground">Request IT onboarding setup for new staff access and systems readiness.</p>
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
              <CardTitle>Onboarding Form</CardTitle>
              <CardDescription>Provide new staff profile and start date for IT provisioning.</CardDescription>
            </CardHeader>
            <CardContent>
              <OnboardingRequestForm onSubmit={() => setRefreshKey((p) => p + 1)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Onboarding Requests</CardTitle>
              <CardDescription>Track assignment and completion of onboarding tasks.</CardDescription>
            </CardHeader>
            <CardContent>
              <RequestStatusTracker key={refreshKey} formType="onboarding" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
