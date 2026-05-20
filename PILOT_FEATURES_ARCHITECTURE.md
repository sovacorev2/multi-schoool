# Pilot Features Architecture - Complete System

## Overview
The pilot features system enables advanced exam management capabilities for schools. Originally piloted in ShuleTech, now available for ANY school via super admin toggle.

## Complete Feature Set (What ShuleTech Has)

### 1. PIN Management & Teacher Identification
- **Location**: Admin portal password → PIN entry screen
- **Files**: app/admin-portal/page.tsx
- **Features**:
  - Two-factor auth: Password + PIN
  - PIN validated against teacher_accounts table
  - Audit logs track which teacher (by PIN) accessed what
  - Full accountability trail

### 2. Subject-Level Access Control
- **Location**: Marks & Subjects pages
- **Files**: app/dashboard/marks/page.tsx, app/dashboard/subjects/page.tsx
- **Features**:
  - Teachers only see subjects assigned to them
  - Assigned subjects: Full opacity, fully editable
  - Non-assigned subjects: Greyed out (40% opacity), disabled
  - Access controlled via teacher_assignments table
  - Backend validation prevents unauthorized edits

### 3. Teachers & Assignments (T&A) Tab
- **Location**: Admin portal after authentication
- **Files**: app/admin-portal/page.tsx (lines 1577+)
- **Features**:
  - Manage teacher-subject assignments per class
  - Add/remove teacher assignments
  - View which teachers can edit which subjects
  - Audit trail of all changes

### 4. Advanced Audit Logging
- **Location**: Admin portal > Audit Logs tab
- **Files**: app/admin-portal/page.tsx (Audit Logs section)
- **Features**:
  - Track ALL actions: marks submitted, sessions created, locking events
  - Shows: Teacher PIN, Action, Details, Timestamp
  - Simple, admin-friendly display format
  - Integrates with all other features

### 5. Unified Teacher UI (Modern Cards)
- **Location**: Admin portal > Teachers section
- **Files**: app/admin-portal/page.tsx
- **Features**:
  - Modern card-based layout for teacher management
  - Gradient buttons with hover effects
  - PIN display for teacher identification
  - Class assignments shown in teacher cards

### 6. Session Management
- **Location**: Marks page
- **Files**: app/dashboard/marks/page.tsx
- **Features**:
  - Create exam sessions per class
  - Auto-lock sessions based on deadline
  - PIN tracking on session creation
  - Audit log entries for all session changes

## Database Tables Involved
- `schools` - feature_pin_management flag
- `teacher_accounts` - PIN storage
- `teacher_assignments` - Subject assignment mapping
- `activity_logs` - Audit trail
- `exam_sessions` - Session management
- `classes` - Class structure
- `subjects` - Subject definitions
- `marks` - Marks records

## How It's Toggled

### Current System
- `PILOT_SCHOOLS` list in lib/shuletech-features.ts
- Only schools in list get features
- St James + ShuleTech hardcoded

### New System
- Super admin can toggle `feature_pin_management` for ANY school
- When enabled: All pilot features activate automatically
- When disabled: Reverts to standard system
- Per-school control in super admin dashboard

## Code Pattern: How Features Are Activated
```tsx
// Check if pilot features are enabled
const isShuleTechSchool_ = isShuleTechSchool(schoolName);

// Or check feature flag
const isPinEnabled = school.feature_pin_management === true;

// Conditionally render/enable features
{isShuletech && (
  <div>Subject Access Control & Audit Logs</div>
)}
```

## Replication Checklist
✓ PIN Management (admin portal + password → PIN flow)
✓ Subject-Level Access Control (marks & subjects pages)
✓ Teachers & Assignments Tab (admin portal)
✓ Audit Logging (activity_logs table + display)
✓ PIN Entry Screen UI (modern, professional)
✓ Feature toggle in super admin (per-school basis)
✓ All data remains intact when toggling features

## To Apply to a New School
1. Super admin clicks "Enable Pilot Features" for school
2. Sets feature_pin_management = true in database
3. All conditional logic automatically activates
4. School gets full ShuleTech architecture
5. All existing school data preserved

## Files That Reference Pilot Features
- app/dashboard/marks/page.tsx - Subject access control
- app/dashboard/subjects/page.tsx - Subject filtering  
- app/admin-portal/page.tsx - PIN auth, T&A tab, Teachers card UI, Audit logs
- lib/shuletech-features.ts - Feature detection
- Database migrations - feature_pin_management column
