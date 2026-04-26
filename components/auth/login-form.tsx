"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Shield, Lock, Mail, ArrowRight } from "lucide-react"

export function LoginForm() {
  const [error, setError] = useState("")
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setIsPending(true)

    const formData = new FormData(e.currentTarget)
    const username = formData.get("username") as string
    const password = formData.get("password") as string

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      // Check if response is JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        setError("Server error. Please check your environment configuration.")
        setIsPending(false)
        return
      }

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || "Invalid credentials")
        setIsPending(false)
        return
      }

      const sanitizedUser = {
        id: data.user.id,
        username: data.user.username || data.user.email,
        email: data.user.email,
        role: data.user.role,
        location: data.user.location || "Head Office",
        name: data.user.full_name || data.user.name || data.user.username,
        full_name: data.user.full_name,
        department: data.user.department,
        phone: data.user.phone,
      }

      try {
        localStorage.setItem("qcc_current_user", JSON.stringify(sanitizedUser))
      } catch (storageError) {
        console.error("[v0] Failed to save user to localStorage:", storageError)
        setError("Failed to save session. Please try again.")
        setIsPending(false)
        return
      }

      // Redirect to dashboard
      window.location.href = data.redirectUrl
    } catch (err) {
      console.error("Login error:", err)
      setError("Authentication failed. Please try again.")
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="w-full border shadow-lg">
        <CardHeader className="space-y-4 pb-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 shadow-xl">
            <Shield className="h-7 w-7 text-slate-900" />
          </div>
          <div className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold">Akwaaba! Welcome Back 👋</CardTitle>
            <CardDescription className="text-base">Sign in and let's sort out your IT needs — quick quick.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive" className="border-2">
              <AlertDescription className="font-medium">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-semibold">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="username"
                  name="username"
                  type="email"
                  placeholder="your.email@qccgh.com — e.g. kwame.asante@qccgh.com"
                  className="pl-11 h-12 text-base"
                  required
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Your password — keep it safe, eh!"
                  className="pl-11 h-12 text-base"
                  required
                  disabled={isPending}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:from-yellow-600 hover:via-amber-600 hover:to-yellow-700 shadow-lg text-slate-900"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Just a moment, we're getting you in…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>

            <div className="text-center pt-4 border-t space-y-2">
              <p className="text-sm text-muted-foreground">
                No account yet?{" "}
                <a href="/create-account" className="font-semibold text-primary hover:underline">
                  Request Access — it's easy!
                </a>
              </p>
              <p className="text-xs text-muted-foreground">
                Powered By the ITD | V2.04.22-26
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
