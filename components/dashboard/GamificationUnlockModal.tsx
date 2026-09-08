'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Gift, Sparkles, X, CheckCircle } from 'lucide-react';
import {
  playGamificationFanfare,
  playRewardClaimSound,
  speakVoiceConfirmation,
} from '@/lib/ui-sounds';

interface GamificationUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  points?: number;
  rewardText?: string;
  badgeName?: string;
  onClaimWithParticles?: () => void;
}

const CARD_EMOJIS = [
  { char: '🍎', className: 'top-[18%] left-[8%] text-3xl sm:text-4xl animate-bounce' },
  { char: '🥪', className: 'top-[18%] right-[8%] text-3xl sm:text-4xl animate-bounce [animation-delay:200ms]' },
  { char: '🪙', className: 'top-[44%] left-[4%] text-2xl sm:text-3xl animate-pulse' },
  { char: '🪙', className: 'top-[44%] right-[4%] text-2xl sm:text-3xl animate-pulse [animation-delay:300ms]' },
  { char: '🧀', className: 'top-[68%] left-[6%] text-2xl sm:text-3xl animate-bounce [animation-delay:400ms]' },
  { char: '🍇', className: 'top-[68%] right-[6%] text-2xl sm:text-3xl animate-bounce [animation-delay:150ms]' },
];

export default function GamificationUnlockModal({
  isOpen,
  onClose,
  title = '¡RECOMPENSA PAE!',
  points = 50,
  rewardText = '¡Excelente puntualidad en el registro!',
  badgeName = 'Estudiante PAE',
  onClaimWithParticles,
}: GamificationUnlockModalProps) {
  const [isClaimed, setIsClaimed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Play fanfare when modal pops in
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

    // Play sounds & speech confirmation
    playRewardClaimSound();
    speakVoiceConfirmation(`¡Felicidades! Has ganado ${points} puntos PAE.`);

    // Target profile capsule
    const targetEl = getVisibleCapsule();
    const targetRect = targetEl?.getBoundingClientRect();
    const targetX = targetRect ? targetRect.left + targetRect.width / 2 : window.innerWidth - 60;
    const targetY = targetRect ? targetRect.top + targetRect.height / 2 : 40;

    // Collect positions of card emoticons to launch
    const emojiElements = cardRef.current?.querySelectorAll('[data-emoticon-particle]');
    const nodes: HTMLElement[] = [];

    // Helper Web Audio synthesizer for flight chime tones
    let audioCtx: AudioContext | null = null;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) audioCtx = new AudioCtxClass();
    } catch (err) {}

    const playChimeTone = (freq: number, delayMs: number) => {
      setTimeout(() => {
        try {
          if (!audioCtx) return;
          if (audioCtx.state === 'suspended') audioCtx.resume();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
          gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.14, audioCtx.currentTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(audioCtx.currentTime);
          osc.stop(audioCtx.currentTime + 0.2);
        } catch (e) {}
      }, delayMs);
    };

    // Animate emoticons flying from card straight to capsule
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
          fontSize: '28px',
          lineHeight: '1',
          zIndex: '100000',
          transform: 'translate(-50%, -50%) scale(1) rotate(0deg)',
          opacity: '1',
          pointerEvents: 'none',
          willChange: 'transform, opacity',
          transition: 'transform 900ms cubic-bezier(.22,1.6,.4,1), opacity 900ms ease',
        });
        document.body.appendChild(flyer);
        nodes.push(flyer);

        const delay = idx * 100;

        // Sound chime for each emoticon flight
        playChimeTone(1046.50 + idx * 90, delay);

        setTimeout(() => {
          requestAnimationFrame(() => {
            const deltaX = targetX - startX;
            const deltaY = targetY - startY;
            flyer.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(0.3) rotate(360deg)`;
            flyer.style.opacity = '0.9';
          });
        }, delay);

        setTimeout(() => {
          flyer.remove();
        }, delay + 950);
      });
    }

    // Pulse & consume effect on Profile Points Capsule
    if (targetEl) {
      setTimeout(() => {
        targetEl.style.transition = 'transform 300ms cubic-bezier(.22,1.6,.4,1), box-shadow 300ms ease';
        targetEl.style.transform = 'scale(1.18)';
        targetEl.style.boxShadow = '0 0 25px 8px rgba(251,191,36,0.8)';
      }, 300);

      setTimeout(() => {
        targetEl.style.transform = 'scale(1.3)';
        targetEl.style.boxShadow = '0 0 40px 14px rgba(251,191,36,1)';
      }, 700);

      setTimeout(() => {
        targetEl.style.transform = '';
        targetEl.style.boxShadow = '';
        targetEl.style.transition = '';
      }, 1400);
    }

    // Also trigger parent callback if provided
    if (onClaimWithParticles) {
      onClaimWithParticles();
    }

    // Fade out modal and close
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 700);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-hidden transition-opacity duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
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
        {/* EMOTICONS FLOATING ON TOP OF THE CARD (Z-30 LAYER AS IN COOKFLOW) */}
        {CARD_EMOJIS.map((item, idx) => (
          <div
            key={idx}
            data-emoticon-particle="true"
            className={`absolute z-30 pointer-events-none select-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] ${item.className}`}
          >
            {item.char}
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
