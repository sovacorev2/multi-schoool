'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getGradeLevelByClass } from '@/lib/grading-utils'
import { getSubjectDisplay } from '@/lib/subject-utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
    marksByExam: Record<string, number | null> // examTypeId -> score
    average: number | null
  }[]
  overallAverage: number | null
  totalPoints: number | null
  classRank: number
  totalInClass: number
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
  const supabase = createClient()

  // All sessions for this year+term — each becomes a selectable "exam column"
  const availableExamSessions = sessions.filter(s =>
    s.year.toString() === selectedYear &&
    (!selectedTerm || s.term === selectedTerm)
  )

  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [customTeacherName, setCustomTeacherName] = useState('')
  const [termDisplay, setTermDisplay] = useState('')

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
    setSelectedSessionIds(prev =>
      prev.includes(sessionId)
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    )
  }

  // Derive selected sessions (in order)
  const chosenSessions = availableExamSessions.filter(s => selectedSessionIds.includes(s.id))

  async function handlePrintAll() {
    if (!currentClass || !currentSchool || chosenSessions.length === 0 || learners.length === 0) return
    setIsGenerating(true)

    try {
      // Fetch all marks for chosen sessions
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
          const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
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
        const overallAverage = totalSubjectsWithMarks > 0
          ? allScores.reduce((a, b) => a + b, 0) / allScores.length
          : null

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
          totalPoints,
          strengthSubjects,
          prioritySubjects,
          autoComment,
          classRank: 0,
          totalInClass: learners.length,
        }
      })

      // Calculate class ranks based on overall average
      const ranked = [...learnersData]
        .filter(l => l.overallAverage !== null)
        .sort((a, b) => (b.overallAverage ?? 0) - (a.overallAverage ?? 0))
      ranked.forEach((l, idx) => { l.classRank = idx + 1 })

      // Generate HTML for all learners
      const html = generateReportHTML(
        learnersData,
        currentClass,
        currentSchool,
        chosenSessions,
        customTeacherName || currentClass.teacher_name || '',
        termDisplay
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
            General Report — Class Report Cards
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Prints individual report cards for all {learners.length} learners in {currentClass?.name}. Select which exam sessions to include in the Academic Performance Summary.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Exam session selector */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Select Exam Sessions to Include in Academic Summary</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {availableExamSessions.map(session => (
                <label
                  key={session.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedSessionIds.includes(session.id)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <Checkbox
                    checked={selectedSessionIds.includes(session.id)}
                    onCheckedChange={() => toggleSession(session.id)}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{session.exam_types?.name}</span>
                    <span className="text-xs text-muted-foreground">{session.term} {session.year}</span>
                  </div>
                </label>
              ))}
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
              disabled={isGenerating || chosenSessions.length === 0 || learners.length === 0}
              className="gap-2"
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><Printer className="w-4 h-4" /> Print All {learners.length} Report Cards</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              {chosenSessions.length} exam{chosenSessions.length !== 1 ? 's' : ''} selected &bull; One page per learner
            </p>
          </div>

        </CardContent>
      </Card>
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
  termDisplay: string
): string {
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

  function overallRubricLabel(avg: number | null): string {
    if (avg === null) return 'N/A'
    if (avg >= 75) return 'EXCEEDING EXPECTATION'
    if (avg >= 58) return 'MEETING EXPECTATION'
    if (avg >= 41) return 'APPROACHING EXPECTATION'
    return 'BELOW EXPECTATION'
  }

  function overallRubricColor(avg: number | null): string {
    if (avg === null) return '#6b7280'
    if (avg >= 75) return '#16a34a'
    if (avg >= 58) return '#2563eb'
    if (avg >= 41) return '#d97706'
    return '#dc2626'
  }

  function calcOverallPoints(avg: number | null, className: string, schoolNameStr: string): string {
    if (avg === null) return '-'
    const g = getGradeLevelByClass(Math.round(avg), className, schoolNameStr)
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

  // Build individual pages
  const pages = learnersData.map(ld => {
    const { learner, subjectMarks, overallAverage, classRank, totalInClass, strengthSubjects, prioritySubjects, autoComment } = ld
    const rubricInfo = getRubricLabel(overallAverage, currentClass.name, school?.name || '')
    const overallPoints = calcOverallPoints(overallAverage, currentClass.name, school?.name || '')
    const trendPoints = chosenSessions.map(s => {
      // average of all subjects for this session
      const sessionScores = subjectMarks.flatMap(sm => {
        const v = sm.marksByExam[s.id]
        return v !== null && v !== undefined ? [v] : []
      })
      return sessionScores.length > 0 ? sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length : null
    })
    const bestExamIdx = trendPoints.reduce((best, v, i) => (v !== null && (best === -1 || (trendPoints[best] ?? 0) < v)) ? i : best, -1)
    const bestExamName = bestExamIdx >= 0 ? (chosenSessions[bestExamIdx]?.exam_types?.name || `Exam ${bestExamIdx + 1}`) : '-'
    const bestExamScore = bestExamIdx >= 0 && trendPoints[bestExamIdx] !== null ? (trendPoints[bestExamIdx] as number).toFixed(1) : '-'

    // Subject rows
    const subjectRows = subjectMarks.map(sm => {
      const avgGrade = getRubricLabel(sm.average, currentClass.name, school?.name || '')
      const avgPts = sm.average !== null ? calcOverallPoints(sm.average, currentClass.name, school?.name || '') : '-'
      const examCells = chosenSessions.map(s => {
        const v = sm.marksByExam[s.id]
        return `<td style="border:1px solid #d1d5db;padding:5px 8px;text-align:center;font-size:12px;">${v !== null && v !== undefined ? v : '-'}</td>`
      }).join('')
      const badgeColor = avgGrade ? rubricBadgeColor(avgGrade.level) : '#6b7280'
      return `<tr>
        <td style="border:1px solid #d1d5db;padding:5px 8px;font-size:12px;">${sm.subjectName}</td>
        ${examCells}
        <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:center;font-size:12px;font-weight:600;">${sm.average !== null ? sm.average.toFixed(1) : '-'}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:center;">
          ${avgGrade ? `<span style="background:${badgeColor};color:#fff;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;">${avgGrade.level}</span>` : '-'}
        </td>
      </tr>`
    }).join('')

    // Overall average row
    const overallGrade = getRubricLabel(overallAverage, currentClass.name, school?.name || '')
    const overallExamAvgs = chosenSessions.map(s => {
      const sessionScores = subjectMarks.flatMap(sm => {
        const v = sm.marksByExam[s.id]
        return v !== null && v !== undefined ? [v] : []
      })
      return sessionScores.length > 0 ? (sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length).toFixed(1) : '-'
    })
    const overallExamCells = overallExamAvgs.map(v =>
      `<td style="border:1px solid #d1d5db;padding:5px 8px;text-align:center;font-size:12px;font-weight:700;">${v}</td>`
    ).join('')
    const overallBadgeColor = overallGrade ? rubricBadgeColor(overallGrade.level) : '#6b7280'

    const examHeaderCells = examColumns.map(col =>
      `<th style="border:1px solid #d1d5db;padding:6px 8px;background:#1e3a5f;color:#fff;font-size:11px;text-align:center;">${col}</th>`
    ).join('')

    const strengthList = strengthSubjects.length > 0
      ? strengthSubjects.map(s => `<li style="margin-bottom:4px;">${s}</li>`).join('')
      : '<li style="color:#9ca3af;">No specific strength areas identified</li>'

    const priorityList = prioritySubjects.length > 0
      ? prioritySubjects.map(s => `<li style="margin-bottom:4px;">${s}</li>`).join('')
      : '<li style="color:#9ca3af;">No priority areas — keep it up!</li>'

    const logoHTML = logoUrl
      ? `<img src="${logoUrl}" alt="School Logo" style="width:70px;height:70px;object-fit:contain;" crossorigin="anonymous"/>`
      : `<div style="width:70px;height:70px;background:#1e3a5f;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700;text-align:center;padding:4px;">${schoolName.split(' ').map(w => w[0]).join('').slice(0, 4)}</div>`

    return `
    <div style="page-break-after:always;font-family:'Helvetica Neue',Arial,sans-serif;max-width:210mm;margin:0 auto;padding:12mm 14mm;color:#1f2937;background:#fff;min-height:297mm;box-sizing:border-box;">

      <!-- HEADER -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;padding-bottom:10px;border-bottom:3px solid #1e3a5f;">
        <div style="flex:0 0 auto;">${logoHTML}</div>
        <div style="flex:1;text-align:center;padding:0 16px;">
          <h1 style="font-size:22px;font-weight:800;color:#1e3a5f;margin:0 0 2px 0;letter-spacing:0.5px;">${schoolName.toUpperCase()}</h1>
          ${schoolTagline ? `<p style="font-size:13px;color:#b45309;font-style:italic;font-weight:600;margin:0 0 4px 0;">${schoolTagline}</p>` : ''}
          <p style="font-size:10px;color:#4b5563;margin:0;">${[schoolAddress, schoolPhone, schoolEmail].filter(Boolean).join(' | ')}</p>
        </div>
        <div style="flex:0 0 auto;text-align:right;">
          <div style="font-size:11px;font-weight:700;color:#1e3a5f;">ShuleTech</div>
          <div style="font-size:9px;color:#6b7280;">Smart Schools, Better Results</div>
        </div>
      </div>

      <!-- TOP TWO-COLUMN SECTION -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">

        <!-- LEARNER DETAILS -->
        <div style="border:2px solid #1e3a5f;border-radius:6px;overflow:hidden;">
          <div style="background:#1e3a5f;color:#fff;font-size:11px;font-weight:700;padding:6px 10px;letter-spacing:0.5px;">LEARNER DETAILS</div>
          <div style="padding:10px 12px;display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <div>
              <div style="font-size:9px;color:#6b7280;font-weight:600;">Learner's Name:</div>
              <div style="font-size:12px;font-weight:600;">${learner.name}</div>
            </div>
            <div>
              <div style="font-size:9px;color:#6b7280;font-weight:600;">Class Teacher:</div>
              <div style="font-size:12px;font-weight:600;">${teacherName || '—'}</div>
            </div>
            <div>
              <div style="font-size:9px;color:#6b7280;font-weight:600;">Admission No.:</div>
              <div style="font-size:12px;">${learner.admission_number || '—'}</div>
            </div>
            <div>
              <div style="font-size:9px;color:#6b7280;font-weight:600;">Academic Year:</div>
              <div style="font-size:12px;">${chosenSessions[0]?.year || '—'}</div>
            </div>
            <div>
              <div style="font-size:9px;color:#6b7280;font-weight:600;">Grade:</div>
              <div style="font-size:12px;">${gradeLabel}</div>
            </div>
            <div>
              <div style="font-size:9px;color:#6b7280;font-weight:600;">Gender:</div>
              <div style="font-size:12px;">${learner.gender || '—'}</div>
            </div>
            ${streamName ? `
            <div>
              <div style="font-size:9px;color:#6b7280;font-weight:600;">Stream:</div>
              <div style="font-size:12px;">${streamName}</div>
            </div>` : ''}
            <div>
              <div style="font-size:9px;color:#6b7280;font-weight:600;">Term:</div>
              <div style="font-size:12px;">${termDisplay}</div>
            </div>
          </div>
        </div>

        <!-- OVERALL ACHIEVEMENT -->
        <div style="border:2px solid #1e3a5f;border-radius:6px;overflow:hidden;">
          <div style="background:#1e3a5f;color:#fff;font-size:11px;font-weight:700;padding:6px 10px;letter-spacing:0.5px;">OVERALL ACHIEVEMENT</div>
          <div style="padding:10px 12px;text-align:center;">
            <div style="font-size:10px;color:#6b7280;margin-bottom:4px;">Overall Average (%)</div>
            <div style="font-size:38px;font-weight:800;color:#1e3a5f;line-height:1;">${overallAverage !== null ? overallAverage.toFixed(1) : '—'}</div>
            <div style="font-size:9px;color:#6b7280;margin-bottom:8px;">Overall Points: ${overallPoints}</div>
            <div style="margin-bottom:10px;">
              <span style="border:2px solid ${overallRubricColor(overallAverage)};color:${overallRubricColor(overallAverage)};border-radius:20px;padding:4px 14px;font-size:11px;font-weight:700;">${overallRubricLabel(overallAverage)}</span>
            </div>
            <div style="font-size:11px;color:#374151;margin-bottom:6px;">Class Position: ${classRank > 0 ? `${classRank} out of ${totalInClass}` : 'N/A'}</div>
            <div style="text-align:left;font-size:9px;line-height:1.6;">
              <div><span style="color:#16a34a;font-weight:700;">●</span> EE: Exceeding Expectation (≥75%)</div>
              <div><span style="color:#2563eb;font-weight:700;">●</span> ME: Meeting Expectation (58–74%)</div>
              <div><span style="color:#d97706;font-weight:700;">●</span> AE: Approaching Expectation (41–57%)</div>
              <div><span style="color:#dc2626;font-weight:700;">●</span> BE: Below Expectation (&lt;41%)</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ACADEMIC PERFORMANCE SUMMARY + TREND -->
      <div style="display:grid;grid-template-columns:1.7fr 1fr;gap:12px;margin-bottom:12px;">

        <!-- ACADEMIC PERFORMANCE TABLE -->
        <div style="border:2px solid #1e3a5f;border-radius:6px;overflow:hidden;">
          <div style="background:#1e3a5f;color:#fff;font-size:11px;font-weight:700;padding:6px 10px;letter-spacing:0.5px;">ACADEMIC PERFORMANCE SUMMARY</div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>
                  <th style="border:1px solid #d1d5db;padding:6px 8px;background:#e5e7eb;color:#1f2937;font-size:11px;text-align:left;">LEARNING AREA</th>
                  ${examHeaderCells}
                  <th style="border:1px solid #d1d5db;padding:6px 8px;background:#e5e7eb;color:#1f2937;font-size:11px;text-align:center;">AVG</th>
                  <th style="border:1px solid #d1d5db;padding:6px 8px;background:#e5e7eb;color:#1f2937;font-size:11px;text-align:center;">RUBRIC</th>
                </tr>
              </thead>
              <tbody>
                ${subjectRows}
                <tr style="background:#fef9c3;font-weight:700;">
                  <td style="border:1px solid #d1d5db;padding:6px 8px;font-size:12px;font-weight:700;">OVERALL AVERAGE</td>
                  ${overallExamCells}
                  <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;font-size:12px;font-weight:700;">${overallAverage !== null ? overallAverage.toFixed(1) : '-'}</td>
                  <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;">
                    ${overallGrade ? `<span style="background:${overallBadgeColor};color:#fff;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;">${overallGrade.level}</span>` : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- PERFORMANCE TREND -->
        <div style="border:2px solid #1e3a5f;border-radius:6px;overflow:hidden;">
          <div style="background:#1e3a5f;color:#fff;font-size:11px;font-weight:700;padding:6px 10px;letter-spacing:0.5px;">PERFORMANCE TREND</div>
          <div style="padding:10px;text-align:center;">
            <div style="font-size:10px;color:#4b5563;font-weight:600;margin-bottom:6px;">Average Score (%)</div>
            ${trendSVG(trendPoints)}
            <div style="margin-top:10px;text-align:center;">
              <div style="display:inline-block;background:#dcfce7;border:2px solid #16a34a;border-radius:50%;width:80px;height:80px;text-align:center;padding-top:14px;box-sizing:border-box;">
                <div style="font-size:9px;color:#15803d;font-weight:700;">BEST:</div>
                <div style="font-size:10px;color:#15803d;font-weight:800;">${bestExamName}</div>
                <div style="font-size:11px;color:#15803d;font-weight:800;">(${bestExamScore}%)</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- STRENGTHS + PRIORITY AREAS -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div style="border:2px solid #16a34a;border-radius:6px;overflow:hidden;">
          <div style="background:#16a34a;color:#fff;font-size:11px;font-weight:700;padding:6px 10px;letter-spacing:0.5px;">STRENGTH AREAS</div>
          <div style="padding:10px 14px;">
            <ul style="margin:0;padding-left:16px;font-size:12px;line-height:1.7;">
              ${strengthList}
            </ul>
          </div>
        </div>
        <div style="border:2px solid #dc2626;border-radius:6px;overflow:hidden;">
          <div style="background:#dc2626;color:#fff;font-size:11px;font-weight:700;padding:6px 10px;letter-spacing:0.5px;">PRIORITY LEARNING AREAS</div>
          <div style="padding:10px 14px;">
            <ul style="margin:0;padding-left:16px;font-size:12px;line-height:1.7;">
              ${priorityList}
            </ul>
          </div>
        </div>
      </div>

      <!-- COMMENTS -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div style="border:2px solid #1e3a5f;border-radius:6px;overflow:hidden;">
          <div style="background:#1e3a5f;color:#fff;font-size:11px;font-weight:700;padding:6px 10px;letter-spacing:0.5px;">CLASS TEACHER'S COMMENTS</div>
          <div style="padding:10px 12px;min-height:80px;">
            <p style="font-size:12px;line-height:1.6;margin:0 0 14px 0;">${autoComment}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:#374151;">
              <div>${teacherName || '______________________'}<br/><span style="color:#6b7280;">Class Teacher</span></div>
              <div>Signature: ______________________<br/>&nbsp;</div>
            </div>
          </div>
        </div>
        <div style="border:2px solid #1e3a5f;border-radius:6px;overflow:hidden;">
          <div style="background:#1e3a5f;color:#fff;font-size:11px;font-weight:700;padding:6px 10px;letter-spacing:0.5px;">PARENT / GUARDIAN COMMENTS</div>
          <div style="padding:10px 12px;min-height:80px;">
            <div style="height:50px;"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:#374151;border-top:1px solid #e5e7eb;padding-top:8px;margin-top:8px;">
              <div>Signature: ______________________</div>
              <div>Date: ___________________________</div>
            </div>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div style="border-top:2px solid #1e3a5f;padding-top:6px;display:flex;justify-content:space-between;font-size:10px;color:#4b5563;">
        <div><strong>Powered by ShuleTech</strong> — Smart Schools, Better Results</div>
        <div style="text-align:right;">${schoolName} &bull; ${gradeLabel} &bull; ${termDisplay}</div>
      </div>

    </div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>General Report — ${currentClass.name} — ${school?.name || ''}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f3f4f6; font-family: 'Helvetica Neue', Arial, sans-serif; }
  @media print {
    body { background: #fff; }
    @page { size: A4 portrait; margin: 0; }
  }
</style>
</head>
<body>
${pages}
</body>
</html>`
}
