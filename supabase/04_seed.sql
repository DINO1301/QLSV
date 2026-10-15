-- ================================================
-- FILE 04: SEED DATA - Dữ liệu mẫu
-- Chạy cuối cùng sau 03_functions_triggers.sql
-- LƯU Ý: Cần tạo ADMIN user trước qua Supabase Auth UI
--   (Sign up: admin@qlsv.com / pass: Admin@123)
-- Sau đó chạy script này
-- ================================================

-- ============ TẠO LỚP HỌC MẪU ============
INSERT INTO public.classes (id, class_name, description, created_at, updated_at) VALUES
(
  gen_random_uuid(),
  'CNTT01',
  'Công nghệ thông tin khóa 2023 - Lớp 1',
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  'CNTT02',
  'Công nghệ thông tin khóa 2023 - Lớp 2',
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  'QTKD01',
  'Quản trị kinh doanh khóa 2023 - Lớp 1',
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  'KT01',
  'Kế toán khóa 2023 - Lớp 1',
  NOW(),
  NOW()
)
ON CONFLICT (class_name) DO NOTHING;

-- ============ TẠO CUSTOM COLUMNS MẪU CHO TỪNG LỚP ============
-- Lấy class_id để seed
DO $$
DECLARE
  v_cntt01 UUID;
  v_cntt02 UUID;
  v_qtkd01 UUID;
  v_kt01 UUID;
BEGIN
  SELECT id INTO v_cntt01 FROM public.classes WHERE class_name = 'CNTT01';
  SELECT id INTO v_cntt02 FROM public.classes WHERE class_name = 'CNTT02';
  SELECT id INTO v_qtkd01 FROM public.classes WHERE class_name = 'QTKD01';
  SELECT id INTO v_kt01 FROM public.classes WHERE class_name = 'KT01';

  -- Cột mẫu CNTT01
  IF v_cntt01 IS NOT NULL THEN
    INSERT INTO public.custom_columns (class_id, column_name, data_type, column_order, options, created_at) VALUES
    (v_cntt01, 'Điểm TB', 'number', 1, '[]', NOW()),
    (v_cntt01, 'Chuyên cần (%)', 'number', 2, '[]', NOW()),
    (v_cntt01, 'Địa chỉ', 'text', 3, '[]', NOW()),
    (v_cntt01, 'Số điện thoại', 'text', 4, '[]', NOW()),
    (v_cntt01, 'Giới tính', 'select', 5, '["Nam", "Nữ", "Khác"]', NOW())
    ON CONFLICT (class_id, column_name) DO NOTHING;
  END IF;

  -- Cột mẫu CNTT02
  IF v_cntt02 IS NOT NULL THEN
    INSERT INTO public.custom_columns (class_id, column_name, data_type, column_order, options, created_at) VALUES
    (v_cntt02, 'Điểm TB', 'number', 1, '[]', NOW()),
    (v_cntt02, 'Chuyên cần (%)', 'number', 2, '[]', NOW()),
    (v_cntt02, 'Số điện thoại', 'text', 3, '[]', NOW())
    ON CONFLICT (class_id, column_name) DO NOTHING;
  END IF;

  -- Cột mẫu QTKD01
  IF v_qtkd01 IS NOT NULL THEN
    INSERT INTO public.custom_columns (class_id, column_name, data_type, column_order, options, created_at) VALUES
    (v_qtkd01, 'Điểm TB', 'number', 1, '[]', NOW()),
    (v_qtkd01, 'Chuyên cần (%)', 'number', 2, '[]', NOW()),
    (v_qtkd01, 'Năng khiếu', 'text', 3, '[]', NOW())
    ON CONFLICT (class_id, column_name) DO NOTHING;
  END IF;

  -- Cột mẫu KT01
  IF v_kt01 IS NOT NULL THEN
    INSERT INTO public.custom_columns (class_id, column_name, data_type, column_order, options, created_at) VALUES
    (v_kt01, 'Điểm TB', 'number', 1, '[]', NOW()),
    (v_kt01, 'Chuyên cần (%)', 'number', 2, '[]', NOW()),
    (v_kt01, 'Số điện thoại', 'text', 3, '[]', NOW())
    ON CONFLICT (class_id, column_name) DO NOTHING;
  END IF;
END;
$$;

-- ============ SINH VIÊN MẪU CNTT01 ============
DO $$
DECLARE
  v_cntt01 UUID;
  v_c1 UUID;
  v_c2 UUID;
  v_c3 UUID;
  v_c4 UUID;
  v_c5 UUID;
  v_s UUID;
  v_student_codes TEXT[] := ARRAY['SV001','SV002','SV003','SV004','SV005','SV006','SV007','SV008','SV009','SV010'];
  v_full_names TEXT[] := ARRAY[
    'Nguyễn Văn Anh','Trần Thị Bình','Lê Hoàng Cường','Phạm Thị Dung','Hoàng Văn Em',
    'Ngô Thị Phượng','Đỗ Văn Giang','Vũ Thị Hương','Bùi Văn Khoa','Đặng Thị Lan'
  ];
  v_dobs DATE[] := ARRAY[
    '2005-01-15','2005-02-20','2005-03-10','2005-04-22','2005-05-30',
    '2005-06-18','2005-07-05','2005-08-12','2005-09-25','2005-10-09'
  ];
  v_wl INT[] := ARRAY[0,1,2,3,0,0,1,0,2,0];
  v_dtb NUMERIC[] := ARRAY[8.5, 6.2, 4.5, 2.1, 7.8, 8.1, 5.5, 9.0, 3.8, 7.2];
  v_cc INT[] := ARRAY[95, 80, 65, 40, 90, 88, 75, 98, 55, 85];
  v_reason TEXT;
BEGIN
  SELECT id INTO v_cntt01 FROM public.classes WHERE class_name = 'CNTT01';
  SELECT id INTO v_c1 FROM public.custom_columns WHERE class_id = v_cntt01 AND column_name = 'Điểm TB';
  SELECT id INTO v_c2 FROM public.custom_columns WHERE class_id = v_cntt01 AND column_name = 'Chuyên cần (%)';
  SELECT id INTO v_c3 FROM public.custom_columns WHERE class_id = v_cntt01 AND column_name = 'Địa chỉ';
  SELECT id INTO v_c4 FROM public.custom_columns WHERE class_id = v_cntt01 AND column_name = 'Số điện thoại';
  SELECT id INTO v_c5 FROM public.custom_columns WHERE class_id = v_cntt01 AND column_name = 'Giới tính';

  FOR i IN 1..10 LOOP
    v_reason := CASE
      WHEN v_wl[i] = 1 THEN 'Điểm trung bình thấp'
      WHEN v_wl[i] = 2 THEN 'Điểm TB rất thấp và chuyên cần dưới 70%'
      WHEN v_wl[i] = 3 THEN 'Cảnh báo học vụ nghiêm trọng - nguy cơ buộc thôi học'
      ELSE NULL
    END;

    INSERT INTO public.students (class_id, student_code, full_name, date_of_birth, warning_level, warning_reason, warning_date)
    VALUES (v_cntt01, v_student_codes[i], v_full_names[i], v_dobs[i], v_wl[i], v_reason, CASE WHEN v_wl[i] > 0 THEN NOW()::DATE ELSE NULL END)
    RETURNING id INTO v_s;

    INSERT INTO public.custom_values (student_id, column_id, value) VALUES
      (v_s, v_c1, to_jsonb(v_dtb[i])),
      (v_s, v_c2, to_jsonb(v_cc[i])),
      (v_s, v_c3, to_jsonb('Số ' || i || ' Đường ABC, TP HCM'::TEXT)),
      (v_s, v_c4, to_jsonb(('09' || LPAD((10000000 + i * 12345)::TEXT, 9, '0'))::TEXT)),
      (v_s, v_c5, to_jsonb(CASE WHEN i % 2 = 0 THEN 'Nữ' ELSE 'Nam' END))
    ON CONFLICT (student_id, column_id) DO UPDATE SET value = EXCLUDED.value;
  END LOOP;
END;
$$;

-- ============ SINH VIÊN MẪU CNTT02 ============
DO $$
DECLARE
  v_class UUID;
  v_c1 UUID; v_c2 UUID; v_c3 UUID;
  v_s UUID;
BEGIN
  SELECT id INTO v_class FROM public.classes WHERE class_name = 'CNTT02';
  SELECT id INTO v_c1 FROM public.custom_columns WHERE class_id = v_class AND column_name = 'Điểm TB';
  SELECT id INTO v_c2 FROM public.custom_columns WHERE class_id = v_class AND column_name = 'Chuyên cần (%)';
  SELECT id INTO v_c3 FROM public.custom_columns WHERE class_id = v_class AND column_name = 'Số điện thoại';

  FOR i IN 1..8 LOOP
    INSERT INTO public.students (class_id, student_code, full_name, date_of_birth, warning_level)
    VALUES (v_class, 'SV20' || LPAD(i::TEXT, 2, '0'), 'Sinh viên CNTT02 ' || i, '2005-03-01'::DATE + (i || ' days')::INTERVAL, CASE WHEN i = 3 THEN 1 ELSE 0 END)
    RETURNING id INTO v_s;

    INSERT INTO public.custom_values (student_id, column_id, value) VALUES
      (v_s, v_c1, to_jsonb(ROUND((5 + random()*4)::numeric, 1))),
      (v_s, v_c2, to_jsonb((70 + floor(random()*30))::INT)),
      (v_s, v_c3, to_jsonb(('09' || LPAD((i * 1111111)::TEXT, 9, '0'))::TEXT))
    ON CONFLICT (student_id, column_id) DO NOTHING;
  END LOOP;
END;
$$;
