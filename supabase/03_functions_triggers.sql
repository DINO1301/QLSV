-- ================================================
-- FILE 03: FUNCTIONS & TRIGGERS
-- Chạy sau 02_rls_policies.sql
-- ================================================

-- ============ 1. AUTO INSERT PROFILE KHI SIGN UP ============
-- Trigger tự động tạo profile khi user mới đăng ký qua Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_count integer;
BEGIN
  -- Nếu là user đầu tiên → admin, ngược lại là user
  SELECT COUNT(*) INTO v_count FROM public.profiles;

  IF v_count = 0 THEN
    v_role := 'admin';
  ELSE
    v_role := 'user';
  END IF;

  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    email,
    role,
    status,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    v_role,
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ 2. AUTO UPDATE updated_at ============
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS classes_updated_at ON public.classes;
CREATE TRIGGER classes_updated_at BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS students_updated_at ON public.students;
CREATE TRIGGER students_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS custom_values_updated_at ON public.custom_values;
CREATE TRIGGER custom_values_updated_at BEFORE UPDATE ON public.custom_values
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ 3. GHI LOG - HELPER FUNCTION ============
-- Ghi log chung (được gọi từ trigger hoặc từ client)
CREATE OR REPLACE FUNCTION public.log_activity(
  p_action TEXT,
  p_class_id UUID DEFAULT NULL,
  p_student_id UUID DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.activity_logs (
    user_id, class_id, student_id, action, old_data, new_data, created_at
  ) VALUES (
    auth.uid(), p_class_id, p_student_id, p_action, p_old_data, p_new_data, NOW()
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ============ 4. TRIGGER GHI LOG - students ============
CREATE OR REPLACE FUNCTION public.handle_student_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.log_activity(
      'CREATE_STUDENT',
      NEW.class_id,
      NEW.id,
      NULL,
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    PERFORM public.log_activity(
      'UPDATE_STUDENT',
      NEW.class_id,
      NEW.id,
      v_old,
      v_new
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM public.log_activity(
      'DELETE_STUDENT',
      NULL,
      NULL,
      to_jsonb(OLD),
      NULL
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS students_logging ON public.students;
CREATE TRIGGER students_logging
AFTER INSERT OR UPDATE OR DELETE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.handle_student_change();

-- ============ 5. TRIGGER GHI LOG - classes ============
CREATE OR REPLACE FUNCTION public.handle_class_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.log_activity('CREATE_CLASS', NEW.id, NULL, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM public.log_activity('UPDATE_CLASS', NEW.id, NULL, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM public.log_activity('DELETE_CLASS', NULL, NULL, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS classes_logging ON public.classes;
CREATE TRIGGER classes_logging
AFTER INSERT OR UPDATE OR DELETE ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.handle_class_change();

-- ============ 6. TRIGGER GHI LOG - custom_columns ============
CREATE OR REPLACE FUNCTION public.handle_column_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.log_activity('CREATE_COLUMN', NEW.class_id, NULL, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM public.log_activity('UPDATE_COLUMN', NEW.class_id, NULL, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM public.log_activity('DELETE_COLUMN', NULL, NULL, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS columns_logging ON public.custom_columns;
CREATE TRIGGER columns_logging
AFTER INSERT OR UPDATE OR DELETE ON public.custom_columns
FOR EACH ROW EXECUTE FUNCTION public.handle_column_change();

-- ============ 7. TRIGGER GHI LOG - class_permissions ============
CREATE OR REPLACE FUNCTION public.handle_permission_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.log_activity('UPDATE_PERMISSION', NEW.class_id, NULL, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM public.log_activity('UPDATE_PERMISSION', NEW.class_id, NULL, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM public.log_activity('UPDATE_PERMISSION', NULL, NULL, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS permissions_logging ON public.class_permissions;
CREATE TRIGGER permissions_logging
AFTER INSERT OR UPDATE OR DELETE ON public.class_permissions
FOR EACH ROW EXECUTE FUNCTION public.handle_permission_change();
