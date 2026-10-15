-- ================================================
-- FILE 05: CELL STYLES + COLUMN PERMISSIONS
-- - Bảng cell_styles: lưu màu nền của từng ô dữ liệu
-- - Thêm cột editable_columns vào class_permissions:
--   quyền sửa theo từng cột (array of column keys)
-- ================================================

-- =============== TABLE: cell_styles ===============
CREATE TABLE IF NOT EXISTS public.cell_styles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    column_key TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, column_key)
);
CREATE INDEX IF NOT EXISTS idx_cell_styles_student ON public.cell_styles(student_id);
CREATE INDEX IF NOT EXISTS idx_cell_styles_column ON public.cell_styles(column_key);

-- =============== ALTER class_permissions ===============
ALTER TABLE public.class_permissions
    ADD COLUMN IF NOT EXISTS editable_columns JSONB NOT NULL DEFAULT '[]'::jsonb;

-- =============== RLS: cell_styles ===============
ALTER TABLE public.cell_styles ENABLE ROW LEVEL SECURITY;

CREATE POLICY cell_styles_select ON public.cell_styles FOR SELECT
USING (
    (public.is_admin() = true)
    OR EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = cell_styles.student_id
          AND s.class_id IN (SELECT public.my_viewable_classes())
    )
);

CREATE POLICY cell_styles_insert ON public.cell_styles FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = cell_styles.student_id
          AND s.class_id IN (SELECT public.my_editable_classes())
    )
);

CREATE POLICY cell_styles_update ON public.cell_styles FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = cell_styles.student_id
          AND s.class_id IN (SELECT public.my_editable_classes())
    )
);

CREATE POLICY cell_styles_delete ON public.cell_styles FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = cell_styles.student_id
          AND s.class_id IN (SELECT public.my_editable_classes())
    )
);
