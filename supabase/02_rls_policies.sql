-- ================================================
-- FILE 02: RLS POLICIES - Phân quyền bảo mật
-- Chạy sau 01_init_schema.sql
-- ================================================

-- Bật RLS trên tất cả các bảng
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- =============== HELPER FUNCTION ===============
-- Lấy role của user hiện tại từ profiles
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Kiểm tra user có phải admin không
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  );
$$;

-- Kiểm tra user có quyền can_view class_id không
CREATE OR REPLACE FUNCTION public.can_view_class(class_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN public.is_admin() THEN true
      ELSE EXISTS (
        SELECT 1 FROM public.class_permissions cp
        JOIN public.profiles p ON p.id = cp.user_id
        WHERE cp.user_id = auth.uid()
          AND cp.class_id = class_uuid
          AND cp.can_view = true
          AND p.status = 'active'
      )
    END;
$$;

-- Kiểm tra user có quyền can_edit class_id không
CREATE OR REPLACE FUNCTION public.can_edit_class(class_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN public.is_admin() THEN true
      ELSE EXISTS (
        SELECT 1 FROM public.class_permissions cp
        JOIN public.profiles p ON p.id = cp.user_id
        WHERE cp.user_id = auth.uid()
          AND cp.class_id = class_uuid
          AND cp.can_edit = true
          AND p.status = 'active'
      )
    END;
$$;

-- Trả về danh sách class_id mà user được phép xem
CREATE OR REPLACE FUNCTION public.my_viewable_classes()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.classes WHERE public.is_admin()
  UNION
  SELECT class_id FROM public.class_permissions
  WHERE user_id = auth.uid() AND can_view = true;
$$;

-- Trả về danh sách class_id mà user được phép edit
CREATE OR REPLACE FUNCTION public.my_editable_classes()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.classes WHERE public.is_admin()
  UNION
  SELECT class_id FROM public.class_permissions
  WHERE user_id = auth.uid() AND can_edit = true;
$$;

-- =============== RLS: profiles ===============
-- ADMIN xem tất cả, USER chỉ xem mình
CREATE POLICY profiles_select ON public.profiles FOR SELECT
USING (
  (public.is_admin() = true)
  OR (id = auth.uid())
);

-- Cho phép insert (sử dụng cho trigger sau khi sign up)
CREATE POLICY profiles_insert ON public.profiles FOR INSERT
WITH CHECK (true);

-- ADMIN sửa tất cả, USER sửa profile mình (trừ role)
CREATE POLICY profiles_update ON public.profiles FOR UPDATE
USING (
  (public.is_admin() = true)
  OR (id = auth.uid())
)
WITH CHECK (
  (public.is_admin() = true)
  OR (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  )
);

-- Chỉ admin được xóa
CREATE POLICY profiles_delete ON public.profiles FOR DELETE
USING (public.is_admin() = true);

-- =============== RLS: classes ===============
CREATE POLICY classes_select ON public.classes FOR SELECT
USING (
  (public.is_admin() = true)
  OR (id IN (SELECT public.my_viewable_classes()))
);

CREATE POLICY classes_insert ON public.classes FOR INSERT
WITH CHECK (public.is_admin() = true);

CREATE POLICY classes_update ON public.classes FOR UPDATE
USING (public.is_admin() = true)
WITH CHECK (public.is_admin() = true);

CREATE POLICY classes_delete ON public.classes FOR DELETE
USING (public.is_admin() = true);

-- =============== RLS: students ===============
CREATE POLICY students_select ON public.students FOR SELECT
USING (
  (public.is_admin() = true)
  OR (class_id IN (SELECT public.my_viewable_classes()))
);

CREATE POLICY students_insert ON public.students FOR INSERT
WITH CHECK (class_id IN (SELECT public.my_editable_classes()));

CREATE POLICY students_update ON public.students FOR UPDATE
USING (class_id IN (SELECT public.my_editable_classes()))
WITH CHECK (class_id IN (SELECT public.my_editable_classes()));

CREATE POLICY students_delete ON public.students FOR DELETE
USING (class_id IN (SELECT public.my_editable_classes()));

-- =============== RLS: custom_columns ===============
CREATE POLICY columns_select ON public.custom_columns FOR SELECT
USING (
  (public.is_admin() = true)
  OR (class_id IN (SELECT public.my_viewable_classes()))
);

CREATE POLICY columns_insert ON public.custom_columns FOR INSERT
WITH CHECK (class_id IN (SELECT public.my_editable_classes()));

CREATE POLICY columns_update ON public.custom_columns FOR UPDATE
USING (class_id IN (SELECT public.my_editable_classes()))
WITH CHECK (class_id IN (SELECT public.my_editable_classes()));

CREATE POLICY columns_delete ON public.custom_columns FOR DELETE
USING (class_id IN (SELECT public.my_editable_classes()));

-- =============== RLS: custom_values ===============
CREATE POLICY values_select ON public.custom_values FOR SELECT
USING (
  (public.is_admin() = true)
  OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = custom_values.student_id
      AND s.class_id IN (SELECT public.my_viewable_classes())
  )
);

CREATE POLICY values_insert ON public.custom_values FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = custom_values.student_id
      AND s.class_id IN (SELECT public.my_editable_classes())
  )
);

CREATE POLICY values_update ON public.custom_values FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = custom_values.student_id
      AND s.class_id IN (SELECT public.my_editable_classes())
  )
);

CREATE POLICY values_delete ON public.custom_values FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = custom_values.student_id
      AND s.class_id IN (SELECT public.my_editable_classes())
  )
);

-- =============== RLS: class_permissions (chỉ admin) ===============
CREATE POLICY perm_select ON public.class_permissions FOR SELECT
USING (
  (public.is_admin() = true)
  OR (user_id = auth.uid())
);

CREATE POLICY perm_insert ON public.class_permissions FOR INSERT
WITH CHECK (public.is_admin() = true);

CREATE POLICY perm_update ON public.class_permissions FOR UPDATE
USING (public.is_admin() = true)
WITH CHECK (public.is_admin() = true);

CREATE POLICY perm_delete ON public.class_permissions FOR DELETE
USING (public.is_admin() = true);

-- =============== RLS: activity_logs ===============
-- ADMIN xem tất cả, USER xem log của chính mình
CREATE POLICY logs_select ON public.activity_logs FOR SELECT
USING (
  (public.is_admin() = true)
  OR (user_id = auth.uid())
);

-- Bất kỳ ai authenticated cũng có thể ghi log (hệ thống tự ghi)
CREATE POLICY logs_insert ON public.activity_logs FOR INSERT
WITH CHECK (true);

-- Không cho update/delete logs - bảo toàn lịch sử
