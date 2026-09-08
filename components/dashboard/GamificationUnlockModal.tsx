'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Trophy, Star, CheckCircle, Gift, X } from 'lucide-react';
import {
  playGamificationFanfare,
  playCardFlipSound,
  playCounterTick,
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
}

const PAE_PARTICLES = ['🍎', '🥛', '🥪', '🍇', '⭐', '🪙', '🎒', '🏫', '🥳', '🏆'];

export default function GamificationUnlockModal({
  isOpen,
  onClose,
  title = '¡Asistencia Confirmada!',
  points = 50,
  rewardText = '¡Excelente puntualidad en la entrega del PAE!',
  badgeName = 'Estudiante Ejemplar PAE',
}: GamificationUnlockModalProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [displayedPoints, setDisplayedPoints] = useState(0);
  const [particles, setParticles] = useState<Array<{ id: number; char: string; left: number; delay: number; duration: number; size: number }>>([]);
  const [isClaimed, setIsClaimed] = useState(false);

  // Initialize particles & play initial fanfare when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsFlipped(false);
      setDisplayedPoints(0);
      setIsClaimed(false);
      playGamificationFanfare();

      // Generate random floating particles
      const newParticles = Array.from({ length: 18 }).map((_, idx) => ({
        id: idx,
        char: PAE_PARTICLES[Math.floor(Math.random() * PAE_PARTICLES.length)],
        left: Math.random() * 90 + 5, // 5% to 95%
        delay: Math.random() * 2,
        duration: Math.random() * 3 + 3, // 3s to 6s
        size: Math.random() * 1.2 + 1.2, // 1.2rem to 2.4rem
      }));
      setParticles(newParticles);
    }
  }, [isOpen]);

  // Handle card flip interaction
  const handleFlipCard = () => {
    if (isFlipped) return;
    setIsFlipped(true);
    playCardFlipSound();

    // Start numeric tick count-up after card finishes turning
    setTimeout(() => {
      let current = 0;
      const step = Math.max(1, Math.ceil(points / 20));
      const timer = setInterval(() => {
        current += step;
        if (current >= points) {
          current = points;
          clearInterval(timer);
          // Trigger voice readout on completion
          speakVoiceConfirmation(`¡Felicidades! Has ganado ${points} puntos PAE.`);
        } else {
          playCounterTick();
        }
        setDisplayedPoints(current);
      }, 40);
    }, 400);
  };

  // Handle final claim button
  const handleClaim = () => {
    setIsClaimed(true);
    playRewardClaimSound();
    setTimeout(() => {
      onClose();
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-hidden animate-fadeIn">
      {/* 360 Sunburst Background Rays */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden opacity-30">
        <div
          className="w-[800px] h-[800px] sm:w-[1200px] sm:h-[1200px] rounded-full animate-[spin_20s_linear_infinite]"
          style={{
            background: `conic-gradient(from 0deg, #f59e0b 0deg 15deg, transparent 15deg 30deg, #eab308 30deg 45deg, transparent 45deg 60deg, #f59e0b 60deg 75deg, transparent 75deg 90deg, #eab308 90deg 105deg, transparent 105deg 120deg, #f59e0b 120deg 135deg, transparent 135deg 150deg, #eab308 150deg 165deg, transparent 165deg 180deg, #f59e0b 180deg 195deg, transparent 195deg 210deg, #eab308 210deg 225deg, transparent 225deg 240deg, #f59e0b 240deg 255deg, transparent 255deg 270deg, #eab308 270deg 285deg, transparent 285deg 300deg, #f59e0b 300deg 315deg, transparent 315deg 330deg, #eab308 330deg 345deg, transparent 345deg 360deg)`,
          }}
        />
      </div>

      {/* Upward Floating PAE Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute bottom-[-50px] animate-[bounce_2s_infinite] transition-all"
            style={{
              left: `${p.left}%`,
              fontSize: `${p.size}rem`,
              animation: `floatUp ${p.duration}s linear infinite`,
              animationDelay: `${p.delay}s`,
            }}
          >
            {p.char}
          </div>
        ))}
      </div>

      {/* Close button top right */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-900/60 p-2 rounded-full border border-slate-700/50 backdrop-blur-sm z-50 transition-colors"
        title="Cerrar"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Main Container Card */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-md flex flex-col items-center">
        {/* Header Header Banner */}
        <div className="text-center mb-6 animate-bounce">
          <span className="px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-widest bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 shadow-lg shadow-amber-500/30 flex items-center justify-center gap-1.5 mx-auto w-fit">
            <Trophy className="w-4 h-4 fill-slate-950" />
            ¡MODO RECOMPENSA HIPER-DOPAMINA!
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-2 drop-shadow-md">
            {title}
          </h2>
        </div>

        {/* 3D Flip Card Container */}
        <div
          className="w-full h-80 sm:h-96 cursor-pointer select-none"
          style={{ perspective: '1000px' }}
          onClick={handleFlipCard}
        >
          <div
            className="relative w-full h-full duration-700 ease-out transition-transform rounded-3xl"
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* FRONT SIDE (Gift Mystery Card) */}
            <div
              className="absolute inset-0 w-full h-full rounded-3xl p-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-2 border-amber-400/60 shadow-[0_0_40px_rgba(245,158,11,0.3)] flex flex-col items-center justify-center text-center backdrop-blur-xl"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-xl shadow-amber-500/40 animate-pulse mb-4 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950/90 rounded-[14px] flex items-center justify-center">
                  <Gift className="w-14 h-14 sm:w-16 sm:h-16 text-amber-400 animate-bounce" />
                </div>
              </div>
              <p className="text-amber-300 font-bold text-lg mb-1">
                ¡Tienes una tarjeta PAE dorada!
              </p>
              <p className="text-xs text-slate-300 max-w-xs">
                Toca aquí para voltear la tarjeta 3D y descubrir tus puntos y medalla.
              </p>

              <div className="mt-6 px-4 py-2 bg-amber-500/20 border border-amber-400/40 rounded-full text-amber-300 text-xs font-semibold flex items-center gap-2 animate-pulse">
                <Sparkles className="w-4 h-4" /> Presiona para Abrir
              </div>
            </div>

            {/* BACK SIDE (Revealed Gold Reward) */}
            <div
              className="absolute inset-0 w-full h-full rounded-3xl p-6 bg-gradient-to-br from-amber-950 via-slate-900 to-yellow-950 border-2 border-yellow-400 shadow-[0_0_50px_rgba(234,179,8,0.5)] flex flex-col items-center justify-between text-center backdrop-blur-xl"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-yellow-300 via-amber-500 to-amber-600 p-1 shadow-lg shadow-amber-500/50 mb-2">
                  <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center text-4xl">
                    ⭐
                  </div>
                </div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300 bg-amber-900/60 px-3 py-1 rounded-full border border-amber-500/40">
                  {badgeName}
                </span>
              </div>

              {/* Points Counter */}
              <div className="my-2">
                <div className="text-4xl sm:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-100 drop-shadow-md">
                  +{displayedPoints} XP
                </div>
                <p className="text-xs text-amber-200/90 font-medium mt-1">
                  {rewardText}
                </p>
              </div>

              {/* Claim Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClaim();
                }}
                disabled={isClaimed}
                className={`w-full py-3.5 px-6 rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-xl ${
                  isClaimed
                    ? 'bg-emerald-500 text-slate-950 scale-95 shadow-emerald-500/50'
                    : 'bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-500 text-slate-950 hover:scale-105 active:scale-95 shadow-amber-500/40'
                }`}
              >
                {isClaimed ? (
                  <>
                    <CheckCircle className="w-5 h-5" /> ¡Recompensas Sumadas!
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 fill-slate-950" /> ¡Reclamar Recompensa!
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Global CSS Animations for keyframes */}
      <style jsx global>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) rotate(360deg);
            opacity: 0;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
