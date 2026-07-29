import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRole) {
        throw new Error('Variables de entorno de Supabase no configuradas');
    }
    return createClient(url, serviceRole);
}

export async function GET(req: NextRequest) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        // Verify caller is an admin
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.replace('Bearer ', '');
        const { data: { user: caller }, error: callerErr } = await supabaseAdmin.auth.getUser(token);
        if (callerErr || !caller) {
            return NextResponse.json({ error: 'Forbidden - invalid token' }, { status: 403 });
        }

        // Verify admin via DB (more reliable than user_metadata which may be stale in JWT)
        const { data: callerProfile } = await supabaseAdmin
            .from('perfiles_publicos')
            .select('rol')
            .eq('id', caller.id)
            .single();

        if (callerProfile?.rol !== 'admin') {
            return NextResponse.json({ error: 'Forbidden - not admin' }, { status: 403 });
        }

        // List all auth users (up to 1000)
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Fetch roles from perfiles_publicos (source of truth for roles changed via app)
        const { data: perfiles, error: perfilesError } = await supabaseAdmin
            .from('perfiles_publicos')
            .select('id, rol, nombre');

        console.log('[list-users] perfiles count:', perfiles?.length, 'error:', perfilesError?.message);

        // Build a map of id -> { rol, nombre } from DB
        const dbRolMap: Record<string, { rol?: string; nombre?: string }> = {};
        if (perfiles) {
            perfiles.forEach((p: any) => {
                dbRolMap[p.id] = { rol: p.rol, nombre: p.nombre };
            });
        }

        // Merge: prefer DB rol over user_metadata.rol (DB is more current)
        const simplified = users.map(u => {
            const dbEntry = dbRolMap[u.id];
            const rol = dbEntry?.rol || u.user_metadata?.rol || '';
            return {
                id: u.id,
                email: u.email,
                created_at: u.created_at,
                user_metadata: {
                    nombre: dbEntry?.nombre || u.user_metadata?.nombre || u.user_metadata?.full_name || '',
                    rol
                }
            };
        });

        return NextResponse.json({ users: simplified });
    } catch (err: any) {
        console.error('[list-users] error:', err.message);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
