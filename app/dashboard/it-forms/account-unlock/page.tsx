"use client"

import { useState } from "react"
import { LockKeyhole } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AccountUnlockRequestForm } from "@/components/it-forms/account-unlock-request-form"
import { RequestStatusTracker } from "@/components/it-forms/request-status-tracker"

export default function AccountUnlockPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-indigo-500/10 p-2">
          <LockKeyhole className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Account Unlock Request</h1>
          <p className="mt-1 text-muted-foreground">Request help to unlock accounts locked due to policy or login issues.</p>
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
              <CardTitle>Account Unlock Form</CardTitle>
              <CardDescription>Submit account lock issues for IT manager assignment.</CardDescription>
            </CardHeader>
            <CardContent>
              <AccountUnlockRequestForm onSubmit={() => setRefreshKey((p) => p + 1)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Account Unlock Requests</CardTitle>
              <CardDescription>Track assignment, progress and completion status.</CardDescription>
            </CardHeader>
            <CardContent>
              <RequestStatusTracker key={refreshKey} formType="account-unlock" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
