import { createClient, SupabaseClient } from '@supabase/supabase-js';

let adminInstance: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
    if (adminInstance) return adminInstance;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL no está configurado en las variables de entorno.');
    }

    adminInstance = createClient(
        supabaseUrl, 
        supabaseServiceRoleKey!, 
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        }
    );
    return adminInstance;
}

// Proxy dinámico para mantener compatibilidad total con `import { supabaseAdmin }`
// Sin ejecutar createClient durante la fase estática de npm run build
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
    get(_target, prop, receiver) {
        const client = getSupabaseAdmin();
        const value = Reflect.get(client, prop, receiver);
        return typeof value === 'function' ? value.bind(client) : value;
    }
});
