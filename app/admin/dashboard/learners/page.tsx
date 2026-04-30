"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Users, Search, Filter } from "lucide-react"
import type { Class, Learner } from "@/lib/types"

export default function AdminLearnersPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [learners, setLearners] = useState<Learner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedClass, setSelectedClass] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const supabase = createClient()
    
    const [classesRes, learnersRes] = await Promise.all([
      supabase.from("classes").select("*").order("display_order"),
      supabase.from("learners").select("*").order("name"),
    ])
    
    if (classesRes.data) setClasses(classesRes.data)
    if (learnersRes.data) setLearners(learnersRes.data)
    setIsLoading(false)
  }

  const filteredLearners = learners.filter(learner => {
    const matchesClass = selectedClass === "all" || learner.class_id === selectedClass
    const matchesSearch = learner.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesClass && matchesSearch
  })

  const getClassName = (classId: string) => {
    return classes.find(c => c.id === classId)?.name || "Unknown"
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-500">Loading learners...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Learners Management</h1>
        <p className="text-gray-600">View and search all registered learners</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search learners by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-64">
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="bg-white">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by class" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Learners Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            All Learners
          </CardTitle>
          <CardDescription>
            Showing {filteredLearners.length} of {learners.length} learners
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLearners.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No learners found matching your criteria.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Assessment No.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLearners.map((learner) => (
                  <TableRow key={learner.id}>
                    <TableCell className="font-medium">{learner.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getClassName(learner.class_id)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={learner.gender === 'Male' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'}>
                        {learner.gender}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{learner.admission_number || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">{learners.length}</div>
              <div className="text-sm text-gray-500">Total Learners</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {learners.filter(l => l.gender === 'Male').length}
              </div>
              <div className="text-sm text-gray-500">Male</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-pink-600">
                {learners.filter(l => l.gender === 'Female').length}
              </div>
              <div className="text-sm text-gray-500">Female</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
