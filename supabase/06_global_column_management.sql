-- ================================================
-- FILE 06: GLOBAL CUSTOM COLUMN MANAGEMENT
-- Chạy sau 05_cell_styles_and_column_permissions.sql
-- Các RPC này chỉ dành cho admin và chạy theo transaction.
-- ================================================

-- Bổ sung cho các database đã cài trước khi visible_columns được khai báo.
ALTER TABLE public.class_permissions
    ADD COLUMN IF NOT EXISTS visible_columns JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.create_global_custom_column(
    p_column_name TEXT,
    p_data_type public.data_type,
    p_options JSONB DEFAULT '[]'::jsonb,
    p_column_order INTEGER DEFAULT 0
)
RETURNS SETOF public.custom_columns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_column_name TEXT := btrim(p_column_name);
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Chỉ quản trị viên mới được quản lý cột toàn hệ thống';
    END IF;
    IF v_column_name IS NULL OR v_column_name = '' THEN
        RAISE EXCEPTION 'Tên cột không được để trống';
    END IF;

    INSERT INTO public.custom_columns (class_id, column_name, data_type, options, column_order)
    SELECT c.id, v_column_name, p_data_type, COALESCE(p_options, '[]'::jsonb), COALESCE(p_column_order, 0)
    FROM public.classes c
    ON CONFLICT (class_id, column_name) DO UPDATE
    SET data_type = EXCLUDED.data_type,
        options = EXCLUDED.options,
        column_order = EXCLUDED.column_order;

    RETURN QUERY
    SELECT cc.*
    FROM public.custom_columns cc
    WHERE cc.column_name = v_column_name
    ORDER BY cc.column_order, cc.class_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_global_custom_column(
    p_column_id UUID,
    p_column_name TEXT,
    p_data_type public.data_type,
    p_options JSONB DEFAULT '[]'::jsonb,
    p_column_order INTEGER DEFAULT 0
)
RETURNS SETOF public.custom_columns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_name TEXT;
    v_new_name TEXT := btrim(p_column_name);
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Chỉ quản trị viên mới được quản lý cột toàn hệ thống';
    END IF;
    IF v_new_name IS NULL OR v_new_name = '' THEN
        RAISE EXCEPTION 'Tên cột không được để trống';
    END IF;

    SELECT cc.column_name INTO v_old_name
    FROM public.custom_columns cc
    WHERE cc.id = p_column_id;
    IF v_old_name IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy cột cần cập nhật';
    END IF;

    UPDATE public.custom_columns
    SET column_name = v_new_name,
        data_type = p_data_type,
        options = COALESCE(p_options, '[]'::jsonb),
        column_order = COALESCE(p_column_order, 0)
    WHERE column_name = v_old_name;

    RETURN QUERY
    SELECT cc.*
    FROM public.custom_columns cc
    WHERE cc.column_name = v_new_name
    ORDER BY cc.column_order, cc.class_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_global_custom_column(p_column_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_column_name TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Chỉ quản trị viên mới được quản lý cột toàn hệ thống';
    END IF;

    SELECT cc.column_name INTO v_column_name
    FROM public.custom_columns cc
    WHERE cc.id = p_column_id;
    IF v_column_name IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy cột cần xóa';
    END IF;

    DELETE FROM public.custom_columns
    WHERE column_name = v_column_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_global_custom_columns(p_column_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_column_id UUID;
    v_column_name TEXT;
    v_order INTEGER := 0;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Chỉ quản trị viên mới được quản lý cột toàn hệ thống';
    END IF;

    FOREACH v_column_id IN ARRAY COALESCE(p_column_ids, ARRAY[]::UUID[])
    LOOP
        SELECT cc.column_name INTO v_column_name
        FROM public.custom_columns cc
        WHERE cc.id = v_column_id;
        IF v_column_name IS NULL THEN
            RAISE EXCEPTION 'Không tìm thấy một trong các cột cần sắp xếp';
        END IF;

        UPDATE public.custom_columns
        SET column_order = v_order
        WHERE column_name = v_column_name;
        v_order := v_order + 1;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.create_global_custom_column(TEXT, public.data_type, JSONB, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_global_custom_column(UUID, TEXT, public.data_type, JSONB, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_global_custom_column(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reorder_global_custom_columns(UUID[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_global_custom_column(TEXT, public.data_type, JSONB, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_global_custom_column(UUID, TEXT, public.data_type, JSONB, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_global_custom_column(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_global_custom_columns(UUID[]) TO authenticated;
