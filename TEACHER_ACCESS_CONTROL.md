# Teacher Access Control System

## Overview

This system implements role-based access control for teachers, allowing them to:
- **VIEW** all marks (read-only access to see full context)
- **EDIT** only marks for their assigned classes and subjects

This design maintains efficiency and simplicity while providing strong security.

## Architecture

### 1. Teacher Assignments Database

The `teacher_assignments` table stores the mapping between teachers, classes, and subjects:

```sql
teacher_assignments {
  id: UUID,
  school_id: UUID,
  user_id: UUID,
  class_id: UUID,
  subject_id: UUID | NULL,  -- NULL means "all subjects in this class"
  is_active: BOOLEAN,
  assigned_at: TIMESTAMP,
  created_at: TIMESTAMP
}
```

**Key Design:**
- `subject_id = NULL` → Teacher teaches ALL subjects in the class (Lower Primary)
- `subject_id = <specific>` → Teacher teaches ONLY that subject (Upper Primary)

### 2. Permission Checking

Use the utilities in `lib/teacher-permissions.ts`:

```typescript
// Check if teacher can edit a specific mark
const canEdit = await canTeacherEditMarks(
  userId,      // Teacher's user ID
  schoolId,    // School ID
  classId,     // Class ID
  subjectId    // Subject ID
);

// Get all classes teacher is assigned to
const classes = await getTeacherAssignedClasses(userId, schoolId);

// Get all subjects teacher can edit in a class
// Returns: string[] | null (null means all subjects)
const subjects = await getTeacherSubjectsInClass(
  userId,
  schoolId,
  classId
);
```

### 3. Admin Interface

**Location:** `/admin/dashboard/teacher-assignments`

**Features:**
- View all teacher assignments
- Add new assignments (teacher + class + optional subject)
- Remove assignments
- Visual matrix of who teaches what

**How to Use:**
1. School admin logs in
2. Goes to Settings → Teacher Assignments
3. Selects a teacher, class, and subject
4. Clicks "Add Assignment"
5. Repeat for all teachers

## Usage Examples

### Lower Primary (PP1 - Grade 3): One Teacher, All Subjects

```
Assignment:
  Teacher: Mr. Ochieng
  Class: Grade 2A
  Subject: All Subjects (NULL)

Result:
  - Mr. Ochieng can VIEW all marks for Grade 2A
  - Mr. Ochieng can EDIT all subjects in Grade 2A
```

### Upper Primary (Grade 4-8): Multiple Teachers, Subject Specialists

```
Assignments:
  1. Teacher: Mr. Ochieng
     Class: Grade 5
     Subject: Mathematics
     
  2. Teacher: Ms. Kipchoge
     Class: Grade 5
     Subject: English
     
  3. Teacher: Dr. Mutua
     Class: Grade 5
     Subject: Science

Result:
  - Mr. Ochieng can EDIT only Mathematics marks in Grade 5
  - Ms. Kipchoge can EDIT only English marks in Grade 5
  - All teachers can VIEW all subjects in Grade 5 (read-only)
```

### Mixed Assignment: Teacher Across Multiple Classes

```
Assignments:
  1. Teacher: Mr. Ochieng
     Class: Grade 4
     Subject: Mathematics
     
  2. Teacher: Mr. Ochieng
     Class: Grade 5
     Subject: Mathematics
     
  3. Teacher: Mr. Ochieng
     Class: Grade 6
     Subject: Mathematics

Result:
  - Mr. Ochieng teaches Mathematics in Grades 4, 5, and 6
  - Can EDIT mathematics marks only in those three classes
  - Can VIEW all other subjects (read-only)
```

## Implementation in Marklist Page

The marklist page will be updated to:

1. **Load teacher assignments** on component mount
2. **Disable editing** for non-assigned rows with visual indicator (🔒 lock icon)
3. **Show read-only mode** for subjects the teacher can't edit
4. **Validate on save** - reject edits for unauthorized marks

### UI Changes

```typescript
// On each mark input field:
if (canEdit) {
  // Enable editing - full textbox
  <input type="number" value={mark} onChange={...} />
} else {
  // Disable editing - grayed out with lock icon
  <div className="bg-gray-100 text-gray-500 cursor-not-allowed">
    🔒 {mark}
  </div>
}
```

### API Validation

Every mark save operation will validate:
```typescript
const hasPermission = await canTeacherEditMarks(
  userId,
  schoolId,
  classId,
  subjectId
);

if (!hasPermission) {
  throw new Error('Unauthorized: You cannot edit marks for this subject/class');
}
```

## Security Features

1. **Database-Level:**
   - Foreign key constraints ensure data integrity
   - Unique constraints prevent duplicate assignments
   - Indexed for performance

2. **Application-Level:**
   - Permission checks before every edit
   - Validation on save
   - Audit logging (optional: track who edited what)

3. **UI-Level:**
   - Visual indicators for non-editable fields
   - Disabled inputs prevent accidental changes
   - Clear feedback messages

## Performance Considerations

1. **Caching:**
   - Assignment data is fetched once on page load
   - Cached in component state
   - Re-fetches only when class/subject changes

2. **Database Queries:**
   - Indexed lookups on `user_id`, `class_id`, `subject_id`
   - Single query to check permission (no N+1 queries)
   - Batched queries for bulk operations

3. **Efficiency Trade-offs:**
   - VIEW access to all data (small performance cost)
   - EDIT access restricted (prevents errors, reduces bad data)
   - Better security with minimal performance impact

## Migration from Current System

**Current State:**
- All teachers can edit all marks
- No access control

**After Implementation:**
1. Admin assigns teachers to classes/subjects
2. Teachers see lock icons on non-editable marks
3. Saves are validated server-side
4. No marks are lost or deleted

**No Breaking Changes:**
- Existing marks remain unchanged
- Teachers can still VIEW everything
- Only editing is restricted (enforces policy)

## Testing

```typescript
// Test: Teacher can edit assigned subject
test('teacher can edit assigned marks', async () => {
  const canEdit = await canTeacherEditMarks(
    'teacher1',
    'school1',
    'class1',
    'math'
  );
  expect(canEdit).toBe(true);
});

// Test: Teacher cannot edit unassigned subject
test('teacher cannot edit unassigned marks', async () => {
  const canEdit = await canTeacherEditMarks(
    'teacher1',
    'school1',
    'class1',
    'english'
  );
  expect(canEdit).toBe(false);
});

// Test: Teacher with "all subjects" can edit any subject
test('class teacher can edit all subjects', async () => {
  const canEdit = await canTeacherEditMarks(
    'teacher1',
    'school1',
    'class1',
    'any-subject'
  );
  expect(canEdit).toBe(true);
});
```

## Admin Checklist

- [ ] Created teacher_assignments table (✓ Done)
- [ ] Set up admin UI for assignments (✓ Done)
- [ ] Assign all teachers to their classes/subjects
- [ ] Test permission checks work correctly
- [ ] Update marklist page to enforce permissions
- [ ] Train teachers on new UI (lock icons)
- [ ] Monitor for any access issues first week

## FAQ

**Q: Can teachers see marks for classes they don't teach?**
A: Yes, they can VIEW all marks (read-only). They can only EDIT their assigned ones.

**Q: What if a teacher teaches multiple subjects?**
A: Create multiple assignments - one for each subject per class.

**Q: Can a teacher be assigned to multiple classes?**
A: Yes, create an assignment for each class.

**Q: What happens if a teacher is removed from a class?**
A: Set their assignment `is_active = false`. Their previous marks remain unchanged.

**Q: Can we change assignments mid-term?**
A: Yes, remove old assignment and create new one. History is preserved.

**Q: What about historical marks from before this system?**
A: All existing marks remain unchanged and visible. Only new/edited marks are restricted.
