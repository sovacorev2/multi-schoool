'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getGradeLevelByClass, isBandedPositionSchool, getPositionFromLevel, getPositionCount } from '@/lib/grading-utils'
import { getSubjectDisplay } from '@/lib/subject-utils'
import { fetchAllRows } from '@/lib/fetch-all-rows'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FileText, Printer, Loader2 } from 'lucide-react'
import type { School } from '@/lib/school-context'
import type { Session, Subject, Learner } from '@/lib/types'

interface ExamTypeOption {
  id: string
  name: string
  sessionId: string
  term: string
  year: number
}

interface LearnerReportData {
  learner: Learner
  subjectMarks: {
    subjectId: string
    subjectName: string
    marksByExam: Record<string, number | null> // sessionId -> score
    average: number | null
  }[]
  overallAverage: number | null
  totalPoints: number | null
  classRank: number          // overall rank within the class
  totalInClass: number
  crossStreamRank: number    // overall rank across all streams of the same level
  totalInLevel: number       // total learners in all streams of the same level
  examRanks: Record<string, number | null>  // sessionId -> rank in that exam
  strengthSubjects: string[]
  prioritySubjects: string[]
  autoComment: string
}

interface GeneralReportProps {
  currentClass: { id: string; name: string; teacher_name?: string | null } | null
  currentSchool: School | null
  subjects: Subject[]
  learners: Learner[]
  sessions: Array<Session & { exam_types?: { id: string; name: string } | null }>
  selectedYear: string
  selectedTerm: string
}

// --- Auto-comment generator ---
function generateAutoComment(
  learnerName: string,
  overallAverage: number | null,
  strengthSubjects: string[],
  prioritySubjects: string[],
  className: string,
  schoolName: string
): string {
  if (overallAverage === null) return `${learnerName} is yet to complete the assessments for this term. We encourage continued effort and participation in class activities.`

  const firstName = learnerName.split(' ')[0]

  if (overallAverage >= 75) {
    const strengths = strengthSubjects.length > 0
      ? `showing exceptional ability in ${strengthSubjects.slice(0, 2).join(' and ')}`
      : 'demonstrating strong performance across all learning areas'
    const improvement = prioritySubjects.length > 0
      ? ` ${firstName} should continue giving attention to ${prioritySubjects[0]} to achieve even greater results.`
      : ' Keep up the outstanding work and continue to challenge yourself.'
    return `${firstName} is an exceptional learner who has performed outstandingly this term, ${strengths}. ${firstName} consistently demonstrates dedication and enthusiasm in class.${improvement} Well done, ${firstName}!`
  }

  if (overallAverage >= 58) {
    const strengths = strengthSubjects.length > 0
      ? ` ${firstName} has shown particular strength in ${strengthSubjects.slice(0, 2).join(' and ')}.`
      : ''
    const improvement = prioritySubjects.length > 0
      ? ` ${firstName} should dedicate more time and effort to ${prioritySubjects.slice(0, 2).join(' and ')} to improve further.`
      : ' We encourage continued hard work and active participation in all learning areas.'
    return `${firstName} has performed well this term and is meeting expectations.${strengths}${improvement} Keep up the good work, ${firstName}!`
  }

  if (overallAverage >= 41) {
    const improvement = prioritySubjects.length > 0
      ? `${prioritySubjects.slice(0, 2).join(' and ')}`
      : 'all learning areas'
    const strengths = strengthSubjects.length > 0
      ? ` There is notable effort in ${strengthSubjects[0]}.`
      : ''
    return `${firstName} is making reasonable progress this term.${strengths} ${firstName} needs to work harder in ${improvement} to meet the expected standards. We encourage ${firstName} to seek help from the teacher and to practice regularly at home.`
  }

  if (overallAverage >= 21) {
    const improvement = prioritySubjects.length > 0
      ? `especially ${prioritySubjects.slice(0, 3).join(', ')}`
      : 'most learning areas'
    return `${firstName} is experiencing challenges this term and needs to improve performance in ${improvement}. We strongly encourage regular practice, more attentiveness in class, and parental support at home. With greater commitment, ${firstName} can do much better.`
  }

  return `${firstName} needs significant support this term. Performance is below expectations across most learning areas. We urge parents and guardians to provide close support and encourage ${firstName} to practice consistently. Please consult the class teacher for additional guidance.`
}

// --- Main Component ---
export function GeneralReport({
  currentClass,
  currentSchool,
  subjects,
  learners,
  sessions,
  selectedYear,
  selectedTerm,
}: GeneralReportProps) {
  // Detect Kimwanga lower grades (level-only entry mode)
  const isKimwangarc = currentSchool?.code?.toLowerCase() === 'kimwangarc'
  const lowerGradePatterns = /^(PP1|PP2|Grade\s*1|Grade\s*2|Grade\s*3|Grade\s*4|Grade\s*5|Grade\s*6)$/i
  const isLowerGradePointsEntry = isKimwangarc && lowerGradePatterns.test(currentClass?.name || '')
  const supabase = createClient()

  // All sessions for this year+term - each becomes a selectable "exam column"
  const availableExamSessions = sessions.filter(s =>
    s.year.toString() === selectedYear &&
    (!selectedTerm || s.term === selectedTerm)
  )

  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [customTeacherName, setCustomTeacherName] = useState('')
  const [termDisplay, setTermDisplay] = useState('')
  const [showDateDialog, setShowDateDialog] = useState(false)
  const [dateClosed, setDateClosed] = useState('')
  const [nextTermBegins, setNextTermBegins] = useState('')

  // Auto-select all available sessions when they change
  useEffect(() => {
    if (availableExamSessions.length > 0) {
      setSelectedSessionIds(availableExamSessions.map(s => s.id))
      const term = availableExamSessions[0]?.term || ''
      const year = availableExamSessions[0]?.year?.toString() || ''
      setTermDisplay(`${term} ${year}`)
    }
  }, [availableExamSessions.length, selectedYear, selectedTerm])

  function toggleSession(sessionId: string) {
    setSelectedSessionIds(prev => {
      if (prev.includes(sessionId)) {
        return prev.filter(id => id !== sessionId)
      }
      // Only allow max 3 exams
      if (prev.length >= 3) return prev
      return [...prev, sessionId]
    })
  }

  // Derive selected sessions preserving user's selection order (not database order)
  const chosenSessions = selectedSessionIds
    .map(id => availableExamSessions.find(s => s.id === id))
    .filter((s): s is typeof availableExamSessions[0] => s !== undefined)

  function handlePrintAll() {
    if (!currentClass || !currentSchool || !subjects || subjects.length === 0 || chosenSessions.length === 0 || learners.length === 0) return

    // Enforce max 3 exams constraint
    if (chosenSessions.length > 3) {
      alert('⚠️ Maximum 3 exam types allowed. Please select only 3 or fewer exams.')
      return
    }

    // Ask for the term-close/next-term dates before generating so the report
    // doesn't ship with blank "___/___/____" placeholders.
    setShowDateDialog(true)
  }

  async function generateReport() {
    setShowDateDialog(false)
    setIsGenerating(true)

    try {
      // Fetch all learners from sibling classes (same level, different streams) for cross-stream ranking
      // Extract base grade level by removing stream suffixes (colors, directions, or letters)
      const gradeLevel = currentClass.name
        .replace(/\s*(?:RED|GREEN|BLUE|YELLOW|ACHIEVERS|EXCELLERS|EAST|WEST|CENTRAL|NORTH|SOUTH|A|B)?\s*$/i, '')
        .trim()
      const { data: siblingClasses } = await supabase
        .from('classes')
        .select('id')
        .eq('school_id', currentSchool.id)
        .ilike('name', `${gradeLevel}%`)
      const siblingClassIds = siblingClasses?.map(c => c.id) ?? []

      // Fetch all marks for chosen sessions across sibling classes
      const allMarks: Array<{ learner_id: string; subject_id: string; score: number; session_id: string }> = []
      for (const session of chosenSessions) {
        const { data } = await supabase
          .from('marks')
          .select('learner_id, subject_id, score')
          .eq('session_id', session.id)
        if (data) {
          allMarks.push(...data.map(m => ({ ...m, session_id: session.id })))
        }
      }

      // Fetch all learners in sibling classes for cross-stream ranking
      let allLearnersInLevel: any[] = []
      if (siblingClassIds.length > 0) {
        const { data: levelLearners } = await supabase
          .from('learners')
          .select('id, class_id')
          .in('class_id', siblingClassIds)
        allLearnersInLevel = levelLearners ?? []
      }

      // Build per-learner data
      const learnersData: LearnerReportData[] = learners.map(learner => {
        const subjectMarks = subjects.map(subject => {
          const marksByExam: Record<string, number | null> = {}
          for (const session of chosenSessions) {
            const mark = allMarks.find(
              m => m.learner_id === learner.id && m.subject_id === subject.id && m.session_id === session.id
            )
            marksByExam[session.id] = mark ? mark.score : null
          }
          const scores = Object.values(marksByExam).filter((v): v is number => v !== null)
          let average: number | null = null
          if (scores.length > 0) {
            const scoreSum = scores.reduce((a, b) => a + b, 0)
            if (isLowerGradePointsEntry) {
              // Level-only mode: scores are 1-4, convert to percentage
              average = (scoreSum / (scores.length * 4)) * 100
            } else {
              // Normal mode: scores are 0-100
              average = scoreSum / scores.length
            }
          }
          return {
            subjectId: subject.id,
            subjectName: getSubjectDisplay(subject.name),
            marksByExam,
            average,
          }
        })

        // Overall average as percentage
        const allScores = subjectMarks.flatMap(sm =>
          Object.values(sm.marksByExam).filter((v): v is number => v !== null)
        )
        const totalSubjectsWithMarks = subjectMarks.filter(sm =>
          Object.values(sm.marksByExam).some(v => v !== null)
        ).length
        const overallTotal = allScores.reduce((a, b) => a + b, 0)
        let overallAverage: number | null = null
        if (totalSubjectsWithMarks > 0) {
          if (isLowerGradePointsEntry) {
            // Level-only mode: total is sum of 1-4 levels, max is 4 per subject
            const maxPossibleLevels = allScores.length * 4
            overallAverage = (overallTotal / maxPossibleLevels) * 100
          } else {
            // Normal mode: average of all marks
            overallAverage = overallTotal / allScores.length
          }
        }

        // Total points from average
        const avgGrade = overallAverage !== null
          ? getGradeLevelByClass(Math.round(overallAverage), currentClass.name, currentSchool?.name)
          : null
        const totalPoints = avgGrade?.points ?? null

        // Strength subjects (top performers: EE range or >= 75%)
        const strengthSubjects = subjectMarks
          .filter(sm => sm.average !== null && sm.average >= 58)
          .sort((a, b) => (b.average ?? 0) - (a.average ?? 0))
          .slice(0, 4)
          .map(sm => sm.subjectName)

        // Priority subjects (below average: AE/BE range or < 41%)
        const prioritySubjects = subjectMarks
          .filter(sm => sm.average !== null && sm.average < 41)
          .sort((a, b) => (a.average ?? 0) - (b.average ?? 0))
          .slice(0, 3)
          .map(sm => sm.subjectName)

        const autoComment = generateAutoComment(
          learner.name,
          overallAverage,
          strengthSubjects,
          prioritySubjects,
          currentClass.name,
          currentSchool?.name || ''
        )

        return {
          learner,
          subjectMarks,
          overallAverage,
          overallTotal,
          totalPoints,
          strengthSubjects,
          prioritySubjects,
          autoComment,
          classRank: 0,
          totalInClass: 0,   // set after ranking pass below
          crossStreamRank: 0,
          totalInLevel: 0,   // set after cross-stream pass below
          examRanks: {},
        }
      })

      // Calculate overall class rank based on total raw marks; use average as tiebreaker.
      // Only rank learners who have at least one mark (overallAverage !== null).
      const ranked = [...learnersData]
        .filter(l => l.overallAverage !== null)
        .sort((a, b) =>
          (b.overallTotal ?? 0) - (a.overallTotal ?? 0) ||
          (b.overallAverage ?? 0) - (a.overallAverage ?? 0)
        )
      ranked.forEach((l, idx) => { l.classRank = idx + 1 })

      // totalInClass = learners who have marks (same denominator as classRank)
      const totalWithMarksInClass = ranked.length
      learnersData.forEach(ld => { ld.totalInClass = totalWithMarksInClass })

      // St Belvia: position comes from each learner's overall CBC level, not
      // raw total marks - every learner in the same level shares the same
      // position, and "out of" becomes the number of levels in the scale
      // (8 for JSS, 4 elsewhere) instead of the class size. Every other
      // school's rank set just above is left untouched.
      if (isBandedPositionSchool(currentSchool?.name)) {
        const positionCount = getPositionCount(currentClass?.name)
        learnersData.forEach(ld => {
          const level = ld.overallAverage !== null
            ? getGradeLevelByClass(ld.overallAverage, currentClass?.name, currentSchool?.name)?.level
            : null
          const banded = getPositionFromLevel(level)
          if (banded !== null) {
            ld.classRank = banded
            ld.totalInClass = positionCount
          }
        })
      }

      // Cross-stream ranking: fetch marks for sibling classes using their own session IDs.
      // allMarks only contains sessions for the current class, so sibling learners
      // need a separate query keyed on their sessions (same exam_type/term/year).
      let crossStreamDone = false
      if (allLearnersInLevel.length > learners.length && chosenSessions.length > 0) {
        try {
          // Collect sibling class IDs (exclude current class)
          const siblingOnlyIds = allLearnersInLevel
            .map((l: any) => l.class_id)
            .filter((id: string) => id !== currentClass.id)
          const uniqueSiblingIds = [...new Set(siblingOnlyIds)] as string[]

          if (uniqueSiblingIds.length > 0) {
            // Use same exam_type/term/year as chosen sessions but for sibling classes
            const siblingMarksAll: Array<{ learner_id: string; score: number }> = []
            for (const chosenSession of chosenSessions) {
              // Find sibling sessions with same exam type, term, year
              const { data: sibSessions } = await supabase
                .from('sessions')
                .select('id')
                .in('class_id', uniqueSiblingIds)
                .eq('exam_type_id', chosenSession.exam_types?.id ?? chosenSession.exam_type_id ?? '')
                .eq('term', chosenSession.term)
                .eq('year', chosenSession.year)
              const sibSessionIds = (sibSessions ?? []).map((s: any) => s.id)
              if (sibSessionIds.length > 0) {
                // Paginated - marks across several sibling streams can exceed
                // Supabase's 1000-row default page cap.
                const sibMarks = await fetchAllRows<{ learner_id: string; score: number | null }>((from, to) =>
                  supabase.from('marks').select('learner_id, score').in('session_id', sibSessionIds).order('id').range(from, to)
                )
                siblingMarksAll.push(...sibMarks)
              }
            }

            // Build totals for sibling learners
            const siblingTotals: Record<string, number> = {}
            for (const m of siblingMarksAll) {
              if (m.learner_id && m.score != null) {
                siblingTotals[m.learner_id] = (siblingTotals[m.learner_id] ?? 0) + Number(m.score)
              }
            }

            // Build totals for current class learners using same overallTotal
            const levelEntries: Array<{ learnerId: string; total: number }> = [
              // Current class - use the already-computed overallTotal (consistent with classRank)
              ...learnersData
                .filter(ld => ld.overallTotal !== null && ld.overallTotal > 0)
                .map(ld => ({ learnerId: ld.learner.id, total: ld.overallTotal ?? 0 })),
              // Sibling classes
              ...Object.entries(siblingTotals).map(([id, total]) => ({ learnerId: id, total })),
            ]

            const crossStreamRanked = levelEntries.sort((a, b) => b.total - a.total)
            const totalWithMarksInLevel = crossStreamRanked.length

            learnersData.forEach(ld => {
              const idx = crossStreamRanked.findIndex(e => e.learnerId === ld.learner.id)
              ld.crossStreamRank = idx >= 0 ? idx + 1 : ld.classRank
              ld.totalInLevel = totalWithMarksInLevel
            })
            crossStreamDone = true
          }
        } catch {
          // fall through to same-as-class fallback
        }
      }

      if (!crossStreamDone) {
        // Single stream, no siblings, or fetch failed - overall equals class rank
        learnersData.forEach(ld => {
          ld.crossStreamRank = ld.classRank
          ld.totalInLevel = totalWithMarksInClass
        })
      }

      // St Belvia: same banded logic for the cross-stream ("Overall Position")
      // rank as for classRank above - every learner in the same CBC level
      // shares the same position across the whole grade level.
      if (isBandedPositionSchool(currentSchool?.name)) {
        const positionCount = getPositionCount(currentClass?.name)
        learnersData.forEach(ld => {
          const level = ld.overallAverage !== null
            ? getGradeLevelByClass(ld.overallAverage, currentClass?.name, currentSchool?.name)?.level
            : null
          const banded = getPositionFromLevel(level)
          if (banded !== null) {
            ld.crossStreamRank = banded
            ld.totalInLevel = positionCount
          }
        })
      }

      // Calculate per-exam ranks: for each session, rank learners by their
      // average score across all subjects in that session
      for (const session of chosenSessions) {
        // Build list of { learnerId, sessionAvg }
        const sessionAvgs = learnersData.map(ld => {
          const scores = ld.subjectMarks
            .map(sm => sm.marksByExam[session.id])
            .filter((v): v is number => v !== null)
          const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
          return { ld, avg }
        })
        // Sort descending to assign ranks
        const withScores = sessionAvgs.filter(x => x.avg !== null)
          .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
        withScores.forEach((x, idx) => {
          x.ld.examRanks[session.id] = idx + 1
        })
        // Learners with no marks in this session get null rank
        sessionAvgs.filter(x => x.avg === null).forEach(x => {
          x.ld.examRanks[session.id] = null
        })
      }

      // Generate HTML for all learners
      const html = generateReportHTML(
        learnersData,
        currentClass,
        currentSchool,
        chosenSessions,
        customTeacherName || currentClass.teacher_name || '',
        termDisplay,
        subjects.length,
        dateClosed,
        nextTermBegins
      )

      const win = window.open('', '_blank')
      if (win) {
        win.document.write(html)
        win.document.close()
        setTimeout(() => win.print(), 800)
      }
    } catch (err) {
      console.error('[v0] General report error:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  if (availableExamSessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No exam sessions found for the selected year/term. Please select a year and term that has exam data.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-5 h-5" />
            General Report - Class Report Cards
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Prints individual report cards for all {learners.length} learners in {currentClass?.name}. Select which exam sessions to include in the Academic Performance Summary.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Exam session selector */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-semibold">Select Exam Sessions to Include in Academic Summary</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                The numbered badge shows the column order in the report. Uncheck and re-check in your preferred order to reorder - all sessions are selected by default in database order.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {availableExamSessions.map(session => {
                const orderIndex = selectedSessionIds.indexOf(session.id)
                return (
                  <label
                    key={session.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      orderIndex >= 0
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <Checkbox
                      checked={orderIndex >= 0}
                      onCheckedChange={() => toggleSession(session.id)}
                    />
                    <div className="flex flex-col flex-1">
                      <span className="text-sm font-medium">{session.exam_types?.name}</span>
                      <span className="text-xs text-muted-foreground">{session.term} {session.year}</span>
                    </div>
                    {orderIndex >= 0 && (
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex-shrink-0">
                        {orderIndex + 1}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
            {chosenSessions.length === 0 && (
              <p className="text-sm text-red-500">Please select at least one exam session.</p>
            )}
          </div>

          {/* Teacher name override */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Class Teacher Name (optional override)</Label>
            <input
              type="text"
              value={customTeacherName}
              onChange={e => setCustomTeacherName(e.target.value)}
              placeholder={currentClass?.teacher_name || 'Enter class teacher name...'}
              className="w-full max-w-sm border border-border rounded px-3 py-2 text-sm bg-background"
            />
          </div>

          {/* Print button */}
          <div className="flex items-center gap-4">
            <Button
              onClick={handlePrintAll}
              disabled={isGenerating || chosenSessions.length === 0 || learners.length === 0 || chosenSessions.length > 3}
              className="gap-2"
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><Printer className="w-4 h-4" /> Print All {learners.length} Report Cards</>
              )}
            </Button>
            <p className={`text-xs ${chosenSessions.length > 3 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
              {chosenSessions.length} exam{chosenSessions.length !== 1 ? 's' : ''} selected &bull; One page per learner
              {chosenSessions.length > 3 && ' ⚠️ Maximum 3 exams allowed'}
            </p>
          </div>

        </CardContent>
      </Card>

      {/* Term dates prompt - collected before generating so the report doesn't
          ship with blank "___/___/____" placeholders */}
      <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Term Dates</DialogTitle>
            <DialogDescription>
              These dates are printed on every report card. Leave blank to print them as ___/___/____ instead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="date-closed" className="text-sm font-semibold">Date Closed</Label>
              <Input
                id="date-closed"
                type="date"
                value={dateClosed}
                onChange={e => setDateClosed(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next-term-begins" className="text-sm font-semibold">Next Term Begins From</Label>
              <Input
                id="next-term-begins"
                type="date"
                value={nextTermBegins}
                onChange={e => setNextTermBegins(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDateDialog(false)}>Cancel</Button>
            <Button onClick={generateReport} className="gap-2">
              <Printer className="w-4 h-4" /> Generate {learners.length} Report Cards
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


// ---- HTML Report Generator ----
function generateReportHTML(
  learnersData: LearnerReportData[],
  currentClass: { id: string; name: string; teacher_name?: string | null },
  school: School | null,
  chosenSessions: Array<{ id: string; term: string; year: number; exam_types?: { id: string; name: string } | null }>,
  teacherName: string,
  termDisplay: string,
  subjectCount: number,
  dateClosed: string,
  nextTermBegins: string
): string {
  // Format a yyyy-mm-dd value (from <input type="date">) into a readable date;
  // falls back to the blank placeholder if the admin left it empty.
  function formatReportDate(value: string): string {
    if (!value) return '___/___/____'
    const d = new Date(`${value}T00:00:00`)
    if (Number.isNaN(d.getTime())) return '___/___/____'
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  // Extract stream from class name e.g. "Grade 7 RED" -> "RED"
  const classWords = currentClass.name.trim().split(/\s+/)
  const streamName = classWords.length > 2 ? classWords.slice(2).join(' ') : ''
  const gradeLabel = currentClass.name

  const examColumns = chosenSessions.map(s => s.exam_types?.name || s.term)

  const schoolName = school?.name || 'SCHOOL'
  const schoolTagline = school?.tagline || ''
  const schoolAddress = school?.address || ''
  const schoolEmail = school?.email || ''
  const schoolPhone = school?.phone || ''
  const logoUrl = school?.logo_url || ''

  // Max points for scale detection (use first learner's first subject to detect scale)
  function getRubricLabel(avg: number | null, className: string, schoolName: string): { level: string; points: number } | null {
    if (avg === null) return null
    return getGradeLevelByClass(Math.round(avg), className, schoolName)
  }

  function rubricBadgeColor(level: string): string {
    if (level.startsWith('EE')) return '#16a34a'
    if (level.startsWith('ME')) return '#2563eb'
    if (level.startsWith('AE')) return '#d97706'
    return '#dc2626'
  }

  // Derive overall label/color/points from the average mark (0-100).
  // We pass the pre-computed overallAverage directly so multi-session totals
  // (sum of all raw scores across sessions) don't overflow the 0-100 scale.
  const _overallClassName = currentClass?.name || ''
  const _overallSchoolName = school?.name || ''

  function overallRubricLabel(avg: number | null): string {
    if (avg === null) return 'N/A'
    const g = getGradeLevelByClass(avg, _overallClassName, _overallSchoolName)
    if (!g) return 'N/A'
    if (g.level.startsWith('EE')) return 'EXCEEDING EXPECTATION'
    if (g.level.startsWith('ME')) return 'MEETING EXPECTATION'
    if (g.level.startsWith('AE')) return 'APPROACHING EXPECTATION'
    return 'BELOW EXPECTATION'
  }

  function overallRubricColor(avg: number | null): string {
    if (avg === null) return '#6b7280'
    const g = getGradeLevelByClass(avg, _overallClassName, _overallSchoolName)
    if (!g) return '#6b7280'
    if (g.level.startsWith('EE')) return '#16a34a'
    if (g.level.startsWith('ME')) return '#2563eb'
    if (g.level.startsWith('AE')) return '#d97706'
    return '#dc2626'
  }

  function calcOverallPoints(avg: number | null): string {
    if (avg === null) return '-'
    const g = getGradeLevelByClass(avg, _overallClassName, _overallSchoolName)
    return g ? String(g.points) : '-'
  }

  // Trend SVG (simple polyline chart)
  function trendSVG(points: (number | null)[]): string {
    const valid = points.filter((p): p is number => p !== null)
    if (valid.length < 2) return '<div style="display:flex;align-items:center;justify-content:center;height:100px;color:#9ca3af;font-size:12px;">Not enough data</div>'

    const w = 220, h = 100, pad = 20
    const minV = Math.max(0, Math.min(...valid) - 5)
    const maxV = Math.min(100, Math.max(...valid) + 5)
    const xStep = (w - pad * 2) / (points.length - 1)

    const coords = points.map((p, i) => {
      if (p === null) return null
      const x = pad + i * xStep
      const y = h - pad - ((p - minV) / (maxV - minV || 1)) * (h - pad * 2)
      return { x, y, v: p }
    })

    const linePoints = coords.filter((c): c is { x: number; y: number; v: number } => c !== null)
    const polyline = linePoints.map(c => `${c.x},${c.y}`).join(' ')

    const labels = points.map((p, i) => {
      const x = pad + i * xStep
      return `<text x="${x}" y="${h - 4}" text-anchor="middle" style="font-size:9px;fill:#6b7280">${examColumns[i] || `E${i + 1}`}</text>`
    }).join('')

    const dots = linePoints.map(c =>
      `<circle cx="${c.x}" cy="${c.y}" r="3" fill="#2563eb"/><text x="${c.x}" y="${c.y - 5}" text-anchor="middle" style="font-size:8px;fill:#1d4ed8">${c.v.toFixed(1)}</text>`
    ).join('')

    return `<svg width="${w}" height="${h}" style="overflow:visible">
      <polyline points="${polyline}" fill="none" stroke="#2563eb" stroke-width="2"/>
      ${dots}
      ${labels}
    </svg>`
  }

  // Class-wide gender breakdown (average + count of learners with marks, per
  // gender) - computed once here and shown as context on every learner's
  // page, same pattern as the school-wide "GENDER ANALYSIS" section in the
  // separate School Performance Analysis report, just scoped to this class.
  const boysWithMarks = learnersData.filter(ld => ld.learner.gender === 'Male' && ld.overallAverage !== null)
  const girlsWithMarks = learnersData.filter(ld => ld.learner.gender === 'Female' && ld.overallAverage !== null)
  const boysAvg = boysWithMarks.length > 0 ? boysWithMarks.reduce((a, ld) => a + (ld.overallAverage ?? 0), 0) / boysWithMarks.length : null
  const girlsAvg = girlsWithMarks.length > 0 ? girlsWithMarks.reduce((a, ld) => a + (ld.overallAverage ?? 0), 0) / girlsWithMarks.length : null

  // Build individual pages
  const pages = learnersData.map(ld => {
    const { learner, subjectMarks, overallAverage, overallTotal, classRank, totalInClass, crossStreamRank, totalInLevel, examRanks, strengthSubjects, prioritySubjects, autoComment } = ld
    const overallPoints = calcOverallPoints(overallAverage)
    

    
    const trendPoints = chosenSessions.map(s => {
      const sessionScores = subjectMarks.flatMap(sm => {
        const v = sm.marksByExam[s.id]
        return v !== null && v !== undefined ? [v] : []
      })
      return sessionScores.length > 0 ? sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length : null
    })
    
    // Sum of per-subject averages (the AVG column values) and their rubric points
    // e.g. if subjects have averages 72, 84, 41... the total is 72+84+41+...
    let sumAllExamAverages = 0
    let sumAllExamPoints = 0
    subjectMarks.forEach(sm => {
      if (sm.average !== null && sm.average !== undefined) {
        sumAllExamAverages += sm.average
        const gradeInfo = getRubricLabel(sm.average, currentClass.name, school?.name || '')
        if (gradeInfo?.points) {
          sumAllExamPoints += gradeInfo.points
        }
      }
    })
    
    const bestExamIdx = trendPoints.reduce((best, v, i) => (v !== null && (best === -1 || (trendPoints[best] ?? 0) < v)) ? i : best, -1)
    const bestExamName = bestExamIdx >= 0 ? (chosenSessions[bestExamIdx]?.exam_types?.name || `Exam ${bestExamIdx + 1}`) : '-'
    const bestExamScore = bestExamIdx >= 0 && trendPoints[bestExamIdx] !== null ? (trendPoints[bestExamIdx] as number).toFixed(1) : '-'

    // Subject rows - comfortable padding with points
    const subjectRows = subjectMarks.map(sm => {
      const avgGrade = getRubricLabel(sm.average, currentClass.name, school?.name || '')
      const subjectPoints = avgGrade ? avgGrade.points.toFixed(1) : '-'
      const examCells = chosenSessions.map(s => {
        const v = sm.marksByExam[s.id]
        return `<td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;font-size:11px;">${v !== null && v !== undefined ? v : '-'}</td>`
      }).join('')
      const badgeColor = avgGrade ? rubricBadgeColor(avgGrade.level) : '#6b7280'
      return `<tr>
        <td style="border:1px solid #d1d5db;padding:5px 7px;font-size:11px;">${sm.subjectName}</td>
        ${examCells}
        <td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;font-size:11px;font-weight:600;">${sm.average !== null ? sm.average.toFixed(1) : '-'}</td>
        <td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;font-size:11px;font-weight:600;color:#15803d;">${subjectPoints}</td>
        <td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;">
          ${avgGrade ? `<span style="background:${badgeColor};color:#fff;border-radius:3px;padding:2px 6px;font-size:10px;font-weight:700;">${avgGrade.level}</span>` : '-'}
        </td>
      </tr>`
    }).join('')

    // Overall grade - derived directly from overallAverage (0–100) so multi-session
    // totals (sum across all sessions) don't inflate past 100 and return null.
    const overallGrade = overallAverage !== null
      ? getGradeLevelByClass(overallAverage, _overallClassName, _overallSchoolName)
      : null
    const overallExamAvgs = chosenSessions.map(s => {
      const sessionScores = subjectMarks.flatMap(sm => {
        const v = sm.marksByExam[s.id]
        return v !== null && v !== undefined ? [v] : []
      })
      return sessionScores.length > 0 ? sessionScores.reduce((a, b) => a + b, 0).toFixed(0) : '-'
    })
    const overallExamCells = overallExamAvgs.map(v =>
      `<td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;font-size:11px;font-weight:700;">${v}</td>`
    ).join('')
    const overallBadgeColor = overallGrade ? rubricBadgeColor(overallGrade.level) : '#6b7280'

    // Average points row - average points across all subjects per exam
    const overallExamPoints = chosenSessions.map(s => {
      const sessionScores = subjectMarks.flatMap(sm => {
        const v = sm.marksByExam[s.id]
        return v !== null && v !== undefined ? [v] : []
      })
      if (sessionScores.length === 0) return '-'
      const avgMark = sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length
      const gradeInfo = getRubricLabel(avgMark, currentClass.name, school?.name || '')
      return gradeInfo ? gradeInfo.points.toFixed(1) : '-'
    })
    const overallExamPointsCells = overallExamPoints.map(v =>
      `<td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;font-size:11px;font-weight:700;color:#16a34a;">${v}</td>`
    ).join('')

    const examHeaderCells = examColumns.map(col =>
      `<th style="border:1px solid #d1d5db;padding:5px 7px;background:#1e3a5f;color:#fff;font-size:10px;text-align:center;">${col}</th>`
    ).join('')

    const strengthList = strengthSubjects.length > 0
      ? strengthSubjects.map(s => `<li style="margin-bottom:2px;">${s}</li>`).join('')
      : '<li style="color:#9ca3af;">No specific strength areas identified</li>'

    const priorityList = prioritySubjects.length > 0
      ? prioritySubjects.map(s => `<li style="margin-bottom:2px;">${s}</li>`).join('')
      : '<li style="color:#9ca3af;">No priority areas - keep it up!</li>'

    const logoHTML = logoUrl
      ? `<img src="${logoUrl}" alt="School Logo" style="width:56px;height:56px;object-fit:contain;" crossorigin="anonymous"/>`
      : `<div style="width:56px;height:56px;background:#1e3a5f;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:8px;font-weight:700;text-align:center;padding:3px;">${schoolName.split(' ').map((w: string) => w[0]).join('').slice(0, 4)}</div>`

    return `
    <div style="page-break-after:always;font-family:'Helvetica Neue',Arial,sans-serif;width:210mm;height:297mm;margin:0 auto;padding:8mm 10mm;color:#1f2937;background:#fff;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;">

      <!-- HEADER -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding-bottom:6px;border-bottom:2px solid #1e3a5f;flex-shrink:0;">
        <div style="flex:0 0 auto;">${logoHTML}</div>
        <div style="flex:1;text-align:center;padding:0 10px;">
          <h1 style="font-size:17px;font-weight:800;color:#1e3a5f;margin:0 0 1px 0;letter-spacing:0.5px;">${schoolName.toUpperCase()}</h1>
          ${schoolTagline ? `<p style="font-size:10px;color:#b45309;font-style:italic;font-weight:600;margin:0 0 2px 0;">${schoolTagline}</p>` : ''}
          <p style="font-size:8.5px;color:#4b5563;margin:0;">${[schoolAddress, schoolPhone, schoolEmail].filter(Boolean).join(' | ')}</p>
        </div>
        <div style="flex:0 0 auto;text-align:right;">
          <div style="font-size:10px;font-weight:700;color:#1e3a5f;">ShuleTech</div>
          <div style="font-size:8px;color:#6b7280;">Smart Schools, Better Results</div>
        </div>
      </div>

      <!-- TOP TWO-COLUMN SECTION - fixed height -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px;flex-shrink:0;">

        <!-- LEARNER DETAILS -->
        <div style="border:1.5px solid #1e3a5f;border-radius:5px;overflow:hidden;">
          <div style="background:#1e3a5f;color:#fff;font-size:10px;font-weight:700;padding:5px 10px;letter-spacing:0.5px;">LEARNER DETAILS</div>
          <div style="padding:8px 10px;display:grid;grid-template-columns:1fr 1fr;gap:5px;">
            <div>
              <div style="font-size:8.5px;color:#6b7280;font-weight:600;">Learner's Name:</div>
              <div style="font-size:11px;font-weight:600;">${learner.name}</div>
            </div>
            <div>
              <div style="font-size:8.5px;color:#6b7280;font-weight:600;">Class Teacher:</div>
              <div style="font-size:11px;font-weight:600;">${teacherName || '-'}</div>
            </div>
            <div>
              <div style="font-size:8.5px;color:#6b7280;font-weight:600;">Admission No.:</div>
              <div style="font-size:11px;">${learner.admission_number || '-'}</div>
            </div>
            <div>
              <div style="font-size:8.5px;color:#6b7280;font-weight:600;">Academic Year:</div>
              <div style="font-size:11px;">${chosenSessions[0]?.year || '-'}</div>
            </div>
            <div>
              <div style="font-size:8.5px;color:#6b7280;font-weight:600;">Grade:</div>
              <div style="font-size:11px;">${gradeLabel}</div>
            </div>
            <div>
              <div style="font-size:8.5px;color:#6b7280;font-weight:600;">Gender:</div>
              <div style="font-size:11px;">${learner.gender || '-'}</div>
            </div>
            ${streamName ? `<div><div style="font-size:8.5px;color:#6b7280;font-weight:600;">Stream:</div><div style="font-size:11px;">${streamName}</div></div>` : ''}
            <div>
              <div style="font-size:8.5px;color:#6b7280;font-weight:600;">Term:</div>
              <div style="font-size:11px;">${termDisplay}</div>
            </div>
          </div>
        </div>

        <!-- OVERALL ACHIEVEMENT -->
        <div style="border:1.5px solid #1e3a5f;border-radius:5px;overflow:hidden;">
          <div style="background:#1e3a5f;color:#fff;font-size:10px;font-weight:700;padding:5px 10px;letter-spacing:0.5px;">OVERALL ACHIEVEMENT</div>
          <div style="padding:8px 12px;text-align:center;">
            <div style="font-size:9.5px;color:#6b7280;margin-bottom:2px;">Overall Average (%)</div>
            <div style="font-size:36px;font-weight:800;color:#1e3a5f;line-height:1;">${overallAverage !== null ? overallAverage.toFixed(1) : '-'}</div>
            <div style="font-size:9px;color:#6b7280;margin-bottom:5px;">Overall Points: ${overallPoints}</div>
            <div style="margin-bottom:6px;">
              <span style="border:1.5px solid ${overallRubricColor(overallAverage)};color:${overallRubricColor(overallAverage)};border-radius:16px;padding:4px 12px;font-size:10px;font-weight:700;">${overallRubricLabel(overallAverage)}</span>
            </div>
            <div style="font-size:9.5px;color:#374151;">Overall Position: <strong>${totalInLevel > totalInClass && crossStreamRank > 0 ? `${crossStreamRank} out of ${totalInLevel}` : (classRank > 0 ? `${classRank} out of ${totalInClass}` : 'N/A')}</strong></div>
          </div>
        </div>
      </div>

      <!-- ACADEMIC PERFORMANCE SUMMARY + TREND - natural height so table (incl. position row) is never squeezed -->
      <div style="display:grid;grid-template-columns:1.8fr 1fr;gap:8px;margin-bottom:6px;flex-shrink:0;">

        <!-- ACADEMIC PERFORMANCE TABLE -->
        <div style="border:1.5px solid #1e3a5f;border-radius:5px;display:flex;flex-direction:column;overflow:visible;">
          <div style="background:#1e3a5f;color:#fff;font-size:10px;font-weight:700;padding:5px 10px;letter-spacing:0.5px;flex-shrink:0;border-radius:3px 3px 0 0;">ACADEMIC PERFORMANCE SUMMARY</div>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="border:1px solid #d1d5db;padding:5px 7px;background:#e5e7eb;color:#1f2937;font-size:10px;text-align:left;">LEARNING AREA</th>
                ${examHeaderCells}
                <th style="border:1px solid #d1d5db;padding:5px 7px;background:#e5e7eb;color:#1f2937;font-size:10px;text-align:center;">AVG</th>
                <th style="border:1px solid #d1d5db;padding:5px 7px;background:#e5e7eb;color:#1f2937;font-size:10px;text-align:center;">POINTS</th>
                <th style="border:1px solid #d1d5db;padding:5px 7px;background:#e5e7eb;color:#1f2937;font-size:10px;text-align:center;">RUBRIC</th>
              </tr>
            </thead>
            <tbody>
              ${subjectRows}
              <tr style="background:#fef9c3;">
                <td style="border:1px solid #d1d5db;padding:5px 7px;font-size:11px;font-weight:700;">OVERALL TOTAL</td>
                ${overallExamCells}
                <td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;font-size:11px;font-weight:700;">${overallAverage !== null ? overallAverage.toFixed(1) : '-'}</td>
                <td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;font-size:11px;font-weight:700;color:#15803d;">${overallPoints}</td>
                <td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;">
                  ${overallGrade ? `<span style="background:${overallBadgeColor};color:#fff;border-radius:3px;padding:2px 6px;font-size:10px;font-weight:700;">${overallGrade.level}</span>` : '-'}
                </td>
              </tr>
              <tr style="background:#dbeafe;">
                <td style="border:1.5px solid #93c5fd;padding:5px 7px;font-size:10px;font-weight:800;color:#1e40af;white-space:nowrap;">CLASS POSITION</td>
                ${chosenSessions.map(s => {
                  const rank = examRanks[s.id]
                  return `<td style="border:1.5px solid #93c5fd;padding:5px 7px;text-align:center;font-size:11px;font-weight:800;color:#1e40af;">${rank != null ? `${rank}<span style="font-size:9px;font-weight:600;color:#3b82f6"> /${totalInClass}</span>` : '-'}</td>`
                }).join('')}
                <td colspan="2" style="border:1.5px solid #93c5fd;padding:5px 7px;text-align:center;font-size:11px;font-weight:800;color:#1e40af;">${totalInLevel > totalInClass && crossStreamRank > 0 ? `${crossStreamRank}<span style="font-size:9px;font-weight:600;color:#3b82f6"> /${totalInLevel}</span>` : (classRank > 0 ? `${classRank}<span style="font-size:9px;font-weight:600;color:#3b82f6"> /${totalInClass}</span>` : '-')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- PERFORMANCE TREND + INFO BOXES -->
        <div style="border:1.5px solid #1e3a5f;border-radius:5px;overflow:hidden;display:flex;flex-direction:column;">
          <div style="background:#1e3a5f;color:#fff;font-size:10px;font-weight:700;padding:5px 10px;letter-spacing:0.5px;flex-shrink:0;">PERFORMANCE TREND</div>
          <div style="padding:8px;text-align:center;flex:1;display:flex;flex-direction:column;justify-content:space-between;">
            <div style="font-size:8.5px;color:#4b5563;font-weight:600;margin-bottom:4px;">Average Score (%)</div>
            ${trendSVG(trendPoints)}
            
            <!-- INFO BOXES (replacing BEST circle) -->
            <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">
              <!-- BEST EXAM -->
              <div style="border:1px solid #16a34a;border-radius:3px;background:#f0fdf4;padding:6px;text-align:center;">
                <div style="font-size:7px;color:#15803d;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;">BEST EXAM</div>
                <div style="font-size:11px;font-weight:800;color:#15803d;margin-top:2px;">${bestExamName}</div>
                <div style="font-size:10px;color:#15803d;font-weight:700;">${bestExamScore}%</div>
              </div>
              
              <!-- TOTAL MARKS AND POINTS - SUM OF ALL EXAM AVERAGES -->
              <div style="border:1px solid #2563eb;border-radius:3px;background:#eff6ff;padding:6px;text-align:center;">
                <div style="font-size:7px;color:#1e40af;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;">TOTAL MKS / PTS</div>
                <div style="font-size:11px;font-weight:800;color:#1e40af;margin-top:2px;">${sumAllExamAverages > 0 ? sumAllExamAverages.toFixed(1) : '0'} / ${sumAllExamPoints > 0 ? sumAllExamPoints.toFixed(1) : '0'}</div>
                <div style="font-size:8px;color:#3b82f6;font-weight:600;">Sum of all exams</div>
              </div>
              
              <!-- POSITION -->
              <div style="border:1px solid #dc2626;border-radius:3px;background:#fef2f2;padding:6px;text-align:center;">
                <div style="font-size:7px;color:#7f1d1d;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;">POSITION</div>
                <div style="font-size:11px;font-weight:800;color:#dc2626;margin-top:2px;">${totalInLevel > totalInClass && crossStreamRank > 0 ? `${crossStreamRank}/${totalInLevel}` : (classRank > 0 ? `${classRank}/${totalInClass}` : 'N/A')}</div>
                <div style="font-size:8px;color:#991b1b;font-weight:600;">${totalInLevel > totalInClass ? 'Level rank' : 'Class rank'}</div>
              </div>

              <!-- GENDER ANALYSIS - class average by gender, for context -->
              <div style="border:1px solid #7c3aed;border-radius:3px;background:#f5f3ff;padding:6px;text-align:center;">
                <div style="font-size:7px;color:#5b21b6;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;">GENDER ANALYSIS</div>
                <div style="font-size:10px;font-weight:800;color:#5b21b6;margin-top:2px;">B: ${boysAvg !== null ? boysAvg.toFixed(1) + '%' : '-'} (${boysWithMarks.length}) &middot; G: ${girlsAvg !== null ? girlsAvg.toFixed(1) + '%' : '-'} (${girlsWithMarks.length})</div>
                <div style="font-size:8px;color:#6d28d9;font-weight:600;">Class average by gender</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- STRENGTHS + PRIORITY AREAS - flex:0.8 reduced -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px;flex:0.8;min-height:0;">
        <div style="border:1.5px solid #16a34a;border-radius:5px;overflow:hidden;display:flex;flex-direction:column;">
          <div style="background:#16a34a;color:#fff;font-size:10px;font-weight:700;padding:5px 10px;letter-spacing:0.5px;flex-shrink:0;">STRENGTH AREAS</div>
          <div style="padding:6px 10px;flex:1;overflow:hidden;">
            <ul style="margin:0;padding-left:14px;font-size:10px;line-height:1.5;">
              ${strengthList}
            </ul>
          </div>
        </div>
        <div style="border:1.5px solid #dc2626;border-radius:5px;overflow:hidden;display:flex;flex-direction:column;">
          <div style="background:#dc2626;color:#fff;font-size:10px;font-weight:700;padding:5px 10px;letter-spacing:0.5px;flex-shrink:0;">PRIORITY LEARNING AREAS</div>
          <div style="padding:6px 10px;flex:1;overflow:hidden;">
            <ul style="margin:0;padding-left:14px;font-size:10px;line-height:1.5;">
              ${priorityList}
            </ul>
          </div>
        </div>
      </div>

      <!-- COMMENTS - flex:1 with 2-column layout -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px;flex:1;min-height:0;">
        <div style="border:1.5px solid #1e3a5f;border-radius:5px;overflow:hidden;display:flex;flex-direction:column;">
          <div style="background:#1e3a5f;color:#fff;font-size:10px;font-weight:700;padding:5px 10px;letter-spacing:0.5px;flex-shrink:0;">CLASS TEACHER'S COMMENTS</div>
          <div style="padding:6px 8px;flex:1;display:flex;flex-direction:column;justify-content:space-between;">
            <p style="font-size:10px;line-height:1.5;margin:0;min-height:35px;">${autoComment}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:8px;color:#374151;border-top:1px solid #e5e7eb;padding-top:4px;">
              <div>${teacherName || '______'}<br/><span style="color:#6b7280;">Class Teacher</span></div>
              <div>Signature: _______________________</div>
            </div>
          </div>
        </div>
        <div style="border:1.5px solid #1e3a5f;border-radius:5px;overflow:hidden;display:flex;flex-direction:column;">
          <div style="background:#1e3a5f;color:#fff;font-size:10px;font-weight:700;padding:5px 10px;letter-spacing:0.5px;flex-shrink:0;">PARENT / GUARDIAN COMMENTS</div>
          <div style="padding:6px 8px;flex:1;display:flex;flex-direction:column;justify-content:flex-end;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:8px;color:#374151;border-top:1px solid #e5e7eb;padding-top:4px;">
              <div>Signature: _______________________</div>
              <div>Date: _______________________</div>
            </div>
          </div>
        </div>
      </div>

      <!-- CALENDAR DATES FOOTER -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px;flex-shrink:0;text-align:center;font-size:10px;font-weight:700;color:#1f2937;">
        <div>DATE CLOSED: ${formatReportDate(dateClosed)}</div>
        <div>NEXT TERM BEGINS FROM: ${formatReportDate(nextTermBegins)}</div>
      </div>

      <!-- FOOTER - pinned at bottom -->
      <div style="border-top:1.5px solid #1e3a5f;padding-top:4px;display:flex;justify-content:space-between;font-size:8px;color:#4b5563;flex-shrink:0;margin-top:auto;">
        <div><strong>Powered by ShuleTech</strong> - Smart Schools, Better Results</div>
        <div style="text-align:right;">${schoolName} &bull; ${gradeLabel} &bull; ${termDisplay}</div>
      </div>

    </div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>General Report - ${currentClass.name} - ${school?.name || ''}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  body { background: #f3f4f6; font-family: 'Helvetica Neue', Arial, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @media print {
    body { background: #fff; }
    @page { size: A4 portrait; margin: 0; }
    div[style*="page-break-after"] { page-break-after: always; break-after: page; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  }
</style>
</head>
<body>
${pages}
</body>
</html>`
}
