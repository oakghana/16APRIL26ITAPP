"use client"

import type React from "react"

import { useAuth } from "@/lib/auth-context"
import { getCanonicalLocationName } from "@/lib/location-filter"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { Home, Laptop, Wrench, MessageSquare, Users, UserPlus, Bell, Settings, BarChart3, FileText } from "lucide-react"

interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: string[]
}

const navigationItems: NavigationItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: Home,
    roles: ["admin", "it_head", "it_staff", "service_desk_head", "service_desk_staff", "user", "service_provider"],
  },
  {
    name: "Store Overview",
    href: "/dashboard/store-overview",
    icon: BarChart3,
    roles: ["admin", "it_store_head", "regional_it_head"],
  },
  {
    name: "Assign Stock",
    href: "/dashboard/assign-stock",
    icon: UserPlus,
    roles: ["admin", "it_store_head", "regional_it_head"],
  },
  {
    name: "Devices",
    href: "/dashboard/devices",
    icon: Laptop,
    roles: ["admin", "it_head", "it_staff"],
  },
  {
    name: "Repairs",
    href: "/dashboard/repairs",
    icon: Wrench,
    roles: ["admin", "it_head", "it_staff"],
  },
  {
    name: "Assigned Repairs",
    href: "/dashboard/assigned-repairs",
    icon: Wrench,
    roles: ["service_provider"],
  },
  {
    name: "Service Desk",
    href: "/dashboard/service-desk",
    icon: MessageSquare,
    roles: ["admin", "it_head", "service_desk_head", "service_desk_staff", "user"],
  },
  {
    name: "My Complaints",
    href: "/dashboard/complaints",
    icon: FileText,
    roles: ["user", "it_staff", "service_desk_staff"],
  },
  {
    name: "Users",
    href: "/dashboard/users",
    icon: Users,
    roles: ["admin", "it_head"],
  },
  {
    name: "HOD Mapping",
    href: "/dashboard/admin/department-heads",
    icon: Users,
    roles: ["admin"],
  },
  {
    name: "IT Forms",
    href: "/dashboard/it-forms/equipment-requisition",
    icon: FileText,
    roles: ["admin", "it_head", "department_head", "it_staff", "regional_it_head", "it_store_head", "service_desk_head", "service_desk_staff", "staff", "user"],
  },
  {
    name: "User Accounts",
    href: "/dashboard/user-accounts", 
    icon: UserPlus,
    roles: ["admin", "it_head", "it_staff", "service_desk_head", "service_desk_staff", "user", "service_provider"],
  },
  {
    name: "Notifications",
    href: "/dashboard/notifications",
    icon: Bell,
    roles: ["admin", "it_head", "service_desk_head"],
  },
  {
    name: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
    roles: ["admin"],
  },
  {
    name: "Staff Performance",
    href: "/dashboard/staff-performance-report",
    icon: BarChart3,
    roles: ["it_staff", "it_head", "it_store_head", "regional_it_head", "admin"],
  },
  {
    name: "System Settings",
    href: "/dashboard/system-settings",
    icon: Settings,
    roles: ["admin"],
  },
]

interface FormNavigationProps {
  currentPage?: string
  className?: string
}

export function FormNavigation({ currentPage, className = "" }: FormNavigationProps) {
  const { user } = useAuth()
  const router = useRouter()

  if (!user) return null

  // Filter navigation items based on user role
  const allowedItems = navigationItems.filter((item) => item.roles.includes(user.role))

  const handleNavigation = (href: string) => {
    router.push(href)
  }

  return (
    <Card className={`mb-4 ${className}`}>
      <CardContent className="p-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400">Quick Navigation</h3>
            <span className="text-xs text-gray-500 dark:text-gray-500 capitalize">
              {user.role.replace(/_/g, " ")} • {getCanonicalLocationName(user.location)}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {allowedItems.map((item) => {
              const Icon = item.icon
              const isActive = currentPage === item.href

              return (
                <Button
                  key={item.href}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleNavigation(item.href)}
                  className="h-8 rounded-full"
                >
                  <Icon className="mr-1.5 h-3.5 w-3.5" />
                  {item.name}
                </Button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
