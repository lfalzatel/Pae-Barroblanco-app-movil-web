import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export async function GET(req: NextRequest) {
  try {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!publicKey || !privateKey || !supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Faltan variables de entorno' }, { status: 500 });
    }

    webpush.setVapidDetails(
      'mailto:admin@iebarroblanco.edu.co',
      publicKey,
      privateKey
    );

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: subscriptions, error: dbError } = await supabaseAdmin.from('push_subscriptions').select('*');

    if (dbError) throw dbError;

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'No hay nadie suscrito en la base de datos.' });
    }

    const payload = JSON.stringify({
      title: 'Prueba Maestro 👋',
      body: `Enviado el ${new Date().toLocaleTimeString('es-CO')}`,
      url: '/dashboard',
    });

    const results = await Promise.allSettled(
      subscriptions.map(sub => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        };
        return webpush.sendNotification(pushSubscription, payload);
      })
    );

    const detailedResults = results.map((r, i) => ({
      endpoint: subscriptions[i].endpoint.substring(0, 40) + '...',
      status: r.status,
      error: r.status === 'rejected' ? (r.reason as any).message : null,
      statusCode: r.status === 'rejected' ? (r.reason as any).statusCode : 200
    }));

    return NextResponse.json({
      message: 'Intento de envío completado',
      total: subscriptions.length,
      results: detailedResults
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
