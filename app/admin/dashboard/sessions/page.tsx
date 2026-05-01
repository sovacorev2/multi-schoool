"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useClass } from "@/lib/class-context";
import { useSchool } from "@/lib/school-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Lock, 
  Unlock, 
  Clock, 
  Calendar,
  ClipboardList,
  History,
  AlertCircle,
  FileText,
  Key,
  RotateCcw
} from "lucide-react";
import type { ExamType, Class, AuditLog } from "@/lib/types";
import { getClassesForPasswordManagement, resetClassPassword } from "@/app/actions/auth";
import { schoolConfig, LOWER_GRADE_CLASSES } from "@/lib/school-config";

interface SessionWithDetails {
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
  classes?: Class | null;
}

export default function AdminPage() {
const { currentClass } = useClass();
const { currentSchool } = useSchool();
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialogs
  const [isDeadlineDialogOpen, setIsDeadlineDialogOpen] = useState(false);
  const [isUnlockConfirmDialogOpen, setIsUnlockConfirmDialogOpen] = useState(false);
  const [isExceptionDialogOpen, setIsExceptionDialogOpen] = useState(false);
  
  // Selected session for actions
  const [selectedSession, setSelectedSession] = useState<SessionWithDetails | null>(null);
  
  // Form states
  const [deadlineForm, setDeadlineForm] = useState({ date: "", time: "" });
  const [exceptionForm, setExceptionForm] = useState({ class_id: "", hours: "24", reason: "" });
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  const [deadlineLoading, setDeadlineLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("sessions");
  
  // Password management
  const [classPasswords, setClassPasswords] = useState<{ id: string; name: string; hasPassword: boolean }[]>([]);
  const [passwordResetLoading, setPasswordResetLoading] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [classToReset, setClassToReset] = useState<{ id: string; name: string } | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const [classesRes, sessionsRes, logsRes] = await Promise.all([
      supabase.from("classes").select("*").order("display_order"),
      supabase
        .from("sessions")
        .select("*, exam_types(*), classes(*)")
        .order("year", { ascending: false })
        .order("term"),
      supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    setAllClasses(classesRes.data || []);
    setSessions(sessionsRes.data || []);
    setAuditLogs(logsRes.data || []);
    
    // Fetch password status for classes
    const passwordData = await getClassesForPasswordManagement();
    setClassPasswords(passwordData);
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleLock = async (session: SessionWithDetails) => {
    // If currently locked and trying to unlock after deadline has passed, show confirmation
    if (session.is_locked && session.deadline_datetime && new Date(session.deadline_datetime) < new Date()) {
      setSelectedSession(session);
      setIsUnlockConfirmDialogOpen(true);
      return;
    }

    setToggleLoading(session.id);
    const supabase = createClient();
    const newLockState = !session.is_locked;
    
    await supabase
      .from("sessions")
      .update({ 
        is_locked: newLockState,
        locked_at: newLockState ? new Date().toISOString() : null,
        locked_by: newLockState ? (currentClass?.name || "Admin") : null,
      })
      .eq("id", session.id);

    // Log the action
    await supabase.from("activity_logs").insert({
      school_id: currentSchool?.id,
      action: newLockState ? "exam_locked" : "exam_unlocked",
      details: `${newLockState ? 'Locked' : 'Unlocked'} exam: ${session.exam_types?.name} - ${session.term} ${session.year} for ${session.classes?.name}`,
      performed_by: currentClass?.name || "Admin",
    });

    setToggleLoading(null);
    fetchData();
  };

  const handleConfirmUnlock = async () => {
    if (!selectedSession) return;

    console.log("[v0] Confirming unlock for session:", selectedSession.id);
    setToggleLoading(selectedSession.id);
    const supabase = createClient();
    
    const { error } = await supabase
      .from("sessions")
      .update({ 
        is_locked: false,
        locked_at: null,
        locked_by: null,
      })
      .eq("id", selectedSession.id);

    if (error) {
      console.log("[v0] Error unlocking session:", error);
      alert("Failed to unlock: " + error.message);
      setToggleLoading(null);
      return;
    }

    console.log("[v0] Session unlocked successfully");

    // Log the action
    await supabase.from("activity_logs").insert({
      school_id: currentSchool?.id,
      action: "exam_unlocked",
      details: `Unlocked exam after deadline: ${selectedSession.exam_types?.name} - ${selectedSession.term} ${selectedSession.year} for ${selectedSession.classes?.name}`,
      performed_by: currentClass?.name || "Admin",
    });

    setToggleLoading(null);
    setIsUnlockConfirmDialogOpen(false);
    setSelectedSession(null);
    await fetchData();
  };

  const handleSetDeadline = async () => {
    if (!selectedSession || !deadlineForm.date) {
      console.log("[v0] Cannot set deadline - missing session or date", { selectedSession: !!selectedSession, date: deadlineForm.date });
      alert("Please select a date for the deadline");
      return;
    }
    
    setDeadlineLoading(true);
    const supabase = createClient();
    
    // Parse time correctly to avoid timezone offset issues
    const [hours, minutes] = (deadlineForm.time || "23:59").split(':').map(Number);
    const deadline = new Date(`${deadlineForm.date}`);
    deadline.setHours(hours, minutes, 0, 0);
    
    console.log("[v0] Setting deadline:", deadline.toISOString(), "for session:", selectedSession.id);
    
    const { data, error } = await supabase
      .from("sessions")
      .update({ deadline_datetime: deadline.toISOString() })
      .eq("id", selectedSession.id)
      .select();

    if (error) {
      console.error("[v0] Error setting deadline:", error);
      alert("Failed to set deadline: " + error.message);
      setDeadlineLoading(false);
      return;
    }

    console.log("[v0] Deadline set successfully:", data);

    // Log the action
    await supabase.from("activity_logs").insert({
      school_id: currentSchool?.id,
      action: "deadline_set",
      details: `Set deadline ${deadline.toISOString()} for ${selectedSession.exam_types?.name} - ${selectedSession.term} ${selectedSession.year} - ${selectedSession.classes?.name}`,
      performed_by: "Admin",
    });

    setIsDeadlineDialogOpen(false);
    setDeadlineForm({ date: "", time: "" });
    setSelectedSession(null);
    setDeadlineLoading(false);
    fetchData();
  };

  const handleCreateException = async () => {
    // Placeholder for handleCreateException logic
  };

  const getSessionStatus = (session: SessionWithDetails) => {
    if (session.is_locked) {
      return <Badge variant="destructive"><Lock className="w-3 h-3 mr-1" />Locked</Badge>;
    }
    if (session.deadline_datetime && new Date(session.deadline_datetime) < new Date()) {
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Past Deadline</Badge>;
    }
    if (session.deadline_datetime) {
      return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Deadline Set</Badge>;
    }
    return <Badge className="bg-primary"><Unlock className="w-3 h-3 mr-1" />Open</Badge>;
  };

  const getActionLabel = (action: string) => {
  const labels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    marks_submitted: { label: "Marks Submitted", variant: "default" },
    marks_edited: { label: "Marks Edited", variant: "secondary" },
    exam_locked: { label: "Exam Locked", variant: "destructive" },
    exam_unlocked: { label: "Exam Unlocked", variant: "outline" },
    deadline_set: { label: "Deadline Set", variant: "outline" },
    session_created: { label: "Session Created", variant: "default" },
  };
    return labels[action] || { label: action, variant: "secondary" as const };
  };

  // Password management - only for lower grades (PP1-Grade 3)
  const lowerClassPasswords = classPasswords.filter(c => 
    LOWER_GRADE_CLASSES.some(grade => c.name.includes(grade))
  );

  const handleResetPassword = async () => {
    if (!classToReset) return;
    
    setPasswordResetLoading(classToReset.id);
    const result = await resetClassPassword(classToReset.id);
    
    if (result.success) {
      // Refresh the password list
      const updatedPasswords = await getClassesForPasswordManagement();
      setClassPasswords(updatedPasswords);
    }
    
    setPasswordResetLoading(null);
    setIsResetConfirmOpen(false);
    setClassToReset(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading admin panel...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="w-6 h-6" />
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
          Manage exam sessions, deadlines, and view audit logs
        </p>
      </div>

      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            Exam Sessions
          </TabsTrigger>
          <TabsTrigger value="passwords" className="gap-2">
            <Key className="w-4 h-4" />
            Password Management
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <History className="w-4 h-4" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* Sessions Tab */}
        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>All Exam Sessions</CardTitle>
              <CardDescription>
                Lock/unlock exams and set deadlines across all classes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No exam sessions created yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead>Exam</TableHead>
                        <TableHead>Term/Year</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((session) => (
                        <TableRow key={session.id}>
                          <TableCell className="font-medium">
                            {session.classes?.name}
                          </TableCell>
                          <TableCell>{session.exam_types?.name}</TableCell>
                          <TableCell>{session.term} {session.year}</TableCell>
                          <TableCell>{getSessionStatus(session)}</TableCell>
                          <TableCell>
                            {session.deadline_datetime 
                              ? new Date(session.deadline_datetime).toLocaleString()
                              : <span className="text-muted-foreground">Not set</span>
                            }
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2 flex-wrap">
                              <Button
                                size="sm"
                                className="min-w-max"
                                variant={session.is_locked ? "outline" : "destructive"}
                                onClick={() => handleToggleLock(session)}
                                disabled={toggleLoading === session.id}
                              >
                                {toggleLoading === session.id ? (
                                  <>
                                    <div className="w-3 h-3 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    {session.is_locked ? "Unlocking..." : "Locking..."}
                                  </>
                                ) : (
                                  <>
                                    {session.is_locked ? (
                                      <><Unlock className="w-4 h-4 mr-1" />Unlock</>
                                    ) : (
                                      <><Lock className="w-4 h-4 mr-1" />Lock</>
                                    )}
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                className="min-w-max bg-transparent"
                                variant="outline"
                                onClick={() => {
                                  setSelectedSession(session);
                                  setIsDeadlineDialogOpen(true);
                                }}
                              >
                                <Calendar className="w-4 h-4 mr-1" />
                                Deadline
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Password Management Tab */}
        <TabsContent value="passwords">
          <Card>
            <CardHeader>
              <CardTitle>Password Management</CardTitle>
              <CardDescription>
                Reset passwords for Playgroup to Grade 3 classes. Grade 4-9 use a common password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                  <strong>Note:</strong> Grade 4-9 classes use a common password ({schoolConfig.defaultTeacherPassword}). 
                  PP1 to Grade 3 teachers set their own passwords on first login.
                </div>
                
                {lowerClassPasswords.length === 0 ? (
                  <div className="text-center py-8">
                    <Key className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No lower grade classes found.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead>Password Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lowerClassPasswords.map((cls) => (
                        <TableRow key={cls.id}>
                          <TableCell className="font-medium">{cls.name}</TableCell>
                          <TableCell>
                            {cls.hasPassword ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                <Lock className="w-3 h-3 mr-1" />
                                Password Set
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-600">
                                <Unlock className="w-3 h-3 mr-1" />
                                Not Set
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {cls.hasPassword && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setClassToReset({ id: cls.id, name: cls.name });
                                  setIsResetConfirmOpen(true);
                                }}
                                disabled={passwordResetLoading === cls.id}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 bg-transparent"
                              >
                                {passwordResetLoading === cls.id ? (
                                  "Resetting..."
                                ) : (
                                  <>
                                    <RotateCcw className="w-4 h-4 mr-1" />
                                    Reset Password
                                  </>
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Reset Confirmation Dialog */}
          {isResetConfirmOpen && classToReset && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <Card className="w-full max-w-md mx-4">
                <CardHeader>
                  <CardTitle className="text-red-600">Confirm Password Reset</CardTitle>
                  <CardDescription>
                    Are you sure you want to reset the password for <strong>{classToReset.name}</strong>?
                    The teacher will need to set a new password on their next login.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsResetConfirmOpen(false);
                      setClassToReset(null);
                    }}
                    className="bg-transparent"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleResetPassword}
                    disabled={!!passwordResetLoading}
                  >
                    {passwordResetLoading ? "Resetting..." : "Reset Password"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>
                Complete history of all actions in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No audit logs yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Performed By</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => {
                        const { label, variant } = getActionLabel(log.action);
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant={variant}>{label}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {log.performed_by || "-"}
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                              {log.details ? JSON.stringify(log.details) : "-"}
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
        </TabsContent>
      </Tabs>

      {/* Set Deadline Dialog */}
      <Dialog open={isDeadlineDialogOpen} onOpenChange={setIsDeadlineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Deadline</DialogTitle>
            <DialogDescription>
              {selectedSession && (
                <>Set submission deadline for {selectedSession.classes?.name} - {selectedSession.exam_types?.name} ({selectedSession.term} {selectedSession.year})</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={deadlineForm.date}
                  onChange={(e) => setDeadlineForm({ ...deadlineForm, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={deadlineForm.time}
                  onChange={(e) => setDeadlineForm({ ...deadlineForm, time: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeadlineDialogOpen(false)} disabled={deadlineLoading}>
              Cancel
            </Button>
            <Button onClick={handleSetDeadline} disabled={!deadlineForm.date || deadlineLoading}>
              {deadlineLoading ? "Setting..." : "Set Deadline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock Confirmation Dialog */}
      <Dialog open={isUnlockConfirmDialogOpen} onOpenChange={setIsUnlockConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              Deadline Has Passed
            </DialogTitle>
            <DialogDescription>
              {selectedSession && (
                <>
                  The deadline for {selectedSession.classes?.name} - {selectedSession.exam_types?.name} has passed. 
                  Are you sure you want to unlock this exam for data entry?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUnlockConfirmDialogOpen(false)} disabled={toggleLoading !== null}>
              Cancel
            </Button>
            <Button onClick={handleConfirmUnlock} disabled={toggleLoading !== null} className="bg-blue-600">
              {toggleLoading ? "Unlocking..." : "Yes, Unlock Exam"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock Confirmation Dialog */}
      <Dialog open={isUnlockConfirmDialogOpen} onOpenChange={setIsUnlockConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              Deadline Has Passed
            </DialogTitle>
            <DialogDescription>
              {selectedSession && (
                <>
                  The deadline for {selectedSession.classes?.name} - {selectedSession.exam_types?.name} has passed. 
                  Are you sure you want to unlock this exam for data entry?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUnlockConfirmDialogOpen(false)} disabled={toggleLoading !== null}>
              Cancel
            </Button>
            <Button onClick={handleConfirmUnlock} disabled={toggleLoading !== null} className="bg-blue-600">
              {toggleLoading ? "Unlocking..." : "Yes, Unlock Exam"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
