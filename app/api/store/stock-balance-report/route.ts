import { createServerClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = await createServerClient()

    const username = request.headers.get("x-username")
    if (!username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch user profile to check role
    const { data: profile } = await supabase.from("profiles").select("*").eq("username", username).single()

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Allow access to IT staff roles, but block regular users
    const allowedRoles = ["admin", "it_head", "regional_it_head", "it_staff", "it_store_head"]
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions. Stock Balance Report is only accessible to IT staff." },
        { status: 403 },
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const location = searchParams.get("location") || "all"
    const deviceType = searchParams.get("deviceType") || "all"
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Start and end dates are required" }, { status: 400 })
    }

    // created_at is a timestamp, so the bare end date must be pushed to end-of-day to stay inclusive
    const rangeStart = `${startDate}T00:00:00.000Z`
    const rangeEnd = `${endDate}T23:59:59.999Z`

    let itemsQuery = supabase.from("store_items").select("*").order("sku")

    if (location !== "all") {
      // Use case-insensitive filter by converting both sides to lowercase
      const { data: allItems, error: allItemsError } = await supabase
        .from("store_items")
        .select("*")
        .order("sku")

      if (allItemsError) {
        console.error("[v0] Error fetching store items:", allItemsError)
        return NextResponse.json({ error: allItemsError.message }, { status: 500 })
      }

      // Filter in-memory for case-insensitive comparison
      let filteredItems = (allItems || []).filter(
        (item) => item.location?.toLowerCase() === location.toLowerCase()
      )

      if (deviceType !== "all") {
        filteredItems = filteredItems.filter(
          (item) => item.category?.toLowerCase() === deviceType.toLowerCase()
        )
      }

      const items = filteredItems
      const { data: transactions } = await supabase
        .from("stock_transactions")
        .select("*")
        .gte("created_at", rangeStart)
        .lte("created_at", rangeEnd)

      console.log(
        "[v0] Items for location '",
        location,
        "':",
        items?.length || 0,
        "Transactions:",
        transactions?.length || 0
      )

      const itemMovements: Record<string, { 
        receipts: number; 
        issues: number; 
        requisitionCount: number;
        issuanceDetails: Array<{ recipient: string; location: string; qty: number }>;
      }> = {}

      // Accept multiple transaction type variants used across the codebase
      const isIssueType = (tt: string) => ["issue", "assigned", "assignment", "assignment_edit"].includes(tt)
      const isReceiptType = (tt: string) => ["received", "receipt", "added", "addition", "stock_in", "stock_addition", "initial_stock"].includes(tt)

      transactions?.forEach((txn) => {
        const itemId = txn.item_id
        if (!itemMovements[itemId]) {
          itemMovements[itemId] = { receipts: 0, issues: 0, requisitionCount: 0, issuanceDetails: [] }
        }

        if (isReceiptType(txn.transaction_type) || txn.transaction_type === "transfer_in") {
          itemMovements[itemId].receipts += txn.quantity || 0
          itemMovements[itemId].requisitionCount++
        }

        if (isIssueType(txn.transaction_type) || txn.transaction_type === "transfer_out") {
          itemMovements[itemId].issues += txn.quantity || 0

          if (txn.recipient || txn.office_location) {
            itemMovements[itemId].issuanceDetails.push({
              recipient: txn.recipient || "N/A",
              location: txn.office_location || txn.location_name || txn.location || "N/A",
              qty: txn.quantity || 0
            })
          }
        }
      })

      const stockBalanceData = items.map((item) => {
        const movements = itemMovements[item.id] || { receipts: 0, issues: 0, requisitionCount: 0, issuanceDetails: [] }
        const currentStock = item.quantity || 0
        const issues = movements.issues
        const receipts = movements.receipts

        const openingBalance = currentStock + issues - receipts

        let remarks = ""
        if (movements.issuanceDetails.length > 0) {
          remarks = movements.issuanceDetails
            .map((detail) => `${detail.qty} to ${detail.recipient} (${detail.location})`)
            .join("; ")
        } else if (movements.requisitionCount > 0) {
          remarks = `${movements.requisitionCount} requisition(s)`
        }

        return {
          id: item.id,
          code: item.sku || item.id.substring(0, 8),
          itemName: item.name || "Unknown",
          category: item.category || "IT Accessories",
          unitOfMeasure: item.unit || "Pcs",
          openingBalance,
          receipts,
          issues,
          closingBalance: currentStock,
          location: item.location || "Unknown",
          remarks,
        }
      })

      return NextResponse.json({ report: stockBalanceData })
    }

    // Handle "all" locations or regional_it_head
    const { data: allItems, error: allItemsError } = await supabase
      .from("store_items")
      .select("*")
      .order("sku")

    if (allItemsError) {
      console.error("[v0] Error fetching store items:", allItemsError)
      return NextResponse.json({ error: allItemsError.message }, { status: 500 })
    }

    let items = allItems || []

    // Regional IT heads can now view all locations (no filter)

    // Filter by device type if specified (case-insensitive)
    if (deviceType !== "all") {
      items = items.filter(
        (item) => item.category?.toLowerCase() === deviceType.toLowerCase()
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ report: [] })
    }

    // Get transactions within date range for accurate receipts and issues
    const { data: transactions } = await supabase
      .from("stock_transactions")
      .select("*")
      .gte("created_at", rangeStart)
      .lte("created_at", rangeEnd)

    console.log(
      "[v0] Items found:",
      items.length,
      "Transactions found:",
      transactions?.length || 0
    )

    const itemMovements: Record<string, { 
      receipts: number; 
      issues: number; 
      requisitionCount: number;
      issuanceDetails: Array<{ recipient: string; location: string; qty: number }>;
    }> = {}

    transactions?.forEach((txn) => {
      const itemId = txn.item_id
      if (!itemMovements[itemId]) {
        itemMovements[itemId] = { receipts: 0, issues: 0, requisitionCount: 0, issuanceDetails: [] }
      }

      if (txn.transaction_type === "transfer_in" || txn.transaction_type === "receipt") {
        itemMovements[itemId].receipts += txn.quantity || 0
        itemMovements[itemId].requisitionCount++
      }

      if (txn.transaction_type === "transfer_out" || txn.transaction_type === "issue") {
        itemMovements[itemId].issues += txn.quantity || 0

        if (txn.recipient || txn.office_location) {
          itemMovements[itemId].issuanceDetails.push({
            recipient: txn.recipient || "N/A",
            location: txn.office_location || txn.location_name || "N/A",
            qty: txn.quantity || 0
          })
        }
      }
    })

    const stockBalanceData = items.map((item) => {
      const movements = itemMovements[item.id] || { receipts: 0, issues: 0, requisitionCount: 0, issuanceDetails: [] }
      const currentStock = item.quantity || 0
      const issues = movements.issues
      const receipts = movements.receipts

      const openingBalance = currentStock + issues - receipts

      let remarks = ""
      if (movements.issuanceDetails.length > 0) {
        remarks = movements.issuanceDetails
          .map((detail) => `${detail.qty} to ${detail.recipient} (${detail.location})`)
          .join("; ")
      } else if (movements.requisitionCount > 0) {
        remarks = `${movements.requisitionCount} requisition(s)`
      }

      return {
        id: item.id,
        code: item.sku || item.id.substring(0, 8),
        itemName: item.name || "Unknown",
        category: item.category || "IT Accessories",
        unitOfMeasure: item.unit || "Pcs",
        openingBalance,
        receipts,
        issues,
        closingBalance: currentStock,
        location: item.location || "Unknown",
        remarks,
      }
    })

    return NextResponse.json({ report: stockBalanceData });
  } catch (error: any) {
    console.error("[v0] Error in stock-balance-report:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
