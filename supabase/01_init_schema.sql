-- ================================================
-- FILE 01: INIT SCHEMA - Tạo tất cả các bảng
-- Thực thi file này trước trong SQL Editor Supabase
-- ================================================

-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============== ENUM TYPES ===============
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE user_status AS ENUM ('active', 'locked');
CREATE TYPE data_type AS ENUM ('text', 'number', 'date', 'checkbox', 'select');

-- =============== TABLE: profiles ===============
-- Mở rộng thông tin từ auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    full_name TEXT,
    email TEXT,
    role user_role NOT NULL DEFAULT 'user',
    status user_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============== TABLE: classes ===============
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============== TABLE: students ===============
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    student_code TEXT NOT NULL,
    full_name TEXT NOT NULL,
    date_of_birth DATE,
    warning_level INTEGER NOT NULL DEFAULT 0 CHECK (warning_level IN (0,1,2,3)),
    warning_reason TEXT,
    warning_date DATE,
    warning_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(class_id, student_code)
);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_warning_level ON public.students(warning_level);
CREATE INDEX IF NOT EXISTS idx_students_code ON public.students(student_code);

-- =============== TABLE: custom_columns ===============
CREATE TABLE IF NOT EXISTS public.custom_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    column_name TEXT NOT NULL,
    data_type data_type NOT NULL DEFAULT 'text',
    column_order INTEGER NOT NULL DEFAULT 0,
    options JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(class_id, column_name)
);
CREATE INDEX IF NOT EXISTS idx_custom_columns_class_id ON public.custom_columns(class_id);

-- =============== TABLE: custom_values ===============
CREATE TABLE IF NOT EXISTS public.custom_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    column_id UUID NOT NULL REFERENCES public.custom_columns(id) ON DELETE CASCADE,
    value JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, column_id)
);
CREATE INDEX IF NOT EXISTS idx_custom_values_student ON public.custom_values(student_id);
CREATE INDEX IF NOT EXISTS idx_custom_values_column ON public.custom_values(column_id);

-- =============== TABLE: class_permissions ===============
CREATE TABLE IF NOT EXISTS public.class_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    can_view BOOLEAN NOT NULL DEFAULT false,
    can_edit BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, class_id)
);
CREATE INDEX IF NOT EXISTS idx_class_perm_user ON public.class_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_class_perm_class ON public.class_permissions(class_id);

-- =============== TABLE: activity_logs ===============
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_logs_user ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_class ON public.activity_logs(class_id);
CREATE INDEX IF NOT EXISTS idx_logs_action ON public.activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_created ON public.activity_logs(created_at);
