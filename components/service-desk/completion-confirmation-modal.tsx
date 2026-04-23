"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "sonner"
import { Loader2, CheckCircle, XCircle } from "lucide-react"

interface CompletionConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket: any
  onConfirmationSuccess: () => void
  currentUser: any
  isStaffSubmitting?: boolean
}

export function CompletionConfirmationModal({
  open,
  onOpenChange,
  ticket,
  onConfirmationSuccess,
  currentUser,
  isStaffSubmitting = false,
}: CompletionConfirmationModalProps) {
  const [step, setStep] = useState<"submit" | "confirm">(isStaffSubmitting ? "submit" : "confirm")
  const [workNotes, setWorkNotes] = useState("")
  const [confirmationNotes, setConfirmationNotes] = useState("")
  const [confirmation, setConfirmation] = useState<"approved" | "rejected">("approved")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setStep(isStaffSubmitting ? "submit" : "confirm")
    setWorkNotes("")
    setConfirmationNotes("")
    setConfirmation("approved")
  }, [isStaffSubmitting, open])

  const handleSubmitCompletion = async () => {
    if (!workNotes.trim()) {
      toast.error("Please provide work notes before submitting")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/service-tickets/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.uuid || ticket.id,
          completedBy: currentUser?.id,
          completedByName: currentUser?.full_name || currentUser?.name,
          completedByRole: currentUser?.role,
          workNotes: workNotes,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || "Failed to submit completion")
        return
      }

      toast.success("Work submitted for confirmation.", {
        description: "Requester (or Service Desk Head if they raised it) must confirm before status and performance are finalized.",
        style: { background: "#22c55e", color: "#ffffff", opacity: 1 },
      })
      setWorkNotes("")
      onOpenChange(false)
      onConfirmationSuccess()
    } catch (error) {
      console.error("Error submitting completion:", error)
      toast.error("An error occurred while submitting completion")
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmCompletion = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/service-tickets/complete", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.uuid || ticket.id,
          confirmedBy: currentUser?.id,
          confirmedByName: currentUser?.full_name || currentUser?.name,
          confirmedByRole: currentUser?.role,
          confirmation: confirmation,
          confirmationNotes: confirmationNotes,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || "Failed to confirm ticket")
        return
      }

      if (confirmation === "approved") {
        toast.success("✓ Ticket confirmed as complete!", {
          description: "The work has been approved and the ticket is now resolved.",
          style: { background: "#22c55e", color: "#ffffff", opacity: 1 },
        })
      } else {
        toast.info("Ticket reopened for rework", {
          description: "The IT staff will be notified to rework this ticket.",
        })
      }

      setConfirmationNotes("")
      onOpenChange(false)
      onConfirmationSuccess()
    } catch (error) {
      console.error("Error confirming completion:", error)
      toast.error("An error occurred while confirming")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {step === "submit" ? "Submit Work Completion" : "Confirm Work Completion"}
          </DialogTitle>
          <DialogDescription>
            {ticket?.title} - {ticket?.ticket_number}
          </DialogDescription>
        </DialogHeader>

        {step === "submit" && (
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                📋 Please provide details of work done. Final completion is only after requester confirmation (or Service Desk Head confirmation if they raised the ticket).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workNotes">Work Completed Summary</Label>
              <Textarea
                id="workNotes"
                placeholder="Describe the work completed, any changes made, parts replaced, or issues resolved..."
                value={workNotes}
                onChange={(e) => setWorkNotes(e.target.value)}
                rows={5}
              />
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                🔍 Please review the work completed by IT staff and confirm if it is satisfactory.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Work Notes from Staff:</p>
              <p className="text-sm text-gray-900 dark:text-gray-100">
                {ticket?.completion_work_notes || "No work notes provided"}
              </p>
            </div>

            <div className="space-y-3">
              <Label>Is the work satisfactory?</Label>
              <RadioGroup value={confirmation} onValueChange={(val: any) => setConfirmation(val)}>
                <div className="flex items-center space-x-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-3 cursor-pointer">
                  <RadioGroupItem value="approved" id="approved" />
                  <Label htmlFor="approved" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Yes, work is complete and satisfactory</span>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-3 cursor-pointer">
                  <RadioGroupItem value="rejected" id="rejected" />
                  <Label htmlFor="rejected" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span>No, work needs to be redone</span>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {confirmation === "rejected" && (
              <div className="space-y-2">
                <Label htmlFor="confirmationNotes">Reason for Rejection</Label>
                <Textarea
                  id="confirmationNotes"
                  placeholder="Please explain what needs to be fixed or redone..."
                  value={confirmationNotes}
                  onChange={(e) => setConfirmationNotes(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {confirmation === "approved" && (
              <div className="space-y-2">
                <Label htmlFor="confirmationNotes">Additional Comments (Optional)</Label>
                <Textarea
                  id="confirmationNotes"
                  placeholder="Add any additional feedback or comments..."
                  value={confirmationNotes}
                  onChange={(e) => setConfirmationNotes(e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={step === "submit" ? handleSubmitCompletion : handleConfirmCompletion}
            disabled={isLoading || (step === "submit" && !workNotes.trim())}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {step === "submit" ? "Submitting..." : "Confirming..."}
              </>
            ) : step === "submit" ? (
              "Submit Completion"
            ) : (
              "Confirm"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
