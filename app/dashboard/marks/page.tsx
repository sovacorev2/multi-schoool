"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { cacheInvalidate, cachedFetch, TTL } from "@/lib/query-cache";
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
import { ClipboardList, Plus, Save, AlertCircle, Lock, Unlock, Clock, Check, Loader2, CloudUpload } from "lucide-react";
import type { ExamType, Subject, Learner, Mark } from "@/lib/types";
import { getStoredTeacherId } from "@/lib/teacher-permissions";



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
  const [learnerSearch, setLearnerSearch] = useState("");
  const [marks, setMarks] = useState<Record<string, Record<string, number | null>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [assignedSubjectIds, setAssignedSubjectIds] = useState<Set<string>>(new Set());
  const [pinManagementEnabled, setPinManagementEnabled] = useState(false);
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [isLowerGradePointsEntry, setIsLowerGradePointsEntry] = useState(false);
  // subject_id -> ISO deadline string. Lets an admin grant one subject's teacher a
  // different deadline than the rest of the class (set via admin-portal Overview).
  const [subjectDeadlineOverrides, setSubjectDeadlineOverrides] = useState<Record<string, string>>({});

  // Autosave state
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const marksRef = useRef<Record<string, Record<string, number | null>>>({});
  const pendingMarksRef = useRef<Map<string, { learnerId: string; subjectId: string }>>(new Map());
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const [examTypesData, sessionsRes, subjectsData, learnersData, schoolRes] = await Promise.all([
      cachedFetch(`exam_types:${currentSchool.id}`, () => supabase.from("exam_types").select("id, name, display_order").eq("school_id", currentSchool.id).order("display_order", { ascending: true }).then(r => r.data ?? []), TTL.STATIC),
      sessionsQuery,
      cachedFetch(`subjects:${currentClass.id}`, () => supabase.from("subjects").select("id, name, class_id").eq("class_id", currentClass.id).order("name").then(r => r.data ?? []), TTL.STATIC),
      cachedFetch(`learners:v2:${currentClass.id}`, () => supabase.from("learners").select("id, name, class_id, parent_phone").eq("class_id", currentClass.id).order("name").then(r => r.data ?? []), TTL.STATIC),
      supabase.from("schools").select("feature_pin_management").eq("id", currentSchool.id).single()
    ]);
    const examTypesRes = { data: examTypesData }
    const subjectsRes = { data: subjectsData }
    const learnersRes = { data: learnersData }

    // Check if PIN management is enabled for this school - this is the ONLY gate
    // that should enable subject restrictions. A stored teacher ID alone is NOT
    // sufficient - the school must explicitly have feature_pin_management=true.
    const pinManagementFeatureEnabled = schoolRes.data?.feature_pin_management === true;

    // Resolve the teacher id from any known login storage format.
    const storedTeacherId = getStoredTeacherId();
    // A teacher is PIN-authenticated only if: they have a stored ID, the school has
    // PIN management enabled, AND they are not in admin bypass mode.
    const isPinAuthenticated = !!storedTeacherId && pinManagementFeatureEnabled && !isAdminBypass;

    // PIN management restrictions apply ONLY when the school has the feature enabled
    // AND a teacher is PIN-authenticated. Non-PIN schools always see all subjects.
    const pinManagementEnabled_ = pinManagementFeatureEnabled && isPinAuthenticated;
    setPinManagementEnabled(pinManagementEnabled_);

    // If PIN management should be enforced, fetch assigned subjects
    if (pinManagementEnabled_) {
      // Admin bypass: show all subjects
      if (isAdminBypass) {
        setIsClassTeacher(true);
        setAssignedSubjectIds(new Set());
      } else {
        // PIN teacher: fetch their specific subject assignments
        if (storedTeacherId) {
          const { data: assignments } = await supabase
            .from('teacher_assignments')
            .select('subject_id, class_id')
            .eq('user_id', storedTeacherId)
            .eq('class_id', currentClass.id);
          
          // A teacher is a "class teacher" for this class ONLY if they have an
          // assignment row with a NULL subject_id (whole-class assignment).
          const isClassTeacherAssignment = assignments?.some(a => !a.subject_id) || false;
          setIsClassTeacher(isClassTeacherAssignment);
          
          // Restrict editing strictly to assigned subjects for this class.
          const assignedIds = new Set(assignments?.map(a => a.subject_id).filter(Boolean) || []);
          setAssignedSubjectIds(assignedIds);
        } else {
          setIsClassTeacher(false);
          setAssignedSubjectIds(new Set());
        }
      }
    } else {
      // Non-PIN school or admin: full access - treat as class teacher with no restrictions
      setIsClassTeacher(true);
      setAssignedSubjectIds(new Set());
    }

    // Filter to only show sessions with exam_type_id (actual exam sessions)
    let fetchedSessions = (sessionsRes.data || []).filter(s => s.exam_type_id !== null);
    
    // Auto-lock expired sessions on initial load
    if (fetchedSessions.length > 0) {
      await autoLockExpiredSessions(fetchedSessions, (updatedSessions) => {
        fetchedSessions = updatedSessions;
      });
    }

    // Only show exam types available to this class. An empty/null allowed_class_ids
    // means the exam type is available to ALL classes.
    const visibleExamTypes = (examTypesRes.data || []).filter((et: any) => {
      const allowed = et.allowed_class_ids
      if (!allowed || !Array.isArray(allowed) || allowed.length === 0) return true
      return allowed.includes(currentClass.id)
    });
    setExamTypes(visibleExamTypes);
    setSessions(fetchedSessions);
    setSubjects(subjectsRes.data || []);
    setLearners(learnersRes.data || []);
    setIsLoading(false);

    // Detect if this is Kimwangarc and lower grades (PP1, PP2, 1-6)
    // For these classes, show points entry instead of marks
    const isKimwangarc = currentSchool?.code?.toLowerCase() === 'kimwangarc';
    const lowerGradePatterns = /^(PP1|PP2|Grade\s*1|Grade\s*2|Grade\s*3|Grade\s*4|Grade\s*5|Grade\s*6)$/i;
    const isLowerGrade = lowerGradePatterns.test(currentClass?.name || '');
    setIsLowerGradePointsEntry(isKimwangarc && isLowerGrade);
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

  // Keep a ref of the latest marks so autosave timers avoid stale closures
  useEffect(() => {
    marksRef.current = marks;
  }, [marks]);

  // Reset the "saved" indicator back to idle after a short delay
  useEffect(() => {
    if (saveStatus === "saved") {
      const t = setTimeout(() => setSaveStatus("idle"), 2500);
      return () => clearTimeout(t);
    }
  }, [saveStatus]);

  // Clear any pending autosave timer when leaving the page
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    async function fetchMarks() {
      if (!selectedSessionId || !currentClass) {
        setMarks({});
        return;
      }

      const supabase = createClient();
      
      // Fetch marks
      const marksRes = await cachedFetch(
        `marks:${selectedSessionId}`,
        () => supabase.from("marks").select("id, session_id, learner_id, subject_id, score").eq("session_id", selectedSessionId).then(r => r.data ?? []),
        TTL.MARKS
      );

      const marksMap: Record<string, Record<string, number | null>> = {};
      (marksRes || []).forEach((mark: Mark) => {
        if (!marksMap[mark.learner_id]) {
          marksMap[mark.learner_id] = {};
        }
        marksMap[mark.learner_id][mark.subject_id] = mark.score;
      });

      setMarks(marksMap);
      setHasChanges(false);
      pendingMarksRef.current.clear();
      setSaveStatus("idle");
    }

    fetchMarks();
  }, [selectedSessionId, currentClass, currentSchool]);

  useEffect(() => {
    async function fetchOverrides() {
      if (!selectedSessionId) {
        setSubjectDeadlineOverrides({});
        return;
      }
      const supabase = createClient();
      const { data, error } = await supabase
        .from("teacher_deadline_overrides")
        .select("subject_id, deadline_datetime")
        .eq("session_id", selectedSessionId);
      if (error) {
        console.error("[marks] Failed to load per-teacher deadline overrides:", error.message);
      }
      const map: Record<string, string> = {};
      (data || []).forEach((o: any) => { map[o.subject_id] = o.deadline_datetime; });
      setSubjectDeadlineOverrides(map);
    }
    fetchOverrides();
  }, [selectedSessionId]);

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
    const min = isLowerGradePointsEntry ? 1 : 0;
    const max = isLowerGradePointsEntry ? 4 : 100;
    const numValue = value === "" ? null : Math.min(max, Math.max(min, Math.round(parseFloat(value) || min)));

    setMarks((prev) => ({
      ...prev,
      [learnerId]: {
        ...prev[learnerId],
        [subjectId]: numValue,
      },
    }));
    setHasChanges(true);

    // Track only the cell that changed so autosave writes the minimum to the DB
    pendingMarksRef.current.set(`${learnerId}__${subjectId}`, { learnerId, subjectId });

    // Debounced autosave: waits 1.5s after the last keystroke, then writes
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      autoSaveMarks();
    }, 1500);
  };

  // Upsert ONLY the supplied changed cells (keeps Supabase Disk I/O low)
  const persistMarks = useCallback(
    async (entries: Array<{ learnerId: string; subjectId: string }>) => {
      if (!selectedSessionId || entries.length === 0) return true;
      const session = sessions.find((s) => s.id === selectedSessionId);
      if (!session) return false;

      const currentMarks = marksRef.current;
      
      // CRITICAL SECURITY: Filter entries to only those the teacher is authorized to edit
      const authorizedEntries = entries.filter(({ subjectId }) => {
        // Admin bypass: can edit all subjects
        if (isAdminBypass) return true;
        
        // PIN management enabled: check subject authorization
        if (pinManagementEnabled) {
          // Class teacher (no subject restriction) can edit all
          if (isClassTeacher) return true;
          
          // Subject teacher: only edit assigned subjects
          const isAssigned = assignedSubjectIds.has(subjectId);
          if (!isAssigned) {
            console.warn('[v0] SECURITY: Teacher attempted to edit unauthorized subject', subjectId);
          }
          return isAssigned;
        }
        
        // If PIN management not enabled, allow all (legacy mode)
        return true;
      });
      
      // If all entries were filtered out (unauthorized), return error
      if (authorizedEntries.length === 0 && entries.length > 0) {
        console.error('[v0] SECURITY: All mark entries were blocked due to authorization failure');
        return false;
      }

      // Only upsert marks that actually have a score value (not empty/null)
      const marksToUpsert = authorizedEntries
        .map(({ learnerId, subjectId }) => ({
          session_id: selectedSessionId,
          learner_id: learnerId,
          subject_id: subjectId,
          score: currentMarks[learnerId]?.[subjectId] ?? null,
          year: session.year,
          term: session.term,
          exam_type_id: session.exam_type_id || null,
        }))
        .filter(m => m.score !== null && m.score !== undefined && m.score !== '');

      const supabase = createClient();
      const { error } = await supabase.from("marks").upsert(marksToUpsert, {
        onConflict: "session_id,learner_id,subject_id",
      });

      if (error) {
        console.error("[v0] Error saving marks:", error);
        return false;
      }
      // Bust the marks cache for this session so the marklist sees fresh data
      cacheInvalidate(`marks:${selectedSessionId}`)
      return true;
    },
    [selectedSessionId, sessions, isAdminBypass, pinManagementEnabled, isClassTeacher, assignedSubjectIds]
  );

  // Autosave the queued changes (triggered by the debounce timer)
  const autoSaveMarks = useCallback(async () => {
    const session = sessions.find((s) => s.id === selectedSessionId);
    if (!session || !isExamEditable(session).editable) return;

    const entries = Array.from(pendingMarksRef.current.values());
    if (entries.length === 0) return;

    // Clear the queue immediately so new edits during the save are not lost
    pendingMarksRef.current.clear();
    setSaveStatus("saving");

    const ok = await persistMarks(entries);
    if (ok) {
      setSaveStatus("saved");
      setHasChanges(false);
    } else {
      setSaveStatus("error");
      // Re-queue failed cells so the next edit/save retries them
      entries.forEach((e) =>
        pendingMarksRef.current.set(`${e.learnerId}__${e.subjectId}`, e)
      );
    }
  }, [selectedSessionId, sessions, persistMarks]);

  // Manual save (bottom button): flush pending changes + write one audit log entry
  const handleSaveMarks = async () => {
    if (!selectedSessionId || !currentClass) return;

    const selectedSession = sessions.find((s) => s.id === selectedSessionId);
    if (!selectedSession) return;

    const { editable, reason } = isExamEditable(selectedSession);
    if (!editable) {
      alert(`Cannot save marks: ${reason}`);
      return;
    }

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    setIsSaving(true);
    setSaveStatus("saving");

    const entries = Array.from(pendingMarksRef.current.values());
    pendingMarksRef.current.clear();

    const ok = await persistMarks(entries);
    if (!ok) {
      setSaveStatus("error");
      entries.forEach((e) =>
        pendingMarksRef.current.set(`${e.learnerId}__${e.subjectId}`, e)
      );
      setIsSaving(false);
      return;
    }

    // Audit log only on manual save to avoid flooding activity_logs (extra I/O)
    const supabase = createClient();
    let teacherPin = typeof window !== "undefined" ? localStorage.getItem("teacher_pin") : null;
    if (!teacherPin && typeof window !== "undefined") {
      const teacherId = localStorage.getItem("teacher_id");
      if (teacherId) {
        const { data: teacherData } = await supabase
          .from("teacher_accounts")
          .select("pin")
          .eq("id", teacherId)
          .single();
        teacherPin = teacherData?.pin || null;
      }
    }

    await supabase.from("activity_logs").insert({
      school_id: currentSchool?.id,
      class_id: currentClass?.id,
      teacher_pin: teacherPin,
      action: "marks_submitted",
      details: `Saved marks for ${currentClass.name} - ${selectedSession.exam_types?.name} ${selectedSession.term} ${selectedSession.year}`,
      performed_by: teacherPin || "Unknown",
    });

    setIsSaving(false);
    setSaveStatus("saved");
    setHasChanges(false);
  };

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);
  const editStatus = selectedSession ? isExamEditable(selectedSession) : { editable: true, reason: "" };
  // A session locked by the deadline cron ("System - Deadline") is just the automatic
  // consequence of the class's own deadline passing, so a per-subject override can still
  // bypass it. An admin's deliberate lock (any other locked_by value, including a manual
  // toggle with no reason set) always wins and blocks every subject, override or not.
  const isAdminLocked = !!selectedSession?.is_locked && selectedSession?.locked_by !== "System - Deadline";
  const hasActiveOverride = Object.values(subjectDeadlineOverrides).some((d) => new Date(d) >= new Date());
  const anyEditable = !isAdminLocked && (editStatus.editable || hasActiveOverride);

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

  // Filter learners by search while preserving each learner's original roster
  // position (idx), so row numbers stay stable instead of renumbering to the
  // filtered list's position.
  const filteredLearners = learners
    .map((learner, idx) => ({ learner, idx }))
    .filter(({ learner }) =>
      learner.name.toLowerCase().includes(learnerSearch.trim().toLowerCase())
    );

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
          {selectedSession && anyEditable && (
            <AutosaveStatus status={saveStatus} />
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
      {selectedSession && !anyEditable && (
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

      {/* The class deadline/lock has closed the exam overall, but at least one subject
          still has an active per-teacher override, so entry for that subject remains open. */}
      {selectedSession && !editStatus.editable && anyEditable && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900">Marks entry closed for most subjects</p>
                <p className="text-sm text-amber-800">
                  The class deadline has passed, but a subject you teach has an extended deadline set by the admin. You can still enter marks for that subject below.
                </p>
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
              <div className="flex-1">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" />
                  {selectedSession.exam_types?.name} - {selectedSession.term}{" "}
                  {selectedSession.year}
                </CardTitle>
                {isLowerGradePointsEntry && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter performance points (1-4): 4=EE, 3=AE, 2=ME, 1=BE
                  </p>
                )}
              </div>
              {getSessionStatus(selectedSession)}
            </div>
            {learners.length > 0 && (
              <div className="mt-3">
                <Input
                  type="text"
                  placeholder="Search learner by name..."
                  value={learnerSearch}
                  onChange={(e) => setLearnerSearch(e.target.value)}
                  className="max-w-xs"
                />
              </div>
            )}
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
            ) : filteredLearners.length === 0 ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  No learners match &quot;{learnerSearch}&quot;.
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
                    {filteredLearners.map(({ learner, idx }) => {
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

                            // A per-subject deadline override (set by the admin for this
                            // one teacher) takes precedence over the class's own deadline -
                            // an admin's explicit lock still always wins.
                            const overrideDeadline = subjectDeadlineOverrides[subject.id];
                            const subjectEditable = isAdminLocked
                              ? false
                              : overrideDeadline
                              ? new Date(overrideDeadline) >= new Date()
                              : editStatus.editable;

                            let canEdit = !subjectEditable;

                            if (pinManagementEnabled) {
                              showCell = isClassTeacher || isAssigned;
                              canEdit = !subjectEditable || (!isClassTeacher && !isAssigned);
                            }

                            return showCell ? (
                              <TableCell key={subject.id} className="p-1 opacity-100">
                                <Input
                                  type="number"
                                  min={isLowerGradePointsEntry ? "1" : "0"}
                                  max={isLowerGradePointsEntry ? "4" : "100"}
                                  className="w-full text-center h-9"
                                  value={learnerMarks[subject.id] ?? ""}
                                  onChange={(e) =>
                                    handleMarkChange(
                                      learner.id,
                                      subject.id,
                                      e.target.value
                                    )
                                  }
                                  placeholder={isLowerGradePointsEntry ? "1-4" : "-"}
                                  disabled={canEdit}
                                  title={!isAssigned && pinManagementEnabled ? 'Not assigned to you' : overrideDeadline ? `Your deadline for this subject: ${new Date(overrideDeadline).toLocaleString()}` : editStatus.editable ? 'Exam closed - cannot edit' : isLowerGradePointsEntry ? 'Enter performance points (1-4)' : ''}
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

      {/* Sticky bottom save bar - always reachable while scrolling through marks */}
      {selectedSession && anyEditable && subjects.length > 0 && learners.length > 0 && (
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
          <div className="flex items-center justify-between gap-4">
            <AutosaveStatus status={saveStatus} />
            <Button onClick={handleSaveMarks} disabled={isSaving} size="lg">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Marks"}
            </Button>
          </div>
        </div>
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

// Autosave Status Indicator Component
function AutosaveStatus({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {status === "idle" && (
        <span className="text-muted-foreground">Ready to save</span>
      )}
      {status === "saving" && (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span className="text-blue-600">Autosaving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="w-4 h-4 text-green-600" />
          <span className="text-green-600">Marks saved</span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-red-600">Save failed</span>
        </>
      )}
    </div>
  )
}
