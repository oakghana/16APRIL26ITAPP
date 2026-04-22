'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

interface TestResult {
  name: string
  status: 'pending' | 'pass' | 'fail'
  message: string
  details?: any
}

export default function StoreRequisitionsTestPage() {
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(false)

  const addResult = (result: TestResult) => {
    setResults((prev) => [...prev, result])
  }

  const runSimulation = async () => {
    setResults([])
    setLoading(true)

    const testRequisitionId = `test-${Date.now()}`

    try {
      // Test 1: CREATE
      addResult({
        name: 'CREATE: Insert new store requisition',
        status: 'pending',
        message: 'Creating test requisition...',
      })

      const { data: createdReq, error: createError } = await supabase
        .from('store_requisitions')
        .insert({
          id: testRequisitionId,
          requisition_number: `TEST-REQ-${Date.now()}`,
          requested_by: 'test-user-123',
          requester_role: 'it_staff',
          status: 'pending',
          location: 'Head Office',
          destination_location: 'Head Office',
          items: [{ name: 'Test Item 1', quantity: 5, unit: 'pcs' }],
          notes: 'Test requisition for CRUD simulation',
          requires_approval: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (createError) {
        addResult({
          name: 'CREATE: Insert new store requisition',
          status: 'fail',
          message: `Failed to create: ${createError.message}`,
          details: createError,
        })
      } else {
        addResult({
          name: 'CREATE: Insert new store requisition',
          status: 'pass',
          message: `Created requisition ${createdReq?.requisition_number}`,
          details: { id: createdReq?.id },
        })
      }

      // Test 2: READ
      addResult({
        name: 'READ: Fetch created requisition',
        status: 'pending',
        message: 'Fetching requisition...',
      })

      const { data: fetchedReq, error: readError } = await supabase
        .from('store_requisitions')
        .select('*')
        .eq('id', testRequisitionId)
        .single()

      if (readError) {
        addResult({
          name: 'READ: Fetch created requisition',
          status: 'fail',
          message: `Failed to fetch: ${readError.message}`,
        })
      } else {
        addResult({
          name: 'READ: Fetch created requisition',
          status: 'pass',
          message: `Fetched: ${fetchedReq?.requisition_number}`,
          details: { status: fetchedReq?.status },
        })
      }

      // Test 3: UPDATE - Approve
      addResult({
        name: 'UPDATE: Approve requisition',
        status: 'pending',
        message: 'Updating status to approved...',
      })

      const { data: approvedReq, error: updateError } = await supabase
        .from('store_requisitions')
        .update({
          status: 'approved',
          approved_by: 'admin-user-123',
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', testRequisitionId)
        .select()
        .single()

      if (updateError) {
        addResult({
          name: 'UPDATE: Approve requisition',
          status: 'fail',
          message: `Failed: ${updateError.message}`,
        })
      } else {
        addResult({
          name: 'UPDATE: Approve requisition',
          status: 'pass',
          message: `Updated status to ${approvedReq?.status}`,
          details: { status: approvedReq?.status },
        })
      }

      // Test 4: UPDATE - Allocate
      addResult({
        name: 'UPDATE: Allocate stock',
        status: 'pending',
        message: 'Allocating stock...',
      })

      const { data: allocatedReq, error: allocateError } = await supabase
        .from('store_requisitions')
        .update({
          allocated_quantity: 5,
          allocated_by: 'store-head-123',
          allocation_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', testRequisitionId)
        .select()
        .single()

      if (allocateError) {
        addResult({
          name: 'UPDATE: Allocate stock',
          status: 'fail',
          message: `Failed: ${allocateError.message}`,
        })
      } else {
        addResult({
          name: 'UPDATE: Allocate stock',
          status: 'pass',
          message: `Allocated ${allocatedReq?.allocated_quantity} units`,
        })
      }

      // Test 5: UPDATE - Issue
      addResult({
        name: 'UPDATE: Issue stock',
        status: 'pending',
        message: 'Issuing stock...',
      })

      const { data: issuedReq, error: issueError } = await supabase
        .from('store_requisitions')
        .update({
          status: 'issued',
          issued_quantity: 5,
          issued_by: 'store-head-123',
          issued_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', testRequisitionId)
        .select()
        .single()

      if (issueError) {
        addResult({
          name: 'UPDATE: Issue stock',
          status: 'fail',
          message: `Failed: ${issueError.message}`,
        })
      } else {
        addResult({
          name: 'UPDATE: Issue stock',
          status: 'pass',
          message: `Issued ${issuedReq?.issued_quantity} units, status: ${issuedReq?.status}`,
        })
      }

      // Test 6: READ - List
      addResult({
        name: 'READ: List requisitions',
        status: 'pending',
        message: 'Fetching list...',
      })

      const { data: allReqs, count, error: listError } = await supabase
        .from('store_requisitions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(10)

      if (listError) {
        addResult({
          name: 'READ: List requisitions',
          status: 'fail',
          message: `Failed: ${listError.message}`,
        })
      } else {
        addResult({
          name: 'READ: List requisitions',
          status: 'pass',
          message: `Fetched ${allReqs?.length || 0} items, total: ${count}`,
        })
      }

      // Test 7: UPDATE - Reject (new test record)
      addResult({
        name: 'UPDATE: Reject requisition',
        status: 'pending',
        message: 'Testing rejection workflow...',
      })

      const rejectTestId = `test-reject-${Date.now()}`
      const { data: rejectReq } = await supabase
        .from('store_requisitions')
        .insert({
          id: rejectTestId,
          requisition_number: `TEST-REJECT-${Date.now()}`,
          requested_by: 'test-user-456',
          requester_role: 'it_staff',
          status: 'pending',
          location: 'Branch Office',
          items: [{ name: 'Test Item 2', quantity: 3 }],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (rejectReq) {
        const { data: rejectedReq, error: rejectError } = await supabase
          .from('store_requisitions')
          .update({
            status: 'rejected',
            rejection_reason: 'Test rejection',
            updated_at: new Date().toISOString(),
          })
          .eq('id', rejectTestId)
          .select()
          .single()

        if (rejectError) {
          addResult({
            name: 'UPDATE: Reject requisition',
            status: 'fail',
            message: `Failed: ${rejectError.message}`,
          })
        } else {
          addResult({
            name: 'UPDATE: Reject requisition',
            status: 'pass',
            message: `Rejected with reason: ${rejectedReq?.rejection_reason}`,
          })
        }
      }

      // Test 8: DELETE - Soft delete
      addResult({
        name: 'DELETE: Soft delete requisition',
        status: 'pending',
        message: 'Deleting test requisition...',
      })

      const { data: deletedReq, error: deleteError } = await supabase
        .from('store_requisitions')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: 'admin-user-123',
          updated_at: new Date().toISOString(),
        })
        .eq('id', testRequisitionId)
        .select()
        .single()

      if (deleteError) {
        addResult({
          name: 'DELETE: Soft delete requisition',
          status: 'fail',
          message: `Failed: ${deleteError.message}`,
        })
      } else {
        addResult({
          name: 'DELETE: Soft delete requisition',
          status: 'pass',
          message: `Soft-deleted with audit trail`,
          details: { deletedAt: deletedReq?.deleted_at },
        })
      }

      // Cleanup
      await supabase.from('store_requisitions').delete().eq('id', testRequisitionId)
      await supabase.from('store_requisitions').delete().eq('id', `test-reject-${Date.now()}`)
    } catch (error) {
      addResult({
        name: 'Unexpected Error',
        status: 'fail',
        message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      setLoading(false)
    }
  }

  const passCount = results.filter((r) => r.status === 'pass').length
  const failCount = results.filter((r) => r.status === 'fail').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">
            Store Requisitions CRUD Test
          </h1>
          <p className="text-gray-600">
            Testing Create, Read, Update, Delete operations
          </p>
        </div>

        <Card className="bg-white shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Run Tests</span>
              <Button
                onClick={runSimulation}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? 'Running...' : 'Run Simulation'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.length === 0 && !loading && (
              <p className="text-gray-500 text-center py-8">
                Click Run Simulation to test all CRUD operations
              </p>
            )}

            {results.map((result, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border-2 ${
                  result.status === 'pass'
                    ? 'bg-green-50 border-green-300'
                    : result.status === 'fail'
                      ? 'bg-red-50 border-red-300'
                      : 'bg-gray-50 border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-1 w-4 h-4 rounded-full flex-shrink-0 ${
                      result.status === 'pass'
                        ? 'bg-green-500'
                        : result.status === 'fail'
                          ? 'bg-red-500'
                          : 'bg-gray-400'
                    }`}
                  />
                  <div className="flex-1">
                    <h3
                      className={`font-semibold ${
                        result.status === 'pass'
                          ? 'text-green-900'
                          : result.status === 'fail'
                            ? 'text-red-900'
                            : 'text-gray-900'
                      }`}
                    >
                      {result.name}
                    </h3>
                    <p className="text-sm mt-1 text-gray-700">
                      {result.message}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {results.length > 0 && (
              <div className="border-t-2 pt-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {results.length}
                  </div>
                  <p className="text-gray-600 text-sm">Tests Run</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {passCount}
                  </div>
                  <p className="text-gray-600 text-sm">Passed</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {failCount}
                  </div>
                  <p className="text-gray-600 text-sm">Failed</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
