'use client';

export type SoundType = 'pop' | 'click' | 'chime' | 'haptic' | 'sparkle' | 'none';

export const SOUND_OPTIONS: { id: SoundType; label: string; icon: string; description: string }[] = [
  { id: 'pop', label: 'Pop / Burbuja', icon: '🍿', description: 'Feedback suave estilo iOS' },
  { id: 'click', label: 'Click Digital', icon: '⚡', description: 'Sensación mecánica de interruptor' },
  { id: 'chime', label: 'Campana Armónica', icon: '🎵', description: 'Micro-acorde musical' },
  { id: 'haptic', label: 'Toque Háptico', icon: '📳', description: 'Pulso grave sutil estilo motor' },
  { id: 'sparkle', label: 'Chime Brillos', icon: '✨', description: 'Tono cristalino ascendente' },
  { id: 'none', label: 'Silencioso', icon: '🔇', description: 'Desactivar efecto auditivo' },
];

export const ACTION_SOUND_OPTIONS = [
  { id: 'arpegio', label: 'Arpegio Sintetizado', icon: '🎵', description: 'Acorde armónico de 3 tonos ascendentes' },
  { id: 'cristal', label: 'Cristalino Acústico', icon: '💎', description: 'Resonancia pura de alta frecuencia' },
  { id: 'electro', label: 'Pulso Eléctrico', icon: '⚡', description: 'Onda sintética moderna y enérgica' },
  { id: 'disolucion', label: 'Disolución Armónica', icon: '🌌', description: 'Tono descendente suave y envolvente' },
  { id: 'silencioso', label: 'Silencioso', icon: '🔇', description: 'Desactivar sonido para esta acción' },
];

export const PARTICLE_SOUND_OPTIONS = [
  { id: 'cristalino_pentatonico', label: 'Cristalino Pentatónico', icon: '🔮', description: 'Cascada de tonos armónicos brillantes' },
  { id: 'arcade_8bit', label: 'Arcade 8-Bit', icon: '✨', description: 'Ráfaga vintage estilo consola NES' },
  { id: 'marimba_acustica', label: 'Marimba Acústica', icon: '🪵', description: 'Toques de madera cálida y resonante' },
  { id: 'neon_ciberpunk', label: 'Neón Ciberpunk', icon: '⚡', description: 'Onda sintetizada retro futurista' },
  { id: 'silencioso', label: 'Silencioso', icon: '🔇', description: 'Desactivar sonido en partículas' },
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

// Sound Preference Helpers for specific categories
export function getCategorySoundPref(category: string, defaultId: string): string {
  if (typeof window === 'undefined') return defaultId;
  return localStorage.getItem(`pae_sound_${category}`) || defaultId;
}

export function setCategorySoundPref(category: string, soundId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`pae_sound_${category}`, soundId);
}

// Audio Synthesizers for Particle & Custom Sounds
export function playSynthesizedSound(soundId: string): void {
  if (typeof window === 'undefined' || soundId === 'silencioso' || soundId === 'none') return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    switch (soundId) {
      case 'pop':
      case 'pop_burbuja': {
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
      case 'click':
      case 'click_digital': {
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
      case 'chime':
      case 'campana_armonica': {
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.03);
          gain.gain.setValueAtTime(0.1, now + i * 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.03 + 0.15);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.03);
          osc.stop(now + i * 0.03 + 0.15);
        });
        break;
      }
      case 'haptic':
      case 'toque_haptico': {
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
      case 'arpegio':
      case 'arpegio_sintetizado': {
        [440, 554.37, 659.25, 880].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.04);
          gain.gain.setValueAtTime(0.12, now + i * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.04);
          osc.stop(now + i * 0.04 + 0.18);
        });
        break;
      }
      case 'disolucion':
      case 'disolucion_armonica': {
        [880, 659.25, 523.25, 349.23].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.05);
          gain.gain.setValueAtTime(0.1, now + i * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.05);
          osc.stop(now + i * 0.05 + 0.22);
        });
        break;
      }
      case 'cristalino_pentatonico': {
        [523.25, 587.33, 659.25, 783.99, 880, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.035);
          gain.gain.setValueAtTime(0.08, now + i * 0.035);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.035 + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.035);
          osc.stop(now + i * 0.035 + 0.2);
        });
        break;
      }
      case 'arcade_8bit': {
        [220, 440, 880, 1760].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now + i * 0.03);
          gain.gain.setValueAtTime(0.06, now + i * 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.03 + 0.05);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.03);
          osc.stop(now + i * 0.03 + 0.05);
        });
        break;
      }
      case 'marimba_acustica': {
        [329.63, 392.0, 493.88].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.04);
          gain.gain.setValueAtTime(0.18, now + i * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.1);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.04);
          osc.stop(now + i * 0.04 + 0.1);
        });
        break;
      }
      case 'neon_ciberpunk': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.12);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }
      default: {
        playNavSound('pop');
        break;
      }
    }
  } catch (e) {
    // Ignore audio restrictions
  }
}

export function speakVoiceConfirmation(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel(); // Cancel active speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-CO';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.error('Speech Synthesis Error:', e);
  }
}

// Gamification Special Audio Synthesizers
export function playGamificationFanfare(): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Major chord triumphant fanfare sequence: C4, E4, G4, C5, E5
    const freqs = [261.63, 329.63, 392.0, 523.25, 659.25];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.08 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.35);
    });
  } catch (e) {}
}

export function playCardFlipSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(750, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  } catch (e) {}
}

export function playCounterTick(): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(900, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.02);
  } catch (e) {}
}

export function playCookFlowCoinSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Classic Mario / CookFlow Coin Chime: B5 (987.77Hz) -> E6 (1318.51Hz)
    const notes = [
      { freq: 987.77, time: now, duration: 0.08 },
      { freq: 1318.51, time: now + 0.08, duration: 0.35 },
    ];
    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(n.freq, n.time);
      gain.gain.setValueAtTime(0.12, n.time);
      gain.gain.exponentialRampToValueAtTime(0.001, n.time + n.duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(n.time);
      osc.stop(n.time + n.duration);
    });
  } catch (e) {}
}

export function playRewardClaimSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Bright cascade sparkle
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      gain.gain.setValueAtTime(0.15, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.25);
    });
  } catch (e) {}
}

export function playNavSound(overrideType?: SoundType): void {
  if (typeof window === 'undefined') return;
  const type = overrideType || getSoundPreference();
  if (type === 'none') return;
  playSynthesizedSound(type);
}

