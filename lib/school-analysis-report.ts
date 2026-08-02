// HTML generator for the School Analysis print/PDF report.
// Mirrors the branded, print-formatted-page pattern already used by
// components/general-report.tsx (window.open + write HTML + window.print()) —
// this is the same approach, applied to whole-school analysis instead of
// per-learner report cards.

export interface SchoolAnalysisCategory {
  category: string
  classes: {
    name: string
    classId: string
    totalLearners: number
    classAvg: number
    subjectCount: number
    rubricDistribution: { r4: number; r3: number; r2: number; r1: number }
    topSubject: string
    weakestSubject: string
  }[]
  categoryAvg: number
  totalLearners: number
}

export interface SchoolAnalysisExtra {
  overallSchoolAvg: number
  passRate: number
  totalLearnersWithMarks: number
  genderStats: { maleAvg: number; femaleAvg: number; maleCount: number; femaleCount: number }
  subjectRankings: { name: string; avg: number; classCount: number }[]
  topLearners: { name: string; className: string; total: number; average: number }[]
  bottomLearners: { name: string; className: string; total: number; average: number }[]
}

interface SchoolInfo {
  name?: string | null
  tagline?: string | null
  address?: string | null
  email?: string | null
  phone?: string | null
  logo_url?: string | null
}

interface SessionInfo {
  term?: string | null
  year?: number | null
  exam_types?: { name: string } | null
}

function generateRecommendations(
  overallAvg: number,
  passRate: number,
  categories: SchoolAnalysisCategory[],
  subjectRankings: { name: string; avg: number; classCount: number }[],
  genderStats: SchoolAnalysisExtra['genderStats']
): string[] {
  const recs: string[] = []

  if (overallAvg >= 75) {
    recs.push(`The school is performing exceptionally well with an overall mean of ${overallAvg}%. Sustain this momentum through continued investment in teaching resources and learner support programs.`)
  } else if (overallAvg >= 58) {
    recs.push(`The school is meeting expectations with an overall mean of ${overallAvg}%. Targeted support in the weaker categories and subjects identified below can push performance into the exceeding range.`)
  } else if (overallAvg >= 41) {
    recs.push(`The school's overall mean of ${overallAvg}% shows learners are approaching expectations. A structured remedial program focused on the weakest subjects and grade levels is recommended.`)
  } else if (overallAvg > 0) {
    recs.push(`The school's overall mean of ${overallAvg}% indicates significant support is needed across most learning areas. Immediate intervention — additional teacher support, parent engagement, and structured revision programs — is strongly recommended.`)
  }

  if (overallAvg > 0 && passRate < 50) {
    recs.push(`Only ${passRate}% of learners are scoring above the 50% mark school-wide. Consider diagnostic assessments to pinpoint specific skill gaps before the next exam cycle.`)
  }

  const validCats = categories.filter(c => c.categoryAvg > 0).sort((a, b) => a.categoryAvg - b.categoryAvg)
  if (validCats.length > 1) {
    const weakest = validCats[0]
    const strongest = validCats[validCats.length - 1]
    recs.push(`${weakest.category} has the lowest mean score (${weakest.categoryAvg}%) among all levels — consider allocating additional teaching resources or peer-mentoring support here. ${strongest.category} is the school's strongest level (${strongest.categoryAvg}%) and its teaching approaches may be worth sharing across other levels.`)
  }

  // Split into a "strongest" and "weakest" group without overlap — with few
  // subjects, slicing a fixed top-3/bottom-3 can select the same subjects twice.
  const halfCount = Math.min(3, Math.floor(subjectRankings.length / 2))
  if (halfCount > 0) {
    const strongSubjects = subjectRankings.slice(0, halfCount)
    const weakSubjects = subjectRankings.slice(-halfCount).reverse()
    recs.push(
      `School-wide, ${weakSubjects.map(s => s.name).join(', ')} ${weakSubjects.length > 1 ? 'are' : 'is'} the area${weakSubjects.length > 1 ? 's' : ''} needing the most attention (mean ${weakSubjects.map(s => s.avg + '%').join(', ')}). ` +
      `${strongSubjects.map(s => s.name).join(', ')} ${strongSubjects.length > 1 ? 'are' : 'is'} performing strongest (mean ${strongSubjects.map(s => s.avg + '%').join(', ')}) and can serve as a model for teaching approaches in weaker subjects.`
    )
  }

  if (genderStats.maleCount > 0 && genderStats.femaleCount > 0) {
    const gap = Math.abs(genderStats.maleAvg - genderStats.femaleAvg)
    if (gap >= 5) {
      const behind = genderStats.maleAvg < genderStats.femaleAvg ? 'boys' : 'girls'
      const ahead = behind === 'boys' ? 'girls' : 'boys'
      recs.push(`There is a notable performance gap between genders: ${ahead} are averaging ${gap.toFixed(1)} points higher than ${behind}. Consider targeted mentorship or engagement programs for ${behind} to help close this gap.`)
    } else {
      recs.push(`Performance between boys (${genderStats.maleAvg}%) and girls (${genderStats.femaleAvg}%) is well balanced, differing by less than 5 points.`)
    }
  }

  if (recs.length === 0) {
    recs.push('Not enough data was available to generate recommendations for this exam session. Load results for a session with marks entered across multiple classes.')
  }

  return recs
}

const categoryColors: Record<string, string> = {
  'Pre-School': '#7c3aed',
  'Lower Primary': '#059669',
  'Upper Primary': '#4b5563',
  'Junior Secondary': '#ea580c',
}

export function generateSchoolAnalysisHTML(
  categories: SchoolAnalysisCategory[],
  extra: SchoolAnalysisExtra,
  school: SchoolInfo | null,
  session: SessionInfo | null
): string {
  const schoolName = school?.name || 'SCHOOL'
  const schoolTagline = school?.tagline || ''
  const contactLine = [school?.address, school?.phone, school?.email].filter(Boolean).join(' | ')
  const logoHTML = school?.logo_url
    ? `<img src="${school.logo_url}" alt="School Logo" style="width:56px;height:56px;object-fit:contain;" crossorigin="anonymous"/>`
    : `<div style="width:56px;height:56px;background:#1e3a5f;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:8px;font-weight:700;text-align:center;padding:3px;">${schoolName.split(' ').map(w => w[0]).join('').slice(0, 4)}</div>`

  const examLabel = `${session?.exam_types?.name || 'Exam'} — ${session?.term || ''} ${session?.year || ''}`.trim()
  const generatedOn = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const recommendations = generateRecommendations(
    extra.overallSchoolAvg,
    extra.passRate,
    categories,
    extra.subjectRankings,
    extra.genderStats
  )

  const categoryRows = categories.map(cat => `
    <tr>
      <td style="border:1px solid #d1d5db;padding:6px 8px;font-weight:700;color:${categoryColors[cat.category] || '#1e3a5f'};">${cat.category}</td>
      <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;">${cat.classes.length}</td>
      <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;">${cat.totalLearners}</td>
      <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;font-weight:700;">${cat.categoryAvg || '—'}</td>
    </tr>
  `).join('')

  const classBreakdownSections = categories.map(cat => {
    const ranked = [...cat.classes].sort((a, b) => b.classAvg - a.classAvg)
    const rows = ranked.map((cls, idx) => {
      const total = cls.rubricDistribution.r4 + cls.rubricDistribution.r3 + cls.rubricDistribution.r2 + cls.rubricDistribution.r1
      const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0
      return `
        <tr>
          <td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;">${cls.classAvg > 0 ? idx + 1 : '—'}</td>
          <td style="border:1px solid #d1d5db;padding:5px 7px;font-weight:600;">${cls.name}</td>
          <td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;">${cls.totalLearners}</td>
          <td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;font-weight:700;">${cls.classAvg || '—'}</td>
          <td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;">${cls.rubricDistribution.r4} <span style="color:#6b7280;font-size:9px;">(${pct(cls.rubricDistribution.r4)}%)</span></td>
          <td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;">${cls.rubricDistribution.r1} <span style="color:#6b7280;font-size:9px;">(${pct(cls.rubricDistribution.r1)}%)</span></td>
          <td style="border:1px solid #d1d5db;padding:5px 7px;font-size:10px;color:#15803d;">${cls.topSubject}</td>
          <td style="border:1px solid #d1d5db;padding:5px 7px;font-size:10px;color:#dc2626;">${cls.weakestSubject}</td>
        </tr>
      `
    }).join('')

    return `
      <div style="margin-bottom:14px;">
        <div style="background:${categoryColors[cat.category] || '#1e3a5f'};color:#fff;font-size:11px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0;">
          ${cat.category} — ${cat.totalLearners} learners, ${cat.classes.length} classes, mean ${cat.categoryAvg || '—'}%
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:#e5e7eb;">
              <th style="border:1px solid #d1d5db;padding:5px 7px;">Rank</th>
              <th style="border:1px solid #d1d5db;padding:5px 7px;text-align:left;">Class</th>
              <th style="border:1px solid #d1d5db;padding:5px 7px;">Learners</th>
              <th style="border:1px solid #d1d5db;padding:5px 7px;">Mean</th>
              <th style="border:1px solid #d1d5db;padding:5px 7px;">Exceeding (R4)</th>
              <th style="border:1px solid #d1d5db;padding:5px 7px;">Below (R1)</th>
              <th style="border:1px solid #d1d5db;padding:5px 7px;text-align:left;">Strongest Subject</th>
              <th style="border:1px solid #d1d5db;padding:5px 7px;text-align:left;">Weakest Subject</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `
  }).join('')

  const subjectRankingRows = extra.subjectRankings.map((s, idx) => `
    <tr>
      <td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;">${idx + 1}</td>
      <td style="border:1px solid #d1d5db;padding:5px 7px;font-weight:600;">${s.name}</td>
      <td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;">${s.classCount}</td>
      <td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;font-weight:700;color:${s.avg >= 58 ? '#15803d' : s.avg >= 41 ? '#b45309' : '#dc2626'};">${s.avg}%</td>
    </tr>
  `).join('')

  const topLearnerRows = extra.topLearners.map((l, idx) => `
    <tr>
      <td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;">${idx + 1}</td>
      <td style="border:1px solid #d1d5db;padding:5px 7px;font-weight:600;">${l.name}</td>
      <td style="border:1px solid #d1d5db;padding:5px 7px;">${l.className}</td>
      <td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;font-weight:700;color:#15803d;">${l.average}%</td>
    </tr>
  `).join('')

  const bottomLearnerRows = extra.bottomLearners.map((l, idx) => `
    <tr>
      <td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;">${idx + 1}</td>
      <td style="border:1px solid #d1d5db;padding:5px 7px;font-weight:600;">${l.name}</td>
      <td style="border:1px solid #d1d5db;padding:5px 7px;">${l.className}</td>
      <td style="border:1px solid #d1d5db;padding:5px 7px;text-align:center;font-weight:700;color:#dc2626;">${l.average}%</td>
    </tr>
  `).join('')

  const genderTotal = extra.genderStats.maleCount + extra.genderStats.femaleCount
  const maleBarPct = extra.genderStats.maleAvg
  const femaleBarPct = extra.genderStats.femaleAvg

  const recommendationsHTML = recommendations.map(r => `<li style="margin-bottom:8px;">${r}</li>`).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>School Analysis — ${schoolName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { background: #f3f4f6; font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 12mm; background: #fff; }
  .section-title { background:#1e3a5f;color:#fff;font-size:12px;font-weight:700;padding:7px 12px;letter-spacing:0.4px;border-radius:4px 4px 0 0;margin-top:18px; }
  table { width: 100%; border-collapse: collapse; }
  @media print {
    body { background: #fff; }
    @page { size: A4 portrait; margin: 10mm; }
    .page { width: auto; min-height: 0; padding: 0; }
    .avoid-break { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:8px;border-bottom:2px solid #1e3a5f;">
    <div>${logoHTML}</div>
    <div style="flex:1;text-align:center;padding:0 10px;">
      <h1 style="font-size:19px;font-weight:800;color:#1e3a5f;letter-spacing:0.5px;">${schoolName.toUpperCase()}</h1>
      ${schoolTagline ? `<p style="font-size:11px;color:#b45309;font-style:italic;font-weight:600;margin-top:2px;">${schoolTagline}</p>` : ''}
      ${contactLine ? `<p style="font-size:9px;color:#4b5563;margin-top:2px;">${contactLine}</p>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;font-weight:700;color:#1e3a5f;">ShuleTech</div>
      <div style="font-size:8px;color:#6b7280;">Smart Schools, Better Results</div>
    </div>
  </div>

  <div style="text-align:center;margin:14px 0;">
    <div style="display:inline-block;border:2px solid #1e3a5f;border-radius:6px;padding:6px 18px;">
      <div style="font-size:14px;font-weight:800;color:#1e3a5f;letter-spacing:0.5px;">SCHOOL PERFORMANCE ANALYSIS REPORT</div>
      <div style="font-size:10px;color:#4b5563;margin-top:2px;">${examLabel} &bull; Generated ${generatedOn}</div>
    </div>
  </div>

  <!-- EXECUTIVE SUMMARY -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
    <div style="border:1.5px solid #1e3a5f;border-radius:5px;padding:10px;text-align:center;">
      <div style="font-size:9px;color:#6b7280;font-weight:600;">SCHOOL-WIDE MEAN</div>
      <div style="font-size:24px;font-weight:800;color:#1e3a5f;">${extra.overallSchoolAvg || '—'}%</div>
    </div>
    <div style="border:1.5px solid #1e3a5f;border-radius:5px;padding:10px;text-align:center;">
      <div style="font-size:9px;color:#6b7280;font-weight:600;">PASS RATE (&ge;50%)</div>
      <div style="font-size:24px;font-weight:800;color:#1e3a5f;">${extra.passRate || '—'}%</div>
    </div>
    <div style="border:1.5px solid #1e3a5f;border-radius:5px;padding:10px;text-align:center;">
      <div style="font-size:9px;color:#6b7280;font-weight:600;">LEARNERS ASSESSED</div>
      <div style="font-size:24px;font-weight:800;color:#1e3a5f;">${extra.totalLearnersWithMarks}</div>
    </div>
    <div style="border:1.5px solid #1e3a5f;border-radius:5px;padding:10px;text-align:center;">
      <div style="font-size:9px;color:#6b7280;font-weight:600;">CLASSES ANALYZED</div>
      <div style="font-size:24px;font-weight:800;color:#1e3a5f;">${categories.reduce((a, c) => a + c.classes.length, 0)}</div>
    </div>
  </div>

  <!-- CATEGORY PERFORMANCE -->
  <div class="section-title avoid-break">PERFORMANCE BY LEVEL</div>
  <table style="font-size:11px;">
    <thead>
      <tr style="background:#e5e7eb;">
        <th style="border:1px solid #d1d5db;padding:6px 8px;text-align:left;">Level</th>
        <th style="border:1px solid #d1d5db;padding:6px 8px;">Classes</th>
        <th style="border:1px solid #d1d5db;padding:6px 8px;">Learners</th>
        <th style="border:1px solid #d1d5db;padding:6px 8px;">Mean Score</th>
      </tr>
    </thead>
    <tbody>${categoryRows}</tbody>
  </table>

  <!-- CLASS BREAKDOWN -->
  <div class="section-title avoid-break">CLASS-BY-CLASS BREAKDOWN</div>
  ${classBreakdownSections}

  <!-- GENDER ANALYSIS -->
  <div class="section-title avoid-break">GENDER ANALYSIS</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px 0;">
    <div style="border:1px solid #d1d5db;border-radius:5px;padding:10px;">
      <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:600;margin-bottom:4px;">
        <span>Boys (${extra.genderStats.maleCount})</span><span>${extra.genderStats.maleAvg || '—'}%</span>
      </div>
      <div style="background:#e5e7eb;border-radius:4px;height:10px;overflow:hidden;"><div style="background:#2563eb;height:100%;width:${Math.min(100, maleBarPct)}%;"></div></div>
    </div>
    <div style="border:1px solid #d1d5db;border-radius:5px;padding:10px;">
      <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:600;margin-bottom:4px;">
        <span>Girls (${extra.genderStats.femaleCount})</span><span>${extra.genderStats.femaleAvg || '—'}%</span>
      </div>
      <div style="background:#e5e7eb;border-radius:4px;height:10px;overflow:hidden;"><div style="background:#db2777;height:100%;width:${Math.min(100, femaleBarPct)}%;"></div></div>
    </div>
  </div>
  ${genderTotal === 0 ? '<p style="font-size:10px;color:#9ca3af;padding-bottom:8px;">No gender data available for this session\'s learners.</p>' : ''}

  <!-- SUBJECT RANKINGS -->
  <div class="section-title avoid-break">SCHOOL-WIDE SUBJECT PERFORMANCE (STRONGEST → WEAKEST)</div>
  <table style="font-size:11px;">
    <thead>
      <tr style="background:#e5e7eb;">
        <th style="border:1px solid #d1d5db;padding:5px 7px;">Rank</th>
        <th style="border:1px solid #d1d5db;padding:5px 7px;text-align:left;">Subject</th>
        <th style="border:1px solid #d1d5db;padding:5px 7px;">Classes Offering</th>
        <th style="border:1px solid #d1d5db;padding:5px 7px;">Mean</th>
      </tr>
    </thead>
    <tbody>${subjectRankingRows}</tbody>
  </table>

  <!-- TOP / BOTTOM PERFORMERS -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px;">
    <div class="avoid-break">
      <div style="background:#16a34a;color:#fff;font-size:11px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0;">TOP 10 PERFORMERS (SCHOOL-WIDE)</div>
      <table style="font-size:10px;">
        <thead><tr style="background:#e5e7eb;"><th style="border:1px solid #d1d5db;padding:4px 6px;">#</th><th style="border:1px solid #d1d5db;padding:4px 6px;text-align:left;">Learner</th><th style="border:1px solid #d1d5db;padding:4px 6px;text-align:left;">Class</th><th style="border:1px solid #d1d5db;padding:4px 6px;">Avg</th></tr></thead>
        <tbody>${topLearnerRows || `<tr><td colspan="4" style="border:1px solid #d1d5db;padding:8px;text-align:center;color:#9ca3af;">No data</td></tr>`}</tbody>
      </table>
    </div>
    <div class="avoid-break">
      <div style="background:#dc2626;color:#fff;font-size:11px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0;">LEARNERS NEEDING SUPPORT (BOTTOM 10)</div>
      <table style="font-size:10px;">
        <thead><tr style="background:#e5e7eb;"><th style="border:1px solid #d1d5db;padding:4px 6px;">#</th><th style="border:1px solid #d1d5db;padding:4px 6px;text-align:left;">Learner</th><th style="border:1px solid #d1d5db;padding:4px 6px;text-align:left;">Class</th><th style="border:1px solid #d1d5db;padding:4px 6px;">Avg</th></tr></thead>
        <tbody>${bottomLearnerRows || `<tr><td colspan="4" style="border:1px solid #d1d5db;padding:8px;text-align:center;color:#9ca3af;">No data</td></tr>`}</tbody>
      </table>
    </div>
  </div>

  <!-- RECOMMENDATIONS -->
  <div class="section-title avoid-break" style="background:#b45309;">KEY RECOMMENDATIONS</div>
  <div style="border:1px solid #d1d5db;border-top:none;padding:12px 16px;">
    <ul style="padding-left:16px;font-size:11px;line-height:1.6;">${recommendationsHTML}</ul>
  </div>

  <!-- FOOTER -->
  <div style="border-top:1.5px solid #1e3a5f;padding-top:6px;margin-top:20px;display:flex;justify-content:space-between;font-size:9px;color:#4b5563;">
    <div><strong>Powered by ShuleTech</strong> — Smart Schools, Better Results</div>
    <div>${schoolName} &bull; ${examLabel} &bull; Generated ${generatedOn}</div>
  </div>

</div>
</body>
</html>`
}
