import { createClient, SupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
    if (clientInstance) return clientInstance;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

    clientInstance = createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });
    return clientInstance;
}

// Proxy transparente para `import { supabase } from '@/lib/supabase'`
// Evita lanzar excepciones destructivas durante el prerrenderizado estático de Vercel
export const supabase = new Proxy({} as SupabaseClient, {
    get(_target, prop, receiver) {
        const client = getSupabaseClient();
        const value = Reflect.get(client, prop, receiver);
        return typeof value === 'function' ? value.bind(client) : value;
    }
});
