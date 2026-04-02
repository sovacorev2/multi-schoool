"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { BookOpen, Plus, Edit, Users, Trash2 } from "lucide-react"
import type { Class } from "@/lib/types"

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<Class | null>(null)
  const [formData, setFormData] = useState({ name: "", display_order: 0, teacher_name: "" })
  const [isSaving, setIsSaving] = useState(false)
  const [learnerCounts, setLearnerCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchClasses()
  }, [])

  async function fetchClasses() {
    const supabase = createClient()
    
    const [classesRes, learnersRes] = await Promise.all([
      supabase.from("classes").select("*").order("display_order"),
      supabase.from("learners").select("class_id"),
    ])
    
    if (classesRes.data) {
      setClasses(classesRes.data)
    }
    
    // Count learners per class
    const counts: Record<string, number> = {}
    if (learnersRes.data) {
      learnersRes.data.forEach(l => {
        counts[l.class_id] = (counts[l.class_id] || 0) + 1
      })
    }
    setLearnerCounts(counts)
    setIsLoading(false)
  }

  async function handleSaveClass() {
    setIsSaving(true)
    const supabase = createClient()
    
    if (editingClass) {
      // Update existing class
      await supabase
        .from("classes")
        .update({
          name: formData.name,
          display_order: formData.display_order,
          teacher_name: formData.teacher_name || null,
        })
        .eq("id", editingClass.id)
    } else {
      // Create new class
      await supabase
        .from("classes")
        .insert({
          name: formData.name,
          display_order: formData.display_order,
          teacher_name: formData.teacher_name || null,
        })
    }
    
    setIsSaving(false)
    setIsAddDialogOpen(false)
    setEditingClass(null)
    setFormData({ name: "", display_order: 0, teacher_name: "" })
    fetchClasses()
  }

  function openEditDialog(cls: Class) {
    setEditingClass(cls)
    setFormData({
      name: cls.name,
      display_order: cls.display_order || 0,
      teacher_name: cls.teacher_name || "",
    })
    setIsAddDialogOpen(true)
  }

  function openAddDialog() {
    setEditingClass(null)
    setFormData({ name: "", display_order: classes.length + 1, teacher_name: "" })
    setIsAddDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-500">Loading classes...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classes Management</h1>
          <p className="text-gray-600">Add, edit, and manage school classes</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add Class
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            All Classes
          </CardTitle>
          <CardDescription>
            Total of {classes.length} classes in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Class Name</TableHead>
                <TableHead>Teacher In Charge</TableHead>
                <TableHead>Learners</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((cls) => (
                <TableRow key={cls.id}>
                  <TableCell className="font-mono text-sm">{cls.display_order}</TableCell>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell>{cls.teacher_name || <span className="text-gray-400">Not assigned</span>}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <Users className="w-3 h-3" />
                      {learnerCounts[cls.id] || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(cls)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClass ? "Edit Class" : "Add New Class"}</DialogTitle>
            <DialogDescription>
              {editingClass ? "Update the class details below." : "Enter the details for the new class."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Class Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Grade 1"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="order">Display Order</Label>
              <Input
                id="order"
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="teacher">Teacher In Charge (Optional)</Label>
              <Input
                id="teacher"
                value={formData.teacher_name}
                onChange={(e) => setFormData({ ...formData, teacher_name: e.target.value })}
                placeholder="e.g., Mr. John Smith"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="bg-transparent">
              Cancel
            </Button>
            <Button onClick={handleSaveClass} disabled={isSaving || !formData.name}>
              {isSaving ? "Saving..." : (editingClass ? "Update" : "Add Class")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
