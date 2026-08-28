'use client';

export type SoundType = 'pop' | 'click' | 'chime' | 'haptic' | 'sparkle' | 'none';

export const SOUND_OPTIONS: { id: SoundType; label: string; icon: string; description: string }[] = [
  { id: 'pop', label: 'Pop / Burbuja', icon: '🍿', description: 'Suave, satisfactorio, estilo iOS (Por defecto)' },
  { id: 'click', label: 'Click Digital', icon: '⚡', description: 'Crisp, mecánico y tecnológico' },
  { id: 'chime', label: 'Campana Armónica', icon: '🎵', description: 'Micro-acorde elegante y refinado' },
  { id: 'haptic', label: 'Toque Háptico', icon: '📳', description: 'Golpecito grave estilo motor de vibración' },
  { id: 'sparkle', label: 'Chime Brillos', icon: '✨', description: 'Tono cristalino ascendente moderno' },
  { id: 'none', label: 'Silencioso', icon: '🔇', description: 'Desactivar efectos de sonido' },
];

let globalAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!globalAudioCtx) {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxClass) {
      globalAudioCtx = new AudioCtxClass();
    }
  }
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
}

export function getSoundPreference(): SoundType {
  if (typeof window === 'undefined') return 'pop';
  const saved = localStorage.getItem('pae_ui_sound') as SoundType;
  if (saved && SOUND_OPTIONS.some(s => s.id === saved)) {
    return saved;
  }
  return 'pop';
}

export function setSoundPreference(sound: SoundType): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('pae_ui_sound', sound);
}

export function playNavSound(overrideType?: SoundType): void {
  if (typeof window === 'undefined') return;
  const type = overrideType || getSoundPreference();
  if (type === 'none') return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    switch (type) {
      case 'pop': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }
      case 'click': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.03);
        break;
      }
      case 'chime': {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now); // C5
        osc2.frequency.setValueAtTime(659.25, now); // E5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.12);
        osc2.stop(now + 0.12);
        break;
      }
      case 'haptic': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.04);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
        break;
      }
      case 'sparkle': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.06);
        osc.frequency.exponentialRampToValueAtTime(1800, now + 0.12);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }
    }
  } catch (err) {
    // Ignore audio autoplay restrictions gracefully
  }
}
