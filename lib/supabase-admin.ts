import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn('Faltan variables de entorno para Supabase Admin. Usando cliente estándar como fallback.');
}

// Cliente con Service Role Key para saltar políticas RLS en el servidor
export const supabaseAdmin = createClient(
    supabaseUrl, 
    supabaseServiceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        }
    }
);
