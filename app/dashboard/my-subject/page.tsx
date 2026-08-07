"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useClass } from "@/lib/class-context";
import { useSchool } from "@/lib/school-context";
import { getStoredTeacherId, getTeacherSubjectsInClass } from "@/lib/teacher-permissions";
import { getSubjectLevelPoints } from "@/lib/grading-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { BookOpen, TrendingUp, TrendingDown, Users } from "lucide-react";

interface SubjectRow {
  id: string;
  name: string;
}

interface SessionRow {
  id: string;
  term: string;
  year: number;
  exam_type_id: string | null;
  exam_types: { name: string } | null;
}

interface LearnerRow {
  id: string;
  name: string;
}

export default function MySubjectPage() {
  const { currentClass } = useClass();
  const { currentSchool } = useSchool();

  const [availableSubjects, setAvailableSubjects] = useState<SubjectRow[]>([]);
  const [restrictedToOwn, setRestrictedToOwn] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");

  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  // Figure out which subjects this teacher may pick from: their own assigned
  // subject(s) in this class if PIN management restricts them, otherwise every
  // subject in the class (class teachers, non-PIN schools, admins).
  useEffect(() => {
    if (!currentClass || !currentSchool) return;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      const supabase = createClient();

      const [{ data: allSubjects }, { data: schoolRow }, sessionsRes] = await Promise.all([
        supabase.from("subjects").select("id, name").eq("class_id", currentClass.id).order("name"),
        supabase.from("schools").select("feature_pin_management").eq("id", currentSchool.id).single(),
        supabase
          .from("sessions")
          .select("id, term, year, exam_type_id, exam_types(name)")
          .eq("class_id", currentClass.id)
          .not("exam_type_id", "is", null)
          .order("year", { ascending: false })
          .order("term"),
      ]);

      if (cancelled) return;

      const teacherId = getStoredTeacherId();
      const pinManagementEnabled = schoolRow?.feature_pin_management === true;

      let subjectsToShow = allSubjects || [];
      let restricted = false;

      if (pinManagementEnabled && teacherId) {
        // null means this teacher has a whole-class assignment (teaches every subject)
        const ownSubjectIds = await getTeacherSubjectsInClass(teacherId, currentSchool.id, currentClass.id);
        if (ownSubjectIds !== null && ownSubjectIds.length > 0) {
          subjectsToShow = (allSubjects || []).filter((s: SubjectRow) => ownSubjectIds.includes(s.id));
          restricted = true;
        }
      }

      setAvailableSubjects(subjectsToShow);
      setRestrictedToOwn(restricted);
      setSelectedSubjectId((prev) => prev || subjectsToShow[0]?.id || "");

      const sess = (sessionsRes.data || []) as unknown as SessionRow[];
      setSessions(sess);
      setSelectedSessionId((prev) => prev || sess[0]?.id || "");

      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentClass?.id, currentSchool?.id]);

  // Load the class roster and this subject's marks for the selected session.
  useEffect(() => {
    if (!currentClass || !selectedSessionId || !selectedSubjectId) {
      setLearners([]);
      setScores({});
      return;
    }
    let cancelled = false;

    (async () => {
      setIsLoadingResults(true);
      const supabase = createClient();
      const [{ data: learnersData }, { data: marksData }] = await Promise.all([
        supabase.from("learners").select("id, name").eq("class_id", currentClass.id).order("name"),
        supabase.from("marks").select("learner_id, score").eq("session_id", selectedSessionId).eq("subject_id", selectedSubjectId),
      ]);
      if (cancelled) return;

      const map: Record<string, number | null> = {};
      (marksData || []).forEach((m: { learner_id: string; score: number | null }) => {
        map[m.learner_id] = m.score;
      });

      setLearners(learnersData || []);
      setScores(map);
      setIsLoadingResults(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentClass?.id, selectedSessionId, selectedSubjectId]);

  const isLowerGradePointsEntry = useMemo(() => {
    const isKimwangarc = currentSchool?.code?.toLowerCase() === "kimwangarc";
    const lowerGradePatterns = /^(PP1|PP2|Grade\s*1|Grade\s*2|Grade\s*3|Grade\s*4|Grade\s*5|Grade\s*6)$/i;
    return isKimwangarc && lowerGradePatterns.test(currentClass?.name || "");
  }, [currentSchool?.code, currentClass?.name]);

  const results = useMemo(() => {
    return learners
      .map((learner) => {
        const score = scores[learner.id] ?? null;
        const level = getSubjectLevelPoints(score, currentClass?.name, currentSchool?.name);
        return { learner, score, level };
      })
      .filter((r) => r.score !== null)
      .sort((a, b) => (b.score as number) - (a.score as number))
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [learners, scores, currentClass?.name, currentSchool?.name]);

  const stats = useMemo(() => {
    const numericScores = results.map((r) => r.score as number);
    const count = numericScores.length;
    const mean = count > 0 ? numericScores.reduce((a, b) => a + b, 0) / count : 0;
    const highest = count > 0 ? Math.max(...numericScores) : 0;
    const lowest = count > 0 ? Math.min(...numericScores) : 0;
    const passThreshold = isLowerGradePointsEntry ? 3 : 50;
    const passRate = count > 0 ? (numericScores.filter((s) => s >= passThreshold).length / count) * 100 : 0;
    return { count, mean, highest, lowest, passRate };
  }, [results, isLowerGradePointsEntry]);

  const topFive = results.slice(0, 5);
  const bottomFive = results.slice(-5);

  const selectedSubject = availableSubjects.find((s) => s.id === selectedSubjectId);
  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="w-6 h-6" />
          My Subject Marklist
        </h1>
        <p className="text-muted-foreground">
          {restrictedToOwn ? "Marklist and analysis for the subject(s) you teach in " : "Marklist and analysis for "}
          {currentClass?.name}
        </p>
      </div>

      {availableSubjects.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No subjects are assigned to you in this class yet. Contact your school administrator.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Select Subject and Exam</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSubjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an exam session" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          {session.exam_types?.name} - {session.term} {session.year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {!selectedSubjectId || !selectedSessionId ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Select a subject and exam session to view the marklist.
              </CardContent>
            </Card>
          ) : isLoadingResults ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : results.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No marks entered yet for {selectedSubject?.name} in {selectedSession?.exam_types?.name} - {selectedSession?.term} {selectedSession?.year}.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Stat tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-muted p-3 rounded-lg border text-center">
                  <p className="text-xs text-muted-foreground">Entered</p>
                  <p className="text-2xl font-bold">{stats.count}</p>
                </div>
                <div className="bg-green-500/10 p-3 rounded-lg border border-green-200 text-center">
                  <p className="text-xs text-muted-foreground">Mean</p>
                  <p className="text-2xl font-bold text-green-600">{stats.mean.toFixed(1)}</p>
                </div>
                <div className="bg-purple-500/10 p-3 rounded-lg border border-purple-200 text-center">
                  <p className="text-xs text-muted-foreground">Highest</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.highest}</p>
                </div>
                <div className="bg-red-500/10 p-3 rounded-lg border border-red-200 text-center">
                  <p className="text-xs text-muted-foreground">Lowest</p>
                  <p className="text-2xl font-bold text-red-600">{stats.lowest}</p>
                </div>
                <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-200 text-center">
                  <p className="text-xs text-muted-foreground">Pass Rate</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.passRate.toFixed(0)}%</p>
                </div>
              </div>

              {/* Top / Bottom 5 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium flex items-center gap-2 text-green-700">
                      <TrendingUp className="w-4 h-4" /> Top 5 in {selectedSubject?.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rank</TableHead>
                          <TableHead>Learner</TableHead>
                          <TableHead className="text-center">Score</TableHead>
                          <TableHead className="text-center">Level</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topFive.map((r) => (
                          <TableRow key={r.learner.id}>
                            <TableCell>{r.rank}</TableCell>
                            <TableCell className="font-medium">{r.learner.name}</TableCell>
                            <TableCell className="text-center font-semibold">{r.score}</TableCell>
                            <TableCell className="text-center">{r.level?.level || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium flex items-center gap-2 text-red-700">
                      <TrendingDown className="w-4 h-4" /> Bottom 5 in {selectedSubject?.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rank</TableHead>
                          <TableHead>Learner</TableHead>
                          <TableHead className="text-center">Score</TableHead>
                          <TableHead className="text-center">Level</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bottomFive.map((r) => (
                          <TableRow key={r.learner.id}>
                            <TableCell>{r.rank}</TableCell>
                            <TableCell className="font-medium">{r.learner.name}</TableCell>
                            <TableCell className="text-center font-semibold">{r.score}</TableCell>
                            <TableCell className="text-center">{r.level?.level || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              {/* Full marklist for this subject */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Users className="w-4 h-4" /> Full Marklist - {selectedSubject?.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rank</TableHead>
                          <TableHead>Learner</TableHead>
                          <TableHead className="text-center">Score</TableHead>
                          <TableHead className="text-center">Level</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((r) => (
                          <TableRow key={r.learner.id}>
                            <TableCell>{r.rank}</TableCell>
                            <TableCell className="font-medium">{r.learner.name}</TableCell>
                            <TableCell className="text-center">{r.score}</TableCell>
                            <TableCell className="text-center">{r.level?.level || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
