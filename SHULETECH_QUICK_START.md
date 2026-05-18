# ShuleTech PIN Login - Quick Start Guide

## ✅ Status: LIVE PILOT FOR SHULETECH

PIN-based login is now active for **SHULE TECH ONLY**. All other schools remain unaffected.

## For ShuleTech Admin

### Step 1: Create Teacher Account
1. Go to `/admin/dashboard/teacher-accounts`
2. See blue banner: "✓ PIN-Based Login Enabled"
3. Click "Add New Teacher Account"
4. Fill in:
   - First Name: e.g., "John"
   - Last Name: e.g., "Doe"
   - Email: e.g., john@example.com
   - Welcome Password: (shared password, e.g., "ShuleTech2024")
5. Click "Create Account"
6. **PIN is auto-generated and visible in the table** (e.g., 2749)
7. **Email sent to teacher automatically** with PIN + assignments

### Step 2: Assign Classes/Subjects
1. Go to `/admin/dashboard/teacher-assignments`
2. Select the teacher
3. Click "Add Assignment"
4. Select:
   - Class: e.g., "Grade 5"
   - Subject: e.g., "Mathematics" (or "All Subjects" for class teachers)
5. Save

### Step 3: Teacher Receives Email
Teacher gets email with:
- ✓ Their unique PIN (e.g., 2749)
- ✓ Assigned classes
- ✓ Assigned subjects
- ✓ Welcome password
- ✓ Login instructions
- ✓ Warning not to share PIN

## For ShuleTech Teachers

### Login Steps
1. Visit app home page
2. Click "Login as Teacher"
3. Choose "PIN-Based Login (NEW)" → ShuleTech
4. Enter:
   - School: ShuleTech (auto-selected)
   - Welcome Password: (shared, e.g., ShuleTech2024)
   - PIN: (unique 4 digits, e.g., 2749)
5. Click "Login"
6. See dashboard with assigned classes/subjects only

### Important
- PIN is UNIQUE to each teacher
- Welcome password is SHARED across school
- Both are required to login
- Never share your PIN
- Contact admin if PIN is lost

## Data Protection

### What Changed for ShuleTech
✓ Teachers now have individual PINs
✓ Permission system is ready
✓ All data is encrypted

### What Did NOT Change for Other Schools
✓ Standard class password login still works
✓ All their data completely intact
✓ No PIN fields or features visible
✓ Can be enabled later if needed

## Checking If It's Working

### Admin Checklist
- [ ] See blue "✓ PIN-Based Login Enabled" banner in teacher accounts
- [ ] PIN appears in teacher table
- [ ] Email sent notification in success message
- [ ] Teacher assignments page works normally

### Teacher Checklist
- [ ] Received email with PIN
- [ ] Can login with PIN + Welcome Password
- [ ] Only see assigned classes on dashboard
- [ ] Can view marks in marklist

## If Something Goes Wrong

### PIN Lost
- Admin can see PIN in table anytime
- Can share PIN again
- Or delete and recreate account (new PIN)

### Email Not Sent
- Check email service in `/api/send-teacher-email`
- Check if email address is valid
- Check server logs

### Login Fails
- Check PIN is exactly 4 digits
- Check Welcome Password spelling
- Check ShuleTech is selected

### Other Schools Not Working
- If they use standard login: should still work
- If issues: contact support (no changes to their system)

## URLs to Use

| Purpose | URL | For |
|---------|-----|-----|
| Teacher Login | `/teacher-login-selection` | Teachers |
| Admin Accounts | `/admin/dashboard/teacher-accounts` | ShuleTech Admin |
| Admin Assignments | `/admin/dashboard/teacher-assignments` | ShuleTech Admin |
| PIN Login | `/teacher-pin-login` | ShuleTech Teachers |
| Teacher Dashboard | `/teacher/dashboard` | ShuleTech Teachers |

## Important Notes

⚠️ **This is a Pilot**
- Testing phase for ShuleTech
- Collect feedback
- Make improvements
- Then expand to other schools

🔒 **Security**
- Pins are stored securely
- Combined with shared password
- Email-verified
- Session-based access

📊 **Data**
- No data lost or changed
- All existing data preserved
- Can rollback anytime
- Multi-tenant safe

## Support

For any issues:
1. Check SHULETECH_PIN_PILOT.md for detailed docs
2. Review PIN_LOGIN_GUIDE.md for setup details
3. Check database enable_pin_login flag
4. Review email sending API logs
