"use client"

import { useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useNotifications } from "@/lib/notification-context"
import { supabase } from "@/lib/supabase"

export function useTicketNotifications() {
  const { user } = useAuth()
  const { addNotification } = useNotifications()

  useEffect(() => {
    if (!user?.id) return

    console.log("[v0] Setting up ticket notification subscriptions for user:", user.id)

    // Subscribe to service_tickets table for assignments
    const ticketSubscription = supabase
      .channel(`service_tickets:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "service_tickets",
          filter: `assigned_to=eq.${user.id}`,
        },
        (payload) => {
          console.log("[v0] Received ticket update:", payload)

          const ticket = payload.new as any
          const oldTicket = payload.old as any

          // Notification for new assignment
          if (!oldTicket?.assigned_to && ticket.assigned_to === user.id) {
            addNotification({
              title: "🎯 New Ticket Assigned",
              message: `${ticket.subject || "Service Request"} - ${ticket.priority?.toUpperCase() || "MEDIUM"} Priority`,
              type: "info",
              priority: ticket.priority === "high" || ticket.priority === "critical" ? "high" : "medium",
              actionUrl: `/dashboard/assigned-tasks`,
              actionLabel: "View Ticket",
            })
          }

          // Notification for status changes
          if (oldTicket?.status !== ticket.status) {
            const statusMessages = {
              in_progress: "Started working on",
              on_hold: "Put on hold",
              completed: "Completed",
              reopened: "Reopened",
            }
            const message = statusMessages[ticket.status as keyof typeof statusMessages] || `Status updated to ${ticket.status}`
            addNotification({
              title: "📋 Ticket Status Updated",
              message: `${message}: ${ticket.subject || "Service Request"}`,
              type: ticket.status === "completed" ? "success" : "info",
              priority: "medium",
              actionUrl: `/dashboard/assigned-tasks`,
              actionLabel: "View Details",
            })
          }
        },
      )
      .subscribe()

    // Subscribe to repair_requests table for assignments
    const repairSubscription = supabase
      .channel(`repair_requests:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "repair_requests",
          filter: `assigned_to=eq.${user.id}`,
        },
        (payload) => {
          console.log("[v0] Received repair update:", payload)

          const repair = payload.new as any
          const oldRepair = payload.old as any

          // Notification for new assignment
          if (!oldRepair?.assigned_to && repair.assigned_to === user.id) {
            addNotification({
              title: "🔧 New Repair Assigned",
              message: `${repair.issue_description || "Device Repair"} - ${repair.priority?.toUpperCase() || "MEDIUM"} Priority`,
              type: "info",
              priority: repair.priority === "high" || repair.priority === "critical" ? "high" : "medium",
              actionUrl: `/dashboard/assigned-tasks`,
              actionLabel: "View Repair",
            })
          }

          // Notification for status changes
          if (oldRepair?.status !== repair.status) {
            const statusMessages = {
              in_progress: "Started repairing",
              awaiting_parts: "Awaiting parts for",
              completed: "Repair completed for",
              failed: "Repair failed for",
            }
            const message = statusMessages[repair.status as keyof typeof statusMessages] || `Status updated for`
            addNotification({
              title: "🔨 Repair Status Updated",
              message: `${message} ${repair.issue_description || "device"}`,
              type: repair.status === "completed" ? "success" : repair.status === "failed" ? "error" : "info",
              priority: "medium",
              actionUrl: `/dashboard/assigned-tasks`,
              actionLabel: "View Repair",
            })
          }
        },
      )
      .subscribe()

    return () => {
      console.log("[v0] Cleaning up ticket notification subscriptions")
      supabase.removeChannel(ticketSubscription)
      supabase.removeChannel(repairSubscription)
    }
  }, [user?.id, addNotification])
}

// Hook for requesting staff to get notified when their tickets are completed
export function useCompletionAcknowledgements() {
  const { user } = useAuth()
  const { addNotification } = useNotifications()

  useEffect(() => {
    if (!user?.id) return

    console.log("[v0] Setting up completion acknowledgement subscriptions for user:", user.id)

    // Subscribe to service_tickets table for completions
    const ticketCompletionSubscription = supabase
      .channel(`ticket_completions:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "service_tickets",
          filter: `requester_id=eq.${user.id}`,
        },
        (payload) => {
          const ticket = payload.new as any
          const oldTicket = payload.old as any

          if (oldTicket?.status !== ticket.status && ticket.status === "awaiting_confirmation") {
            console.log("[v0] Ticket completed, sending notification to requester")
            addNotification({
              title: "✅ Work Submitted - Confirmation Needed",
              message: `${ticket.subject || "Service Request"} was marked done by IT. Please confirm if resolved.`,
              type: "success",
              priority: "high",
              actionUrl: `/dashboard/my-tickets?id=${ticket.id}`,
              actionLabel: "Review & Confirm",
            })
          }
        },
      )
      .subscribe()

    // Subscribe to repair_requests table for completions
    const repairCompletionSubscription = supabase
      .channel(`repair_completions:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "repair_requests",
          filter: `requester_id=eq.${user.id}`,
        },
        (payload) => {
          const repair = payload.new as any
          const oldRepair = payload.old as any

          if (oldRepair?.status !== repair.status && repair.status === "completed") {
            console.log("[v0] Repair completed, sending notification to requester")
            addNotification({
              title: "✅ Your Device is Ready",
              message: `${repair.issue_description || "Device"} repair is complete`,
              type: "success",
              priority: "high",
              actionUrl: `/dashboard/my-devices?id=${repair.id}`,
              actionLabel: "Acknowledge & Pickup",
            })
          }
        },
      )
      .subscribe()

    return () => {
      console.log("[v0] Cleaning up completion acknowledgement subscriptions")
      supabase.removeChannel(ticketCompletionSubscription)
      supabase.removeChannel(repairCompletionSubscription)
    }
  }, [user?.id, addNotification])
}
