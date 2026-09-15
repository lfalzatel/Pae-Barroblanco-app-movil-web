'use client';

import { useEffect } from 'react';
import { playGeneralClickSound } from '@/lib/ui-sounds';

export default function GlobalSoundListener() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Detecta si el elemento cliqueado (o su ancestro cercano) es interactivo
      const interactiveEl = target.closest(
        'button, a, [role="button"], input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"]'
      );

      if (!interactiveEl) return;

      // Omite botones de vista previa de sonido para evitar superposición
      if (interactiveEl.closest('[data-sound-preview]')) return;

      // Reproduce el sonido de clic general según preferencia guardada
      playGeneralClickSound();
    };

    window.addEventListener('click', handleGlobalClick, { capture: true });

    return () => {
      window.removeEventListener('click', handleGlobalClick, { capture: true });
    };
  }, []);

  return null;
}
