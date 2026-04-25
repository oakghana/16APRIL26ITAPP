"use client"

import { useState } from "react"
import { KeyRound } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PasswordResetRequestForm } from "@/components/it-forms/password-reset-request-form"
import { RequestStatusTracker } from "@/components/it-forms/request-status-tracker"

export default function PasswordResetPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleFormSubmit = () => {
    setRefreshKey((prev) => prev + 1)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-500/10 rounded-lg">
          <KeyRound className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Password Reset Request</h1>
          <p className="text-muted-foreground mt-1">
            Request account reset support for enterprise systems with IT manager approval and assignment workflow
          </p>
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
              <CardTitle>Password Reset Form</CardTitle>
              <CardDescription>
                Select the target system, provide account details, and submit directly to IT manager queue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PasswordResetRequestForm onSubmit={handleFormSubmit} key={refreshKey} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Password Reset Requests</CardTitle>
              <CardDescription>
                Track assignment and confirm when your new password is working.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RequestStatusTracker
                key={refreshKey}
                formType="password-reset"
                title="My Password Reset Requests"
                description="Monitor assignment progress and confirm successful access after reset."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
