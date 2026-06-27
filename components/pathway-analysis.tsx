import React from 'react'
import { PathwayScore, getRecommendedPathway, getPathwayConfig } from '@/lib/pathways'

interface PathwayAnalysisProps {
  scores: PathwayScore[]
  className?: string
}

export function PathwayAnalysis({ scores, className = '' }: PathwayAnalysisProps) {
  const recommendedPathway = getRecommendedPathway(scores)

  return (
    <div className={`pathway-analysis ${className}`}>
      {/* Summary Table - Compact */}
      <div className="pathway-summary" style={{ marginTop: '0', marginBottom: '8px' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #ddd',
            fontSize: '10px',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #ddd', fontWeight: '600' }}>
                Pathway
              </th>
              <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #ddd', fontWeight: '600' }}>
                Points
              </th>
              <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #ddd', fontWeight: '600' }}>
                Percentage
              </th>
            </tr>
          </thead>
          <tbody>
            {scores.map(pathway => {
              const config = getPathwayConfig(pathway.name)
              return (
                <tr key={pathway.name} style={{ backgroundColor: config?.color.light }}>
                  <td
                    style={{
                      padding: '6px 8px',
                      border: '1px solid #ddd',
                      fontWeight: '500',
                      color: config?.color.dark,
                    }}
                  >
                    {pathway.name}
                  </td>
                  <td
                    style={{
                      padding: '6px 8px',
                      border: '1px solid #ddd',
                      textAlign: 'center',
                      fontWeight: '600',
                    }}
                  >
                    {pathway.score}/{pathway.maxPoints}
                  </td>
                  <td
                    style={{
                      padding: '6px 8px',
                      border: '1px solid #ddd',
                      textAlign: 'center',
                      fontWeight: '600',
                    }}
                  >
                    {pathway.percentage.toFixed(1)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Recommended Pathway - Compact */}
      <div
        style={{
          padding: '8px 12px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #0284c7',
          borderRadius: '4px',
          textAlign: 'center',
          fontSize: '9px',
        }}
      >
        <p style={{ margin: '0 0 4px 0', color: '#666', fontWeight: '500' }}>
          RECOMMENDED PATHWAY
        </p>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#0284c7' }}>
          {recommendedPathway}
        </p>
      </div>
    </div>
  )
}
