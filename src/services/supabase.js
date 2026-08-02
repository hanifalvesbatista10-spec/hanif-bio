import { createClient } from "@supabase/supabase-js";

// As variáveis do Vercel têm prioridade. Os valores abaixo são a configuração
// pública (anon) do projeto e permitem que o site funcione mesmo antes de você
// configurar o painel do Vercel.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://qgenfhyzobauknptwsex.supabase.co";

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5maHl6b2JhdWtucHR3c2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NzA3MTAsImV4cCI6MjEwMTI0NjcxMH0.q8_C-d2aJR9uiEI0-BamD3Ee8it-wxzQynSCJjKvmsA";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
