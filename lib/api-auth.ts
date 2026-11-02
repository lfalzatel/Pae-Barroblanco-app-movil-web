import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Verifica el token de sesión y el rol del usuario en perfiles_publicos.
// Nunca usar user_metadata.rol para autorizar: el propio usuario puede modificarlo.
export async function verificarRol(req: Request, rolesPermitidos: string[]) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (error || !user) {
        return { error: NextResponse.json({ error: 'Sesión inválida' }, { status: 401 }) };
    }

    const { data: perfil } = await supabaseAdmin
        .from('perfiles_publicos')
        .select('rol')
        .eq('id', user.id)
        .single();

    if (!perfil || !rolesPermitidos.includes(perfil.rol)) {
        return { error: NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 }) };
    }

    return { user, rol: perfil.rol as string };
}
