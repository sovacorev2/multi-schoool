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
      {/* Summary Table */}
      <div className="pathway-summary" style={{ marginTop: '20px', marginBottom: '15px' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #ddd',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd', fontSize: '12px', fontWeight: '600' }}>
                Pathway
              </th>
              <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd', fontSize: '12px', fontWeight: '600' }}>
                Points
              </th>
              <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd', fontSize: '12px', fontWeight: '600' }}>
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
                      padding: '10px',
                      border: '1px solid #ddd',
                      fontWeight: '500',
                      fontSize: '12px',
                      color: config?.color.dark,
                    }}
                  >
                    {pathway.name}
                  </td>
                  <td
                    style={{
                      padding: '10px',
                      border: '1px solid #ddd',
                      textAlign: 'center',
                      fontWeight: '600',
                      fontSize: '12px',
                    }}
                  >
                    {pathway.score}/{pathway.maxPoints}
                  </td>
                  <td
                    style={{
                      padding: '10px',
                      border: '1px solid #ddd',
                      textAlign: 'center',
                      fontWeight: '600',
                      fontSize: '12px',
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

      {/* Recommended Pathway */}
      <div
        style={{
          padding: '15px',
          backgroundColor: '#f0f9ff',
          border: '2px solid #0284c7',
          borderRadius: '8px',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>
          RECOMMENDED PATHWAY
        </p>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0284c7' }}>
          {recommendedPathway}
        </p>
      </div>
    </div>
  )
}
