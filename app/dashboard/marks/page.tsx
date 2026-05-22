"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useClass } from "@/lib/class-context";
import { useSchool } from "@/lib/school-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ClipboardList, Plus, Save, AlertCircle, Lock, Unlock, Clock } from "lucide-react";
import type { ExamType, Subject, Learner, Mark } from "@/lib/types";



interface SessionWithExamType {
  id: string;
  class_id: string;
  exam_type_id: string;
  term: string;
  year: number;
  is_active: boolean;
  is_locked: boolean;
  deadline_datetime: string | null;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
  exam_types?: ExamType | null;
}

const CURRENT_YEAR = new Date().getFullYear();
const TERMS = ["Term 1", "Term 2", "Term 3"];
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

// Helper to check if exam is editable
function isExamEditable(session: SessionWithExamType): { editable: boolean; reason: string } {
  const now = new Date();
  
  // Check if manually locked
  if (session.is_locked) {
    return { editable: false, reason: "Exam is locked by admin" };
  }
  
  // Check if deadline has passed
  if (session.deadline_datetime) {
    const deadline = new Date(session.deadline_datetime);
    if (deadline < now) {
      return { editable: false, reason: `Deadline has passed (${deadline.toLocaleString()})` };
    }
    
    // Check if deadline is approaching (within 1 hour)
    const timeUntilDeadline = deadline.getTime() - now.getTime();
    if (timeUntilDeadline > 0 && timeUntilDeadline < 3600000) {
      return { editable: true, reason: `Deadline approaching: ${deadline.toLocaleString()}` };
    }
  }
  
  return { editable: true, reason: "" };
}
  
// Helper to auto-lock sessions when deadline passes and update state
async function autoLockExpiredSessions(
  sessions: SessionWithExamType[],
  setSessions: (sessions: SessionWithExamType[]) => void
) {
  const supabase = createClient();
  const now = new Date();
  const updatedSessions: SessionWithExamType[] = [];

  for (const session of sessions) {
    if (
      session.deadline_datetime &&
      !session.is_locked &&
      new Date(session.deadline_datetime) < now
    ) {
      const { error } = await supabase
        .from("sessions")
        .update({
          is_locked: true,
          locked_at: now.toISOString(),
          locked_by: "System - Deadline",
        })
        .eq("id", session.id);

      if (!error) {
        // Log the auto-lock with teacher PIN and class ID
        const teacherPin = typeof window !== 'undefined' ? localStorage.getItem('teacher_pin') : null
        await supabase.from("activity_logs").insert({
          school_id: currentSchool?.id,
          class_id: session.class_id,
          teacher_pin: teacherPin,
          action: "deadline_auto_locked",
          details: `Session auto-locked: ${session.exam_types?.name} - Deadline: ${session.deadline_datetime}`,
          performed_by: "System",
        });

        // Update local state
        updatedSessions.push({
          ...session,
          is_locked: true,
          locked_at: now.toISOString(),
          locked_by: "System - Deadline",
        });
      } else {
        updatedSessions.push(session);
      }
    } else {
      updatedSessions.push(session);
    }
  }

  // Update state with locked sessions
  if (updatedSessions.length > 0) {
    setSessions(updatedSessions);
  }
}

export default function MarksPage() {
  const { currentClass, currentSession: loggedInSession, isAdminBypass } = useClass();
  const { currentSchool } = useSchool();
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [sessions, setSessions] = useState<SessionWithExamType[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [marks, setMarks] = useState<Record<string, Record<string, number | null>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [assignedSubjectIds, setAssignedSubjectIds] = useState<Set<string>>(new Set());
  const [pinManagementEnabled, setPinManagementEnabled] = useState(false);
  const [isClassTeacher, setIsClassTeacher] = useState(false);

  // Session selection
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>(CURRENT_YEAR.toString());
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);

  // New session form
  const [newSession, setNewSession] = useState({
    exam_type_id: "",
    term: "",
    year: CURRENT_YEAR.toString(),
  });

  const fetchInitialData = useCallback(async () => {
    if (!currentClass || !currentSchool) return;

    const supabase = createClient();

    // Build session query - show all sessions for this class (like marklist does)
    let sessionsQuery = supabase
      .from("sessions")
      .select("*, exam_types(*)")
      .eq("class_id", currentClass.id)
      .order("year", { ascending: false })
      .order("term");

    const [examTypesRes, sessionsRes, subjectsRes, learnersRes, schoolRes] = await Promise.all([
      supabase.from("exam_types").select("*").eq("school_id", currentSchool.id).order("display_order", { ascending: true }),
      sessionsQuery,
      supabase
        .from("subjects")
        .select("*")
        .eq("class_id", currentClass.id)
        .order("name"),
      supabase
        .from("learners")
        .select("*")
        .eq("class_id", currentClass.id)
        .order("name"),
      supabase
        .from("schools")
        .select("feature_pin_management")
        .eq("id", currentSchool.id)
        .single()
    ]);

    // Check if PIN management is enabled for this school
    const pinManagementEnabled_ = schoolRes.data?.feature_pin_management === true;
    setPinManagementEnabled(pinManagementEnabled_);

    // If PIN management is enabled, fetch assigned subjects
    if (pinManagementEnabled_) {
      // Admin bypass: show all subjects
      if (isAdminBypass) {
        setIsClassTeacher(true);
        setAssignedSubjectIds(new Set());
      } else {
        // Regular teacher: fetch their assignments
        const teacherId = localStorage.getItem('teacher_id');
        if (teacherId) {
          const { data: assignments } = await supabase
            .from('teacher_assignments')
            .select('subject_id')
            .eq('user_id', teacherId)
            .eq('class_id', currentClass.id);
          
          const isClassTeacherAssignment = assignments?.some(a => !a.subject_id) || false;
          setIsClassTeacher(isClassTeacherAssignment);
          
          const assignedIds = new Set(assignments?.map(a => a.subject_id).filter(Boolean) || []);
          setAssignedSubjectIds(assignedIds);
        }
      }
    }

    // Filter to only show sessions with exam_type_id (actual exam sessions)
    let fetchedSessions = (sessionsRes.data || []).filter(s => s.exam_type_id !== null);
    
    // Auto-lock expired sessions on initial load
    if (fetchedSessions.length > 0) {
      await autoLockExpiredSessions(fetchedSessions, (updatedSessions) => {
        fetchedSessions = updatedSessions;
      });
    }

    setExamTypes(examTypesRes.data || []);
    setSessions(fetchedSessions);
    setSubjects(subjectsRes.data || []);
    setLearners(learnersRes.data || []);
    setIsLoading(false);
  }, [currentClass, currentSchool]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Periodic check for expired deadlines (every 10 seconds)
  useEffect(() => {
    const checkDeadlines = async () => {
      if (sessions.length > 0) {
        await autoLockExpiredSessions(sessions, setSessions);
      }
    };

    const interval = setInterval(checkDeadlines, 10000);
    return () => clearInterval(interval);
  }, [sessions]);

  useEffect(() => {
    async function fetchMarks() {
      if (!selectedSessionId || !currentClass) {
        setMarks({});
        return;
      }

      const supabase = createClient();
      
      // Fetch marks
      const { data: marksRes } = await supabase.from("marks").select("*").eq("session_id", selectedSessionId);

      const marksMap: Record<string, Record<string, number | null>> = {};
      (marksRes || []).forEach((mark: Mark) => {
        if (!marksMap[mark.learner_id]) {
          marksMap[mark.learner_id] = {};
        }
        marksMap[mark.learner_id][mark.subject_id] = mark.score;
      });

      setMarks(marksMap);
      setHasChanges(false);
    }

    fetchMarks();
  }, [selectedSessionId, currentClass]);

  const handleCreateSession = async () => {
    if (!currentClass || !currentSchool || !newSession.exam_type_id || !newSession.term || !newSession.year) return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        class_id: currentClass.id,
        school_id: currentSchool.id,
        exam_type_id: newSession.exam_type_id,
        term: newSession.term,
        year: parseInt(newSession.year),
        is_locked: false,
      })
      .select("*, exam_types(*)")
      .single();

    if (error) {
      alert("Error creating session: " + (error.message || "This session already exists!"));
      return;
    }

    // Log the action with teacher PIN and class ID
    let teacherPin = typeof window !== 'undefined' ? localStorage.getItem('teacher_pin') : null
    
    // If PIN not in localStorage, fetch from database
    if (!teacherPin && typeof window !== 'undefined') {
      const teacherId = localStorage.getItem('teacher_id')
      if (teacherId) {
        const { data: teacherData } = await supabase
          .from('teacher_accounts')
          .select('pin')
          .eq('id', teacherId)
          .single()
        teacherPin = teacherData?.pin || null
      }
    }
    
    await supabase.from("activity_logs").insert({
      school_id: currentSchool?.id,
      class_id: currentClass?.id,
      teacher_pin: teacherPin,
      action: "session_created",
      details: `Created session: ${examTypes.find(e => e.id === newSession.exam_type_id)?.name} - ${newSession.term} ${newSession.year} for ${currentClass.name}`,
      performed_by: teacherPin || 'Unknown',
    });

    setSessions([data, ...sessions]);
    setSelectedSessionId(data.id);
    setIsCreateSessionOpen(false);
    setNewSession({ exam_type_id: "", term: "", year: CURRENT_YEAR.toString() });
  };

  const handleMarkChange = (learnerId: string, subjectId: string, value: string) => {
    const numValue = value === "" ? null : Math.min(100, Math.max(0, parseFloat(value) || 0));
    
    setMarks((prev) => ({
      ...prev,
      [learnerId]: {
        ...prev[learnerId],
        [subjectId]: numValue,
      },
    }));
    setHasChanges(true);
  };

  const handleSaveMarks = async () => {
    if (!selectedSessionId || !currentClass) return;
    
    const selectedSession = sessions.find((s) => s.id === selectedSessionId);
    if (!selectedSession) return;

    // Check if editable
    const { editable, reason } = isExamEditable(selectedSession);
    if (!editable) {
      alert(`Cannot save marks: ${reason}`);
      return;
    }

    setIsSaving(true);

    const supabase = createClient();
    const session = sessions.find(s => s.id === selectedSessionId);
    if (!session) {
      setIsSaving(false);
      return;
    }

    const marksToUpsert: Array<{
      session_id: string;
      learner_id: string;
      subject_id: string;
      score: number | null;
      year: number;
      term: string;
      exam_type_id: string | null;
    }> = [];

    Object.entries(marks).forEach(([learnerId, subjectMarks]) => {
      Object.entries(subjectMarks).forEach(([subjectId, score]) => {
        marksToUpsert.push({
          session_id: selectedSessionId,
          learner_id: learnerId,
          subject_id: subjectId,
          score,
          year: session.year,
          term: session.term,
          exam_type_id: session.exam_type_id || null,
        });
      });
    });

    const { error } = await supabase.from("marks").upsert(marksToUpsert, {
      onConflict: "session_id,learner_id,subject_id",
    });

    if (error) {
      console.error("[v0] Error saving marks:", error);
    }

    // Log the action with teacher PIN and class ID for audit trail
    let teacherPin = typeof window !== 'undefined' ? localStorage.getItem('teacher_pin') : null
    
    // If PIN not in localStorage, fetch from database
    if (!teacherPin && typeof window !== 'undefined') {
      const teacherId = localStorage.getItem('teacher_id')
      if (teacherId) {
        const { data: teacherData } = await supabase
          .from('teacher_accounts')
          .select('pin')
          .eq('id', teacherId)
          .single()
        teacherPin = teacherData?.pin || null
      }
    }
    
    await supabase.from("activity_logs").insert({
      school_id: currentSchool?.id,
      class_id: currentClass?.id,
      teacher_pin: teacherPin,
      action: "marks_submitted",
      details: `Submitted marks for ${learners.length} learners in ${subjects.length} subjects - ${currentClass.name}`,
      performed_by: teacherPin || 'Unknown',
    });

    setIsSaving(false);
    setHasChanges(false);
  };

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);
  const editStatus = selectedSession ? isExamEditable(selectedSession) : { editable: true, reason: "" };

  // Get session status badge
  const getSessionStatus = (session: SessionWithExamType) => {
    if (session.is_locked) {
      return <Badge variant="destructive" className="ml-2"><Lock className="w-3 h-3 mr-1" />Locked</Badge>;
    }
    if (session.deadline_datetime && new Date(session.deadline_datetime) < new Date()) {
      return <Badge variant="secondary" className="ml-2"><Clock className="w-3 h-3 mr-1" />Past Deadline</Badge>;
    }
    if (session.deadline_datetime) {
      return <Badge variant="outline" className="ml-2"><Clock className="w-3 h-3 mr-1" />Due: {new Date(session.deadline_datetime).toLocaleDateString()}</Badge>;
    }
    return <Badge variant="default" className="ml-2 bg-primary"><Unlock className="w-3 h-3 mr-1" />Open</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marks Entry</h1>
          <p className="text-muted-foreground">
            Record exam marks for {currentClass?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && editStatus.editable && (
            <Button onClick={handleSaveMarks} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Marks"}
            </Button>
          )}
        </div>
      </div>

      {/* Deadline Timer Notification */}
      {selectedSession && selectedSession.deadline_datetime && (
        <DeadlineTimer deadline={new Date(selectedSession.deadline_datetime)} sessionName={selectedSession.exam_types?.name || 'Exam'} />
      )}

      {/* Session Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Select Exam Session</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-6 space-y-4">
              <div className="text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No exam sessions yet</p>
                <p className="text-sm">Create a new exam session to start entering marks</p>
              </div>
              <Button onClick={() => setIsCreateSessionOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Exam Session
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Year Filter */}
              {Array.from(new Set(sessions.map(s => s.year))).length > 1 && (
                <div className="w-full sm:w-32">
                  <Select value={selectedYear} onValueChange={(value) => {
                    setSelectedYear(value);
                    setSelectedTerm("");
                    setSelectedSessionId("");
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(new Set(sessions.map(s => s.year)))
                        .sort((a, b) => b - a)
                        .map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* Term Filter */}
              {Array.from(new Set(sessions.filter(s => s.year.toString() === selectedYear).map(s => s.term))).length > 1 && (
                <div className="w-full sm:w-32">
                  <Select value={selectedTerm} onValueChange={(value) => {
                    setSelectedTerm(value);
                    setSelectedSessionId("");
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by term" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(new Set(sessions.filter(s => s.year.toString() === selectedYear).map(s => s.term)))
                        .map((term) => (
                          <SelectItem key={term} value={term}>
                            {term}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex-1">
                <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an exam session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions
                      .filter(session => 
                        session.year.toString() === selectedYear &&
                        (!selectedTerm || session.term === selectedTerm)
                      )
                      .map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          <span className="flex items-center">
                            {session.exam_types?.name} - {session.term} {session.year}
                            {session.is_locked && <Lock className="w-3 h-3 ml-2 text-destructive" />}
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={() => setIsCreateSessionOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Session
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lock/Deadline Warning */}
      {selectedSession && !editStatus.editable && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Marks Entry Closed</p>
                <p className="text-sm text-muted-foreground">
                  {editStatus.reason}
                  {selectedSession.deadline_datetime && (
                    <span className="block mt-1">
                      Deadline: {new Date(selectedSession.deadline_datetime).toLocaleString()}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Contact the headteacher if you need an extension.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deadline Warning (Approaching) */}
      {selectedSession && editStatus.editable && editStatus.reason.includes("⚠️") && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900">Deadline Approaching</p>
                <p className="text-sm text-amber-800">{editStatus.reason}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Marks Table */}
      {selectedSession && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                {selectedSession.exam_types?.name} - {selectedSession.term}{" "}
                {selectedSession.year}
              </CardTitle>
              {getSessionStatus(selectedSession)}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {subjects.length === 0 ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  No subjects configured. Please add subjects first.
                </p>
              </div>
            ) : learners.length === 0 ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  No learners in this class. Please add learners first.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 sticky left-0 bg-card">#</TableHead>
                      <TableHead className="min-w-[180px] sticky left-12 bg-card">
                        Learner Name
                      </TableHead>
                      {subjects.map((subject) => {
                        const isAssigned = assignedSubjectIds.has(subject.id);
                        // If PIN management is enabled: only show assigned subjects (or all if class teacher)
                        // If PIN management is disabled: show all subjects
                        let showColumn = true;
                        let columnOpacity = 'opacity-100';
                        
                        if (pinManagementEnabled) {
                          showColumn = isClassTeacher || isAssigned;
                          columnOpacity = (isClassTeacher || isAssigned) ? 'opacity-100' : 'opacity-40';
                        }
                        
                        return showColumn ? (
                          <TableHead
                            key={subject.id}
                            className={`min-w-[100px] text-center ${columnOpacity}`}
                            title={!isAssigned && pinManagementEnabled ? 'Not assigned to you' : ''}
                          >
                            {subject.name}
                          </TableHead>
                        ) : null;
                      })}
                      <TableHead className="min-w-[80px] text-center">Total</TableHead>
                      <TableHead className="min-w-[80px] text-center">Avg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {learners.map((learner, idx) => {
                      const learnerMarks = marks[learner.id] || {};
                      const totalMarks = Object.values(learnerMarks).reduce(
                        (sum, m) => sum + (m || 0),
                        0
                      );
                      const subjectsWithMarks = Object.values(learnerMarks).filter(
                        (m) => m !== null && m !== undefined
                      ).length;
                      const average =
                        subjectsWithMarks > 0
                          ? (totalMarks / subjectsWithMarks).toFixed(1)
                          : "-";

                      return (
                        <TableRow key={learner.id}>
                          <TableCell className="sticky left-0 bg-card text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="sticky left-12 bg-card font-medium">
                            {learner.name}
                          </TableCell>
                          {subjects.map((subject) => {
                            const isAssigned = assignedSubjectIds.has(subject.id);
                            // For ShuleTech: only show cells for assigned subjects
                            // If PIN management is disabled: show all cells
                            let showCell = true;
                            let canEdit = !editStatus.editable;
                            
                            if (pinManagementEnabled) {
                              showCell = isClassTeacher || isAssigned;
                              canEdit = !editStatus.editable || (!isClassTeacher && !isAssigned);
                            }
                            
                            return showCell ? (
                              <TableCell key={subject.id} className="p-1 opacity-100">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  className="w-full text-center h-9"
                                  value={learnerMarks[subject.id] ?? ""}
                                  onChange={(e) =>
                                    handleMarkChange(
                                      learner.id,
                                      subject.id,
                                      e.target.value
                                    )
                                  }
                                  placeholder="-"
                                  disabled={canEdit}
                                  title={!isAssigned && pinManagementEnabled ? 'Not assigned to you' : ''}
                                />
                              </TableCell>
                            ) : null;
                          })}
                          <TableCell className="text-center font-medium">
                            {subjectsWithMarks > 0 ? totalMarks : "-"}
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {average}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedSession && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No Session Selected
            </h3>
            <p className="text-muted-foreground mb-4">
              Select an exam session above or create a new one to start entering marks.
            </p>
            <Button onClick={() => setIsCreateSessionOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create New Session
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Session Dialog */}
      <Dialog open={isCreateSessionOpen} onOpenChange={setIsCreateSessionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Exam Session</DialogTitle>
            <DialogDescription>
              Set up a new exam session for marks entry
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Exam Type *</Label>
              <Select
                value={newSession.exam_type_id}
                onValueChange={(v) =>
                  setNewSession({ ...newSession, exam_type_id: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select exam type" />
                </SelectTrigger>
                <SelectContent>
                  {examTypes.map((et) => (
                    <SelectItem key={et.id} value={et.id}>
                      {et.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Term *</Label>
                <Select
                  value={newSession.term}
                  onValueChange={(v) => setNewSession({ ...newSession, term: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    {TERMS.map((term) => (
                      <SelectItem key={term} value={term}>
                        {term}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year *</Label>
                <Select
                  value={newSession.year}
                  onValueChange={(v) => setNewSession({ ...newSession, year: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateSessionOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSession}
              disabled={!newSession.exam_type_id || !newSession.term || !newSession.year}
            >
              Create Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Deadline Timer Component
function DeadlineTimer({ deadline, sessionName }: { deadline: Date; sessionName: string }) {
  const [timeLeft, setTimeLeft] = useState('')
  const [isOverdue, setIsOverdue] = useState(false)

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date()
      const diff = deadline.getTime() - now.getTime()

      if (diff <= 0) {
        setIsOverdue(true)
        setTimeLeft('OVERDUE')
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((diff / 1000 / 60) % 60)
      const seconds = Math.floor((diff / 1000) % 60)

      setIsOverdue(false)
      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [deadline])

  return (
    <Alert className={isOverdue ? 'border-red-500 bg-red-50' : 'border-orange-500 bg-orange-50'}>
      <Clock className={`w-4 h-4 ${isOverdue ? 'text-red-600' : 'text-orange-600'}`} />
      <AlertTitle className={isOverdue ? 'text-red-800' : 'text-orange-800'}>
        Marks Entry Deadline {isOverdue ? 'OVERDUE' : 'Countdown'}
      </AlertTitle>
      <AlertDescription className={isOverdue ? 'text-red-700' : 'text-orange-700'}>
        <div className="space-y-1">
          <div className="font-bold text-lg">{timeLeft}</div>
          <div className="text-sm">{sessionName} deadline: {deadline.toLocaleString()}</div>
        </div>
      </AlertDescription>
    </Alert>
  )
}
