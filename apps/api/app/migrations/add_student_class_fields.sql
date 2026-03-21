-- Audit fix: add_student_class_fields migration
-- Run via ensure_new_tables() at API startup

-- 1. Add missing columns to amilyhub.students
ALTER TABLE amilyhub.students ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE amilyhub.students ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE amilyhub.students ADD COLUMN IF NOT EXISTS school TEXT;
ALTER TABLE amilyhub.students ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE amilyhub.students ADD COLUMN IF NOT EXISTS follow_up_person TEXT;
ALTER TABLE amilyhub.students ADD COLUMN IF NOT EXISTS edu_manager TEXT;
ALTER TABLE amilyhub.students ADD COLUMN IF NOT EXISTS wechat_bound BOOLEAN DEFAULT FALSE;
ALTER TABLE amilyhub.students ADD COLUMN IF NOT EXISTS face_captured BOOLEAN DEFAULT FALSE;

-- 2. Create amilyhub.classes table (audit fix: classes table)
CREATE TABLE IF NOT EXISTS amilyhub.classes (
    id BIGSERIAL PRIMARY KEY,
    source_class_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT '班课',
    course_id TEXT,
    teacher_id TEXT,
    campus TEXT DEFAULT '',
    capacity INTEGER DEFAULT 0,
    description TEXT DEFAULT '',
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT '开班中',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_classes_name ON amilyhub.classes(name);

-- 3. Add new columns to amilyhub.courses
ALTER TABLE amilyhub.courses ADD COLUMN IF NOT EXISTS validity_days INTEGER DEFAULT 0;
ALTER TABLE amilyhub.courses ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE amilyhub.courses ADD COLUMN IF NOT EXISTS materials TEXT[];

-- 4. Add price_per_hour to amilyhub.courses
ALTER TABLE amilyhub.courses ADD COLUMN IF NOT EXISTS price_per_hour INTEGER DEFAULT 0;

-- 5. Create amilyhub.rooms table
CREATE TABLE IF NOT EXISTS amilyhub.rooms (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    campus TEXT DEFAULT '' NOT NULL,
    capacity INTEGER DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'active' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rooms_name ON amilyhub.rooms(name);
CREATE INDEX IF NOT EXISTS idx_rooms_campus ON amilyhub.rooms(campus);
