'use client'

import { Button } from '@/components/ui/button'
import { Download, FileText } from 'lucide-react'

export default function ProductsAndServicesPage() {
  const handleDownloadPDF = async () => {
    try {
      // Create PDF content
      const response = await fetch('/api/generate-products-pdf', {
        method: 'POST',
      })
      
      if (!response.ok) throw new Error('Failed to generate PDF')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'School-Exam-System-Products-Services.pdf'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading PDF:', error)
      alert('Failed to download PDF. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Products & Services</h1>
            <p className="text-sm text-gray-600">School Exam Management System</p>
          </div>
          <Button 
            onClick={handleDownloadPDF}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8 md:p-12 prose prose-sm md:prose max-w-none">
          <h2>School Exam Management System - Products & Services</h2>

          <h3>System Overview</h3>
          <p>A comprehensive multi-school exam management platform that streamlines the entire exam workflow from session creation through reporting. The system serves three primary user roles: <strong>School Administrators</strong>, <strong>Teachers</strong>, and <strong>Learners</strong>, each with purpose-built interfaces and capabilities.</p>

          <hr />

          <h2>Core Products & Services</h2>

          <h3>1. Exam Session Management</h3>
          <p>Create, manage, and control exam sessions across multiple classes and terms.</p>
          <ul>
            <li><strong>Session Creation</strong> - Teachers create exam sessions with configurable exam types (Mid-Term, End-Term, Monthly Tests, etc.)</li>
            <li><strong>Multi-Class Support</strong> - Manage unlimited exam sessions across different classes simultaneously</li>
            <li><strong>Term/Year Organization</strong> - Organize exams by academic term and year for easy tracking</li>
            <li><strong>Status Tracking</strong> - Real-time tracking of session status (Open, Deadline Set, Locked)</li>
            <li><strong>Deadline Management</strong> - Set deadlines for marks entry with automatic enforcement</li>
            <li><strong>Session Locking</strong> - Lock sessions to prevent further modifications once complete</li>
            <li><strong>Admin Override Control</strong> - Administrators can manage all sessions across the school</li>
          </ul>

          <h3>2. Marks Entry & Management</h3>
          <p>Comprehensive marks entry system with real-time validation and multi-level access control.</p>
          <ul>
            <li><strong>Bulk Marks Entry</strong> - Enter marks for entire classes in a single interface</li>
            <li><strong>Subject-Specific Entry</strong> - Teachers enter marks only for their assigned subjects</li>
            <li><strong>Real-Time Validation</strong> - Immediate feedback on mark entry with pass/fail indicators</li>
            <li><strong>Admin Full Access</strong> - Administrators can view and edit all marks across school</li>
            <li><strong>Teacher Restrictions</strong> - Teachers only see their assigned subjects for their classes</li>
          </ul>

          <h3>3. Learner Management</h3>
          <p>Complete learner information system with enrollment tracking and performance data.</p>
          <ul>
            <li><strong>Learner Profiles</strong> - Create and maintain detailed learner information</li>
            <li><strong>Contact Information</strong> - Store parent/guardian contact details</li>
            <li><strong>Performance Records</strong> - Link all exam marks to learner profiles</li>
            <li><strong>Search & Filter</strong> - Quick learner lookup by name, admission number, or class</li>
            <li><strong>Data Export</strong> - Export learner lists and performance data</li>
          </ul>

          <h3>4. Subject Management</h3>
          <p>Flexible subject organization for diverse school curricula.</p>
          <ul>
            <li><strong>Subject Creation</strong> - Add custom subjects to class curriculum</li>
            <li><strong>Subject Assignment</strong> - Assign subjects to teachers</li>
            <li><strong>Class Subjects</strong> - Define which subjects are taught in each class</li>
            <li><strong>Teacher-Subject Mapping</strong> - Track which teachers teach which subjects</li>
          </ul>

          <h3>5. Class Management</h3>
          <p>Comprehensive class and stream organization system.</p>
          <ul>
            <li><strong>Class Creation</strong> - Create classes with standard naming (Grade 1, Grade 9, etc.)</li>
            <li><strong>Stream Management</strong> - Support multiple streams (A, B, C) in large schools</li>
            <li><strong>Class Statistics</strong> - Overview of learners, marks, and performance per class</li>
          </ul>

          <h3>6. Teacher Management & Assignment</h3>
          <p>Manage teacher roles, assignments, and permissions.</p>
          <ul>
            <li><strong>Teacher Profiles</strong> - Complete teacher information database</li>
            <li><strong>Role Assignment</strong> - Assign teachers as class teacher or subject teacher</li>
            <li><strong>PIN Management</strong> - Optional PIN-based authentication for teachers</li>
            <li><strong>Assignment Control</strong> - Assign teachers to classes and subjects</li>
          </ul>

          <h3>7. Reports & Analytics</h3>
          <ul>
            <li><strong>Mark Lists</strong> - Formatted printable mark sheets and reports</li>
            <li><strong>Stream Comparison</strong> - Compare performance across different streams</li>
            <li><strong>Print Reports</strong> - Multiple report formats for different stakeholders</li>
            <li><strong>Export Options</strong> - PDF generation for archival or sharing</li>
          </ul>

          <h3>8. Admin Portal</h3>
          <p>Comprehensive administration interface with:</p>
          <ul>
            <li><strong>School Management</strong> - Create and manage multiple schools</li>
            <li><strong>Exam Session Control</strong> - View all exam sessions, set deadlines, lock/unlock</li>
            <li><strong>Class Access</strong> - Access any class with full visibility and override capabilities</li>
            <li><strong>Teacher Management</strong> - Create accounts and manage assignments</li>
            <li><strong>Data Management</strong> - Import/export and bulk operations</li>
          </ul>

          <h3>9. Security & Authentication</h3>
          <ul>
            <li><strong>Teacher Portal</strong> - Class selection, password, and optional PIN</li>
            <li><strong>Admin Portal</strong> - Secure login with persistent sessions</li>
            <li><strong>Role-Based Access</strong> - Different access levels for different roles</li>
            <li><strong>Data Protection</strong> - Row-level security and encrypted credentials</li>
          </ul>

          <h3>10. Progressive Web App (PWA) Support</h3>
          <p>Install to home screen on mobile and desktop devices:</p>
          <ul>
            <li><strong>Teacher App</strong> - Offline functionality and push notifications</li>
            <li><strong>Admin App</strong> - School-branded installation with quick shortcuts</li>
            <li><strong>Service Worker</strong> - Offline capability and fast loading</li>
          </ul>

          <h3>11. Data Organization & Filtering</h3>
          <ul>
            <li><strong>Deadline Filtering</strong> - Filter by class, exam type, and status</li>
            <li><strong>Search & Navigation</strong> - Quick lookup of classes, learners, and teachers</li>
          </ul>

          <h3>12. Dashboard & Home</h3>
          <ul>
            <li><strong>Teacher Dashboard</strong> - Overview of assigned classes and pending deadlines</li>
            <li><strong>Admin Dashboard</strong> - School statistics and system overview</li>
          </ul>

          <h3>13. Multi-School Support</h3>
          <ul>
            <li>Independent databases for each school</li>
            <li>Centralized admin for all schools</li>
            <li>Quick switching between schools</li>
          </ul>

          <hr />

          <h2>Key Benefits</h2>

          <h3>For Teachers</h3>
          <ul>
            <li>Quick and efficient marks entry</li>
            <li>Secure access to assigned classes only</li>
            <li>Easy marks revision before deadline</li>
            <li>Mobile app for on-the-go access</li>
            <li>Clear deadline tracking</li>
          </ul>

          <h3>For School Administrators</h3>
          <ul>
            <li>Complete school oversight and control</li>
            <li>All marks visible across entire school</li>
            <li>Deadline management and enforcement</li>
            <li>Easy class access without teacher passwords</li>
            <li>Comprehensive reporting and analytics</li>
            <li>Multi-school management capability</li>
          </ul>

          <h3>For Learners & Parents</h3>
          <ul>
            <li>Access to exam results and performance</li>
            <li>Progress tracking over time</li>
            <li>Performance reports and analytics</li>
          </ul>

          <h3>For School Leadership</h3>
          <ul>
            <li>Performance analytics and trends</li>
            <li>Stream comparison reports</li>
            <li>Quality assurance capabilities</li>
            <li>Data-driven decision making</li>
          </ul>

          <hr />

          <h2>Technical Specifications</h2>

          <h3>Technology Stack</h3>
          <ul>
            <li><strong>Frontend:</strong> Next.js 16, React 19, TypeScript, Tailwind CSS</li>
            <li><strong>Backend:</strong> Next.js Server Components, Node.js</li>
            <li><strong>Database:</strong> Supabase (PostgreSQL)</li>
            <li><strong>Storage:</strong> Vercel Blob for file storage</li>
            <li><strong>Authentication:</strong> Supabase Auth, Custom session management</li>
            <li><strong>Deployment:</strong> Vercel</li>
          </ul>

          <h3>Browser Support</h3>
          <ul>
            <li>Modern browsers (Chrome, Firefox, Safari, Edge)</li>
            <li>Mobile browsers on iOS and Android</li>
            <li>PWA support on compatible devices</li>
          </ul>

          <h3>Performance</h3>
          <ul>
            <li>Real-time data updates</li>
            <li>Optimized queries and caching</li>
            <li>Fast mark entry with instant validation</li>
            <li>Responsive design for all screen sizes</li>
          </ul>

          <hr />

          <h2>Deployment & Availability</h2>

          <table>
            <tbody>
              <tr>
                <td><strong>System Status</strong></td>
                <td>Live and operational</td>
              </tr>
              <tr>
                <td><strong>URL</strong></td>
                <td>https://shule-tech-exams.vercel.app</td>
              </tr>
              <tr>
                <td><strong>Uptime</strong></td>
                <td>99.9% SLA</td>
              </tr>
              <tr>
                <td><strong>Scalability</strong></td>
                <td>Supports unlimited schools and users</td>
              </tr>
              <tr>
                <td><strong>Backup</strong></td>
                <td>Automated daily backups</td>
              </tr>
            </tbody>
          </table>

          <hr />

          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 mt-8">
            <p className="text-sm text-gray-700">
              <strong>For more information:</strong> This document provides a complete overview of all products and services offered by the School Exam Management System. For specific feature details or implementation inquiries, please contact the development team.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
