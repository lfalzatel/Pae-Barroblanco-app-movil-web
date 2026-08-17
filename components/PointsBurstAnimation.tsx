'use client';

import { useEffect, useRef } from 'react';

interface PointsBurstAnimationProps {
    points: number;          // registros nuevos guardados en esta sesión
    targetSelector: string;  // selector CSS de la cápsula de perfil, ej: '[data-points-capsule]'
    originSelector?: string; // selector del botón "Guardar" (opcional, por defecto centro-inferior de pantalla)
    onComplete: () => void;
}

// Componente sin dependencias externas: crea y anima nodos DOM directamente,
// igual patrón que usan en AnimatedNumber.tsx (requestAnimationFrame + transition CSS)
export default function PointsBurstAnimation({
    points,
    targetSelector,
    originSelector,
    onComplete,
}: PointsBurstAnimationProps) {
    const ranRef = useRef(false);
    const onCompleteRef = useRef(onComplete);

    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    useEffect(() => {
        if (ranRef.current) return;
        ranRef.current = true;

        // Puede haber varias cápsulas en el DOM (una para escritorio, otra para
        // móvil) que se muestran/ocultan con clases responsive (hidden md:flex).
        // querySelector siempre devuelve la primera en el DOM, esté visible o no,
        // así que buscamos explícitamente la que tenga tamaño real (> 0px).
        const pickVisible = (selector: string): Element | null => {
            const candidates = Array.from(document.querySelectorAll(selector));
            return (
                candidates.find((el) => {
                    const r = el.getBoundingClientRect();
                    return r.width > 0 && r.height > 0;
                }) || candidates[0] || null
            );
        };

        const targetContainer = pickVisible(targetSelector);
        const targetEl = (targetContainer?.querySelector('button') || targetContainer) as HTMLElement | null;
        const originEl = originSelector ? pickVisible(originSelector) : null;

        const targetRect = targetEl?.getBoundingClientRect();
        const originRect = originEl?.getBoundingClientRect();

        const targetX = targetRect ? targetRect.left + targetRect.width / 2 : window.innerWidth - 40;
        const targetY = targetRect ? targetRect.top + targetRect.height / 2 : 40;
        const originX = originRect ? originRect.left + originRect.width / 2 : window.innerWidth / 2;
        const originY = originRect ? originRect.top : window.innerHeight * 0.7;

        const nodes: HTMLElement[] = [];
        const timers: ReturnType<typeof setTimeout>[] = [];

        // Helper de síntesis de sonido con Web Audio API (cero dependencias externas)
        let audioCtx: AudioContext | null = null;
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume();
                }
            }
        } catch (e) {
            audioCtx = null;
        }

        const playTone = (freq: number, type: OscillatorType, durationMs: number, delayMs: number = 0, gainLevel: number = 0.12) => {
            if (!audioCtx) return;
            timers.push(setTimeout(() => {
                try {
                    if (!audioCtx || audioCtx.state === 'closed') return;
                    if (audioCtx.state === 'suspended') audioCtx.resume();

                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();

                    osc.type = type;
                    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

                    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(gainLevel, audioCtx.currentTime + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (durationMs / 1000));

                    osc.connect(gain);
                    gain.connect(audioCtx.destination);

                    osc.start(audioCtx.currentTime);
                    osc.stop(audioCtx.currentTime + (durationMs / 1000));
                } catch (err) {
                    // Silencioso si se bloquea por política de autoplay
                }
            }, delayMs));
        };

        // 🎵 EFECTOS DE SONIDO SINTETIZADOS

        // A) Arpegio celestial ascendente al despegar estrellas (0ms - 500ms)
        const arpeggioNotes = [523.25, 659.25, 783.99, 987.77, 1046.50]; // Do5, Mi5, Sol5, Si5, Do6
        arpeggioNotes.forEach((freq, idx) => {
            playTone(freq, 'sine', 280, 80 + idx * 80, 0.12);
        });

        // B) Campanada brillante de cristal al aparecer la estrella central (600ms)
        playTone(1318.51, 'sine', 600, 600, 0.15); // Mi6
        playTone(1567.98, 'sine', 700, 650, 0.12); // Sol6

        // C) Fanfarria y explosión estelar al desprenderse las 5 puntas (2550ms)
        const fireworksNotes = [1567.98, 1760.00, 1975.53, 2093.00, 2637.02]; // Sol6, La6, Si6, Do7, Mi7
        fireworksNotes.forEach((freq, idx) => {
            playTone(freq, 'triangle', 450, 2550 + idx * 60, 0.18);
            playTone(freq * 1.5, 'sine', 350, 2580 + idx * 60, 0.08); // armónico de brillo
        });

        // Inyectar animación CSS para rotación GPU fluida a 60fps en móviles
        const styleId = 'burst-sunburst-keyframes';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
                @keyframes burstSunburstSpin {
                    from { transform: translate3d(-50%, -50%, 0) scale(1.2) rotate(0deg); }
                    to { transform: translate3d(-50%, -50%, 0) scale(1.2) rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        // 1. Flash blanco suave de pantalla
        const flash = document.createElement('div');
        Object.assign(flash.style, {
            position: 'fixed', inset: '0', background: '#fff', opacity: '0',
            zIndex: '9996', pointerEvents: 'none', transition: 'opacity 150ms ease-out',
            willChange: 'opacity',
        });
        document.body.appendChild(flash);
        nodes.push(flash);
        requestAnimationFrame(() => { flash.style.opacity = '0.35'; });
        timers.push(setTimeout(() => {
            flash.style.transition = 'opacity 500ms ease-in';
            flash.style.opacity = '0';
        }, 150));

        // 2. Rayos Solares Giratorios en el centro (Sunburst Effect con Aceleración GPU)
        const sunburst = document.createElement('div');
        Object.assign(sunburst.style, {
            position: 'fixed', left: '50%', top: '42%',
            width: '360px', height: '360px',
            zIndex: '9997', pointerEvents: 'none',
            transform: 'translate3d(-50%, -50%, 0) scale(0.2)', opacity: '0',
            borderRadius: '50%',
            background: 'conic-gradient(from 0deg, rgba(251,191,36,0.35) 0deg 15deg, transparent 15deg 30deg, rgba(251,191,36,0.35) 30deg 45deg, transparent 45deg 60deg, rgba(251,191,36,0.35) 60deg 75deg, transparent 75deg 90deg, rgba(251,191,36,0.35) 90deg 105deg, transparent 105deg 120deg, rgba(251,191,36,0.35) 120deg 135deg, transparent 135deg 150deg, rgba(251,191,36,0.35) 150deg 165deg, transparent 165deg 180deg, rgba(251,191,36,0.35) 180deg 195deg, transparent 195deg 210deg, rgba(251,191,36,0.35) 210deg 225deg, transparent 225deg 240deg, rgba(251,191,36,0.35) 240deg 255deg, transparent 255deg 270deg, rgba(251,191,36,0.35) 270deg 285deg, transparent 285deg 300deg, rgba(251,191,36,0.35) 300deg 315deg, transparent 315deg 330deg, rgba(251,191,36,0.35) 330deg 345deg, transparent 345deg 360deg)',
            maskImage: 'radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)',
            WebkitMaskImage: 'radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)',
            willChange: 'transform, opacity',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
            transition: 'transform 700ms cubic-bezier(.22,1.6,.4,1), opacity 500ms ease',
        });
        document.body.appendChild(sunburst);
        nodes.push(sunburst);

        requestAnimationFrame(() => {
            sunburst.style.opacity = '1';
            sunburst.style.animation = 'burstSunburstSpin 12s linear infinite';
        });

        // 3. Doble onda expansiva inicial en el origen
        [0, 1].forEach((r) => {
            const ring = document.createElement('div');
            Object.assign(ring.style, {
                position: 'fixed', left: `${originX}px`, top: `${originY}px`,
                width: '14px', height: '14px', borderRadius: '50%',
                border: `3px solid ${r === 0 ? '#fbbf24' : '#fb923c'}`,
                zIndex: '9998', transform: 'translate3d(-50%,-50%,0) scale(1)', opacity: '0.9',
                willChange: 'transform, opacity',
                transition: 'transform 750ms ease-out, opacity 750ms ease-out',
            });
            document.body.appendChild(ring);
            nodes.push(ring);
            timers.push(setTimeout(() => requestAnimationFrame(() => {
                ring.style.transform = `translate3d(-50%,-50%,0) scale(${12 + r * 5})`;
                ring.style.opacity = '0';
            }), r * 100));
            timers.push(setTimeout(() => ring.remove(), 900 + r * 100));
        });

        // 4. Estrellas en abanico -> convergen a la cápsula
        const starsN = Math.max(points * 2, 8); // Optimizado para 60fps móvil
        for (let i = 0; i < starsN; i++) {
            const angle = (Math.PI / (starsN + 1)) * (i + 1) + Math.PI;
            const spreadX = originX + Math.cos(angle) * 80;
            const spreadY = originY + Math.sin(angle) * 50;

            const star = document.createElement('div');
            star.innerHTML = '★';
            Object.assign(star.style, {
                position: 'fixed', left: `${originX}px`, top: `${originY}px`,
                zIndex: '9999', color: '#fbbf24', fontSize: '32px', lineHeight: '1',
                textShadow: '0 0 12px rgba(251,191,36,0.9), 0 0 24px rgba(251,146,60,0.8)',
                transform: 'translate3d(-50%,-50%,0) scale(0.2) rotate(0deg)', opacity: '0',
                willChange: 'left, top, transform, opacity',
                WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden',
                transition: 'left 1200ms cubic-bezier(.22,1.6,.4,1), top 1200ms cubic-bezier(.22,1.6,.4,1), transform 1200ms cubic-bezier(.22,1.6,.4,1), opacity 1200ms ease',
            });
            document.body.appendChild(star);
            nodes.push(star);

            requestAnimationFrame(() => {
                star.style.left = `${spreadX}px`;
                star.style.top = `${spreadY}px`;
                star.style.transform = 'translate3d(-50%,-50%,0) scale(2) rotate(45deg)';
                star.style.opacity = '1';
            });

            // Estela de chispas
            timers.push(setTimeout(() => {
                for (let s = 0; s < 2; s++) {
                    const dot = document.createElement('div');
                    Object.assign(dot.style, {
                        position: 'fixed', left: `${spreadX}px`, top: `${spreadY}px`,
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: s % 2 === 0 ? '#fde68a' : '#fb923c',
                        zIndex: '9998', opacity: '1', boxShadow: '0 0 8px rgba(251,191,36,0.9)',
                        willChange: 'transform, opacity',
                        transition: 'transform 700ms ease-out, opacity 700ms ease-out',
                    });
                    document.body.appendChild(dot);
                    nodes.push(dot);
                    const dx = (Math.random() - 0.5) * 70;
                    const dy = (Math.random() - 0.5) * 70 - 10;
                    requestAnimationFrame(() => {
                        dot.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(0.2)`;
                        dot.style.opacity = '0';
                    });
                    timers.push(setTimeout(() => dot.remove(), 720));
                }
            }, 300 + i * 110));

            // Convergencia progresiva hacia la cápsula
            timers.push(setTimeout(() => {
                star.style.left = `${targetX}px`;
                star.style.top = `${targetY}px`;
                star.style.transform = 'translate3d(-50%,-50%,0) scale(0.35) rotate(600deg)';
                star.style.opacity = '0.9';
            }, 800 + i * 110));

            timers.push(setTimeout(() => star.remove(), 2000 + i * 110));
        }

        // 5. Gran Insignia de Estrella de Cristal Blur "+N PUNTOS PAE" centrada en pantalla
        const starContainer = document.createElement('div');
        Object.assign(starContainer.style, {
            position: 'fixed', left: '50%', top: '42%',
            width: '230px', height: '230px',
            zIndex: '100000', transform: 'translate3d(-50%,-50%,0) scale(0.2)', opacity: '0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
            willChange: 'transform, opacity',
            WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden',
            transition: 'transform 700ms cubic-bezier(.22,1.6,.4,1), opacity 500ms ease',
        });

        // Fondo de Estrella en Cristal Blur Semitransparente Optimizado para Móvil GPU
        const starBg = document.createElement('div');
        Object.assign(starBg.style, {
            position: 'absolute', inset: '0',
            clipPath: 'polygon(50% 0%, 63% 33%, 98% 35%, 70% 58%, 81% 92%, 50% 72%, 19% 92%, 30% 58%, 2% 35%, 37% 33%)',
            background: 'radial-gradient(circle, rgba(251,191,36,0.85) 0%, rgba(245,158,11,0.65) 100%)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '2px solid rgba(255, 255, 255, 0.7)',
            boxShadow: '0 0 25px rgba(251,191,36,0.9), inset 0 0 15px rgba(255,255,255,0.4)',
            willChange: 'transform, opacity',
            transition: 'transform 600ms cubic-bezier(.22,1.6,.4,1), opacity 500ms ease',
        });
        starContainer.appendChild(starBg);

        // Texto interno en negrita brillante estilo Temu
        const labelText = document.createElement('div');
        labelText.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
             <span style="font-size: 21px; font-weight: 900; color: #ffffff; text-shadow: 0 2px 10px rgba(0,0,0,0.9), 0 0 12px rgba(251,191,36,1); font-family: system-ui, -apple-system, sans-serif; letter-spacing: 0.5px;">
               +${points} PUNTOS PAE
             </span>
             <span style="font-size: 11px; font-weight: 800; color: #fef3c7; background: rgba(0,0,0,0.3); padding: 2px 10px; borderRadius: 9999px; text-transform: uppercase; letter-spacing: 1px;">
               ¡Excelente Registro!
             </span>
          </div>
        `;
        Object.assign(labelText.style, {
            position: 'relative', zIndex: '2', textCenter: 'center', textAlign: 'center',
            willChange: 'opacity',
            transition: 'transform 400ms ease, opacity 400ms ease',
        });
        starContainer.appendChild(labelText);

        document.body.appendChild(starContainer);
        nodes.push(starContainer);

        requestAnimationFrame(() => {
            starContainer.style.transform = 'translate3d(-50%,-50%,0) scale(1.2)';
            starContainer.style.opacity = '1';
        });

        timers.push(setTimeout(() => {
            starContainer.style.transform = 'translate3d(-50%,-50%,0) scale(1)';
        }, 600));

        // DESPRENDIMIENTO Y EXPLOSIÓN ÉPICA DE LAS 5 PUNTAS (Fase de Recompensa al segundo 2.5)
        timers.push(setTimeout(() => {
            // El núcleo central de cristal se encoge girando hacia adentro
            starBg.style.transition = 'transform 600ms ease-in, opacity 600ms ease-in';
            starBg.style.transform = 'scale(0) rotate(240deg)';
            starBg.style.opacity = '0';
            labelText.style.transition = 'opacity 350ms ease-in';
            labelText.style.opacity = '0';

            sunburst.style.transition = 'transform 600ms ease-in, opacity 600ms ease-in';
            sunburst.style.transform = 'translate3d(-50%,-50%,0) scale(0.1) rotate(360deg)';
            sunburst.style.opacity = '0';

            // Desprendimiento de 5 grandes estrellas doradas volando hacia afuera en 5 direcciones (0°, 72°, 144°, 216°, 288°)
            for (let p = 0; p < 5; p++) {
                const tipAngle = ((p * 72) - 90) * (Math.PI / 180);
                const startX = window.innerWidth / 2 + Math.cos(tipAngle) * 45;
                const startY = window.innerHeight * 0.42 + Math.sin(tipAngle) * 45;

                const tip = document.createElement('div');
                tip.innerHTML = '★';
                Object.assign(tip.style, {
                    position: 'fixed', left: `${startX}px`, top: `${startY}px`,
                    zIndex: '100001', color: '#fbbf24', fontSize: '38px', lineHeight: '1',
                    textShadow: '0 0 16px rgba(251,191,36,1), 0 0 30px rgba(251,146,60,1)',
                    transform: 'translate3d(-50%,-50%,0) scale(1.4) rotate(0deg)', opacity: '1',
                    willChange: 'transform, opacity',
                    transition: 'transform 800ms cubic-bezier(.17,.89,.32,1.28), opacity 800ms ease-out',
                });
                document.body.appendChild(tip);
                nodes.push(tip);

                const destX = Math.cos(tipAngle) * 150;
                const destY = Math.sin(tipAngle) * 150;

                requestAnimationFrame(() => {
                    tip.style.transform = `translate3d(calc(-50% + ${destX}px), calc(-50% + ${destY}px), 0) scale(0.1) rotate(${360 + p * 72}deg)`;
                    tip.style.opacity = '0';
                });

                // Chispas de fuegos artificiales al desprenderse cada punta
                for (let spark = 0; spark < 3; spark++) {
                    const sparkEl = document.createElement('div');
                    Object.assign(sparkEl.style, {
                        position: 'fixed', left: `${startX}px`, top: `${startY}px`,
                        width: '7px', height: '7px', borderRadius: '50%',
                        background: spark % 2 === 0 ? '#ffffff' : '#fb923c',
                        zIndex: '100002', opacity: '1',
                        boxShadow: '0 0 10px rgba(251,191,36,1)',
                        willChange: 'transform, opacity',
                        transition: 'transform 700ms ease-out, opacity 700ms ease-out',
                    });
                    document.body.appendChild(sparkEl);
                    nodes.push(sparkEl);

                    const sparkAngle = tipAngle + (Math.random() - 0.5) * 1.2;
                    const sparkDist = 70 + Math.random() * 70;
                    const sdx = Math.cos(sparkAngle) * sparkDist;
                    const sdy = Math.sin(sparkAngle) * sparkDist;

                    requestAnimationFrame(() => {
                        sparkEl.style.transform = `translate3d(${sdx}px, ${sdy}px, 0) scale(0.1)`;
                        sparkEl.style.opacity = '0';
                    });
                    timers.push(setTimeout(() => sparkEl.remove(), 750));
                }

                timers.push(setTimeout(() => tip.remove(), 850));
            }
        }, 2550));

        timers.push(setTimeout(() => starContainer.remove(), 3200));

        // 6. Crecimiento Progresivo y Halo Redondeado de la Cápsula
        if (targetEl) {
            const computedRadius = window.getComputedStyle(targetEl).borderRadius || '9999px';

            // Inicio suave al despegar las estrellas
            timers.push(setTimeout(() => {
                targetEl.style.transition = 'transform 400ms cubic-bezier(.22,1.6,.4,1), box-shadow 400ms ease';
                targetEl.style.borderRadius = computedRadius;
                targetEl.style.transform = 'scale(1.1)';
                targetEl.style.boxShadow = '0 0 18px 4px rgba(251,191,36,0.6)';
            }, 800));

            // Crecimiento intermedio al volar el grupo de estrellas
            timers.push(setTimeout(() => {
                targetEl.style.transform = 'scale(1.22)';
                targetEl.style.boxShadow = '0 0 30px 10px rgba(251,191,36,0.85)';
            }, 1800));

            // Pulso máximo al estallar las 5 puntas y asimilar toda la energía
            timers.push(setTimeout(() => {
                targetEl.style.transform = 'scale(1.32)';
                targetEl.style.boxShadow = '0 0 45px 16px rgba(251,191,36,1)';
            }, 2600));

            // Retorno suave a su tamaño normal
            timers.push(setTimeout(() => {
                targetEl.style.transform = '';
                targetEl.style.boxShadow = '';
                targetEl.style.transition = '';
            }, 3400));
        }

        // Fin de la secuencia -> aviso al componente padre tras 3.7s
        const doneTimer = setTimeout(() => {
            if (onCompleteRef.current) onCompleteRef.current();
        }, 3700);
        timers.push(doneTimer);

        return () => {
            timers.forEach(clearTimeout);
            nodes.forEach((n) => n.remove());
            if (audioCtx && audioCtx.state !== 'closed') {
                try { audioCtx.close(); } catch(e) {}
            }
            if (targetEl) {
                targetEl.style.transform = '';
                targetEl.style.boxShadow = '';
                targetEl.style.transition = '';
            }
        };
    }, [points, targetSelector, originSelector]); // Remove onComplete from deps

    return null; // este componente no renderiza JSX: solo orquesta nodos DOM temporales
}
