"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, Users, Link2, Unlink2, ChevronRight, Zap, Grid3x3 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface DepartmentHead {
  id: string
  name: string
  email: string
  department?: string
  location?: string
  staff_count: number
}

interface StaffMember {
  id: string
  name: string
  email: string
  department: string
  location?: string
  linked: boolean
  department_head_id?: string | null
}

export function DepartmentHeadLinking() {
  const { toast } = useToast()
  const [departmentHeads, setDepartmentHeads] = useState<DepartmentHead[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedHeadId, setSelectedHeadId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [staffSearchTerm, setStaffSearchTerm] = useState("")
  const [isLinkingOpen, setIsLinkingOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAutoLinking, setIsAutoLinking] = useState(false)
  const [isAutoLinkingAll, setIsAutoLinkingAll] = useState(false)
  const [activeTab, setActiveTab] = useState("mapping")

  useEffect(() => {
    loadDepartmentHeads()
    loadStaff()
  }, [])

  const loadDepartmentHeads = async () => {
    try {
      const response = await fetch("/api/admin/department-heads")
      if (!response.ok) throw new Error("Failed to load department heads")
      const data = await response.json()
      setDepartmentHeads(data.department_heads || [])
    } catch (error) {
      console.error("[v0] Error loading department heads:", error)
      toast({
        title: "Error",
        description: "Failed to load department heads",
        variant: "destructive",
      })
    }
  }

  const loadStaff = async () => {
    try {
      const response = await fetch("/api/admin/staff-list")
      if (!response.ok) throw new Error("Failed to load staff")
      const data = await response.json()
      setStaff(data.staff || [])
      setLoading(false)
    } catch (error) {
      console.error("[v0] Error loading staff:", error)
      toast({
        title: "Error",
        description: "Failed to load staff list",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  const handleLinkStaff = async (headId: string, staffIds: string[]) => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/admin/link-department-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_head_id: headId,
          staff_ids: staffIds,
        }),
      })

      if (!response.ok) throw new Error("Failed to link staff")
      
      toast({
        title: "Success",
        description: `Successfully linked ${staffIds.length} staff member(s)`,
      })
      
      setIsLinkingOpen(false)
      setSelectedStaff([])
      loadDepartmentHeads()
      loadStaff()
    } catch (error) {
      console.error("[v0] Error linking staff:", error)
      toast({
        title: "Error",
        description: "Failed to link staff to department head",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUnlinkStaff = async (headId: string, staffId: string) => {
    try {
      const response = await fetch("/api/admin/unlink-department-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_head_id: headId,
          staff_id: staffId,
        }),
      })

      if (!response.ok) throw new Error("Failed to unlink staff")
      
      toast({
        title: "Success",
        description: "Staff member unlinked from department head",
      })
      
      loadDepartmentHeads()
      loadStaff()
    } catch (error) {
      console.error("[v0] Error unlinking staff:", error)
      toast({
        title: "Error",
        description: "Failed to unlink staff",
        variant: "destructive",
      })
    }
  }

  const handleAutoLinkStaff = async (headId: string) => {
    setIsAutoLinking(true)
    try {
      const response = await fetch("/api/admin/auto-link-department-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_head_id: headId,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to auto-link staff")
      
      toast({
        title: "Auto-Link Success",
        description: data.message || `Successfully linked ${data.linked_count} staff member(s)`,
      })
      
      loadDepartmentHeads()
      loadStaff()
    } catch (error) {
      console.error("[v0] Error auto-linking staff:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to auto-link staff",
        variant: "destructive",
      })
    } finally {
      setIsAutoLinking(false)
    }
  }

  const handleAutoLinkAllStaff = async () => {
    setIsAutoLinkingAll(true)
    try {
      const response = await fetch("/api/admin/auto-link-all-department-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to auto-link all staff")

      toast({
        title: "Auto-Link All Success",
        description: data.message || `Successfully linked ${data.linked_count} user(s) across all department heads`,
      })

      loadDepartmentHeads()
      loadStaff()
    } catch (error) {
      console.error("[v0] Error auto-linking all staff:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to auto-link all staff",
        variant: "destructive",
      })
    } finally {
      setIsAutoLinkingAll(false)
    }
  }

  const selectedHead = departmentHeads.find((h) => h.id === selectedHeadId)
  const linkedStaffForHead = staff.filter((s) => s.department_head_id === selectedHeadId)
  // Show all staff - both unlinked and linked to other heads (for reassignment)
  const availableStaffForHead = staff

  const filteredStaff = availableStaffForHead.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Department Head Staff Linking</h2>
        <p className="text-muted-foreground">Manage which staff members report to each department head</p>
      </div>

      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-3">
            <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Auto-Link Feature</h3>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                Click the <span className="font-medium">"Auto-Link"</span> button to automatically link all staff members from the same department and location to this department head. This is the recommended way to set up HOD assignments.
              </p>
            </div>
          </div>
            <Button
              onClick={handleAutoLinkAllStaff}
              disabled={isAutoLinkingAll}
              variant="outline"
              className="gap-2 bg-white/80"
            >
              <Zap className="h-4 w-4" />
              {isAutoLinkingAll ? "Auto-Linking All..." : "Auto-Link All HODs"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="mapping" className="gap-2">
            <Link2 className="h-4 w-4" />
            HOD Mapping
          </TabsTrigger>
          <TabsTrigger value="directory" className="gap-2">
            <Grid3x3 className="h-4 w-4" />
            Staff Directory
          </TabsTrigger>
        </TabsList>

        {/* HOD Mapping Tab */}
        <TabsContent value="mapping" className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Department Heads List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Department Heads
            </CardTitle>
            <CardDescription>{departmentHeads.length} total</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {departmentHeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No department heads found</p>
            ) : (
              departmentHeads.map((head) => (
                <button
                  key={head.id}
                  onClick={() => setSelectedHeadId(head.id)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    selectedHeadId === head.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                      : "border-transparent hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{head.name}</p>
                      <p className="text-xs text-muted-foreground">{head.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {head.department || "No department"}
                        {head.location ? ` • ${head.location}` : ""}
                      </p>
                    </div>
                    <Badge variant="secondary">{head.staff_count}</Badge>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Staff Management */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  {selectedHead ? `Staff for ${selectedHead.name}` : "Select a Department Head"}
                </CardTitle>
                <CardDescription>
                  {selectedHead ? `${linkedStaffForHead.length} staff members linked` : "Choose a department head above"}
                </CardDescription>
              </div>
              {selectedHead && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleAutoLinkStaff(selectedHead.id)}
                    disabled={isAutoLinking}
                    variant="outline"
                    className="gap-2"
                  >
                    <Zap className="h-4 w-4" />
                    {isAutoLinking ? "Auto-Linking..." : "Auto-Link"}
                  </Button>
                  <Dialog open={isLinkingOpen} onOpenChange={setIsLinkingOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <Link2 className="h-4 w-4" />
                        Link Staff
                      </Button>
                    </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Link Staff to {selectedHead.name}</DialogTitle>
                      <DialogDescription>
                        Select staff members to add under this department head
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search staff..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8"
                        />
                      </div>

                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredStaff.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">No staff available</p>
                        ) : (
                          filteredStaff.map((member) => {
                            const isLinkedElsewhere = member.linked && member.department_head_id !== selectedHeadId
                            const isLinkedHere = member.department_head_id === selectedHeadId
                            
                            return (
                              <label
                                key={member.id}
                                className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                                  isLinkedElsewhere 
                                    ? "bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                                }`}
                              >
                                <Checkbox
                                  checked={selectedStaff.includes(member.id)}
                                  onCheckedChange={(checked) => {
                                    setSelectedStaff(
                                      checked
                                        ? [...selectedStaff, member.id]
                                        : selectedStaff.filter((id) => id !== member.id)
                                    )
                                  }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium">{member.name}</p>
                                    {isLinkedElsewhere && (
                                      <Badge className="text-xs bg-amber-600 text-white">
                                        Linked to Another HOD
                                      </Badge>
                                    )}
                                    {isLinkedHere && (
                                      <Badge className="text-xs bg-blue-600 text-white">
                                        Already Linked Here
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                                  {member.department && (
                                    <p className="text-xs text-muted-foreground">{member.department}</p>
                                  )}
                                </div>
                              </label>
                            )
                          })
                        )}
                      </div>

                      <div className="flex gap-2 justify-end pt-4">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsLinkingOpen(false)
                            setSelectedStaff([])
                            setSearchTerm("")
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => handleLinkStaff(selectedHead.id, selectedStaff)}
                          disabled={isSubmitting || selectedStaff.length === 0}
                        >
                          {isSubmitting ? "Linking..." : `Link ${selectedStaff.length} Staff`}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                </div>
              )}
            </div>
          </CardHeader>

          {selectedHead ? (
            <CardContent>
              {linkedStaffForHead.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto opacity-20 mb-2" />
                  <p>No staff linked yet. Click "Link Staff" to add staff members.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedStaffForHead.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:border-gray-400 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnlinkStaff(selectedHead.id, member.id)}
                        className="ml-2"
                      >
                        <Unlink2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          ) : (
            <CardContent className="text-center text-muted-foreground py-8">
              Select a department head to view and manage their staff
            </CardContent>
          )}
        </Card>
      </div>
        </TabsContent>

        {/* Staff Directory Tab */}
        <TabsContent value="directory" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    All Staff Members
                  </CardTitle>
                  <CardDescription>
                    {staff.length} total staff | Click a button to link/unlink staff
                  </CardDescription>
                </div>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or department..."
                  value={staffSearchTerm}
                  onChange={(e) => setStaffSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {staff
                  .filter(
                    (s) =>
                      s.name.toLowerCase().includes(staffSearchTerm.toLowerCase()) ||
                      s.email.toLowerCase().includes(staffSearchTerm.toLowerCase()) ||
                      s.department.toLowerCase().includes(staffSearchTerm.toLowerCase())
                  )
                  .map((member) => {
                    const linkedHead = departmentHeads.find(
                      (h) => h.id === member.department_head_id
                    )
                    return (
                      <div
                        key={member.id}
                        className="p-4 rounded-lg border hover:border-gray-400 transition-colors flex items-center justify-between"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {member.department}
                            {member.location && ` • ${member.location}`}
                          </p>
                          {linkedHead && (
                            <Badge className="mt-2 bg-blue-600 text-white">
                              Linked to: {linkedHead.name}
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4 flex-shrink-0">
                          <Select
                            value={member.department_head_id || ""}
                            onValueChange={(headId) => {
                              if (headId === "__unlink__") {
                                // Unlink staff
                                if (member.department_head_id) {
                                  handleUnlinkStaff(member.department_head_id, member.id)
                                }
                              } else {
                                // Link to new HOD
                                handleLinkStaff(headId, [member.id])
                              }
                            }}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Assign to HOD" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unlink__">Unlink</SelectItem>
                              {departmentHeads.map((head) => (
                                <SelectItem key={head.id} value={head.id}>
                                  {head.name} ({head.department})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )
                  })}
              </div>
              {staff.filter(
                (s) =>
                  s.name.toLowerCase().includes(staffSearchTerm.toLowerCase()) ||
                  s.email.toLowerCase().includes(staffSearchTerm.toLowerCase()) ||
                  s.department.toLowerCase().includes(staffSearchTerm.toLowerCase())
              ).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto opacity-20 mb-2" />
                  <p>No staff members found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
