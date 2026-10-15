// Edge Function: Tạo người dùng mới bằng service_role (chạy server-side)
// Cho phép ADMIN tạo tài khoản cho người khác mà không cần xác nhận email.
//
// Deploy: supabase functions deploy create-user
//
// Body request (JSON):
// {
//   "email": "...",
//   "password": "...",
//   "username": "...",
//   "full_name": "...",
//   "role": "admin" | "user"  (mặc định "user")
// }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { email, password, username, full_name, role = 'user' } = await req.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'email và password là bắt buộc' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Tạo user trong auth.users với service_role (không cần confirm email)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, full_name },
    })

    if (error) throw error

    const user = data.user

    // Đồng bộ role vào bảng profiles (trigger sẽ tạo profile, nhưng ta set role)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ role, full_name, username })
      .eq('id', user.id)

    if (profileError) {
      console.warn('Update profile role lỗi:', profileError.message)
    }

    return new Response(
      JSON.stringify({ user: { id: user.id, email: user.email } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('create-user error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Tạo user thất bại' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
