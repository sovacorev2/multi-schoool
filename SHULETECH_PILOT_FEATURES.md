# ShuleTech Pilot Features - Isolation Guarantee

## Overview
The following features were implemented as a pilot for **ShuleTech school only** and are completely isolated from other schools:

## Pilot Features

### 1. PIN-Based Teacher Login
- **Status**: Pilot for ShuleTech only
- **Guard**: `enable_pin_login` flag in `schools` table
- **Implementation**: Only enabled when `enable_pin_login = true` for the school
- **Location**: Admin Portal → Teachers & Assignments tab (conditionally rendered)
- **Impact on Other Schools**: None - feature completely hidden if flag is false

### 2. Unified Teachers & Assignments Management
- **Status**: Pilot for ShuleTech only
- **Component**: `TeachersUnified` component
- **Guard**: Wrapped in `{pinLoginEnabled && <TeachersUnified />}`
- **Functionality**:
  - Create and manage teacher accounts with auto-generated PINs
  - Assign teachers to multiple classes and subjects
  - Send email notifications with PIN + assignments
  - Real-time assignment tracking
- **Impact on Other Schools**: None - only accessible if pin-accounts tab is visible

### 3. Email Notifications
- **Status**: Pilot for ShuleTech only
- **Service**: Resend API
- **Trigger**: "Notify Teacher" button in Teachers & Assignments tab
- **Data**: Teacher PIN + all assigned classes/subjects
- **Env Var**: `RESEND_API_KEY`
- **Impact on Other Schools**: None - only triggered for ShuleTech

### 4. Teacher Assignments & PIN Login Integration
- **Status**: Pilot for ShuleTech only
- **Tables**: 
  - `teacher_accounts` (only queried when `enable_pin_login = true`)
  - `teacher_assignments` (only queried when `enable_pin_login = true`)
- **Guard**: All queries filtered by `school_id` and guarded by `enable_pin_login` flag
- **Impact on Other Schools**: None - completely isolated by school context

## Code Isolation Strategy

### Admin Portal (`app/admin-portal/page.tsx`)
```typescript
// Line 284: Load enable_pin_login setting
supabase.from('schools').select('enable_pin_login').eq('id', currentSchool.id).single()

// Line 295: Set state based on school setting
setPinLoginEnabled(schoolRes.data.enable_pin_login === true)

// Line 1045: Conditionally render tab trigger
{pinLoginEnabled && (
  <TabsTrigger value="pin-accounts">...</TabsTrigger>
)}

// Line 1575: Conditionally render tab content
{pinLoginEnabled && (
  <TeachersUnified schoolId={currentSchool?.id || ''} schoolName={currentSchool?.name || ''} />
)}
```

### Data Access
All data operations are scoped to:
1. `currentSchool?.id` - Only access that school's data
2. `pinLoginEnabled` check - Only when feature is enabled
3. School context - All pages use `useSchool()` hook

## Other Schools Impact

- **No new tables used**: Existing tables (`teacher_accounts`, `teacher_assignments`) only queried when `enable_pin_login = true`
- **No global changes**: All features are school-scoped
- **No UI changes**: Other schools see standard interface unchanged
- **No database changes**: Features are completely opt-in via `enable_pin_login` flag

## Enabling Feature for Other Schools

To enable this pilot for another school:
1. Set `enable_pin_login = true` in the `schools` table for that school
2. Teachers & Assignments tab will automatically appear
3. All features will work with that school's data

To disable for ShuleTech:
1. Set `enable_pin_login = false` in the `schools` table
2. Teachers & Assignments tab will disappear
3. All data remains intact in database

## Feature Status Per School

- **ShuleTech**: Pilot features enabled (`enable_pin_login = true`)
- **Other Schools**: Pilot features disabled (`enable_pin_login = false` or not set)
