import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
    try {
        // Verify caller is an admin
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.replace('Bearer ', '');
        const { data: { user: caller }, error: callerErr } = await supabaseAdmin.auth.getUser(token);
        if (callerErr || !caller || caller.user_metadata?.rol !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // List all auth users (up to 1000)
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Also fetch roles from the DB table (usuarios or perfiles_publicos)
        // Try perfiles_publicos first (more up-to-date when changed from app)
        const { data: perfiles } = await supabaseAdmin
            .from('perfiles_publicos')
            .select('id, rol, nombre');

        // Build a map of id -> { rol, nombre } from DB
        const dbRolMap: Record<string, { rol?: string; nombre?: string }> = {};
        if (perfiles) {
            perfiles.forEach((p: any) => {
                dbRolMap[p.id] = { rol: p.rol, nombre: p.nombre };
            });
        }

        // If perfiles_publicos had no results, try 'usuarios' table
        if (!perfiles || perfiles.length === 0) {
            const { data: usuariosData } = await supabaseAdmin
                .from('usuarios')
                .select('id, rol, nombre');
            if (usuariosData) {
                usuariosData.forEach((u: any) => {
                    dbRolMap[u.id] = { rol: u.rol, nombre: u.nombre };
                });
            }
        }

        // Merge: prefer DB rol over user_metadata.rol (DB is more current)
        const simplified = users.map(u => ({
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            user_metadata: {
                nombre: dbRolMap[u.id]?.nombre || u.user_metadata?.nombre || u.user_metadata?.full_name || '',
                rol: dbRolMap[u.id]?.rol || u.user_metadata?.rol || ''
            }
        }));

        return NextResponse.json({ users: simplified });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
