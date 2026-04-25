"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import type { User } from "@/lib/auth-context"
import { canSeeAllLocations } from "@/lib/location-filter"

export interface BadgeCounts {
  assignedTasks: number
  itFormsQueue: number
  itWorkQueue: number
  serviceDeskTickets: number
  repairs: number
  storeRequisitions: number
  serviceProviders: number
  userAccounts: number
  itStaffStatus: number
  notifications: number
  updates: number
  devices: number
  stockAllocations: number
  lowStockItems: number
  pendingUserApprovals: number
  readyForPickup: number
}

const DEFAULT_COUNTS: BadgeCounts = {
  assignedTasks: 0,
  itFormsQueue: 0,
  itWorkQueue: 0,
  serviceDeskTickets: 0,
  repairs: 0,
  storeRequisitions: 0,
  serviceProviders: 0,
  userAccounts: 0,
  itStaffStatus: 0,
  notifications: 0,
  updates: 0,
  devices: 0,
  stockAllocations: 0,
  lowStockItems: 0,
  pendingUserApprovals: 0,
  readyForPickup: 0,
}

// Cache for badge counts (30 second TTL)
const CACHE_TTL = 30000
let cachedCounts: BadgeCounts | null = null
let cacheTimestamp = 0

export function useBadgeCounts(user: User | null) {
  const [counts, setCounts] = useState<BadgeCounts>(DEFAULT_COUNTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchInProgress = useRef(false)
  const refreshInterval = useRef<NodeJS.Timeout | null>(null)

  const fetchCounts = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setLoading(false)
      return
    }

    // Check cache first (unless force refresh)
    const now = Date.now()
    if (!forceRefresh && cachedCounts && (now - cacheTimestamp) < CACHE_TTL) {
      setCounts(cachedCounts)
      setLoading(false)
      return
    }

    // Prevent concurrent fetches
    if (fetchInProgress.current) return
    fetchInProgress.current = true

    // Retry logic for transient failures
    let retries = 0
    const maxRetries = 2
    
    while (retries <= maxRetries) {
      try {
        const canSeeAll = canSeeAllLocations(user)
        const location = user.location || ""

        // Build query params
        const params = new URLSearchParams({
          location: location,
          canSeeAll: String(canSeeAll),
          userId: user.id || "",
          userEmail: user.email || "",
          userName: user.full_name || user.name || user.username || "",
          userRole: user.role || "",
          region: user.region || "",
          district: user.district || "",
        })

        const response = await fetch(`/api/dashboard/badge-counts?${params}`, {
          signal: AbortSignal.timeout(10000), // 10 second timeout
        })
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const data = await response.json()

        // Map API response to BadgeCounts interface
        const newCounts: BadgeCounts = {
          assignedTasks: data.assignedTasks ?? 0,
          itFormsQueue: data.itFormsQueue ?? 0,
          itWorkQueue: data.itWorkQueue ?? 0,
          serviceDeskTickets: data.serviceDeskTickets ?? 0,
          repairs: data.repairs ?? 0,
          storeRequisitions: data.storeRequisitions ?? 0,
          serviceProviders: data.serviceProviders ?? 0,
          userAccounts: data.userAccounts ?? 0,
          itStaffStatus: data.itStaffStatus ?? 0,
          notifications: data.notifications ?? 0,
          updates: data.updates ?? 0,
          devices: data.devices ?? 0,
          stockAllocations: data.stockAllocations ?? 0,
          lowStockItems: data.lowStockItems ?? 0,
          pendingUserApprovals: data.pendingUserApprovals ?? 0,
          readyForPickup: data.readyForPickup ?? 0,
        }

        // Handle error values (-1 means query failed)
        for (const key of Object.keys(newCounts) as (keyof BadgeCounts)[]) {
          if (newCounts[key] === -1) {
            newCounts[key] = 0 // Display 0 instead of -1 on error
          }
        }

        // Update cache
        cachedCounts = newCounts
        cacheTimestamp = now

        setCounts(newCounts)
        setError(null)
        break // Success, exit retry loop
      } catch (err) {
        retries++
        if (retries > maxRetries) {
          console.error("[v0] Error fetching badge counts after retries:", err)
          setError(err instanceof Error ? err.message : "Unknown error")
          // Keep previous counts on error
        } else {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 500 * retries))
        }
      }
    }
    
    setLoading(false)
    fetchInProgress.current = false
  }, [user])

  // Initial fetch and interval setup
  useEffect(() => {
    fetchCounts()

    // Refresh counts every 60 seconds
    refreshInterval.current = setInterval(() => {
      fetchCounts(true) // Force refresh on interval
    }, 60000)

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current)
      }
    }
  }, [fetchCounts])

  // Refresh on route change
  useEffect(() => {
    const handleRouteChange = () => {
      // Debounce route change refreshes
      setTimeout(() => fetchCounts(), 500)
    }

    window.addEventListener('popstate', handleRouteChange)
    return () => window.removeEventListener('popstate', handleRouteChange)
  }, [fetchCounts])

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchCounts(true)
  }, [fetchCounts])

  return { counts, loading, error, refresh }
}
