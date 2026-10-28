import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const ISSUE_TYPES = ["issue", "issued", "assignment", "assigned", "transfer_out"]
const DECREASE_TYPES = new Set(["issue", "issued", "assignment", "assigned", "transfer_out", "requisition"])
const INCREASE_TYPES = new Set(["receipt", "transfer_in", "return", "addition", "stock_addition", "initial_stock", "received"])

interface TransactionRow {
  id: string
  item_id: string | null
  item_name: string | null
  transaction_type: string | null
  quantity: number | null
  quantity_before: number | null
  quantity_after: number | null
  unit: string | null
  location_name: string | null
  recipient: string | null
  office_location: string | null
  reference_type: string | null
  reference_id: string | null
  reference_number: string | null
  performed_by: string | null
  performed_by_name: string | null
  notes: string | null
  created_at: string
}

function signedDelta(type: string | null, quantity: number) {
  const t = (type || "").toLowerCase()
  if (DECREASE_TYPES.has(t)) return -quantity
  if (INCREASE_TYPES.has(t)) return quantity
  return 0
}

export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("stock_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5000)

    if (error) {
      console.error("[v0] stock-issue-report transactions error:", error)
      return NextResponse.json({ error: error.message, records: [] }, { status: 500 })
    }

    const transactions = (data || []) as TransactionRow[]

    const itemIds = Array.from(new Set(transactions.map((t) => t.item_id).filter(Boolean))) as string[]
    const currentQuantityByItem = new Map<string, number>()
    if (itemIds.length > 0) {
      const { data: items } = await supabase
        .from("store_items")
        .select("id, quantity")
        .in("id", itemIds)
      for (const item of items || []) {
        currentQuantityByItem.set(item.id, Number(item.quantity) || 0)
      }
    }

    // Rebuild balances for older rows that were saved without before/after values.
    // Walk each item's history from newest to oldest starting at today's stock.
    const balances = new Map<string, { before: number; after: number; estimated: boolean }>()
    const runningByItem = new Map<string, number>()
    for (const txn of transactions) {
      if (!txn.item_id) continue
      const qty = Number(txn.quantity) || 0
      const hasStored = txn.quantity_before !== null && txn.quantity_after !== null
      let after: number
      let before: number
      let estimated = false

      if (hasStored) {
        before = Number(txn.quantity_before)
        after = Number(txn.quantity_after)
      } else {
        const running = runningByItem.get(txn.item_id) ?? currentQuantityByItem.get(txn.item_id)
        if (running === undefined) continue
        after = running
        before = running - signedDelta(txn.transaction_type, qty)
        estimated = true
      }

      balances.set(txn.id, { before, after, estimated })
      runningByItem.set(txn.item_id, before)
    }

    const issueTransactions = transactions.filter((t) => {
      const type = (t.transaction_type || "").toLowerCase()
      if (!ISSUE_TYPES.includes(type)) return false
      if (type === "transfer_out") return t.reference_type === "requisition"
      return true
    })

    const requisitionIds = Array.from(
      new Set(issueTransactions.map((t) => t.reference_id).filter(Boolean)),
    ) as string[]
    const requisitionById = new Map<string, any>()
    if (requisitionIds.length > 0) {
      const { data: requisitions } = await supabase
        .from("store_requisitions")
        .select("*")
        .in("id", requisitionIds)
      for (const requisition of requisitions || []) {
        requisitionById.set(requisition.id, requisition)
      }
    }

    const records = issueTransactions.map((t) => {
      const requisition = t.reference_id ? requisitionById.get(t.reference_id) : undefined
      const balance = balances.get(t.id)
      return {
        id: t.id,
        issued_at: t.created_at,
        item_id: t.item_id,
        item_name: t.item_name || "Unknown item",
        unit: t.unit || "pcs",
        quantity_issued: Number(t.quantity) || 0,
        previous_stock: balance ? balance.before : null,
        current_stock: balance ? balance.after : null,
        balance_estimated: balance ? balance.estimated : false,
        source_location: t.transaction_type === "transfer_out" ? t.location_name : null,
        destination: requisition?.location || t.office_location || t.location_name || null,
        issued_to: t.recipient || requisition?.beneficiary || requisition?.requested_by || null,
        requisition_number: t.reference_number || requisition?.requisition_number || null,
        requisition_frequency: requisition?.requisition_frequency || null,
        requested_by: requisition?.requested_by || null,
        issued_by: requisition?.issued_by || t.performed_by_name || t.performed_by || "Store Manager",
        notes: t.notes,
      }
    })

    return NextResponse.json({ records })
  } catch (error: any) {
    console.error("[v0] stock-issue-report error:", error)
    return NextResponse.json({ error: error.message || "Internal server error", records: [] }, { status: 500 })
  }
}
