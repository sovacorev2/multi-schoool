# ShuleTech PIN Login System - Admin Guide

## Overview
This guide explains how to manage the PIN-based teacher login system for ShuleTech school only.

## Two Simple Admin Pages

### 1. Teacher PIN Accounts Management
**Location:** Admin Dashboard → Teacher PIN Accounts (or `/admin/dashboard/teacher-accounts`)

#### What It Does:
- Register teachers with auto-generated 4-digit PINs
- Send welcome emails from shuletech1@gmail.com
- Manage teacher accounts
- Resend emails if needed
- Track email delivery status

#### How to Register a Teacher:
1. Click **"Register New Teacher"** button
2. Fill in:
   - **First Name** (required) - e.g., "John"
   - **Last Name** (optional) - e.g., "Ochieng"
   - **Email** (required) - e.g., "john@shuletech.com"
3. Click **"Register Teacher"**
4. System auto-generates a unique 4-digit PIN (e.g., 2749)
5. Welcome email is automatically sent to teacher
6. PIN is displayed in the table

#### PIN Features:
- **Copy Button:** Click the copy icon next to PIN to copy to clipboard
- **Email Status:** Shows "Sent" if email delivered, "Pending" if not
- **Resend Email:** Click "Resend" to send email again if teacher didn't receive it
- **Delete:** Remove teacher account if needed

### 2. Teacher Assignments Management
**Location:** Admin Dashboard → Teacher Assignments (or `/admin/dashboard/teacher-assignments`)

#### What It Does:
- Assign teachers to specific classes
- Assign teachers to specific subjects
- Support two teaching models:
  1. **Class Teacher** - teaches ALL subjects in a class (Lower Primary: PP1-Grade 3)
  2. **Subject Teacher** - teaches ONE subject across classes (Upper Primary: Grade 4-8)

#### How to Assign a Teacher:
1. Click **"Add Assignment"** button
2. Fill in:
   - **Teacher** - Select from dropdown of registered teachers
   - **Class** - Select which class (e.g., Grade 5A)
   - **Subject** (optional):
     - Leave blank = "All Subjects" (Class Teacher mode)
     - Select subject = "Subject Teacher" (specific subject only)
3. Click **"Add Assignment"**
4. Teacher immediately has access to that class/subject

#### Examples:

**Lower Primary (Grade 1-3) - Class Teacher Model:**
- Teacher: John Ochieng
- Class: Grade 3A
- Subject: (leave blank)
→ John can edit ALL marks (Math, English, Science, etc.) in Grade 3A

**Upper Primary (Grade 4-8) - Subject Teacher Model:**
- Teacher: Jane Smith
- Class: Grade 5A
- Subject: Mathematics
→ Jane can ONLY edit Math marks in Grade 5A (but can view other subjects)

- Teacher: Jane Smith
- Class: Grade 6A
- Subject: Mathematics
→ Jane can ALSO edit Math marks in Grade 6A

## How Teachers Use the System

### Teacher Login Flow:
1. Visit: **Teacher Login** page
2. Select: **ShuleTech** school
3. Choose: **PIN-Based Login**
4. Enter: **PIN** (the 4-digit code from email)
5. Click: **Login**
6. Dashboard shows: Only assigned classes/subjects

### What Teachers Can Do:
- ✓ **View** all marks (read-only, all classes/subjects)
- ✓ **Edit** marks ONLY for assigned classes/subjects
- ✗ **Cannot edit** marks for classes they're not assigned to
- ✗ **Cannot see** PIN login interface if not registered

## Email Notifications

### Welcome Email Content:
Email is sent from: **shuletech1@gmail.com**

Includes:
- Unique 4-digit PIN (prominently displayed)
- Simple login instructions (PIN only - no password!)
- School name: ShuleTech
- Security warnings:
  - Never share PIN with anyone
  - Keep PIN safe
  - Contact admin if PIN is compromised
- Assigned classes/subjects (if any)
- Support contact information

### When Emails Are Sent:
1. **Automatic:** When you register a teacher
2. **Manual:** Click "Resend" button in teacher accounts table
3. **Email Status:** Shows "Sent" or "Pending" in table

## Security Features

### PIN-Only Access:
- Teachers use **ONLY their PIN** to login
- No password required
- Prevents credential sharing
- Easy to manage - admin controls all PINs

### Access Control by Assignment:
- Teachers can **only edit marks** for assigned classes/subjects
- Teachers **cannot edit** other teachers' marks
- Prevents unauthorized mark changes
- Maintains data integrity

### Data Isolation:
- All data isolated by school_id
- ShuleTech data completely separate from other schools
- Other schools unaffected by PIN system
- No cross-school access

## Troubleshooting

### Problem: Teacher didn't receive email
**Solution:** Click "Resend" button next to teacher name in accounts table

### Problem: Teacher forgot PIN
**Solution:** 
1. Find teacher in accounts table
2. PIN is shown in bold monospace font
3. Share PIN verbally or via email
4. Click "Copy" button to copy PIN easily

### Problem: Teacher sharing PIN with others
**Solution:** 
1. Delete the teacher account
2. Register new account - system generates new PIN
3. Send new PIN via email

### Problem: Teacher needs to be removed
**Solution:** Click delete button (trash icon) in accounts table

## Best Practices

### For Lower Primary (PP1-Grade 3):
1. Register all class teachers
2. Assign each teacher to their class with "All Subjects"
3. Each teacher has access to their class only
4. Simple, straightforward setup

### For Upper Primary (Grade 4-8):
1. Register all teachers
2. Assign each subject teacher to all their classes
   - Math teacher: Grade 4, 5, 6, 7, 8 (if teaching all)
   - English teacher: Grade 4, 5, 6, 7, 8 (if teaching all)
3. Multiple assignments possible per teacher
4. More granular control

### General Best Practices:
- Register teachers at the beginning of term
- Assign classes immediately after registration
- Keep email addresses updated
- Resend email if teacher reports not receiving it
- Communicate PIN to teachers separately from email (phone/in-person)
- Change PIN if compromised by notifying teacher of new PIN

## Admin Dashboard Overview

The main admin dashboard shows:
- **PIN Login System Status:** Active (green) or Not Enabled
- **Teacher Account Count:** Total registered teachers
- **Quick Action Buttons:**
  - "Manage Teacher Accounts" - Register/manage teachers
  - "Manage Assignments" - Assign teachers to classes/subjects
- **Feature Status:** Enabled for ShuleTech only

## Key Differences from Standard System

| Feature | Standard | PIN System |
|---------|----------|-----------|
| Login Method | Class Password | Individual PIN |
| Credentials | Shared password | Unique 4-digit code |
| Access Control | None (all teachers can edit all marks) | Granular (only assigned classes/subjects) |
| Email Notification | Manual | Automatic from shuletech1@gmail.com |
| Teacher Identification | Class-based | Individual PIN-based |
| Authorization | Teacher role | Assignment-based |

## Summary

The PIN login system for ShuleTech provides:
1. **Simplified Registration:** Just name + email
2. **Automatic PIN Generation:** Unique 4-digit codes
3. **Email Notifications:** From shuletech1@gmail.com
4. **Granular Access Control:** By class and subject
5. **Clear Admin Interface:** Two simple pages
6. **Data Security:** No cross-school access

This system is designed specifically for primary schools where teachers need simple but secure access to mark entry systems.
