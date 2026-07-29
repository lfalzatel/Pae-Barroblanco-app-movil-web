import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This route uses the SERVICE ROLE key (server-side only) to delete auth users.
// It must be called from an authenticated admin session.

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRole) {
        throw new Error('Variables de entorno de Supabase no configuradas');
    }
    return createClient(url, serviceRole);
}

export async function DELETE(req: NextRequest) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const body = await req.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Verify that the requester is an admin using their session token
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.replace('Bearer ', '');

        // Validate the caller's session
        const { data: { user: caller }, error: callerErr } = await supabaseAdmin.auth.getUser(token);
        if (callerErr || !caller) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify caller is admin
        if (caller.user_metadata?.rol !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: only admins can delete users' }, { status: 403 });
        }

        // Prevent admin from deleting themselves
        if (caller.id === userId) {
            return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
        }

        // Delete the auth user
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteError) {
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
