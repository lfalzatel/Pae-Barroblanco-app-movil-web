import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Configurar VAPID
webpush.setVapidDetails(
  'mailto:admin@iebarroblanco.edu.co',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticación del usuario y rol
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ).auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verificar rol en perfiles_publicos
    const { data: profile } = await supabaseAdmin
      .from('perfiles_publicos')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.rol !== 'admin' && profile.rol !== 'coordinador' && profile.rol !== 'coordinadora')) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const body = await req.json();
    const { title, message, url, user_id } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // Obtener suscripciones de Supabase
    let query = supabaseAdmin.from('push_subscriptions').select('*');
    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    const { data: subscriptions, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Error obteniendo suscripciones' }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'Sin suscriptores' });
    }

    // Payload de la notificación
    const payload = JSON.stringify({
      title,
      body: message,
      url: url || '/dashboard',
      tag: 'pae-horario',
    });

    // Enviar a cada dispositivo suscrito
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };
        return webpush.sendNotification(pushSubscription, payload);
      })
    );

    // Limpiar suscripciones expiradas (error 410 = dispositivo ya no está suscrito)
    const expiredEndpoints: string[] = [];
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        const err = result.reason as any;
        if (err?.statusCode === 410) {
          expiredEndpoints.push(subscriptions[idx].endpoint);
        }
      }
    });

    if (expiredEndpoints.length > 0) {
      await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
    }

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    return NextResponse.json({ success: true, sent, total: subscriptions.length });
  } catch (e) {
    console.error('Error en /api/push/send:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
