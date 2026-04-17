import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import bcrypt from "bcryptjs"

export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabase()
    const testUsername = "joseph.asante@qccgh.com"
    const testPassword = "qcc@123"

    console.log("[v0 SIMULATION] Starting login simulation for:", testUsername)
    console.log("[v0 SIMULATION] Password to test:", testPassword)

    // Step 1: Search by username
    console.log("[v0 SIMULATION] Step 1: Searching by username...")
    const { data: userByUsername, error: usernameError } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", testUsername)
      .eq("status", "approved")
      .eq("is_active", true)
      .maybeSingle()

    console.log("[v0 SIMULATION] Username search result:", {
      found: !!userByUsername,
      error: usernameError?.message,
    })

    // Step 2: Search by email if not found
    let user = userByUsername
    if (!user) {
      console.log("[v0 SIMULATION] Step 2: Searching by email...")
      const { data: userByEmail, error: emailError } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", testUsername)
        .eq("status", "approved")
        .eq("is_active", true)
        .maybeSingle()

      console.log("[v0 SIMULATION] Email search result:", {
        found: !!userByEmail,
        error: emailError?.message,
      })
      user = userByEmail
    }

    if (!user) {
      return NextResponse.json({
        success: false,
        error: "User not found",
        details: "No user found with username or email: " + testUsername,
      })
    }

    console.log("[v0 SIMULATION] User found:", {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      is_active: user.is_active,
    })

    // Step 3: Check password hash
    console.log("[v0 SIMULATION] Step 3: Checking password hash...")
    console.log("[v0 SIMULATION] Hash exists:", !!user.password_hash)
    console.log("[v0 SIMULATION] Hash length:", user.password_hash?.length)
    console.log("[v0 SIMULATION] Hash format:", user.password_hash?.substring(0, 10))
    console.log("[v0 SIMULATION] Full hash:", user.password_hash)

    if (!user.password_hash || user.password_hash.length < 20) {
      return NextResponse.json({
        success: false,
        error: "Password not set",
        details: "User has no valid password hash",
      })
    }

    // Step 4: Generate a fresh hash for comparison
    console.log("[v0 SIMULATION] Step 4: Generating fresh hash for password...")
    const freshHash = await bcrypt.hash(testPassword, 10)
    console.log("[v0 SIMULATION] Fresh hash generated:", freshHash)

    // Step 5: Test password verification
    console.log("[v0 SIMULATION] Step 5: Testing password verification...")
    let isPasswordValid = false
    try {
      isPasswordValid = await bcrypt.compare(testPassword, user.password_hash)
      console.log("[v0 SIMULATION] bcrypt.compare result:", isPasswordValid)
    } catch (bcryptError: any) {
      console.error("[v0 SIMULATION] bcrypt.compare error:", bcryptError)
      return NextResponse.json({
        success: false,
        error: "Bcrypt comparison failed",
        details: bcryptError.message,
        storedHash: user.password_hash,
        testPassword: testPassword,
      })
    }

    // Step 6: If password doesn't match, update with fresh hash and test again
    if (!isPasswordValid) {
      console.log("[v0 SIMULATION] Step 6: Password didn't match. Updating with fresh hash...")
      
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          password_hash: freshHash,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id)

      if (updateError) {
        console.error("[v0 SIMULATION] Error updating password:", updateError)
        return NextResponse.json({
          success: false,
          error: "Failed to update password",
          details: updateError.message,
        })
      }

      console.log("[v0 SIMULATION] Password updated successfully. Testing again...")
      
      // Verify the new hash works
      const verifyNewHash = await bcrypt.compare(testPassword, freshHash)
      console.log("[v0 SIMULATION] New hash verification:", verifyNewHash)

      return NextResponse.json({
        success: true,
        message: "Password was incorrect but has been updated and verified",
        oldHashWorked: false,
        newHashWorked: verifyNewHash,
        newHash: freshHash,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: "Login simulation successful - existing hash works!",
      passwordVerified: isPasswordValid,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error: any) {
    console.error("[v0 SIMULATION] Simulation error:", error)
    return NextResponse.json({
      success: false,
      error: "Simulation failed",
      details: error.message,
      stack: error.stack,
    })
  }
}
