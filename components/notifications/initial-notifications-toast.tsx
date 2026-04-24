"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import { notificationService } from "@/lib/notification-service"

/**
 * Displays all unread notifications as toasts on login/initial load
 * Shows them one after another for better UX
 */
export function InitialNotificationsToast() {
  const { user } = useAuth()
  const hasShownRef = useRef(false)
  const supabase = createClient()

  useEffect(() => {
    if (!user?.id || hasShownRef.current) return

    const showNotifications = async () => {
      try {
        // Get unread notifications for this user
        const { data: notifications, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_read", false)
          .order("created_at", { ascending: true })

        if (error) {
          console.error("[v0] Error fetching initial notifications:", error)
          return
        }

        if (!notifications || notifications.length === 0) {
          return
        }

        // Mark as shown
        hasShownRef.current = true

        // Show unread count summary
        if (notifications.length > 0) {
          const unreadCount = notifications.length
          notificationService.info(
            unreadCount === 1
              ? "📬 You have 1 unread notification"
              : `📬 You have ${unreadCount} unread notifications`
          )
        }

        // Show each notification as a toast with slight delay
        notifications.forEach((notification: any, index: number) => {
          setTimeout(() => {
            const title = notification.title || "Notification"
            const message = notification.message || ""
            const type = (notification.type || "info") as "info" | "success" | "warning" | "error"

            // Map notification types to notificationService methods
            switch (type) {
              case "success":
                notificationService.success(title, message, 5000)
                break
              case "warning":
                notificationService.warning(title, message, 6000)
                break
              case "error":
                notificationService.error(title, message, 7000)
                break
              default:
                notificationService.info(title, message, 5000)
            }

            // Mark as read after showing
            setTimeout(() => {
              ;(async () => {
                const { error: markReadError } = await supabase
                  .from("notifications")
                  .update({ is_read: true, read_at: new Date().toISOString() })
                  .eq("id", notification.id)

                if (markReadError) {
                  console.error("[v0] Error marking notification as read:", markReadError)
                }
              })()
            }, 500)
          }, index * 2500) // 2.5 second delay between each toast
        })
      } catch (error) {
        console.error("[v0] Error in InitialNotificationsToast:", error)
      }
    }

    showNotifications()
  }, [user?.id, supabase])

  return null
}
