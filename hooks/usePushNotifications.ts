import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'pae_push_asked';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(Array.from(rawData).map((char) => char.charCodeAt(0)));
}

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  dismiss: () => void;
  shouldShowBanner: boolean;
}

async function syncSubscriptionWithServer(sub: PushSubscription, token: string) {
  try {
    const p256dhRaw = sub.getKey('p256dh');
    const authRaw = sub.getKey('auth');

    if (!p256dhRaw || !authRaw) return;

    const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhRaw))));
    const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authRaw))));

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: { p256dh, auth }
      }),
    });
  } catch (err) {
    console.error('Error al sincronizar suscripción con el servidor:', err);
  }
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shouldShowBanner, setShouldShowBanner] = useState(false);

  useEffect(() => {
    // Verificar soporte del navegador
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    setIsSupported(supported);

    if (!supported) return;

    const currentPermission = Notification.permission;
    setPermission(currentPermission);

    // Si ya tiene permiso, verificar suscripción activa
    if (currentPermission === 'granted') {
      checkExistingSubscription();
    } else if (currentPermission === 'default') {
      // Solo mostrar banner si no se ha preguntado antes
      const alreadyAsked = localStorage.getItem(STORAGE_KEY);
      if (!alreadyAsked) {
        // Pequeño delay para no interrumpir la carga inicial
        setTimeout(() => setShouldShowBanner(true), 3000);
      }
    }

    // Escuchar cambios de autenticación para asegurar la sincronización de la suscripción
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && Notification.permission === 'granted') {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await syncSubscriptionWithServer(sub, session.access_token);
          }
        } catch (e) {
          // Silencioso
        }
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [isSupported]);

  const checkExistingSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);

      if (sub) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await syncSubscriptionWithServer(sub, session.access_token);
        }
      }
    } catch (e) {
      // Silencioso
    }
  };

  const subscribe = async () => {
    if (!isSupported || isLoading) return;
    setIsLoading(true);

    try {
      // 1. Pedir permiso al usuario
      const result = await Notification.requestPermission();
      setPermission(result);
      localStorage.setItem(STORAGE_KEY, 'true');
      setShouldShowBanner(false);

      if (result !== 'granted') {
        setIsLoading(false);
        return;
      }

      // 2. Obtener el Service Worker registrado
      const reg = await navigator.serviceWorker.ready;

      // 3. Suscribirse al push con clave VAPID pública
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn('VAPID public key not configured');
        setIsLoading(false);
        return;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as any,
      });

      // 4. Enviar suscripción al servidor
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await syncSubscriptionWithServer(subscription, session.access_token);
      }

      setIsSubscribed(true);
    } catch (e) {
      console.error('Error al suscribirse a notificaciones:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (!isSupported || isLoading) return;
    setIsLoading(true);

    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();

      if (subscription) {
        // 1. Eliminar del servidor
        const { data: { session } } = await supabase.auth.getSession();
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        // 2. Desuscribir en el navegador
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      localStorage.setItem(STORAGE_KEY, 'dismissed');
    } catch (e) {
      console.error('Error al desascribirse de notificaciones:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'dismissed');
    setShouldShowBanner(false);
  };

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    dismiss,
    shouldShowBanner,
  };
}
