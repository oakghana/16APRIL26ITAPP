"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useBadgeCounts } from "@/hooks/use-badge-counts"
import { offlineCacheManager } from "@/lib/offline-cache"
import { getRoleColorScheme } from "@/lib/role-colors"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Menu,
  X,
  Home,
  Monitor,
  Wrench,
  Users,
  UserPlus,
  Bell,
  LogOut,
  Settings,
  Headphones,
  MessageSquare,
  BarChart3,
  Database,
  ClipboardList,
  Plus,
  ChevronDown,
  ChevronRight,
  Building2,
  Truck,
  FileText,
  PanelLeftClose,
  PanelLeft,
  Package,
  Rss,
  BookOpen,
  UserCheck,
  Send,
  Store,
  Edit2,
  Target,
  Laptop,
  Wifi,
} from "lucide-react"
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog"

interface NavigationItem {
  name: string
  href: string
  icon: React.ElementType
  badge?: string | number
}

interface NavigationGroup {
  name: string
  icon: React.ElementType
  badge?: number
  items: NavigationItem[]
}

interface ModernSidebarProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  className?: string
  onCollapseChange?: (collapsed: boolean) => void
}

export function ModernSidebar({ isOpen, setIsOpen, className, onCollapseChange }: ModernSidebarProps) {
  const { user, logout } = useAuth()
  const { counts, loading } = useBadgeCounts(user)
  const pathname = usePathname()
  const router = useRouter()
  const [isProfileExpanded, setIsProfileExpanded] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])
  const [editProfileOpen, setEditProfileOpen] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (onCollapseChange) {
      onCollapseChange(isCollapsed)
    }
  }, [isCollapsed, onCollapseChange])

  const roleColors = user?.role ? getRoleColorScheme(user.role) : null

  const isActiveLink = (href: string) => pathname === href || (href !== "/dashboard" && pathname?.startsWith(`${href}/`))

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupName) 
        ? prev.filter(g => g !== groupName)
        : [...prev, groupName]
    )
  }

  const getNavigationItems = (): { items: NavigationItem[]; groups: NavigationGroup[] } => {
    if (user?.role === "staff" || user?.role === "user") {
      return {
        items: [
          { name: "My Complaints", href: "/dashboard/complaints", icon: MessageSquare },
          { name: "IT Store Stock Levels", href: "/dashboard/store-snapshot", icon: Database },
        ],
        groups: [
          {
            name: "IT Forms",
            icon: FileText,
            items: [
              { name: "Equipment Requisition", href: "/dashboard/it-forms/equipment-requisition", icon: Laptop },
              { name: "Maintenance & Repairs", href: "/dashboard/it-forms/maintenance-repairs", icon: Wrench },
              { name: "New Gadget Request", href: "/dashboard/it-forms/new-gadget", icon: Laptop },
            ],
          },
        ],
      }
    }

    if (user?.role === "admin") {
      return {
        items: [],
        groups: [
          {
            name: "IT Operations",
            icon: Building2,
            badge: counts.itStaffStatus > 0 ? counts.itStaffStatus : undefined,
            items: [
              {
                name: "IT Staff Status",
                href: "/dashboard/it-staff-status",
                icon: Users,
                badge: counts.itStaffStatus > 0 ? counts.itStaffStatus : undefined,
              },
              { name: "Staff Performance Report", href: "/dashboard/staff-performance-report", icon: Target },
              { name: "Weekly Internet Report", href: "/dashboard/weekly-internet-report", icon: Wifi },
              { name: "Reports & Analysis", href: "/dashboard/it-reports", icon: BarChart3 },
              { name: "IT Documents", href: "/dashboard/it-documents", icon: FileText },
            ],
          },
          {
            name: "Service & Repairs",
            icon: Wrench,
            badge: counts.repairs > 0 ? counts.repairs : undefined,
            items: [
              {
                name: "Repairs",
                href: "/dashboard/repairs",
                icon: Wrench,
                badge: counts.repairs > 0 ? counts.repairs : undefined,
              },
              {
                name: "IT Service Provider",
                href: "/dashboard/service-provider",
                icon: Truck,
                badge: counts.serviceProviders > 0 ? counts.serviceProviders : undefined,
              },
              { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
            ],
          },
          {
            name: "Device Management",
            icon: Monitor,
            badge: counts.devices > 0 ? counts.devices : undefined,
            items: [
              { 
                name: "All Devices", 
                href: "/dashboard/devices", 
                icon: Monitor,
                badge: counts.devices > 0 ? counts.devices : undefined,
              },
              {
                name: "Device Summary Report",
                href: "/dashboard/device-summary-report",
                icon: FileText,
              },
              {
                name: "User Device Allocation",
                href: "/dashboard/user-device-allocation",
                icon: UserCheck,
              },
            ],
          },
          {
            name: "Store Management",
            icon: Store,
            badge: counts.storeRequisitions > 0 ? counts.storeRequisitions : undefined,
            items: [
              { name: "Store Overview", href: "/dashboard/store-overview", icon: Package },
              { name: "Store Inventory", href: "/dashboard/store-inventory", icon: Database },
              {
                name: "Assign Stock to Staff",
                href: "/dashboard/assign-stock",
                icon: UserPlus,
              },
              {
                name: "Store Requisitions",
                href: "/dashboard/store-requisitions",
                icon: ClipboardList,
                badge: counts.storeRequisitions > 0 ? counts.storeRequisitions : undefined,
              },
              {
                name: "Stock Transfer Requests",
                href: "/dashboard/stock-transfer-requests",
                icon: Send,
              },
              {
                name: "Stock Balance Report",
                href: "/dashboard/store-summary-report",
                icon: FileText,
              },
            ],
          },
          {
            name: "User Management",
            icon: Users,
            badge: counts.userAccounts > 0 ? counts.userAccounts : undefined,
            items: [
              { name: "All Users", href: "/dashboard/users", icon: Users },
              {
                name: "Pending Approvals",
                href: "/dashboard/user-accounts",
                icon: UserPlus,
                badge: counts.userAccounts > 0 ? counts.userAccounts : undefined,
              },
            ],
          },
          {
            name: "IT Forms",
            icon: FileText,
            items: [
              { name: "Equipment Requisition", href: "/dashboard/it-forms/equipment-requisition", icon: Laptop },
              { name: "Maintenance & Repairs", href: "/dashboard/it-forms/maintenance-repairs", icon: Wrench },
              { name: "New Gadget Request", href: "/dashboard/it-forms/new-gadget", icon: Laptop },
              { name: "Approvals", href: "/dashboard/it-forms/approvals", icon: ClipboardList },
            ],
          },
        ],
      }
    }

    if (user?.role === "it_staff") {
      return {
        items: [
          {
            name: "Assigned Tasks",
            href: "/dashboard/assigned-tasks",
            icon: ClipboardList,
            badge: counts.assignedTasks > 0 ? counts.assignedTasks : undefined,
          },
          {
            name: "Repairs",
            href: "/dashboard/repairs",
            icon: Wrench,
            badge: counts.repairs > 0 ? counts.repairs : undefined,
          },
          { name: "Store Stock Levels", href: "/dashboard/store-snapshot", icon: Package },
          {
            name: "Stock Balance Report",
            href: "/dashboard/store-summary-report",
            icon: FileText,
          },
          {
            name: "Stock Analytics",
            href: "/dashboard/store-analytics",
            icon: BarChart3,
          },
          {
            name: "My Stock Requests",
            href: "/dashboard/store-summary-report",
            icon: FileText,
          },
          {
            name: "Staff Performance Report",
            href: "/dashboard/staff-performance-report",
            icon: Target,
          },
          { name: "IT Documents", href: "/dashboard/it-documents", icon: FileText },
          { name: "My Complaints", href: "/dashboard/complaints", icon: MessageSquare },
        ],
        groups: [
          {
            name: "IT Forms",
            icon: FileText,
            items: [
              { name: "Equipment Requisition", href: "/dashboard/it-forms/equipment-requisition", icon: Laptop },
              { name: "Maintenance & Repairs", href: "/dashboard/it-forms/maintenance-repairs", icon: Wrench },
              { name: "New Gadget Request", href: "/dashboard/it-forms/new-gadget", icon: Laptop },
            ],
          },
        ],
      }
    }

    if (user?.role === "it_store_head") {
      return {
        items: [
          {
            name: "Assigned Tasks",
            href: "/dashboard/assigned-tasks",
            icon: ClipboardList,
            badge: counts.assignedTasks > 0 ? counts.assignedTasks : undefined,
          },
          {
            name: "Repairs",
            href: "/dashboard/repairs",
            icon: Wrench,
            badge: counts.repairs > 0 ? counts.repairs : undefined,
          },
          {
            name: "Staff Performance Report",
            href: "/dashboard/staff-performance-report",
            icon: Target,
          },
          { name: "IT Documents", href: "/dashboard/it-documents", icon: FileText },
          { name: "Users", href: "/dashboard/users", icon: Users },
          { name: "My Complaints", href: "/dashboard/complaints", icon: MessageSquare },
        ],
        groups: [
          {
            name: "IT Forms",
            icon: FileText,
            items: [
              { name: "Equipment Requisition", href: "/dashboard/it-forms/equipment-requisition", icon: Laptop },
              { name: "Maintenance & Repairs", href: "/dashboard/it-forms/maintenance-repairs", icon: Wrench },
              { name: "New Gadget Request", href: "/dashboard/it-forms/new-gadget", icon: Laptop },
            ],
          },
          {
            name: "Store Management",
            icon: Store,
            badge: counts.storeRequisitions > 0 ? counts.storeRequisitions : undefined,
            items: [
              { name: "Store Overview", href: "/dashboard/store-overview", icon: Package },
              { name: "Store Inventory", href: "/dashboard/store-inventory", icon: Database },
              { name: "Store Stock Levels", href: "/dashboard/store-snapshot", icon: Package },
              {
                name: "Assign Stock to Staff",
                href: "/dashboard/assign-stock",
                icon: UserPlus,
              },
              {
                name: "Stock Balance Report",
                href: "/dashboard/store-summary-report",
                icon: FileText,
              },
              {
                name: "Stock Analytics",
                href: "/dashboard/store-analytics",
                icon: BarChart3,
              },
              {
                name: "Assign IT Devices",
                href: "/dashboard/assign-it-devices",
                icon: Monitor,
              },
            ],
          },
        ],
      }
    }

    if (user?.role === "it_head") {
      return {
        items: [],
        groups: [
          {
            name: "IT Operations",
            icon: Building2,
            badge: counts.itStaffStatus > 0 ? counts.itStaffStatus : undefined,
            items: [
              {
                name: "IT Staff Status",
                href: "/dashboard/it-staff-status",
                icon: Users,
                badge: counts.itStaffStatus > 0 ? counts.itStaffStatus : undefined,
              },
              { name: "Staff Performance Report", href: "/dashboard/staff-performance-report", icon: Target },
              { name: "Weekly Internet Report", href: "/dashboard/weekly-internet-report", icon: Wifi },
              { name: "Reports & Analysis", href: "/dashboard/it-reports", icon: BarChart3 },
              { name: "IT Documents", href: "/dashboard/it-documents", icon: FileText },
            ],
          },
          {
            name: "Service & Repairs",
            icon: Wrench,
            badge: counts.repairs > 0 ? counts.repairs : undefined,
            items: [
              {
                name: "Repairs",
                href: "/dashboard/repairs",
                icon: Wrench,
                badge: counts.repairs > 0 ? counts.repairs : undefined,
              },
            ],
          },
          {
            name: "Device Management",
            icon: Monitor,
            badge: counts.devices > 0 ? counts.devices : undefined,
            items: [
              { 
                name: "All Devices", 
                href: "/dashboard/devices", 
                icon: Monitor,
                badge: counts.devices > 0 ? counts.devices : undefined,
              },
              {
                name: "Device Summary Report",
                href: "/dashboard/device-summary-report",
                icon: FileText,
              },
              {
                name: "User Device Allocation",
                href: "/dashboard/user-device-allocation",
                icon: UserCheck,
              },
              {
                name: "Assign IT Devices",
                href: "/dashboard/assign-it-devices",
                icon: Monitor,
              },
            ],
          },
          {
            name: "Store Management",
            icon: Store,
            badge: counts.storeRequisitions > 0 ? counts.storeRequisitions : undefined,
            items: [
              { name: "Store Inventory", href: "/dashboard/store-inventory", icon: Package },
              {
                name: "Stock Balance Report",
                href: "/dashboard/store-summary-report",
                icon: FileText,
              },
            ],
          },
          {
            name: "IT Forms",
            icon: FileText,
            items: [
              { name: "Equipment Requisition", href: "/dashboard/it-forms/equipment-requisition", icon: Laptop },
              { name: "Maintenance & Repairs", href: "/dashboard/it-forms/maintenance-repairs", icon: Wrench },
              { name: "New Gadget Request", href: "/dashboard/it-forms/new-gadget", icon: Laptop },
              { name: "Approvals", href: "/dashboard/it-forms/approvals", icon: ClipboardList },
            ],
          },
        ],
      }
    }

    // Regional IT Head role - manages regional IT operations (location-based)
    if (user?.role === "regional_it_head") {
      return {
        items: [],
        groups: [
          {
            name: "IT Forms",
            icon: FileText,
            items: [
              { name: "Equipment Requisition", href: "/dashboard/it-forms/equipment-requisition", icon: Laptop },
              { name: "Maintenance & Repairs", href: "/dashboard/it-forms/maintenance-repairs", icon: Wrench },
              { name: "New Gadget Request", href: "/dashboard/it-forms/new-gadget", icon: Laptop },
            ],
          },
          {
            name: "IT Operations",
            icon: Building2,
            badge: counts.itStaffStatus > 0 ? counts.itStaffStatus : undefined,
            items: [
              {
                name: "IT Staff Status",
                href: "/dashboard/it-staff-status",
                icon: Users,
                badge: counts.itStaffStatus > 0 ? counts.itStaffStatus : undefined,
              },
              { name: "Staff Performance Report", href: "/dashboard/staff-performance-report", icon: Target },
              { name: "Weekly Internet Report", href: "/dashboard/weekly-internet-report", icon: Wifi },
              { name: "Reports & Analysis", href: "/dashboard/it-reports", icon: BarChart3 },
              { name: "IT Documents", href: "/dashboard/it-documents", icon: FileText },
            ],
          },
          {
            name: "Service & Repairs",
            icon: Wrench,
            badge: counts.repairs > 0 ? counts.repairs : undefined,
            items: [
              {
                name: "Repairs",
                href: "/dashboard/repairs",
                icon: Wrench,
                badge: counts.repairs > 0 ? counts.repairs : undefined,
              },
            ],
          },
          {
            name: "Store Management",
            icon: Store,
            badge: counts.storeRequisitions > 0 ? counts.storeRequisitions : undefined,
            items: [
              { name: "Store Overview", href: "/dashboard/store-overview", icon: Package },
              { name: "Store Stock Levels", href: "/dashboard/store-snapshot", icon: Database },
              {
                name: "Assign Stock to Staff",
                href: "/dashboard/assign-stock",
                icon: UserPlus,
              },
              {
                name: "Stock Balance Report",
                href: "/dashboard/store-summary-report",
                icon: FileText,
              },
            ],
          },
        ],
      }
    }

    if (user?.role === "department_head") {
      return {
        items: [],
        groups: [
          {
            name: "IT Forms",
            icon: FileText,
            items: [
              { name: "Equipment Requisition", href: "/dashboard/it-forms/equipment-requisition", icon: Laptop },
              { name: "Maintenance & Repairs", href: "/dashboard/it-forms/maintenance-repairs", icon: Wrench },
              { name: "New Gadget Request", href: "/dashboard/it-forms/new-gadget", icon: Laptop },
              { name: "Approvals", href: "/dashboard/it-forms/approvals", icon: ClipboardList },
            ],
          },
        ],
      }
    }

    if (user?.role === "service_provider") {
      return {
        items: [
          {
            name: "My Tasks (Legacy)",
            href: "/dashboard/service-provider",
            icon: Wrench,
          },
        ],
        groups: [],
      }
    }

    // Location-based Service Desk roles
    if (user?.role?.startsWith("service_desk")) {
      return {
        items: [
          {
            name: "Assigned Tasks",
            href: "/dashboard/assigned-tasks",
            icon: ClipboardList,
            badge: counts.assignedTasks > 0 ? counts.assignedTasks : undefined,
          },
          {
            name: "IT Staff Status",
            href: "/dashboard/it-staff-status",
            icon: Users,
            badge: counts.itStaffStatus > 0 ? counts.itStaffStatus : undefined,
          },
          {
            name: "Repairs",
            href: "/dashboard/repairs",
            icon: Wrench,
            badge: counts.repairs > 0 ? counts.repairs : undefined,
          },
          { name: "IT Documents", href: "/dashboard/it-documents", icon: FileText },
        ],
        groups: [
          {
            name: "IT Forms",
            icon: FileText,
            items: [
              { name: "Equipment Requisition", href: "/dashboard/it-forms/equipment-requisition", icon: Laptop },
              { name: "Maintenance & Repairs", href: "/dashboard/it-forms/maintenance-repairs", icon: Wrench },
              { name: "New Gadget Request", href: "/dashboard/it-forms/new-gadget", icon: Laptop },
              { name: "Approvals", href: "/dashboard/it-forms/approvals", icon: ClipboardList },
            ],
          },
        ],
      }
    }

    return { items: [], groups: [] }
  }

  const handleLogout = () => {
    // Clear ALL cached data before logout
    offlineCacheManager.clearCache()
    
    // Clear localStorage and sessionStorage
    if (typeof window !== "undefined") {
      localStorage.clear()
      sessionStorage.clear()
    }

    // Wait a moment for cache to clear, then logout
    setTimeout(() => {
      logout()
      window.location.href = "/"
    }, 100)
  }

  const navigation = useMemo(() => getNavigationItems(), [user, counts])

  useEffect(() => {
    if (navigation.groups.length > 0) {
      const activeGroups = navigation.groups
        .filter((group) => group.items.some((item) => isActiveLink(item.href)))
        .map((group) => group.name)

      setExpandedGroups((prev) => (prev.length > 0 ? prev : activeGroups))
    }
  }, [pathname, navigation.groups])

  // Prevent hydration mismatch by not rendering until mounted
  if (!isMounted) {
    return null
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "h-screen bg-white/90 backdrop-blur-2xl border-r border-gray-100/80 shadow-2xl",
          "dark:bg-gray-950/95 dark:border-gray-800/80",
          // Mobile: fixed overlay
          "fixed left-0 top-0 z-50 transform transition-all duration-300 ease-in-out lg:relative lg:z-auto",
          isCollapsed ? "w-20" : "w-64",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          className,
        )}
      >
        <div className="flex h-full flex-col">
          {/* Minimalist Header */}
          <div className="flex h-14 items-center justify-between px-3 border-b border-gray-100 dark:border-gray-800">
            {!isCollapsed && (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-600 to-yellow-600 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-sm">Q</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">QCC IT</h2>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Quality Control Co.</p>
                </div>
              </div>
            )}
            {isCollapsed && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-600 to-yellow-600 flex items-center justify-center shadow-lg mx-auto">
                <span className="text-white font-bold text-sm">Q</span>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hidden lg:flex hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => setIsCollapsed(!isCollapsed)}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 lg:hidden hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* User Profile */}
          {!isCollapsed && (
            <div className="p-3 border-b border-gray-100 dark:border-gray-800">
              <Button
                variant="ghost"
                className="w-full p-0 h-auto hover:bg-gray-50 dark:hover:bg-gray-800/50"
                onClick={() => setIsProfileExpanded(!isProfileExpanded)}
              >
                <div className="flex items-center justify-between w-full p-3 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10 ring-2 ring-blue-100 dark:ring-blue-900">
                      <AvatarImage src="/placeholder-user.jpg" />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white font-medium text-sm">
                        {user?.name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("") || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">
                        {user?.name || "User"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user?.role?.replace("_", " ") || "Staff"}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-gray-400 transition-transform duration-200",
                      isProfileExpanded && "rotate-180",
                    )}
                  />
                </div>
              </Button>

              {isProfileExpanded && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <p className="text-xs text-gray-600 dark:text-gray-400">{user?.email || "user@qcc.com.gh"}</p>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {user?.location?.replace("_", " ") || "Kumasi"}
                    </Badge>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-gray-600 dark:text-gray-400">Online</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {isCollapsed && (
            <div className="p-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex justify-center">
                <Avatar className="h-10 w-10 ring-2 ring-blue-100 dark:ring-blue-900">
                  <AvatarImage src="/placeholder-user.jpg" />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white font-medium text-sm">
                    {user?.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("") || "U"}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          )}

          {/* Navigation */}
          <ScrollArea className="flex-1 px-2 py-3 scrollbar-thin scrollbar-thumb-orange-500 scrollbar-track-gray-100 dark:scrollbar-track-gray-800 hover:scrollbar-thumb-orange-600">
            <nav className="space-y-0.5">
              {/* Regular navigation items */}
              {navigation.items.map((item) => (
                <div key={item.name} className="relative group">
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-3 rounded-lg px-3 py-2 text-gray-700 transition-all duration-200 group relative dark:text-gray-300",
                      isActiveLink(item.href)
                        ? "bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                        : "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100",
                      isCollapsed ? "justify-center" : "justify-between",
                    )}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <div className={cn("flex items-center", isCollapsed ? "justify-center" : "space-x-3")}>
                      <div className="relative">
                        <item.icon className="h-5 w-5" />
                        {item.badge && isCollapsed && (
                          <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs bg-red-500 text-white border-2 border-white dark:border-gray-950">
                            {typeof item.badge === "number" && item.badge > 9 ? "9+" : item.badge}
                          </Badge>
                        )}
                      </div>
                      {!isCollapsed && <span className="font-medium text-sm">{item.name}</span>}
                    </div>
                    {!isCollapsed && item.badge && (
                      <Badge variant="secondary" className="h-5 px-2 text-xs bg-red-500 text-white border-none">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                      {item.name}
                      {item.badge && (
                        <span className="ml-2 px-1 bg-red-500 text-white rounded text-xs">{item.badge}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Collapsible navigation groups */}
              {navigation.groups.length > 0 && !isCollapsed && (
                <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
                  {navigation.groups.map((group) => (
                    <Collapsible
                      key={group.name}
                      open={user?.role === "admin" ? true : expandedGroups.includes(group.name)}
                      onOpenChange={() => {
                        if (user?.role !== "admin") {
                          toggleGroup(group.name)
                        }
                      }}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between px-3 py-2.5 h-auto font-medium text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <div className="flex items-center space-x-3">
                            <group.icon className="h-5 w-5" />
                            <span>{group.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {group.badge && (
                              <Badge variant="secondary" className="h-5 px-2 text-xs bg-red-500 text-white border-none">
                                {group.badge}
                              </Badge>
                            )}
                            {user?.role !== "admin" && (
                              <ChevronRight
                                className={cn(
                                  "h-4 w-4 transition-transform duration-200",
                                  expandedGroups.includes(group.name) && "rotate-90"
                                )}
                              />
                            )}
                          </div>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-4 space-y-1 mt-1">
                        {group.items.map((item) => (
                          <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                              "flex items-center justify-between rounded-lg px-3 py-1.5 text-sm text-gray-600 transition-all duration-200 dark:text-gray-400",
                              isActiveLink(item.href)
                                ? "bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                                : "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100",
                            )}
                          >
                            <div className="flex items-center space-x-3">
                              <item.icon className="h-4 w-4" />
                              <span>{item.name}</span>
                            </div>
                            {item.badge && (
                              <Badge variant="secondary" className="h-5 px-2 text-xs bg-red-500 text-white border-none">
                                {item.badge}
                              </Badge>
                            )}
                          </Link>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}

              {/* Collapsed state for groups */}
              {navigation.groups.length > 0 && isCollapsed && (
                <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
                  {navigation.groups.map((group) => (
                    <div key={group.name} className="relative group">
                      <Button
                        variant="ghost"
                        className="w-full justify-center px-3 py-2.5 h-auto"
                        onClick={() => router.push(group.items[0]?.href || "/dashboard")}
                      >
                        <div className="relative">
                          <group.icon className="h-5 w-5" />
                          {group.badge && (
                            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs bg-red-500 text-white border-2 border-white dark:border-gray-950">
                              {group.badge > 9 ? "9+" : group.badge}
                            </Badge>
                          )}
                        </div>
                      </Button>
                      <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                        {group.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </nav>

            {/* Quick Actions - only when not collapsed */}
            {!isCollapsed && user?.role !== "admin" && (
              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="px-3 mb-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Quick Actions
                  </p>
                </div>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    onClick={() => {
                      if (user?.role === "staff") {
                        router.push("/dashboard/complaints")
                      } else {
                        router.push("/dashboard/repairs")
                      }
                    }}
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    New Request
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="border-t border-gray-100 dark:border-gray-800 p-3 space-y-1">
            {!isCollapsed ? (
              <>
                {(user?.role === "regional_it_head" || user?.role === "it_staff" || user?.role === "it_store_head" || user?.role === "service_desk_head" || user?.role === "service_desk_staff") && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm h-10 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    onClick={() => setEditProfileOpen(true)}
                  >
                    <Edit2 className="mr-3 h-4 w-4" />
                    Edit Profile
                  </Button>
                )}
                {(user?.role === "admin" || user?.role === "it_head") && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                    onClick={() => router.push("/dashboard/settings")}
                  >
                    <Settings className="mr-3 h-4 w-4" />
                    Settings
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm h-10 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  Sign Out
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                {(user?.role === "regional_it_head" || user?.role === "it_staff" || user?.role === "it_store_head" || user?.role === "service_desk_head" || user?.role === "service_desk_staff") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-full h-10 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    onClick={() => setEditProfileOpen(true)}
                    title="Edit Profile"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
                {(user?.role === "admin" || user?.role === "it_head") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-full h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                    onClick={() => router.push("/dashboard/settings")}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full h-10 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </aside>
      {/* Edit Profile Dialog */}
      <EditProfileDialog
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
      />
    </>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClick}>
      <Menu className="h-5 w-5" />
    </Button>
  )
}
