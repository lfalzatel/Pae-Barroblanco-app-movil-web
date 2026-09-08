'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Gift, Sparkles, X, CheckCircle } from 'lucide-react';
import {
  playGamificationFanfare,
  playCoinClaimSound,
  speakVoiceConfirmation,
} from '@/lib/ui-sounds';

interface GamificationUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  points?: number;
  rewardText?: string;
  badgeName?: string;
}

// 16 Mario Bros & PAE Particles Array (CookFlow Blueprint Specification)
const MARIO_PARTICLES = [
  // 8 Izquierda
  { id: 1, symbol: '🍄', side: 'left', x: -220, y: -160, scale: 1.4, duration: 2.2, delay: 0.1 },
  { id: 2, symbol: '⭐', side: 'left', x: -300, y: -80, scale: 1.6, duration: 2.4, delay: 0.15 },
  { id: 3, symbol: '🪙', side: 'left', x: -180, y: 40, scale: 1.3, duration: 2.0, delay: 0.2 },
  { id: 4, symbol: '🍓', side: 'left', x: -280, y: 120, scale: 1.5, duration: 2.3, delay: 0.25 },
  { id: 5, symbol: '🥑', side: 'left', x: -340, y: -20, scale: 1.4, duration: 2.5, delay: 0.3 },
  { id: 6, symbol: '🧀', side: 'left', x: -210, y: 180, scale: 1.3, duration: 2.1, delay: 0.35 },
  { id: 7, symbol: '🍳', side: 'left', x: -260, y: -210, scale: 1.5, duration: 2.4, delay: 0.4 },
  { id: 8, symbol: '🥐', side: 'left', x: -170, y: -100, scale: 1.2, duration: 2.2, delay: 0.45 },
  // 8 Derecha
  { id: 9, symbol: '🍄', side: 'right', x: 220, y: -160, scale: 1.4, duration: 2.2, delay: 0.1 },
  { id: 10, symbol: '⭐', side: 'right', x: 300, y: -80, scale: 1.6, duration: 2.4, delay: 0.15 },
  { id: 11, symbol: '🪙', side: 'right', x: 180, y: 40, scale: 1.3, duration: 2.0, delay: 0.2 },
  { id: 12, symbol: '🍗', side: 'right', x: 280, y: 120, scale: 1.5, duration: 2.3, delay: 0.25 },
  { id: 13, symbol: '🍕', side: 'right', x: 340, y: -20, scale: 1.4, duration: 2.5, delay: 0.3 },
  { id: 14, symbol: '🌶️', side: 'right', x: 210, y: 180, scale: 1.3, duration: 2.1, delay: 0.35 },
  { id: 15, symbol: '🥞', side: 'right', x: 260, y: -210, scale: 1.5, duration: 2.4, delay: 0.4 },
  { id: 16, symbol: '🍍', side: 'right', x: 170, y: -100, scale: 1.2, duration: 2.2, delay: 0.45 },
];

export default function GamificationUnlockModal({
  isOpen,
  onClose,
  title = '¡RECOMPENSA PAE!',
  points = 50,
  rewardText = '¡Excelente puntualidad en el registro!',
  badgeName = 'Estudiante PAE',
}: GamificationUnlockModalProps) {
  const [isClaimed, setIsClaimed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Play CookFlow fanfare when modal pops in
  useEffect(() => {
    if (isOpen) {
      setIsClaimed(false);
      setIsClosing(false);
      playGamificationFanfare();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Helper to pick visible profile points capsule in DOM
  const getVisibleCapsule = (): HTMLElement | null => {
    const candidates = Array.from(document.querySelectorAll('[data-points-capsule]'));
    const visible = candidates.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) as HTMLElement | null;
    if (!visible) return null;
    return (visible.querySelector('button') || visible) as HTMLElement;
  };

  const handleClaim = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isClaimed) return;
    setIsClaimed(true);

    // 1. Play CookFlow Mario Coin Chime & Speech confirmation
    playCoinClaimSound();
    speakVoiceConfirmation(`¡Felicidades! Has ganado ${points} puntos PAE.`);

    // 2. Find target profile points capsule
    const targetEl = getVisibleCapsule();
    const targetRect = targetEl?.getBoundingClientRect();
    const targetX = targetRect ? targetRect.left + targetRect.width / 2 : window.innerWidth - 60;
    const targetY = targetRect ? targetRect.top + targetRect.height / 2 : 40;

    // 3. Collect active particle elements for flight trajectory
    const emojiElements = cardRef.current?.querySelectorAll('[data-mario-particle]');

    // Helper Web Audio synthesizer for impact crystal chimes
    let audioCtx: AudioContext | null = null;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) audioCtx = new AudioCtxClass();
    } catch (err) {}

    const playImpactCrystalChime = (freq: number, delayMs: number) => {
      setTimeout(() => {
        try {
          if (!audioCtx) return;
          if (audioCtx.state === 'suspended') audioCtx.resume();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
          gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(audioCtx.currentTime);
          osc.stop(audioCtx.currentTime + 0.25);
        } catch (e) {}
      }, delayMs);
    };

    // 4. Launch each emoticon with exact arrival sound synchronization
    const flightDurationMs = 1000;

    if (emojiElements && emojiElements.length > 0) {
      emojiElements.forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;

        const flyer = document.createElement('div');
        flyer.innerHTML = el.textContent || '⭐';
        Object.assign(flyer.style, {
          position: 'fixed',
          left: `${startX}px`,
          top: `${startY}px`,
          fontSize: '32px',
          lineHeight: '1',
          zIndex: '100000',
          transform: 'translate(-50%, -50%) scale(1) rotate(0deg)',
          opacity: '1',
          pointerEvents: 'none',
          willChange: 'transform, opacity',
          transition: `transform ${flightDurationMs}ms cubic-bezier(.22,1.6,.4,1), opacity ${flightDurationMs}ms ease`,
        });
        document.body.appendChild(flyer);

        const startDelay = 80 + idx * 110;
        const impactTimestamp = startDelay + flightDurationMs;

        // 🎵 Campanada de cristal sintonizada en el MILISEGUNDO EXACTO del impacto
        const chimeFreq = 1046.50 + idx * 70;
        playImpactCrystalChime(chimeFreq, impactTimestamp);

        // Volar hacia la cápsula
        setTimeout(() => {
          requestAnimationFrame(() => {
            const deltaX = targetX - startX;
            const deltaY = targetY - startY;
            flyer.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(0.35) rotate(600deg)`;
            flyer.style.opacity = '0.9';
          });
        }, startDelay);

        // Eliminar nodo tras el impacto
        setTimeout(() => {
          flyer.remove();
        }, impactTimestamp + 80);
      });
    }

    // 5. 4 Etapas de Pulso y Crecimiento Progresivo de la Cápsula (1.1x ➔ 1.22x ➔ 1.32x)
    if (targetEl) {
      const computedRadius = window.getComputedStyle(targetEl).borderRadius || '9999px';
      targetEl.style.borderRadius = computedRadius;

      // Etapa 1: Inicio al despegar las partículas (800ms)
      setTimeout(() => {
        targetEl.style.transition = 'transform 400ms cubic-bezier(.22,1.6,.4,1), box-shadow 400ms ease';
        targetEl.style.transform = 'scale(1.1)';
        targetEl.style.boxShadow = '0 0 18px 4px rgba(251,191,36,0.6)';
      }, 800);

      // Etapa 2: Crecimiento intermedio con la llegada de la primera oleada (1800ms)
      setTimeout(() => {
        targetEl.style.transform = 'scale(1.22)';
        targetEl.style.boxShadow = '0 0 30px 10px rgba(251,191,36,0.85)';
      }, 1800);

      // Etapa 3: Pulso máximo al impactar la oleada final (2600ms)
      setTimeout(() => {
        targetEl.style.transform = 'scale(1.32)';
        targetEl.style.boxShadow = '0 0 45px 16px rgba(251,191,36,1)';
      }, 2600);

      // Etapa 4: Retorno suave a tamaño normal (3400ms)
      setTimeout(() => {
        targetEl.style.transform = '';
        targetEl.style.boxShadow = '';
        targetEl.style.transition = '';
      }, 3400);
    }

    // Fade out modal and close
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 750);
  };

  // Dynamic Keyframes Generator for 16 Mario Particles continuous parabolic orbit
  const generateDynamicKeyframes = () => {
    return MARIO_PARTICLES.map((pt) => {
      const rotMid = pt.side === 'left' ? -180 : 180;
      const rotEnd = pt.side === 'left' ? -360 : 360;
      return `
        @keyframes marioOrbit_${pt.id} {
          0% {
            transform: translate(-50%, -50%) translate3d(0, 0, 0) scale(0) rotate(0deg);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          50% {
            transform: translate(-50%, -50%) translate3d(${pt.x * 0.5}px, ${pt.y - 60}px, 0) scale(${pt.scale}) rotate(${rotMid}deg);
            opacity: 1;
          }
          85% {
            transform: translate(-50%, -50%) translate3d(${pt.x}px, ${pt.y + 40}px, 0) scale(${pt.scale * 0.8}) rotate(${rotEnd}deg);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) translate3d(${pt.x}px, ${pt.y + 40}px, 0) scale(0) rotate(${rotEnd}deg);
            opacity: 0;
          }
        }
      `;
    }).join('\n');
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-hidden transition-opacity duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Dynamic Keyframes Injection */}
      <style>{generateDynamicKeyframes()}</style>

      {/* 360 Sunburst Background Rays */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden opacity-35">
        <div
          className="w-[900px] h-[900px] sm:w-[1300px] sm:h-[1300px] rounded-full animate-[spin_25s_linear_infinite]"
          style={{
            background: `conic-gradient(from 0deg, #f59e0b 0deg 15deg, transparent 15deg 30deg, #eab308 30deg 45deg, transparent 45deg 60deg, #f59e0b 60deg 75deg, transparent 75deg 90deg, #eab308 90deg 105deg, transparent 105deg 120deg, #f59e0b 120deg 135deg, transparent 135deg 150deg, #eab308 150deg 165deg, transparent 165deg 180deg, #f59e0b 180deg 195deg, transparent 195deg 210deg, #eab308 210deg 225deg, transparent 225deg 240deg, #f59e0b 240deg 255deg, transparent 255deg 270deg, #eab308 270deg 285deg, transparent 285deg 300deg, #f59e0b 300deg 315deg, transparent 315deg 330deg, #eab308 330deg 345deg, transparent 345deg 360deg)`,
          }}
        />
      </div>

      {/* Close button top right */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white bg-slate-900/70 p-2.5 rounded-full border border-amber-400/40 backdrop-blur-sm z-50 transition-colors shadow-lg"
        title="Cerrar"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Main Single-Step Reward Card Container */}
      <div
        ref={cardRef}
        className="relative z-10 w-full max-w-sm sm:max-w-md animate-[popIn_500ms_cubic-bezier(0.175,0.885,0.32,1.275)_forwards]"
      >
        {/* 16 MARIO BROS & PAE PARTICLES - CONTINUOUS RADIAL PARABOLIC DISPERSION (COOKFLOW BLUEPRINT) */}
        {MARIO_PARTICLES.map((pt) => (
          <div
            key={pt.id}
            data-mario-particle="true"
            className="absolute z-30 pointer-events-none select-none text-3xl sm:text-4xl drop-shadow-[0_0_12px_rgba(255,255,255,0.9)]"
            style={{
              left: '50%',
              top: '50%',
              animation: `marioOrbit_${pt.id} ${pt.duration}s ease-out ${pt.delay}s infinite`,
            }}
          >
            {pt.symbol}
          </div>
        ))}

        {/* Card Main Body */}
        <div className="w-full bg-gradient-to-b from-amber-400 via-orange-500 to-red-600 border-4 border-yellow-300 rounded-[36px] p-5 sm:p-7 shadow-[0_0_60px_rgba(245,158,11,0.6)] flex flex-col items-center text-center relative overflow-hidden">
          
          {/* Sparkle background accents */}
          <div className="absolute top-3 left-4 text-yellow-200 text-2xl">✨</div>
          <div className="absolute top-4 right-5 text-yellow-200 text-2xl">⭐</div>

          {/* Trophy Header Circle */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white border-4 border-yellow-300 p-1 shadow-2xl flex items-center justify-center mb-3 animate-bounce">
            <div className="w-full h-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 rounded-full flex items-center justify-center border-2 border-yellow-200">
              <Trophy className="w-12 h-12 sm:w-14 sm:h-14 text-amber-950 fill-amber-950" />
            </div>
          </div>

          {/* Title Header */}
          <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] flex items-center justify-center gap-2">
            {title}
          </h2>
          <p className="text-xs sm:text-sm font-bold text-yellow-100 mt-1 mb-4 drop-shadow-sm">
            {rewardText}
          </p>

          {/* Dark Chocolate Points Box */}
          <div className="w-full bg-[#4a1c03]/90 border border-amber-400/50 rounded-2xl p-4 mb-4 flex items-center justify-between text-left shadow-inner">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                PUNTOS XP
              </span>
              <span className="text-2xl sm:text-3xl font-black text-yellow-300 flex items-center gap-1 drop-shadow-sm">
                <span className="text-amber-400">⚡</span> +{points}
              </span>
            </div>

            <div className="h-10 w-[1px] bg-amber-500/30" />

            <div className="flex flex-col text-right">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                NIVEL ALCANZADO
              </span>
              <span className="text-sm sm:text-base font-black text-white drop-shadow-sm">
                {badgeName}
              </span>
              <span className="text-[10px] font-bold text-amber-200/80">
                Puntualidad Certificada
              </span>
            </div>
          </div>

          {/* Golden Gift Pill */}
          <div className="w-full bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-400 border border-yellow-100 rounded-2xl p-3.5 mb-5 flex items-center gap-3 text-left shadow-md">
            <div className="p-2.5 rounded-xl bg-amber-950/90 text-yellow-300">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <span className="px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 text-[9px] font-black uppercase tracking-wider">
                REGALO PAE
              </span>
              <p className="text-xs font-black text-amber-950 mt-0.5">
                ¡Logro diario de asistencia registrado!
              </p>
            </div>
          </div>

          {/* Big Golden Single-Step Claim Button */}
          <button
            id="btn-claim-gamification-reward"
            onClick={handleClaim}
            disabled={isClaimed}
            className={`w-full py-4 px-6 rounded-2xl font-black text-base sm:text-lg uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 border-2 border-yellow-200 shadow-xl ${
              isClaimed
                ? 'bg-emerald-500 text-slate-950 scale-95 border-emerald-300 shadow-emerald-950/50'
                : 'bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-500 hover:from-yellow-200 hover:to-amber-300 text-amber-950 hover:scale-[1.03] active:scale-95 shadow-orange-950/50'
            }`}
          >
            {isClaimed ? (
              <>
                <CheckCircle className="w-6 h-6" /> ¡RECOMPENSA SUMADA!
              </>
            ) : (
              <>
                <Sparkles className="w-6 h-6 fill-amber-950" /> ¡RECLAMAR RECOMPENSAS!
              </>
            )}
          </button>

        </div>
      </div>

      {/* Global CSS Keyframes */}
      <style jsx global>{`
        @keyframes popIn {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          70% {
            transform: scale(1.06);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
