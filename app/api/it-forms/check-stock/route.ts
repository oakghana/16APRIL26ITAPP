import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function POST(req: NextRequest) {
  try {
    const { itemsRequired, location } = await req.json()

    if (!itemsRequired || itemsRequired.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Items required field is empty' },
        { status: 400 }
      )
    }

    // Parse items from the text - handle comma-separated and newline-separated items
    const itemNames = itemsRequired
      .split(/[,\n]/)
      .map((item: string) => item.trim().toUpperCase())
      .filter((item: string) => item.length > 0)

    if (itemNames.length === 0) {
      return NextResponse.json(
        { success: true, items: [] }
      )
    }

    // Query store_items table for matching items
    const { data: storeItems, error: storeError } = await supabase
      .from('store_items')
      .select('id, item_name, quantity, category, location, unit, supplier_name')
      .or(itemNames.map((name: string) => `item_name.ilike.%${name}%`).join(','))

    if (storeError) {
      console.error('[v0] Store items query error:', storeError)
      return NextResponse.json(
        { success: false, error: 'Failed to query store items' },
        { status: 500 }
      )
    }

    // Fallback to central_store_items if no results from store_items
    let items = storeItems || []
    if (items.length === 0) {
      const { data: centralItems, error: centralError } = await supabase
        .from('central_store_items')
        .select('id, item_name, quantity, category, unit')
        .or(itemNames.map((name: string) => `item_name.ilike.%${name}%`).join(','))

      if (!centralError) {
        items = centralItems || []
      }
    }

    // Map requested items to stock information
    const result = itemNames.map((requestedItem: string) => {
      // Find matching stock item (case-insensitive)
      const matchingItem = items.find((item: any) =>
        item.item_name.toUpperCase().includes(requestedItem) ||
        requestedItem.includes(item.item_name.toUpperCase())
      )

      return {
        name: requestedItem,
        inStock: !!matchingItem,
        quantity: matchingItem?.quantity || 0,
        category: matchingItem?.category || 'Unknown',
        location: matchingItem?.location || location || 'Unknown',
        unit: matchingItem?.unit || 'pcs',
        supplier: matchingItem?.supplier_name || undefined,
        status: !matchingItem
          ? 'not_found'
          : matchingItem.quantity <= 0
            ? 'out_of_stock'
            : matchingItem.quantity < 5
              ? 'low_stock'
              : 'in_stock'
      }
    })

    const summary = {
      total: result.length,
      inStock: result.filter((item: any) => item.inStock && item.quantity > 0).length,
      outOfStock: result.filter((item: any) => item.quantity <= 0).length,
      notFound: result.filter((item: any) => !item.inStock).length
    }

    return NextResponse.json({
      success: true,
      items: result,
      summary
    })
  } catch (error: any) {
    console.error('[v0] Check stock error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check stock' },
      { status: 500 }
    )
  }
}
