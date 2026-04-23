"use client"

import { useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import { notificationService } from "@/lib/notification-service"

/**
 * Listens for real-time notifications and displays flash notifications
 * Automatically shown when tasks are completed or important events occur
 */
export function RealtimeNotificationListener() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) return

    console.log("[v0] Starting realtime notification listener for user:", user.id)

    // Subscribe to notifications table for new notifications
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("[v0] Received realtime notification:", payload)
          
          const notification = payload.new as any
          
          // Show appropriate notification based on type
          switch (notification.type) {
            case "task_completed":
              notificationService.flash(
                notification.title || "Task Completed! 🎉",
                notification.message
              )
              break

            case "task_confirmed":
              notificationService.success(
                notification.title || "Work Confirmed",
                notification.message
              )
              break

            case "task_rejected":
              notificationService.warning(
                notification.title || "Work Needs Rework",
                notification.message
              )
              break
            
            case "task_assigned":
              notificationService.taskAssigned(
                notification.message,
                notification.priority || "medium"
              )
              break
            
            case "urgent":
              notificationService.warning(
                notification.title || "Urgent Update",
                notification.message
              )
              break

            case "warning":
              notificationService.warning(
                notification.title || "Warning",
                notification.message
              )
              break

            case "success":
              notificationService.success(
                notification.title || "Success",
                notification.message
              )
              break
            
            case "info":
              notificationService.info(
                notification.title || "Information",
                notification.message
              )
              break
            
            default:
              notificationService.show({
                title: notification.title || "Notification",
                description: notification.message,
                type: "default",
              })
          }
        }
      )
      .subscribe()

    return () => {
      console.log("[v0] Cleaning up realtime notification listener")
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  return null // This component doesn't render anything
}
