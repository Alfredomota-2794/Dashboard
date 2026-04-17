// BGI Tools — Cliente de Supabase (compartido entre todas las páginas)
const SUPABASE_URL = 'https://muvbcbuawwfuhnhwwors.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RG3aN7Fa5iSjWu5InWefLw_csdwVLNh';
const bgiSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
