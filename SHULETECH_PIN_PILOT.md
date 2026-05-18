# ShuleTech PIN-Based Login - Pilot Implementation

## Overview

This document outlines the ShuleTech pilot implementation of PIN-based teacher authentication. This is a **multi-tenant safe** deployment that does not affect other schools' operations.

## Pilot Status

**Status:** ACTIVE PILOT (ShuleTech only)
**Enabled Date:** 2026-05-18
**Feature Flag:** `schools.enable_pin_login = TRUE` for ShuleTech only

## What Changed

### Database
- `schools` table: Added `enable_pin_login` (BOOLEAN) and `pin_login_enabled_at` (TIMESTAMP)
- `teacher_accounts` table: Added `pin` (VARCHAR 4) and `email_sent` (BOOLEAN)
- All other data remains unchanged for other schools

### Features Enabled for ShuleTech Only

1. **PIN Login Page** (`/teacher-pin-login`)
   - Only shows schools with `enable_pin_login = TRUE`
   - Currently only ShuleTech

2. **Teacher Account Creation with PIN**
   - Admin creates teacher at `/admin/dashboard/teacher-accounts`
   - System auto-generates unique 4-digit PIN
   - PIN displayed to admin for reference

3. **Email Notifications**
   - Welcome email with PIN sent to teacher
   - Shows assigned classes/subjects
   - Security warning included

4. **Teacher Assignments**
   - Link teachers to specific classes/subjects
   - Already implemented at `/admin/dashboard/teacher-assignments`

### Features NOT Affected (Other Schools)

✓ Class-based authentication (still works)
✓ Existing teacher login flow
✓ All mark entry functionality
✓ Exam sessions and comparisons
✓ Report generation
✓ All other school operations

## How It Works

### For ShuleTech Admins

1. Visit `/admin/dashboard/teacher-accounts`
2. Notice blue banner: "✓ PIN-Based Login Enabled"
3. Click "Add New Teacher Account"
4. Enter: First Name, Last Name, Email, Welcome Password
5. System creates account with auto-generated PIN
6. Admin can see PIN in the table
7. Email with PIN is sent to teacher automatically

### For ShuleTech Teachers

1. Visit `/teacher-login-selection`
2. See "PIN-BASED LOGIN (NEW)" for ShuleTech
3. Click ShuleTech card
4. Enter: Welcome Password + 4-digit PIN + School
5. System validates both credentials
6. Session created with teacher's assignments
7. Access only their assigned classes/subjects

### For Other School Admins

1. Visit `/admin/dashboard/teacher-accounts`
2. Notice amber banner: "ℹ PIN-Based Login Not Enabled"
3. System works as normal
4. No PIN field visible in form or table
5. All existing functionality preserved

## Data Isolation

**ShuleTech Data:**
- `teacher_accounts.pin` - Only ShuleTech teachers get PINs
- `teacher_assignments.school_id = ShuleTech ID` - Only ShuleTech assignments
- `schools.enable_pin_login = TRUE` - Only ShuleTech

**Other Schools:**
- No PIN fields accessed
- `enable_pin_login = FALSE` by default
- All existing authentication flows unchanged
- All data completely intact

## Security Measures

1. **Feature Flag Check**
   - PIN login page only shows `enable_pin_login = TRUE` schools
   - Admin UI shows status per school
   - Other schools cannot access PIN features

2. **Unique PIN Generation**
   - 4-digit random PIN (0000-9999)
   - Unique per teacher within school
   - Cannot be blank or duplicate

3. **Dual Authentication**
   - PIN + Welcome Password both required
   - Shared password across school for simplicity
   - PIN unique to each teacher

4. **Email Verification**
   - PIN sent to teacher's email
   - Prevents unauthorized access
   - Clear security instructions in email

## Login Flow Diagrams

### Teacher Login Selection
```
visit /teacher-login-selection
    ↓
fetch schools (with enable_pin_login flag)
    ↓
ShuleTech shown with PIN option (blue card)
Other schools shown with standard option (gray card)
    ↓
click ShuleTech → go to /teacher-pin-login
click other → go to /
```

### ShuleTech PIN Login
```
visit /teacher-pin-login
    ↓
select school (only PIN-enabled schools shown)
    ↓
enter Welcome Password + PIN
    ↓
verify against teacher_accounts table
    ↓
load teacher_assignments for that teacher
    ↓
create session with permissions
    ↓
redirect to /teacher/dashboard
```

### Admin Panel
```
/admin/dashboard/teacher-accounts
    ↓
check if school.enable_pin_login = TRUE
    ↓
if TRUE:
  - show "✓ PIN-Based Login Enabled" banner
  - show PIN column in table
  - accept Welcome Password field
  - send PIN via email
    
if FALSE:
  - show "ℹ PIN-Based Login Not Enabled" banner
  - PIN fields hidden
  - standard workflow continues
```

## Testing Checklist

- [ ] ShuleTech: PIN login page works
- [ ] ShuleTech: PIN is sent in email
- [ ] ShuleTech: PIN + password login works
- [ ] ShuleTech: Only assigned classes/subjects visible
- [ ] ShuleTech: Admin can see PIN in table
- [ ] Other Schools: No PIN fields visible in admin
- [ ] Other Schools: Standard login still works
- [ ] Other Schools: No PIN data created for their teachers
- [ ] All Schools: Class/subject/student data unchanged
- [ ] All Schools: Exam data unchanged
- [ ] All Schools: Report generation unchanged

## Rolling Out to Other Schools

When ready to enable for another school:

```sql
UPDATE schools 
SET enable_pin_login = TRUE, 
    pin_login_enabled_at = NOW()
WHERE id = 'school_uuid_here';
```

Then:
1. New teacher accounts will get PIN
2. PIN login will appear as option
3. All existing data preserved
4. Can be reverted anytime

## Reverting the Feature

If issues arise with ShuleTech:

```sql
UPDATE schools 
SET enable_pin_login = FALSE
WHERE id = '829b7928-84d0-4bd6-8cb2-8e424412ebc9';
```

Result:
- PIN login page won't show ShuleTech
- Existing teacher_accounts data preserved
- Teachers can still use existing login
- Can re-enable anytime

## Support

For issues with ShuleTech PIN login, check:

1. Database: `SELECT enable_pin_login FROM schools WHERE name = 'SHULE TECH'`
   - Should return `TRUE`

2. Teacher Account: `SELECT id, pin, is_active FROM teacher_accounts WHERE school_id = ShuleTech_ID`
   - Should show PIN for each teacher

3. Assignments: `SELECT * FROM teacher_assignments WHERE school_id = ShuleTech_ID`
   - Should show class/subject assignments

4. Email Sending: Check if `/api/send-teacher-email` is called on account creation

## Next Steps

1. ✓ Enable PIN login for ShuleTech
2. ✓ Create teacher accounts with PIN
3. ✓ Assign teachers to classes/subjects
4. → Test PIN login with actual teachers
5. → Integrate permission checks in marklist
6. → Monitor for 1-2 weeks
7. → Evaluate results
8. → Decide on rollout to other schools
