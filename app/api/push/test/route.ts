import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export async function GET(req: NextRequest) {
  try {
    // Verificar autenticación: solo admin o coordinador_pae pueden ejecutar esto
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'No autorizado: token requerido' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Faltan variables de entorno' }, { status: 500 });
    }

    // Verificar el token y obtener el usuario
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado: sesión inválida' }, { status: 401 });
    }

    const userRole = user.user_metadata?.rol;
    if (userRole !== 'admin' && userRole !== 'coordinador_pae') {
      return NextResponse.json({ error: 'No autorizado: se requiere rol admin o coordinador_pae' }, { status: 403 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey || !supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Faltan variables de entorno' }, { status: 500 });
    }

    webpush.setVapidDetails(
      'mailto:admin@iebarroblanco.edu.co',
      publicKey,
      privateKey
    );

    const { data: subscriptions, error: dbError } = await supabaseAdmin.from('push_subscriptions').select('*');

    if (dbError) throw dbError;

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'No hay nadie suscrito en la base de datos.' });
    }

    const formattedTime = new Date().toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const payload = JSON.stringify({
      title: 'Prueba Maestro 👋',
      body: `Enviado el ${formattedTime} (Hora Exacta)`,
      url: '/dashboard',
    });

    const results = await Promise.allSettled(
      subscriptions.map(sub => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        };
        return webpush.sendNotification(pushSubscription, payload, { urgency: 'high' });
      })
    );

    const detailedResults = results.map((r, i) => {
      const endpoint = subscriptions[i].endpoint;
      const browser = endpoint.includes('fcm.googleapis.com') ? 'Android/Chrome' : 
                      endpoint.includes('push.apple.com') ? 'iOS/Safari' : 'PC/Otro';
      
      return {
        browser,
        endpoint: endpoint.substring(0, 30) + '...',
        status: r.status,
        error: r.status === 'rejected' ? (r.reason as any).message : null,
        statusCode: r.status === 'rejected' ? (r.reason as any).statusCode : 200
      };
    });

    return NextResponse.json({
      message: 'Intento de envío completado',
      total: subscriptions.length,
      results: detailedResults
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
