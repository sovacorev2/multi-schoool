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
        // Log the auto-lock
        await supabase.from("audit_logs").insert({
          class_id: session.class_id,
          session_id: session.id,
          action: "deadline_auto_locked",
          details: {
            deadline: session.deadline_datetime,
            exam: session.exam_types?.name,
          },
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
  const { currentClass, currentSession: loggedInSession } = useClass();
  const { currentSchool } = useSchool();
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [sessions, setSessions] = useState<SessionWithExamType[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [marks, setMarks] = useState<Record<string, Record<string, number | null>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  

  // Session selection
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);

  // New session form
  const [newSession, setNewSession] = useState({
    exam_type_id: "",
    term: "",
    year: CURRENT_YEAR.toString(),
  });

  const fetchInitialData = useCallback(async () => {
    if (!currentClass || !currentSchool || !loggedInSession) return;

    const supabase = createClient();

    // Build session query - filter by the logged-in session's term and year
    let sessionsQuery = supabase
      .from("sessions")
      .select("*, exam_types(*)")
      .eq("class_id", currentClass.id)
      .eq("term", loggedInSession.term)
      .eq("year", loggedInSession.year)
      .order("year", { ascending: false })
      .order("term");

    const [examTypesRes, sessionsRes, subjectsRes, learnersRes] = await Promise.all([
      supabase.from("exam_types").select("*").eq("school_id", currentSchool.id).order("display_order", { ascending: true }),
      sessionsQuery,
      supabase
        .from("subjects")
        .select("*")
        .eq("school_id", currentSchool.id)
        .order("name"),
      supabase
        .from("learners")
        .select("*")
        .eq("class_id", currentClass.id)
        .order("name")
    ]);

    let fetchedSessions = sessionsRes.data || [];
    
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
  }, [currentClass, currentSchool, loggedInSession]);

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
    if (!currentClass || !currentSchool || !loggedInSession || !newSession.exam_type_id) return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        class_id: currentClass.id,
        school_id: currentSchool.id,
        exam_type_id: newSession.exam_type_id,
        term: loggedInSession.term,
        year: loggedInSession.year,
        is_locked: false,
      })
      .select("*, exam_types(*)")
      .single();

    if (error) {
      alert("This session already exists!");
      return;
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      class_id: currentClass.id,
      session_id: data.id,
      action: "session_created",
      details: { term: loggedInSession.term, year: loggedInSession.year, exam_type: examTypes.find(e => e.id === newSession.exam_type_id)?.name },
      performed_by: currentClass.name,
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

    // Log the action
    await supabase.from("audit_logs").insert({
      class_id: currentClass.id,
      session_id: selectedSessionId,
      action: "marks_submitted",
      details: { learner_count: learners.length, subject_count: subjects.length },
      performed_by: currentClass.name,
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

      {/* Session Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Select Exam Session</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an exam session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
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
                      {subjects.map((subject) => (
                        <TableHead
                          key={subject.id}
                          className="min-w-[100px] text-center"
                        >
                          {subject.name}
                        </TableHead>
                      ))}
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
                          {subjects.map((subject) => (
                            <TableCell key={subject.id} className="p-1">
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
                                disabled={!editStatus.editable}
                              />
                            </TableCell>
                          ))}
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                Creating session for: <strong>{loggedInSession?.term} {loggedInSession?.year}</strong>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateSessionOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSession}
              disabled={!newSession.exam_type_id}
            >
              Create Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
