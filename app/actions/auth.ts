"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function loginAction(formData: FormData) {
  const username = formData.get("username") as string
  const password = formData.get("password") as string

  if (!username || !password) {
    return { error: "Email and password are required" }
  }

  try {
    const supabase = await createClient()

    // Query user from database
    const { data: user, error: queryError } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .eq("status", "approved")
      .single()

    if (queryError || !user) {
      return { error: "Invalid credentials" }
    }

    // Verify password
    const { data: isValid, error: authError } = await supabase.rpc("verify_password", {
      p_username: username,
      p_password: password,
    })

    if (authError || !isValid) {
      return { error: "Invalid credentials" }
    }

    // Set secure HTTP-only cookie with user session
    const cookieStore = await cookies()
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email || user.username,
      name: user.full_name || user.username,
      role: user.role,
      location: user.location,
      department: user.department,
      phone: user.phone,
    }

    cookieStore.set("qcc_session", JSON.stringify(userData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    })

    let redirectUrl = "/dashboard"
    if (user.role === "admin") {
      redirectUrl = "/dashboard/admin"
    } else if (user.role === "it_store_head") {
      redirectUrl = "/dashboard/store-inventory"
    } else if (user.role === "it_staff") {
      redirectUrl = "/dashboard/assigned-tasks"
    } else if (user.role === "department_head") {
      redirectUrl = "/dashboard/department-head"
    } else if (user.role === "staff") {
      redirectUrl = "/dashboard/service-desk"
    }

    return { success: true, redirectUrl }
  } catch (error) {
    console.error("Login error:", error)
    return { error: "Authentication failed. Please try again." }
  }
}

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete("qcc_session")
  redirect("/")
}

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get("qcc_session")

    if (!session) {
      return null
    }

    return JSON.parse(session.value)
  } catch {
    return null
  }
}
