"use client"

import { CheckCircle2, Clock, XCircle, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDisplayDateTime } from "@/lib/utils"

interface ApprovalStage {
  stage: string
  role: string
  status: "completed" | "pending" | "rejected"
  approver?: string
  timestamp?: string
  notes?: string
  signatureDataUrl?: string
}

interface ApprovalTrackerProps {
  stages: ApprovalStage[]
  currentStatus: string
}

export function ApprovalTracker({ stages, currentStatus }: ApprovalTrackerProps) {
  const getStageIcon = (status: "completed" | "pending" | "rejected") => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-6 w-6 text-green-600" />
      case "rejected":
        return <XCircle className="h-6 w-6 text-red-600" />
      case "pending":
        return <Clock className="h-6 w-6 text-amber-600 animate-pulse" />
    }
  }

  const getStageColor = (status: "completed" | "pending" | "rejected") => {
    switch (status) {
      case "completed":
        return "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
      case "rejected":
        return "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
      case "pending":
        return "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
    }
  }

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {stages.map((stage, index) => (
            <div key={stage.stage} className="space-y-2">
              <div className={`flex items-start gap-4 p-4 rounded-lg border-2 transition-all ${getStageColor(stage.status)}`}>
                <div className="flex-shrink-0 pt-0.5">
                  {getStageIcon(stage.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm">{stage.stage}</h4>
                    <Badge
                      variant={stage.status === "completed" ? "default" : stage.status === "rejected" ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {stage.status === "completed" ? "Approved" : stage.status === "rejected" ? "Rejected" : "Awaiting"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    <span className="font-medium">{stage.role}</span>
                  </p>
                  {stage.approver && (
                    <p className="text-xs">
                      <span className="font-medium">Approver:</span> {stage.approver}
                    </p>
                  )}
                  {stage.timestamp && (
                    <p className="text-xs text-muted-foreground">
                      {formatDisplayDateTime(stage.timestamp)}
                    </p>
                  )}
                  {stage.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      "{stage.notes}"
                    </p>
                  )}
                  {stage.signatureDataUrl && (
                    <div className="mt-2">
                      <p className="text-[11px] font-medium text-muted-foreground mb-1">Digital Signature</p>
                      <div className="inline-block overflow-hidden rounded-md border bg-white p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={stage.signatureDataUrl}
                          alt={`${stage.role} signature`}
                          className="max-h-20 object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {index < stages.length - 1 && (
                <div className="flex justify-center py-1">
                  <ChevronRight className={`h-5 w-5 ${
                    stage.status === "rejected" 
                      ? "text-red-400" 
                      : stages[index + 1].status === "pending"
                      ? "text-amber-400 animate-bounce"
                      : "text-green-400"
                  }`} />
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
