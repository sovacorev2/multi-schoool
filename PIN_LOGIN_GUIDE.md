# Teacher PIN-Based Login System - Complete Guide

## Overview

Instead of teachers remembering email + password combinations, the system uses a simpler 2-step approach:
1. **Welcome Password** (shared across all teachers at a school)
2. **Unique 4-Digit PIN** (individual to each teacher)

This is more practical for primary schools and reduces password fatigue.

---

## How It Works

### Step 1: Admin Creates Teacher Account

**Location:** `/admin/dashboard/teacher-accounts`

1. Admin fills in:
   - First Name
   - Last Name
   - Email (where PIN will be sent)
   - Welcome Password (shared password for all teachers at school)

2. System automatically:
   - Generates unique 4-digit PIN (e.g., 2749)
   - Sends welcome email with:
     - PIN code
     - Classes assigned
     - Subjects assigned
     - Login instructions
     - Security warnings

### Step 2: Admin Assigns Classes & Subjects

**Location:** `/admin/dashboard/teacher-assignments`

1. Select teacher
2. Select classes they teach
3. Select subjects (leave empty for "all subjects")
4. Save assignment

### Step 3: Teacher Receives Email

Email contains:
```
Your PIN: 2749

Classes & Subjects Assigned:
- Grade 5: Mathematics, English
- Grade 6: Mathematics

Login Instructions:
1. Go to teacher portal
2. Select your school
3. Enter welcome password
4. Enter your PIN: 2749
5. Click Login
```

### Step 4: Teacher Logs In

**URL:** `/teacher-pin-login`

1. Select school
2. Enter welcome password (e.g., "Welcome123")
3. Enter their 4-digit PIN (e.g., "2749")
4. System verifies and loads their assignments
5. Redirected to `/teacher/dashboard`

---

## Admin Interface Details

### Teacher Accounts Page (`/admin/dashboard/teacher-accounts`)

**What You See:**
- Table of all teachers
- Name, Email, PIN code, Status, Created date
- PIN displayed prominently (not hidden)
- Admin can see all PINs to assist teachers if they forget

**Actions:**
- Delete teacher account
- PIN is auto-generated and shown after creation

**Form Fields:**
- **First Name** (required)
- **Last Name** (optional)
- **Email** (where welcome email is sent)
- **Welcome Password** (minimum 6 characters)
  - This is shared across all teachers
  - All teachers use the same welcome password
  - Example: "School2024" or "Welcome123"

**Success Message Example:**
```
✅ Teacher account created for John Ochieng. 
Sent PIN 2749 to john@example.com
```

### Teacher Assignments Page (`/admin/dashboard/teacher-assignments`)

**How to assign:**

**For Lower Primary (PP1-Grade 3 - 1 teacher, all subjects):**
1. Select teacher: "Grace Kamau"
2. Select class: "Grade 3A"
3. Leave subject empty (means all subjects)
4. Save

Result: Grace can edit ALL marks in Grade 3A

**For Upper Primary (Grade 4-8 - specialist teachers):**
1. Select teacher: "Mr. Ochieng"
2. Select class: "Grade 5"
3. Select subject: "Mathematics"
4. Save
5. Repeat for Grade 6 Mathematics, Grade 7 Mathematics, etc.

Result: Mr. Ochieng can edit Math in Grades 5, 6, 7 only

---

## Teacher Login Flow

### Login Page (`/teacher-pin-login`)

**Step 1: Select School**
- Dropdown shows all schools
- Teacher selects their school

**Step 2: Enter Welcome Password**
- Same password for all teachers at that school
- Provided by admin or posted in staff room
- Example: "Welcome123" or "SchoolName2024"

**Step 3: Enter 4-Digit PIN**
- Unique to each teacher
- Found in welcome email
- Example: "2749"
- Cannot be empty or wrong format

**Step 4: Login**
- System verifies PIN against teacher_accounts table
- Confirms password matches
- Checks teacher is active
- Loads all assignments from teacher_assignments table
- Creates session in localStorage
- Redirects to teacher dashboard

### Teacher Dashboard (`/teacher/dashboard`)

Shows:
- Teacher name: "Welcome, John Ochieng!"
- Assigned classes
- Assigned subjects in each class
- Quick action buttons:
  - View marklist
  - Edit marks
  - View reports
- Logout button

---

## Email System

### Welcome Email Contents

The system sends an HTML email with:

1. **Header with School Name**
   - "Welcome to ShuleTech [School Name]!"

2. **Teacher's PIN (Prominent)**
   ```
   Your 4-digit PIN code:
   2749
   ```

3. **Login Instructions**
   - Step-by-step guide
   - Welcome password
   - PIN number
   - Where to log in

4. **Assigned Classes & Subjects**
   - Table showing all assignments
   - Subjects listed per class

5. **Security Warning**
   - ⚠️ Do NOT share your PIN
   - ⚠️ Do NOT lose your PIN
   - If forgot, contact admin
   - PIN protects learner data

6. **Footer**
   - "This email contains sensitive information"
   - School name and date sent

### Email Implementation

Currently configured to:
- Log email details to console
- Ready for integration with:
  - Resend (recommended)
  - SendGrid
  - Mailgun
  - AWS SES
  - Any SMTP service

**To activate email sending:**
1. Choose email service (Resend recommended)
2. Add API key to environment variables
3. Update `/lib/email-service.ts` with actual email sending code

---

## Database Structure

### teacher_accounts Table

```sql
id (UUID)
school_id (references schools)
email (VARCHAR)
password (VARCHAR) -- Welcome password
first_name (VARCHAR)
last_name (VARCHAR)
pin (VARCHAR(4)) -- Unique 4-digit PIN
email_sent (BOOLEAN) -- Track if welcome email was sent
is_active (BOOLEAN)
created_at (TIMESTAMP)
```

### teacher_assignments Table

```sql
id (UUID)
school_id (references schools)
user_id (UUID) -- references teacher_accounts.id
class_id (references classes)
subject_id (references subjects) -- NULL = all subjects
assigned_at (TIMESTAMP)
is_active (BOOLEAN)
created_at (TIMESTAMP)
```

---

## PIN Management

### Reset PIN

If teacher forgets PIN:

1. Admin goes to `/admin/dashboard/teacher-accounts`
2. Finds teacher in list
3. Sees their current PIN
4. Can share PIN over phone/in person (securely)
5. Or delete account and create new one with new PIN

### Generate New PIN

To force a PIN change:
1. Delete teacher account
2. Create new account with same details
3. New PIN generated automatically
4. New welcome email sent

---

## Security Considerations

### PIN Security

✅ **4-digit PIN provides:**
- Simplicity for teachers to remember
- Personal identifier (teacher-specific)
- Pairing with welcome password adds security layer
- Unique per teacher (prevents sharing)

⚠️ **Admin responsibilities:**
- Keep PIN list confidential
- Don't share PIN via email (it's in welcome email)
- Teach teachers NOT to share PIN
- If PIN shared, reset immediately

### Password Security

✅ **Welcome Password features:**
- Shared across school (reduces complexity)
- Minimum 6 characters required
- Combined with PIN makes login secure
- Not stored individually per teacher

### Access Control

After login, the system:
- Checks teacher's assignments
- Only shows assigned classes
- Only allows editing of assigned subjects
- Logs all access (preparation for audit)

---

## Troubleshooting

### Teacher Forgot PIN

**Solution:**
1. Admin locates teacher in `/admin/dashboard/teacher-accounts`
2. Reads PIN from admin portal table
3. Tells teacher the PIN
4. Or resets account + sends new PIN via email

### Teacher Enters Wrong PIN

**Message:** "Invalid PIN or teacher not found. Please check and try again."

**Solutions:**
- Check spelling of PIN (look at email)
- Check using correct school
- Contact admin if PIN unclear

### Wrong Welcome Password

**Message:** "Incorrect welcome password"

**Solutions:**
- Check if password is case-sensitive
- Ask another teacher for password
- Check staff room notice board
- Contact admin

### Email Not Received

**Solutions:**
1. Check spam/junk folder
2. Check email address is correct
3. Ask admin to verify email in system
4. Admin can resend email or share PIN directly

---

## Best Practices

### For School Admins

1. **Password Management**
   - Use strong, memorable welcome password
   - Example: "SchoolName2024" not "123456"
   - Change password each school year (optional)

2. **Teacher Setup**
   - Assign classes/subjects immediately after account creation
   - Send welcome email before teacher first login
   - Keep printed copy of teacher-PIN list (secured)

3. **Ongoing**
   - Monitor login access
   - Reset account if teacher leaves
   - Support teachers who forget PIN

### For Teachers

1. **Login**
   - Save welcome password in safe place
   - Keep PIN confidential
   - Don't share account with others

2. **Daily Use**
   - Log in each time (don't share account)
   - Log out after entering marks
   - Protect PIN like a password

3. **If Issues**
   - Contact school admin (don't try to guess)
   - Keep welcome email with PIN
   - Don't share PIN with anyone

---

## Integration Checklist

- [ ] Teacher accounts created in admin panel
- [ ] Welcome password decided and set
- [ ] Teachers assigned to classes/subjects
- [ ] Email service configured (if sending real emails)
- [ ] Welcome email template tested
- [ ] Teacher login page tested with sample account
- [ ] PIN generation verified (4 digits)
- [ ] Permission checks implemented in marklist
- [ ] Teachers can log in and see assignments
- [ ] Teachers can edit only assigned marks
- [ ] Non-assigned marks are read-only with lock icon

---

## Next Steps

1. **Integrate Permission Checks** - Update marklist page to:
   - Check teacher's assignments on load
   - Lock marks teacher cannot edit
   - Show visual indicators (lock icons)
   - Prevent form submission if unauthorized

2. **Activate Email Service** - Configure:
   - Email API (Resend, SendGrid, etc.)
   - Add credentials to environment
   - Test welcome email sending

3. **Train School Admins** - Show how to:
   - Create teacher accounts
   - Assign classes/subjects
   - Reset PINs
   - Support teachers

4. **Onboard Teachers** - Provide:
   - Login URL
   - Welcome password
   - Where to find their PIN
   - How to report issues
