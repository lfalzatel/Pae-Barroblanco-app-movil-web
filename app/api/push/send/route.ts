import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export async function POST(req: NextRequest) {
  try {
    // 1. Validar variables de entorno críticas
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!publicKey || !privateKey || !supabaseUrl || !serviceRoleKey) {
      console.error('Missing environment variables for push notifications');
      return NextResponse.json({ error: 'Configuración de servidor incompleta' }, { status: 500 });
    }

    // 2. Configurar VAPID en tiempo de ejecución
    webpush.setVapidDetails(
      'mailto:admin@iebarroblanco.edu.co',
      publicKey,
      privateKey
    );

    // 3. Inicializar administrador de Supabase
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 4. Verificar autenticación del usuario y rol
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseCheck = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: { user }, error: authError } = await supabaseCheck.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth Error in Push Send:', authError?.message || 'No user found');
      return NextResponse.json({ error: 'Token inválido', details: authError?.message }, { status: 401 });
    }

    // Verificar rol en perfiles_publicos
    const { data: profile } = await supabaseAdmin
      .from('perfiles_publicos')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'coordinador', 'coordinadora', 'coordinador_pae'].includes(profile.rol)) {
      console.warn(`Intento de envío de push bloqueado. Usuario: ${user.id}, Rol: ${profile?.rol}`);
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const body = await req.json();
    const { title, message, url, user_id } = body;
    
    console.log(`Iniciando envío de push: "${title}" - Para: ${user_id || 'Todos'}`);

    if (!title || !message) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // Obtener suscripciones de Supabase
    let query = supabaseAdmin.from('push_subscriptions').select('*');
    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    const { data: subscriptions, error } = await query;
    console.log(`Encontrados ${subscriptions?.length || 0} dispositivos suscritos.`);

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return NextResponse.json({ error: 'Error obteniendo suscripciones' }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'Sin suscriptores' });
    }

    // Payload de la notificación
    const formattedTime = new Date().toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const payload = JSON.stringify({
      title,
      body: `${message}\n(Enviado a las ${formattedTime})`,
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
        console.error(`Error enviando a ${subscriptions[idx].endpoint.substring(0, 30)}... :`, err.message || err);
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expiredEndpoints.push(subscriptions[idx].endpoint);
        }
      }
    });

    if (expiredEndpoints.length > 0) {
      console.log(`Limpiando ${expiredEndpoints.length} suscripciones expiradas.`);
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
