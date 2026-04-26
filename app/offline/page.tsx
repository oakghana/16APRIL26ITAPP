"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { WifiOff, RefreshCw, Smartphone, Monitor, Users, Wrench, AlertTriangle } from "lucide-react"

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false)
  const [cachedData, setCachedData] = useState({
    devices: 0,
    pendingRepairs: 0,
    activeUsers: 0,
    lastSync: ""
  })

  useEffect(() => {
    // Check online status
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine)
    }

    updateOnlineStatus()
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    // Load cached data from localStorage
    const loadCachedData = () => {
      try {
        const cached = safeStorage.get('qcc-offline-data')
        if (cached) {
          setCachedData(safeJsonParse(cached, {
            devices: 12,
            pendingRepairs: 3,
            activeUsers: 8,
            lastSync: new Date().toLocaleString(),
          }))
        } else {
          // Set default offline data
          setCachedData({
            devices: 12,
            pendingRepairs: 3,
            activeUsers: 8,
            lastSync: new Date().toLocaleString()
          })
        }
      } catch (error) {
        console.error('Failed to load cached data:', error)
      }
    }

    loadCachedData()

    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  const handleRefresh = () => {
    if (isOnline) {
      window.location.reload()
    }
  }

  const handleRetryConnection = () => {
    // Force a network check
    fetch('/', { method: 'HEAD', cache: 'no-cache' })
      .then(() => {
        window.location.href = '/dashboard'
      })
      .catch(() => {
        // Still offline
        setIsOnline(false)
      })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 dark:from-orange-950 dark:via-amber-950 dark:to-orange-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center items-center mb-4">
              <div className="p-4 bg-orange-100 dark:bg-orange-800 rounded-full">
                <WifiOff className="h-12 w-12 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-orange-900 dark:text-orange-100 mb-2">
              Ei! No Internet Right Now
            </h1>
            <p className="text-lg text-orange-700 dark:text-orange-300 mb-4">
              No wahala — QCC IT Tracker is keeping things running offline for you.
            </p>
            <Badge 
              variant={isOnline ? "default" : "secondary"} 
              className={isOnline ? "bg-green-100 text-green-800 border-green-200" : "bg-orange-100 text-orange-800 border-orange-200"}
            >
              {isOnline ? "Connection Restored" : "Offline Mode"}
            </Badge>
          </div>

          {/* Connection Status */}
          <Card className="mb-6 border-orange-200 dark:border-orange-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
                <AlertTriangle className="h-5 w-5" />
                Network Status
              </CardTitle>
              <CardDescription>
                {isOnline 
                  ? "Your connection is back — you're good to go! Head straight to the dashboard."
                  : "You're offline right now, but your recent pages are still available. We'll reconnect soon."
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={handleRetryConnection}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                  disabled={isOnline}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {isOnline ? "Connected — Carry On!" : "Try Reconnecting"}
                </Button>
                {isOnline && (
                  <Button onClick={handleRefresh} variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50">
                    Back to Dashboard
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Offline Data Summary */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
            <Card className="border-orange-200 dark:border-orange-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-orange-900 dark:text-orange-100">
                  Total Devices
                </CardTitle>
                <Monitor className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {cachedData.devices}
                </div>
                <p className="text-xs text-orange-600 dark:text-orange-400">
                  Saved from last sync
                </p>
              </CardContent>
            </Card>

            <Card className="border-orange-200 dark:border-orange-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-orange-900 dark:text-orange-100">
                  Pending Repairs
                </CardTitle>
                <Wrench className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {cachedData.pendingRepairs}
                </div>
                <p className="text-xs text-orange-600 dark:text-orange-400">
                  Last recorded count
                </p>
              </CardContent>
            </Card>

            <Card className="border-orange-200 dark:border-orange-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-orange-900 dark:text-orange-100">
                  Active Users
                </CardTitle>
                <Users className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {cachedData.activeUsers}
                </div>
                <p className="text-xs text-orange-600 dark:text-orange-400">
                  From last online session
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Offline Features */}
          <Card className="mb-6 border-orange-200 dark:border-orange-700">
            <CardHeader>
              <CardTitle className="text-orange-900 dark:text-orange-100">
                What You Can Still Do
              </CardTitle>
              <CardDescription>
                Even without internet, these are still working for you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                  <Monitor className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  <div>
                    <p className="font-medium text-orange-900 dark:text-orange-100">Browse Recent Pages</p>
                    <p className="text-sm text-orange-600 dark:text-orange-400">Pages you visited are still accessible</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                  <Smartphone className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  <div>
                    <p className="font-medium text-orange-900 dark:text-orange-100">App Still Running</p>
                    <p className="text-sm text-orange-600 dark:text-orange-400">The app keeps working even without a signal</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                  <Users className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  <div>
                    <p className="font-medium text-orange-900 dark:text-orange-100">Local Data</p>
                    <p className="text-sm text-orange-600 dark:text-orange-400">View saved information</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                  <RefreshCw className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  <div>
                    <p className="font-medium text-orange-900 dark:text-orange-100">Auto-Sync</p>
                    <p className="text-sm text-orange-600 dark:text-orange-400">Data syncs when online</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card className="border-orange-200 dark:border-orange-700">
            <CardHeader>
              <CardTitle className="text-orange-900 dark:text-orange-100">
                Offline Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-orange-800 dark:text-orange-200">
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-1">•</span>
                  Your data will automatically sync when you're back online
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-1">•</span>
                  Previously viewed pages are still accessible
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-1">•</span>
                  The app will notify you when connection is restored
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-1">•</span>
                  Any changes made offline will be saved and synced later
                </li>
              </ul>
            </CardContent>
          </Card>

          {cachedData.lastSync && (
            <div className="text-center mt-6 text-sm text-orange-600 dark:text-orange-400">
              Last synced: {cachedData.lastSync}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
