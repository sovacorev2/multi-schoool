# ShuleTech PIN Login System - Complete Testing Guide

## System Overview
ShuleTech has implemented a secure PIN-based teacher access system for Grades 4-9. Teachers use a shared **Welcome Password** + unique **4-digit PIN** to access only their assigned classes/subjects.

## Database Structure

### teacher_accounts Table
- `id`: Unique teacher ID
- `school_id`: School identifier (ShuleTech only)
- `first_name`: Teacher's first name
- `last_name`: Teacher's last name
- `email`: Teacher email address
- `pin`: Unique 4-digit PIN code
- `is_active`: Boolean (true/false)
- `created_at`: Registration timestamp

### teacher_assignments Table
- `id`: Assignment ID
- `school_id`: School identifier
- `teacher_id`: Reference to teacher_accounts
- `class_id`: Reference to classes table
- `subject_id`: Reference to subjects table (NULL = teaches all subjects)
- `is_active`: Boolean
- `created_at`: Assignment creation timestamp

## Admin Portal Workflow

### Step 1: Register Teachers (PIN Accounts Tab)
1. Go to Admin Portal → PIN Accounts tab
2. Click "Register New Teacher"
3. Fill in:
   - First Name: e.g., "John"
   - Last Name: e.g., "Ochieng"
   - Email: e.g., "john@shuletech.com"
4. Click "Create Account & Send Email"
5. System generates unique 4-digit PIN (e.g., 2749)
6. Email sent to teacher from shuletech1@gmail.com

**Email Content:**
- PIN code highlighted prominently
- Login instructions (Welcome Password + PIN)
- Security reminders
- Support contact information

### Step 2: Assign Teachers (Assignments Tab)
1. Go to Admin Portal → Assignments tab
2. Click "Assign Teacher to Class"
3. Fill in:
   - Select Teacher: Choose from dropdown
   - Select Class: Choose from dropdown (Grade 4, 5, etc.)
   - Subject (Optional):
     - Leave blank = Teacher teaches ALL subjects in class
     - Select subject = Teacher teaches ONLY that subject
4. Click "Create Assignment"
5. Assignment appears in table below

**Examples:**
- John Ochieng → Grade 5A → (blank) = teaches all subjects in Grade 5A
- Jane Smith → Grade 6B → Mathematics = teaches only Math in Grade 6B

## Teacher Login Workflow

### Teacher Login Page (/teacher-pin-login)
1. Select School: "SHULE TECH"
2. Enter Welcome Password: **(School admin password - shared with all teachers)**
3. Enter PIN: 4-digit personal PIN
4. Click Login

**After Successful Login:**
- Teacher dashboard loads
- Session stored with:
  - teacher_id
  - assigned classes
  - assigned subjects
  - login timestamp

## Marks Table Access Control (Next Implementation)

### What Teachers See:
✓ **Assigned Classes**: Full access (editable)
✓ **Assigned Subjects**: Full access (editable)
✗ **Non-Assigned Subjects**: Greyed out (read-only)
✗ **Other Teachers' Classes**: Hidden/blocked

### Example:
```
Grade 5A Marks Sheet
[Math]        ← Editable (assigned)
[English]     ← Editable (assigned)
[Science]     ← Greyed out (not assigned)
[PE]          ← Greyed out (not assigned)
```

## Testing Checklist

### Phase 1: Admin Portal
- [ ] PIN Accounts tab visible (green highlight)
- [ ] Assignments tab visible (blue highlight)
- [ ] Register teacher form accepts: First Name, Last Name, Email
- [ ] System generates unique 4-digit PIN
- [ ] PIN displays in bold monospace font
- [ ] Copy PIN button works
- [ ] Pin shows in registered teachers table
- [ ] Assign Teacher form appears
- [ ] Can select teacher from dropdown
- [ ] Can select class from dropdown
- [ ] Subject field optional (leave blank for all subjects)
- [ ] Create assignment button works
- [ ] Assignments show in table
- [ ] Can delete teacher account
- [ ] Can delete assignment

### Phase 2: Email Notifications
- [ ] Email sent to teacher address
- [ ] Sent from shuletech1@gmail.com
- [ ] PIN prominently displayed
- [ ] Login instructions clear
- [ ] Includes teacher name and school name

### Phase 3: Teacher Login
- [ ] PIN Accounts tab visible in admin
- [ ] /teacher-pin-login page accessible
- [ ] School dropdown populated
- [ ] Welcome password field working
- [ ] PIN field accepts 4 digits only
- [ ] Login validates both welcome password and PIN
- [ ] Error message for invalid PIN
- [ ] Error message for invalid password
- [ ] Session stored in localStorage
- [ ] Redirect to teacher dashboard on success

### Phase 4: Access Control (Coming)
- [ ] Teacher dashboard shows assigned classes only
- [ ] Subject selection shows assigned subjects only
- [ ] Non-assigned subjects greyed out
- [ ] Cannot edit marks for non-assigned subjects
- [ ] Cannot access other teacher's marks

## Configuration

### Welcome Password
- Set in Admin Portal → Settings
- Shared with all teachers at that school
- Example: "Shule@2024"
- Teachers use this + their PIN to login

### School Setting
- School must have `enable_pin_login = TRUE`
- ShuleTech ID: 829b7928-84d0-4bd6-8cb2-8e424412ebc9
- PIN Accounts tab only shows if enabled

## Troubleshooting

### PIN Login Page Not Showing
- Check if school has `enable_pin_login = TRUE`
- Verify school ID in database

### No Teachers Appearing in Dropdown
- Check if teacher accounts created in PIN Accounts tab
- Verify teacher `is_active = TRUE`

### Email Not Received
- Check teacher email address
- Currently logs to console (needs email service integration)
- Will use Resend/SendGrid in production

### Cannot Create Assignment
- Both teacher and class must exist
- Check dropdowns are properly populated

### Marks Not Editable
- Check if teacher has assignment for that class/subject
- Verify teacher logged in with PIN

## Next Steps

1. **Integrate Email Service**: Connect to Resend/SendGrid for actual email delivery
2. **Implement Marks Access Control**: Grey out non-assigned subjects
3. **Add Permission Checks**: Prevent editing other teachers' marks
4. **Test with Real Teachers**: Create actual teacher accounts and test login
5. **Monitor Assignments**: View analytics of teacher access

## Security Notes

- PIN is 4-digit unique code (10,000 combinations)
- Welcome password is shared but changes per school
- PIN + Password combo prevents unauthorized access
- Each teacher account linked to specific classes/subjects
- Session stored in localStorage (teacher-side only)
- Database enforces school isolation with school_id foreign key

