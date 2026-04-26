"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { getCanonicalLocationName } from "@/lib/location-filter"

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    fullName: "",
    password: "",
    confirmPassword: "",
    phone: "",
    department: "",
    location: "head_office",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState("")
  const [locations, setLocations] = useState<{ name: string; code: string }[]>([])

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch("/api/admin/lookup-data?type=locations")
        if (response.ok) {
          const data = await response.json()
          const mapped = data
            .filter((loc: any) => loc.is_active !== false)
            .map((loc: any) => ({
              name: getCanonicalLocationName(loc.name),
              code: getCanonicalLocationName(loc.code || loc.name),
            }))
          // Deduplicate by canonical code
          const seen = new Set<string>()
          setLocations(
            mapped.filter((loc: { code: string }) => {
              if (seen.has(loc.code)) return false
              seen.add(loc.code)
              return true
            })
          )
        }
      } catch (err) {
        console.error("[v0] Error fetching locations:", err)
      }
    }
    fetchLocations()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Ei! Your passwords don't match — please check and try again.")
      setIsLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setError("Password too short — use at least 8 characters to keep it secure.")
      return
    }

    try {
      // TODO: Replace with actual API call to Supabase
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setIsSuccess(true)
      } else {
        const data = await response.json()
        setError(data.message || "Something went wrong with your registration. Please try again.")
      }
    } catch (err) {
      setError("Hmm, something didn't go through. Check your connection and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Ei! You're In! 🎉</CardTitle>
            <CardDescription className="text-base">
              Your account is ready. Welcome to the QCC IT family!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertDescription className="text-sm">
                <div className="space-y-2">
                  <p className="font-semibold">Your login details:</p>
                  <p>
                    <strong>Username:</strong> Your email address
                  </p>
                  <p>
                    <strong>Default Password:</strong> <code className="bg-white px-2 py-1 rounded">pa$$w0rd</code>
                  </p>
                  <p className="text-xs text-yellow-800 mt-2">
                    Please change your password the first time you log in — keep your account safe!
                  </p>
                </div>
              </AlertDescription>
            </Alert>
            <Alert>
              <AlertDescription>
                You've been set up as a User. You can raise IT requests and track your tickets right away. If you need extra access, reach out to your IT admin.
              </AlertDescription>
            </Alert>
            <Link href="/" className="block">
              <Button className="w-full bg-transparent" variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl p-2 shadow-lg flex items-center justify-center">
              <Image src="/images/qcc-logo.png" alt="QCC Logo" width={40} height={40} className="object-contain" />
            </div>
            <div>
              <CardTitle className="text-2xl">Join the QCC IT System</CardTitle>
              <CardDescription>Create your account and get IT support across all our locations.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fullName"
                  placeholder="e.g. Kwame Mensah"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">
                  Username <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="username"
                  placeholder="username@qccgh.com"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@qccgh.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+233XXXXXXXXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  placeholder="e.g. Finance, Operations"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">
                  Office Location <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.location}
                  onValueChange={(value) => setFormData({ ...formData, location: value })}
                >
                  <SelectTrigger id="location">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.length > 0 ? (
                      locations.map((loc) => (
                        <SelectItem key={loc.code} value={loc.code}>
                          {loc.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="head_office">Head Office - Accra</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">
                  Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  Confirm Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                />
              </div>
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                Your account will be pending approval after registration. An administrator will review and assign your
                role before you can access the system.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Link href="/" className="flex-1">
                <Button type="button" variant="outline" className="w-full bg-transparent">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isLoading} className="flex-1 bg-yellow-500 hover:bg-yellow-600">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
