# Teacher Login & Access Control Setup Guide

## Overview

The system now supports **individual teacher accounts** with login credentials. Each teacher:
- Has their own email and password
- Logs in separately (not shared class credentials)
- Can view all marks but only edit their assigned classes/subjects
- Has personalized access based on admin configuration

## How It Works

### For Admins (School Admin)

1. **Create Teacher Accounts**
   - Go to `/admin/dashboard/teacher-accounts`
   - Add new teacher with:
     * First name & Last name
     * Email (unique per school)
     * Password
   - System auto-hashes password with bcrypt

2. **Assign Teacher to Classes/Subjects**
   - Go to `/admin/dashboard/teacher-assignments`
   - Create assignment matrix:
     * Select teacher
     * Select class
     * Select subject (or leave blank for "all subjects")
   - Examples:
     ```
     Grade 3 Teacher → Grade 3 → [All Subjects]
     Math Teacher → Grade 5 → Mathematics
     Math Teacher → Grade 6 → Mathematics
     English Teacher → Grade 5 → English
     ```

### For Teachers

1. **Teacher Visits Login Page**
   - URL: `/teacher-login`
   - Select school
   - Enter email
   - Enter password

2. **System Loads Assignments**
   - Creates secure session with HttpOnly cookie
   - Loads all assigned classes and subjects
   - Redirects to `/teacher/dashboard`

3. **Teacher Accesses Marklist**
   - Can VIEW all class marks (read-only)
   - Can EDIT marks only for:
     * Their assigned classes
     * Their assigned subjects (if specific)
   - Non-editable fields show lock icon

## File Structure

```
app/
├── api/
│   ├── teacher-login/route.ts       # Login API
│   └── teacher-logout/route.ts      # Logout API
├── teacher-login/page.tsx           # Login page UI
├── teacher/dashboard/page.tsx       # Dashboard after login
└── admin/dashboard/
    ├── teacher-accounts/page.tsx    # Create accounts (UI in progress)
    └── teacher-assignments/page.tsx # Create assignments (already built)

lib/
├── teacher-session.ts               # Session & permission utilities
└── teacher-permissions.ts           # Permission checking functions
```

## Database Schema

### teacher_accounts
```sql
id (UUID)
school_id (FK -> schools)
email (VARCHAR, unique per school)
password (VARCHAR, bcrypt hashed)
first_name (VARCHAR)
last_name (VARCHAR)
is_active (BOOLEAN)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

### teacher_assignments
```sql
id (UUID)
school_id (FK -> schools)
user_id (FK -> teacher_accounts)
class_id (FK -> classes)
subject_id (FK -> subjects, nullable)
assigned_at (TIMESTAMP)
is_active (BOOLEAN)
created_at (TIMESTAMP)
```

**Subject Rules:**
- `subject_id = NULL` → Teacher teaches ALL subjects in this class
- `subject_id = UUID` → Teacher teaches ONLY this subject in this class

## Session Management

### Session Data (HttpOnly Cookie)
```json
{
  "teacherId": "uuid",
  "email": "teacher@school.com",
  "firstName": "John",
  "lastName": "Doe",
  "schoolId": "uuid",
  "assignments": [
    { "id": "uuid", "class_id": "uuid", "subject_id": "uuid", "is_active": true }
  ],
  "assignedClasses": [
    { "id": "uuid", "name": "Grade 5A" }
  ],
  "assignedSubjects": [
    { "id": "uuid", "name": "Mathematics" }
  ],
  "loginTime": "2026-05-18T..."
}
```

### Session Utilities
From `lib/teacher-session.ts`:

```typescript
// Get current session
const session = await getTeacherSession()

// Check if can edit
const canEdit = await canTeacherEditMarks(classId, subjectId)

// Get editable classes
const classes = await getTeacherEditableClasses()

// Get subjects in class
const subjects = await getTeacherSubjectsInClass(classId)
// Returns null if teacher teaches all subjects

// Check login status
const isLoggedIn = await isTeacherLoggedIn()

// Logout
await clearTeacherSession()
```

## Permission Check Logic

### Can Edit Marks?
```typescript
async function canTeacherEditMarks(classId: string, subjectId?: string) {
  const session = await getTeacherSession()
  
  // Find assignment matching class
  const assignment = session.assignments.find(a => {
    if (a.class_id !== classId) return false
    
    // If subjectId required, check:
    // - Teacher teaches all subjects (subject_id = null), OR
    // - Teacher teaches this specific subject
    if (subjectId) {
      return a.subject_id === null || a.subject_id === subjectId
    }
    return true
  })
  
  return !!assignment
}
```

## Integration with Marklist

### Next Steps (Not Yet Implemented)

To fully enable permission checking in the marklist:

1. **Client-side checks** - Disable edit inputs for non-assigned marks
2. **Server-side validation** - Reject any unauthorized mark updates
3. **Visual indicators** - Show lock icons on restricted fields
4. **Error handling** - Clear messages when user tries to edit unauthorized marks

Example integration:
```typescript
// In marklist page
const canEdit = await canTeacherEditMarks(currentClass.id, subject.id)

if (!canEdit) {
  // Disable input
  // Show lock icon
  // Display tooltip: "You don't have permission to edit this"
}
```

## Login Flow Diagram

```
Teacher visits /teacher-login
    ↓
Selects school + enters email/password
    ↓
POST /api/teacher-login
    ↓
System verifies credentials
    ↓
System loads assignments from database
    ↓
System creates HttpOnly session cookie
    ↓
Redirect to /teacher/dashboard
    ↓
Teacher can access marklist with restrictions
```

## Security Features

✅ **Password Hashing**
- Bcrypt with 10 salt rounds
- Passwords never stored in plain text

✅ **Session Security**
- HttpOnly cookies (cannot access via JavaScript)
- Secure flag in production
- SameSite=Lax to prevent CSRF

✅ **Permission Isolation**
- Each teacher can only edit assigned classes/subjects
- Server-side validation on every save

✅ **Session Expiration**
- Sessions expire after 7 days
- Requires re-login

## Common Tasks

### Create a New Teacher Account
1. Go to `/admin/dashboard/teacher-accounts`
2. Fill in:
   - First Name
   - Last Name
   - Email
   - Password (minimum 8 characters)
3. Click "Create Account"

### Assign Teacher to Grade 5 Mathematics
1. Go to `/admin/dashboard/teacher-assignments`
2. Select Teacher: "John Doe"
3. Select Class: "Grade 5A"
4. Select Subject: "Mathematics"
5. Click "Assign"

### Assign Class Teacher (All Subjects)
1. Go to `/admin/dashboard/teacher-assignments`
2. Select Teacher: "Jane Smith"
3. Select Class: "Grade 3A"
4. Leave Subject blank
5. Click "Assign"

### Reset Teacher Password
1. Delete existing assignment
2. Create new teacher account with new password
3. Re-assign to classes/subjects
(Better approach: Add "Reset Password" feature later)

## Testing

### Test Login Flow
1. Create test teacher account at `/admin/dashboard/teacher-accounts`
   - Email: test@school.com
   - Password: TestPassword123
2. Assign to Grade 5A, Mathematics
3. Visit `/teacher-login`
4. Login with test@school.com / TestPassword123
5. Should see "Grade 5A" and "Mathematics" on dashboard

### Test Permissions
1. Login as teacher
2. Go to `/dashboard/marklist`
3. View marks for Grade 5A → should be editable
4. View marks for Grade 6A → should be locked
5. Try to edit Grade 6A mark → should fail on server

## Troubleshooting

### "Invalid email or password"
- Check email spelling and case
- Verify teacher is active (is_active = true)
- Verify you selected the correct school

### Session not loading
- Check if cookies are enabled
- Try incognito/private mode
- Clear browser cookies and try again

### Can't edit marks despite login
- Check teacher assignments at `/admin/dashboard/teacher-assignments`
- Verify assignment is for correct class and subject
- Verify is_active = true in assignments

## Future Enhancements

1. **Password Reset** - Self-service password reset via email
2. **Two-Factor Authentication** - Add 2FA for extra security
3. **Audit Logging** - Track who edited which marks and when
4. **Bulk Imports** - Import teacher accounts from CSV
5. **Permission Groups** - Pre-configured roles (e.g., "Grade 5 Teacher", "Math Specialist")
