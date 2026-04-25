"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatDisplayDateTime } from "@/lib/utils"
import { User, CheckCircle, Clock, Signature } from "lucide-react"

interface ApprovalChainNode {
  role: string
  person: string
  email?: string
  timestamp?: string
  signature?: string
}

interface FormApprovalChainViewProps {
  formType: "new_gadget" | "maintenance" | "equipment_requisition"
  formNumber: string
  createdBy: string
  createdByRole: string
  createdByEmail?: string
  createdAt: string
  approvalChain: ApprovalChainNode[]
  status: string
}

export function FormApprovalChainView({
  formType,
  formNumber,
  createdBy,
  createdByRole,
  createdByEmail,
  createdAt,
  approvalChain,
  status,
}: FormApprovalChainViewProps) {
  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      it_staff: "IT Staff",
      regional_it_head: "Regional IT Head",
      department_head: "Department Head (HOD)",
      it_manager: "IT Manager",
      it_head: "IT Head",
      admin: "Administrator",
    }
    return labels[role] || role
  }

  const getStatusBadge = (status: string) => {
    const statuses: Record<string, { color: string; label: string }> = {
      pending_hod: { color: "bg-yellow-500", label: "Awaiting HOD Approval" },
      pending_manager: { color: "bg-blue-500", label: "Awaiting IT Manager Approval" },
      pending_it_head: { color: "bg-purple-500", label: "Awaiting IT Head Approval" },
      approved: { color: "bg-green-500", label: "Approved" },
      rejected: { color: "bg-red-500", label: "Rejected" },
      completed: { color: "bg-green-600", label: "Completed" },
    }
    const statusConfig = statuses[status] || { color: "bg-gray-500", label: status }
    return <Badge className={`${statusConfig.color} text-white`}>{statusConfig.label}</Badge>
  }

  return (
    <div className="space-y-4">
      {/* Form Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {formType === "new_gadget" && "New Gadget Request"}
                {formType === "maintenance" && "Maintenance & Repairs"}
                {formType === "equipment_requisition" && "Equipment Requisition"}
                <Badge variant="outline">{formNumber}</Badge>
              </CardTitle>
              <CardDescription>Form approval workflow and status tracking</CardDescription>
            </div>
            <div>{getStatusBadge(status)}</div>
          </div>
        </CardHeader>
      </Card>

      {/* Initiator Information */}
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5 text-green-600" />
            Initiated By
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">Name</p>
                <p className="text-sm font-medium">{createdBy}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">Role</p>
                <p className="text-sm font-medium">{getRoleLabel(createdByRole)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">Date</p>
                <p className="text-sm font-medium">{formatDisplayDateTime(createdAt)}</p>
              </div>
              {createdByEmail && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Email</p>
                  <p className="text-sm font-medium text-blue-600">{createdByEmail}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Approval Chain Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-5 w-5" />
            Approval Workflow
          </CardTitle>
          <CardDescription>Track approvals through each stage</CardDescription>
        </CardHeader>
        <CardContent>
          {approvalChain && approvalChain.length > 0 ? (
            <div className="space-y-4">
              {approvalChain.map((node, index) => (
                <div key={index}>
                  <div className="flex gap-4">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        node.timestamp ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-gray-100 text-gray-400 dark:bg-gray-800"
                      }`}>
                        {node.timestamp ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <Clock className="h-5 w-5" />
                        )}
                      </div>
                      {index < approvalChain.length - 1 && (
                        <div className="h-12 w-0.5 bg-gray-200 dark:bg-gray-700 my-2" />
                      )}
                    </div>

                    {/* Approval details */}
                    <div className="flex-1 pb-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Role</p>
                          <p className="text-sm font-medium">{getRoleLabel(node.role)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Approver</p>
                          <p className="text-sm font-medium">{node.person || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Date</p>
                          <p className="text-sm font-medium">{node.timestamp ? formatDisplayDateTime(node.timestamp) : "Pending"}</p>
                        </div>
                        {node.signature && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Signature</p>
                            <img
                              src={node.signature}
                              alt="Signature"
                              className="h-8 max-w-[100px]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {index < approvalChain.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No approvals recorded yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
