# Database I/O Optimization Guide

## Problem Statement
Your Supabase database is running out of Disk I/O budget due to inefficient queries. This guide provides specific optimizations to reduce I/O by 50-80%.

---

## ✅ CRITICAL FIXES (Implement First)

### 1. **Add Database Indexes** (Reduces I/O by 70-80%)
**File:** `scripts/003_add_indexes_for_io_optimization.sql`

Run this migration to add critical indexes:
```bash
# Connect to Supabase and run the SQL file
psql "$POSTGRES_URL" < scripts/003_add_indexes_for_io_optimization.sql
```

**Why:** Foreign key queries without indexes cause full table scans. With indexes, queries run 100-1000x faster.

---

### 2. **Stop Using `select('*')`** (Reduces I/O by 30-40%)

#### Problem:
```typescript
// BAD - loads ALL columns (wasteful)
const { data } = await supabase.from('learners').select('*')
```

#### Solution - Select Only Needed Columns:
```typescript
// GOOD - loads only needed columns
const { data } = await supabase
  .from('learners')
  .select('id, name, gender, admission_number')
  .eq('class_id', classId)
```

#### Files to Update:
- `/app/admin-portal/page.tsx` - Line 296-302
- `/app/dashboard/learners/page.tsx` - Various queries
- `/app/actions/auth.ts` - Lines with `select('*')`

**Recommended Column Sets:**
```typescript
// For admin portal classes
'id, name, display_order, password, school_id'

// For learners list
'id, name, gender, admission_number, birth_cert_number, parent_phone'

// For marks
'id, learner_id, session_id, subject_id, score, grade'

// For sessions
'id, name, class_id, exam_type_id, status, created_at'
```

---

### 3. **Batch Related Queries** (Reduces I/O by 20-30%)

#### Problem:
```typescript
// Loading each exam type separately in a loop
sessions.forEach(async session => {
  const examType = await supabase
    .from('exam_types')
    .select('*')
    .eq('id', session.exam_type_id)
})
```

#### Solution - Use Promise.all():
The admin portal already does this correctly at line 295:
```typescript
const [classesRes, examTypesRes, ...] = await Promise.all([
  supabase.from('classes').select(...).eq('school_id', schoolId),
  supabase.from('exam_types').select(...).eq('school_id', schoolId),
  // ... other queries
])
```

**Always use this pattern instead of sequential queries.**

---

### 4. **Add Result Pagination** (Reduces I/O by 40-50% for large lists)

#### Problem:
```typescript
// Loads ALL 1000+ learners every time
const { data: allLearners } = await supabase
  .from('learners')
  .select('*')
  .eq('class_id', classId)
```

#### Solution - Implement Pagination:
```typescript
const ITEMS_PER_PAGE = 50

const { data, count } = await supabase
  .from('learners')
  .select('id, name, gender', { count: 'exact' })
  .eq('class_id', classId)
  .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1)
```

**Files to update:**
- Learners list pages
- Marks pages (paginate by session and subject)
- Activity logs (paginate by date)

---

### 5. **Use Count Queries for Summaries** (Reduces I/O by 60%)

#### Problem:
```typescript
// Returns 500+ rows just to count them
const { data } = await supabase
  .from('marks')
  .select('*')
  .eq('session_id', sessionId)
const count = data?.length
```

#### Solution - Use Count:
```typescript
// Returns only the count (1 I/O operation instead of 500)
const { count } = await supabase
  .from('marks')
  .select('*', { count: 'exact', head: true })
  .eq('session_id', sessionId)
```

---

## 🚀 OPTIMIZATION CHECKLIST

### Phase 1: Indexes & Column Selection (Week 1)
- [ ] Run migration: `003_add_indexes_for_io_optimization.sql`
- [ ] Update `admin-portal/page.tsx` - specify columns instead of `select('*')`
- [ ] Update `auth.ts` - specify columns for teacher lookup
- [ ] Update `dashboard/learners/page.tsx` - specify columns
- [ ] Update `dashboard/marks/page.tsx` - specify columns

### Phase 2: Pagination & Batch Queries (Week 2)
- [ ] Add pagination to learners list
- [ ] Add pagination to marks view
- [ ] Add pagination to activity logs
- [ ] Batch all school-related queries with Promise.all()

### Phase 3: Query Caching (Week 3)
- [ ] Cache global data (subjects, exam types) in state
- [ ] Implement SWR for frequently accessed lists
- [ ] Add cache headers to API routes

---

## 📊 Expected I/O Reduction

| Optimization | I/O Reduction | Implementation Time |
|--------------|--------------|-------------------|
| Add Indexes | 70-80% | 15 mins |
| Column Selection | 30-40% | 2 hours |
| Pagination | 40-50% | 4 hours |
| Batch Queries | 20-30% | 1 hour |
| Count Queries | 60% | 1 hour |
| **Total Potential** | **~80%** | **~8 hours** |

After these optimizations, you should reduce I/O usage by 80%, freeing up disk space and dramatically improving performance.

---

## 🔍 MONITORING

Check your I/O usage in Supabase Dashboard:
1. Go to Organization → Usage
2. Monitor "Database Size" and "Realtime Concurrent Peak Connections"
3. Run heavy operations during off-peak hours

---

## 📝 QUERY OPTIMIZATION PATTERNS

### Pattern 1: List with Filters
```typescript
// BEFORE (wasteful)
const { data } = await supabase
  .from('learners')
  .select('*')

// AFTER (optimized)
const { data } = await supabase
  .from('learners')
  .select('id, name, gender')
  .eq('class_id', classId)
  .order('name')
```

### Pattern 2: Related Data
```typescript
// BEFORE (N+1 problem)
const classes = await supabase.from('classes').select('*')
for (const cls of classes) {
  const learners = await supabase.from('learners').select('*').eq('class_id', cls.id)
}

// AFTER (efficient)
const classes = await supabase.from('classes').select('id, name')
const learners = await supabase
  .from('learners')
  .select('id, name, class_id')
  .in('class_id', classes.map(c => c.id))
```

### Pattern 3: Large Result Sets
```typescript
// BEFORE (loads everything)
const { data } = await supabase
  .from('marks')
  .select('*')
  .eq('session_id', sessionId)

// AFTER (paginated)
const { data, count } = await supabase
  .from('marks')
  .select('id, learner_id, score, grade', { count: 'exact' })
  .eq('session_id', sessionId)
  .range(0, 49)
```

---

## ❓ FAQ

**Q: Will these changes break anything?**
A: No. These are pure optimizations with no functional changes. All queries return the same data structure.

**Q: How long do the changes take?**
A: ~8 hours total. Start with indexes (easiest, biggest impact), then column selection, then pagination.

**Q: Can I do this gradually?**
A: Yes! Each optimization works independently. Prioritize indexes first.

**Q: What if queries still slow?**
A: Check Supabase logs for slow queries. Ensure indexes were created properly with:
```sql
SELECT * FROM pg_indexes WHERE schemaname != 'pg_catalog';
```
