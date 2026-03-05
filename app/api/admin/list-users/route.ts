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

        // List all users (up to 1000)
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Return only relevant fields
        const simplified = users.map(u => ({
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            user_metadata: {
                nombre: u.user_metadata?.nombre || u.user_metadata?.full_name || '',
                rol: u.user_metadata?.rol || 'sin rol'
            }
        }));

        return NextResponse.json({ users: simplified });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
