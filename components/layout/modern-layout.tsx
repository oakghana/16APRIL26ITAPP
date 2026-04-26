"use client"

import type React from "react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { ModernSidebar, MobileMenuButton } from "@/components/ui/modern-sidebar"
import { PWAInstall } from "@/components/ui/pwa-install"
import { MobileAppDownload } from "@/components/ui/mobile-app-download"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Bell, Search, User, LogOut, ChevronDown, WifiOff, Zap, Loader2, Home, Headphones, Monitor, MessageSquare, Send, Database, Settings, Rss, BookOpen, Wrench, ClipboardList, Users, Package, BarChart3, FileText, Store, Target, Wifi, Link2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useNotifications } from "@/lib/notification-context"
import { useOfflineCache } from "@/lib/offline-cache"
import { cn, formatDisplayDateTime, safeStorage } from "@/lib/utils"

interface ModernLayoutProps {
  children: React.ReactNode
  className?: string
}

export function ModernLayout({ children, className }: ModernLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  const [showMobileDownload, setShowMobileDownload] = useState(false)
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const { setupConnectivityListeners, preloadCriticalData, isOnline: checkOnline, clearCache } = useOfflineCache()

  useEffect(() => {
    setIsMounted(true)

    setIsOnline(checkOnline())

    const shouldShowMobileDownload = safeStorage.get("showMobileAppDownload") === "true"
    if (shouldShowMobileDownload) {
      setShowMobileDownload(true)
      safeStorage.remove("showMobileAppDownload")
    }

    const cleanup = setupConnectivityListeners(
      () => {
        setIsOnline(true)
        preloadCriticalData()
      },
      () => setIsOnline(false),
    )

    if (checkOnline()) {
      preloadCriticalData()
    }

    return cleanup
  }, [])

  const handleLogout = () => {
    // Clear ALL cached data before logout
    clearCache()
    
    // Clear localStorage
    safeStorage.clear()
    
    // Wait a moment for cache to clear, then logout
    setTimeout(() => {
      logout()
    }, 100)
  }

  const recentNotifications = notifications.slice(0, 5)
  
  // Check if user can see notifications menu (IT Head and Admin only)
  const canSeeNotifications = user?.role === "it_head" || user?.role === "admin"

  // Icon quick-access links — shown as a minimal icon bar below the header for all roles
  const getQuickIconLinks = () => {
    const role = user?.role
    if (role === "staff" || role === "user") {
      return [
        { name: "Dashboard", href: "/dashboard", icon: Home },
        { name: "Messages", href: "/dashboard/notifications", icon: Bell },
        { name: "Service Desk", href: "/dashboard/service-desk", icon: Headphones },
        { name: "Complaints", href: "/dashboard/complaints", icon: MessageSquare },
      ]
    }
    if (role === "admin") {
      return [
        { name: "Dashboard", href: "/dashboard", icon: Home },
        { name: "Service Desk", href: "/dashboard/service-desk", icon: Headphones },
        { name: "Notifications", href: "/dashboard/notifications", icon: Bell },
        { name: "Broadcast", href: "/dashboard/broadcast-notifications", icon: Send },
        { name: "Lookup Data", href: "/dashboard/lookup-data", icon: Database },
        { name: "Settings", href: "/dashboard/system-settings", icon: Settings },
        { name: "Updates", href: "/dashboard/updates", icon: Rss },
        { name: "Help Guide", href: "/dashboard/help-guide", icon: BookOpen },
      ]
    }
    if (role === "it_staff") {
      return [
        { name: "Dashboard", href: "/dashboard", icon: Home },
        { name: "Messages", href: "/dashboard/notifications", icon: Bell },
        { name: "Tasks", href: "/dashboard/assigned-tasks", icon: ClipboardList },
        { name: "Performance", href: "/dashboard/staff-performance-report", icon: Target },
        { name: "Repairs", href: "/dashboard/repairs", icon: Wrench },
        { name: "Devices", href: "/dashboard/devices", icon: Monitor },
        { name: "Store", href: "/dashboard/store-snapshot", icon: Package },
        { name: "Complaints", href: "/dashboard/complaints", icon: MessageSquare },
        { name: "HOD Linking", href: "/dashboard/admin/department-heads", icon: Link2 },
      ]
    }
    if (role === "it_store_head") {
      return [
        { name: "Dashboard", href: "/dashboard", icon: Home },
        { name: "Messages", href: "/dashboard/notifications", icon: Bell },
        { name: "Tasks", href: "/dashboard/assigned-tasks", icon: ClipboardList },
        { name: "IT Requisition", href: "/dashboard/it-forms/equipment-requisition", icon: Package },
        { name: "Store Requisitions", href: "/dashboard/store-requisitions", icon: ClipboardList },
        { name: "Performance", href: "/dashboard/staff-performance-report", icon: Target },
        { name: "Repairs", href: "/dashboard/repairs", icon: Wrench },
        { name: "Devices", href: "/dashboard/devices", icon: Monitor },
        { name: "Inventory", href: "/dashboard/store-inventory", icon: Store },
        { name: "Stock Report", href: "/dashboard/store-summary-report", icon: FileText },
      ]
    }
    if (role === "it_head") {
      return [
        { name: "Dashboard", href: "/dashboard", icon: Home },
        { name: "Service Desk", href: "/dashboard/service-desk", icon: Headphones },
        { name: "Notifications", href: "/dashboard/notifications", icon: Bell },
        { name: "Performance", href: "/dashboard/staff-performance-report", icon: Target },
        { name: "IT Staff", href: "/dashboard/it-staff-status", icon: Users },
        { name: "Repairs", href: "/dashboard/repairs", icon: Wrench },
        { name: "Devices", href: "/dashboard/devices", icon: Monitor },
        { name: "Reports", href: "/dashboard/it-reports", icon: BarChart3 },
      ]
    }
    if (role === "regional_it_head") {
      return [
        { name: "Dashboard", href: "/dashboard", icon: Home },
        { name: "Messages", href: "/dashboard/notifications", icon: Bell },
        { name: "Service Desk", href: "/dashboard/service-desk", icon: Headphones },
        { name: "Performance", href: "/dashboard/staff-performance-report", icon: Target },
        { name: "IT Staff", href: "/dashboard/it-staff-status", icon: Users },
        { name: "Devices", href: "/dashboard/devices", icon: Monitor },
        { name: "Repairs", href: "/dashboard/repairs", icon: Wrench },
        { name: "Issue Items", href: "/dashboard/it-forms/store-issuance", icon: Package },
        { name: "Reports", href: "/dashboard/it-reports", icon: BarChart3 },
        { name: "HOD Linking", href: "/dashboard/admin/department-heads", icon: Link2 },
      ]
    }
    if (role === "department_head") {
      return [
        { name: "Dashboard", href: "/dashboard", icon: Home },
        { name: "Messages", href: "/dashboard/notifications", icon: Bell },
        { name: "Service Desk", href: "/dashboard/service-desk", icon: Headphones },
        { name: "Complaints", href: "/dashboard/complaints", icon: MessageSquare },
      ]
    }
    if (role === "service_provider") {
      return [
        { name: "Dashboard", href: "/dashboard", icon: Home },
        { name: "My Repairs", href: "/dashboard/service-provider/my-repairs", icon: Wrench },
      ]
    }
    if (role?.startsWith("service_desk")) {
      return [
        { name: "Dashboard", href: "/dashboard", icon: Home },
        { name: "Service Desk", href: "/dashboard/service-desk", icon: Headphones },
        { name: "Tasks", href: "/dashboard/assigned-tasks", icon: ClipboardList },
        { name: "IT Staff", href: "/dashboard/it-staff-status", icon: Users },
        { name: "Devices", href: "/dashboard/devices", icon: Monitor },
        { name: "Repairs", href: "/dashboard/repairs", icon: Wrench },
      ]
    }
    return [{ name: "Dashboard", href: "/dashboard", icon: Home }]
  }
  const quickIconLinksBase = getQuickIconLinks()
  const quickIconLinks = quickIconLinksBase.some((item) => item.href === "/dashboard/it-forms/approvals")
    ? quickIconLinksBase
    : [...quickIconLinksBase, { name: "IT Forms", href: "/dashboard/it-forms/approvals", icon: ClipboardList }]

  const quickAccessLinks: { name: string; href: string }[] = []

  const pageTitle = pathname
    ?.split("/")
    .filter(Boolean)
    .slice(-1)[0]
    ?.replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Overview"

  if (!isMounted) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950 dark:via-emerald-950 dark:to-teal-950">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600 dark:text-orange-400" />
            <div className="text-orange-600 dark:text-orange-400">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    if (typeof window !== "undefined") {
      window.location.href = "/"
    }
    return null
  }

  return (
      <div className="flex min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950 dark:via-emerald-950 dark:to-teal-950">
      {/* Sidebar */}
      <ModernSidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        onCollapseChange={setSidebarCollapsed}
        className="flex-shrink-0"
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        {/* PWA Install Banner */}
        <div className="p-4">
          <PWAInstall />
        </div>

        {/* Mobile App Download Notification */}
        {showMobileDownload && (
          <div className="px-4 pb-4">
            <MobileAppDownload showOnLogin={true} autoShow={true} />
          </div>
        )}

        {/* Always Available Mobile Download Component (hidden) */}
        <MobileAppDownload showOnLogin={false} />

        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-20 items-center gap-4 border-b border-green-200/50 bg-white/95 backdrop-blur-xl px-4 sm:px-6 lg:px-8 shadow-sm dark:bg-green-950/95 dark:border-green-800/50 flex-shrink-0">
          <div className="flex items-center gap-4">
            <MobileMenuButton onClick={() => setSidebarOpen(true)} />

            {/* Breadcrumb */}
            <div className="hidden sm:flex items-center space-x-2 text-base font-medium text-orange-600 dark:text-orange-400">
              <span className="px-3 py-1 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 rounded-lg dark:from-green-900/30 dark:to-emerald-900/30 dark:text-green-300">
                Dashboard
              </span>
              <span>/</span>
              <span className="text-green-900 dark:text-green-100 font-semibold">{pageTitle}</span>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-4">
            {/* Notifications - Only visible to IT Head and Admin */}
            {canSeeNotifications && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
                      >
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    Notifications
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{unreadCount}</Badge>
                      {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-6 text-xs">
                          Mark all read
                        </Button>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {recentNotifications.length > 0 ? (
                    recentNotifications.map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className="flex flex-col items-start p-4 cursor-pointer"
                        onClick={() => !notification.isRead && markAsRead(notification.id)}
                      >
                        <div className="flex w-full items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("font-medium text-sm", !notification.isRead && "text-primary")}>
                                {notification.title}
                              </span>
                              {!notification.isRead && <div className="w-2 h-2 bg-primary rounded-full"></div>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notification.message}</p>
                            <span className="text-xs text-muted-foreground mt-1">
                              {formatDisplayDateTime(notification.timestamp)}
                            </span>
                          </div>
                          <Badge
                            variant={
                              notification.type === "success"
                                ? "default"
                                : notification.type === "warning"
                                  ? "secondary"
                                  : notification.type === "error"
                                    ? "destructive"
                                    : "outline"
                            }
                            className="text-xs ml-2"
                          >
                            {notification.type}
                          </Badge>
                        </div>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem className="text-center text-muted-foreground py-8">
                      No notifications
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-center text-primary">
                    <a href="/dashboard/notifications" className="w-full">
                      View all notifications
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* User display: name + role only, no dropdown for non-admins */}
            <div className="flex items-center gap-2 pl-2">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium leading-none">{user?.name || "User"}</span>
                <span className="text-xs text-muted-foreground capitalize mt-0.5">{user?.role?.replace(/_/g, " ") || "staff"}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Quick-access icon bar — visible for all roles */}
        {quickIconLinks.length > 0 && (
          <div className="border-b border-green-200/50 bg-white/85 px-2 shadow-sm backdrop-blur-sm dark:border-green-800/50 dark:bg-green-950/75 sm:px-4">
            <div className="mx-auto flex max-w-7xl gap-0.5 overflow-x-auto py-1.5 scrollbar-none">
              {quickIconLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname?.startsWith(`${link.href}/`))
                const Icon = link.icon
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    title={link.name}
                    className={cn(
                      "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-150 min-w-[52px] flex-shrink-0",
                      isActive
                        ? "bg-green-500 text-white shadow-sm"
                        : "text-green-700 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900/40"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="leading-tight truncate max-w-[48px] text-center">{link.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {quickAccessLinks.length > 0 && (
          <div className="border-b border-green-200/50 bg-white/85 px-4 shadow-sm backdrop-blur-sm dark:border-green-800/50 dark:bg-green-950/75 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto py-3">
              {quickAccessLinks.map((link) => {
                const isActive = pathname === link.href || pathname?.startsWith(`${link.href}/`)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      isActive
                  ? "border-green-500 bg-green-500 text-white"
                  : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300"
                    )}
                  >
                    {link.name}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className={cn("flex-1 p-6 sm:p-8 lg:p-10 overflow-auto", className)}>
          <div className="mx-auto max-w-7xl h-full">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-green-200/50 dark:bg-green-950/80 dark:border-green-800/50 p-8 min-h-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
