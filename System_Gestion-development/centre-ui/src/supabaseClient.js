import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  console.error("⚠️ لم يتم العثور على VITE_SUPABASE_URL! تأكد من إيقاف السيرفر وإعادة تشغيله بعد حفظ ملف .env")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);