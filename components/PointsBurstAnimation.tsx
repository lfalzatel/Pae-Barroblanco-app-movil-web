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

        // 1. Flash blanco suave de pantalla
        const flash = document.createElement('div');
        Object.assign(flash.style, {
            position: 'fixed', inset: '0', background: '#fff', opacity: '0',
            zIndex: '9996', pointerEvents: 'none', transition: 'opacity 120ms ease-out',
        });
        document.body.appendChild(flash);
        nodes.push(flash);
        requestAnimationFrame(() => { flash.style.opacity = '0.3'; });
        timers.push(setTimeout(() => {
            flash.style.transition = 'opacity 400ms ease-in';
            flash.style.opacity = '0';
        }, 120));

        // 2. Doble onda expansiva inicial
        [0, 1].forEach((r) => {
            const ring = document.createElement('div');
            Object.assign(ring.style, {
                position: 'fixed', left: `${originX}px`, top: `${originY}px`,
                width: '12px', height: '12px', borderRadius: '50%',
                border: `3px solid ${r === 0 ? '#fbbf24' : '#fb923c'}`,
                zIndex: '9998', transform: 'translate(-50%,-50%) scale(1)', opacity: '0.9',
                transition: 'transform 650ms ease-out, opacity 650ms ease-out',
            });
            document.body.appendChild(ring);
            nodes.push(ring);
            timers.push(setTimeout(() => requestAnimationFrame(() => {
                ring.style.transform = `translate(-50%,-50%) scale(${10 + r * 4})`;
                ring.style.opacity = '0';
            }), r * 90));
            timers.push(setTimeout(() => ring.remove(), 800 + r * 90));
        });

        // 3. Destello radial dorado en origen
        const glow = document.createElement('div');
        Object.assign(glow.style, {
            position: 'fixed', left: `${originX}px`, top: `${originY}px`,
            width: '100px', height: '100px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,237,180,0.95) 0%, rgba(251,191,36,0.6) 40%, rgba(251,191,36,0) 70%)',
            zIndex: '9997', transform: 'translate(-50%,-50%) scale(0.3)', opacity: '1',
            transition: 'transform 450ms ease-out, opacity 450ms ease-out',
        });
        document.body.appendChild(glow);
        nodes.push(glow);
        requestAnimationFrame(() => {
            glow.style.transform = 'translate(-50%,-50%) scale(1.8)';
            glow.style.opacity = '0';
        });
        timers.push(setTimeout(() => glow.remove(), 500));

        // 4. Estrellas en abanico -> convergen a la cápsula
        const starsN = Math.max(points * 2, 8); // Abundantes estrellas brillantes
        for (let i = 0; i < starsN; i++) {
            const angle = (Math.PI / (starsN + 1)) * (i + 1) + Math.PI;
            const spreadX = originX + Math.cos(angle) * 75;
            const spreadY = originY + Math.sin(angle) * 45;

            const star = document.createElement('div');
            star.innerHTML = '★';
            Object.assign(star.style, {
                position: 'fixed', left: `${originX}px`, top: `${originY}px`,
                zIndex: '9999', color: '#fbbf24', fontSize: '32px', lineHeight: '1',
                filter: 'drop-shadow(0 0 12px rgba(251,191,36,1)) drop-shadow(0 0 24px rgba(251,146,60,0.8))',
                transform: 'translate(-50%,-50%) scale(0.2) rotate(0deg)', opacity: '0',
                transition: 'left 1050ms cubic-bezier(.22,1.6,.4,1), top 1050ms cubic-bezier(.22,1.6,.4,1), transform 1050ms cubic-bezier(.22,1.6,.4,1), opacity 1050ms ease',
            });
            document.body.appendChild(star);
            nodes.push(star);

            requestAnimationFrame(() => {
                star.style.left = `${spreadX}px`;
                star.style.top = `${spreadY}px`;
                star.style.transform = 'translate(-50%,-50%) scale(1.9) rotate(45deg)';
                star.style.opacity = '1';
            });

            // Estela de chispas
            timers.push(setTimeout(() => {
                for (let s = 0; s < 3; s++) {
                    const dot = document.createElement('div');
                    Object.assign(dot.style, {
                        position: 'fixed', left: `${spreadX}px`, top: `${spreadY}px`,
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: s % 2 === 0 ? '#fde68a' : '#fb923c',
                        zIndex: '9998', opacity: '1', boxShadow: '0 0 8px rgba(251,191,36,0.9)',
                        transition: 'transform 600ms ease-out, opacity 600ms ease-out',
                    });
                    document.body.appendChild(dot);
                    nodes.push(dot);
                    const dx = (Math.random() - 0.5) * 70;
                    const dy = (Math.random() - 0.5) * 70 - 10;
                    requestAnimationFrame(() => {
                        dot.style.transform = `translate(${dx}px, ${dy}px) scale(0.3)`;
                        dot.style.opacity = '0';
                    });
                    timers.push(setTimeout(() => dot.remove(), 620));
                }
            }, 250 + i * 90));

            // Convergencia hacia la cápsula
            timers.push(setTimeout(() => {
                star.style.left = `${targetX}px`;
                star.style.top = `${targetY}px`;
                star.style.transform = 'translate(-50%,-50%) scale(0.35) rotate(540deg)';
                star.style.opacity = '0.9';
            }, 300 + i * 90));

            timers.push(setTimeout(() => star.remove(), 1350 + i * 90));
        }

        // 5. Insignia/Texto "+N GESTOR PAE ✨" perfectamente centrado en pantalla
        const label = document.createElement('div');
        label.textContent = `+${points} GESTOR PAE ✨`;
        Object.assign(label.style, {
            position: 'fixed', left: '50%', top: '42%',
            zIndex: '100000', transform: 'translate(-50%,-50%) scale(0.3)', opacity: '0',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#ffffff', fontWeight: '900', fontSize: '20px', letterSpacing: '1px',
            padding: '10px 24px', borderRadius: '9999px',
            boxShadow: '0 10px 30px rgba(245, 158, 11, 0.5), 0 0 25px rgba(251, 191, 36, 0.8)',
            border: '2px solid rgba(255, 255, 255, 0.4)',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)', pointerEvents: 'none',
            transition: 'transform 600ms cubic-bezier(.22,1.6,.4,1), opacity 400ms ease',
        });
        document.body.appendChild(label);
        nodes.push(label);
        requestAnimationFrame(() => {
            label.style.transform = 'translate(-50%,-50%) scale(1.15)';
            label.style.opacity = '1';
        });
        timers.push(setTimeout(() => {
            label.style.transform = 'translate(-50%,-70%) scale(1)';
        }, 500));
        timers.push(setTimeout(() => { label.style.opacity = '0'; }, 1500));
        timers.push(setTimeout(() => label.remove(), 1900));

        // 6. Crecimiento Progresivo y Halo Redondeado de la Cápsula
        if (targetEl) {
            const computedRadius = window.getComputedStyle(targetEl).borderRadius || '9999px';

            // Inicio suave al volar las primeras estrellas
            timers.push(setTimeout(() => {
                targetEl.style.transition = 'transform 350ms cubic-bezier(.22,1.6,.4,1), box-shadow 350ms ease';
                targetEl.style.borderRadius = computedRadius;
                targetEl.style.transform = 'scale(1.08)';
                targetEl.style.boxShadow = '0 0 15px 4px rgba(251,191,36,0.6)';
            }, 450));

            // Crecimiento intermedio al llegar el grueso de las estrellas
            timers.push(setTimeout(() => {
                targetEl.style.transform = 'scale(1.18)';
                targetEl.style.boxShadow = '0 0 25px 8px rgba(251,191,36,0.85)';
            }, 1000));

            // Pulso máximo de asimilación
            timers.push(setTimeout(() => {
                targetEl.style.transform = 'scale(1.24)';
                targetEl.style.boxShadow = '0 0 35px 12px rgba(251,191,36,0.95)';
            }, 1450));

            // Retorno suave a su tamaño original
            timers.push(setTimeout(() => {
                targetEl.style.transform = '';
                targetEl.style.boxShadow = '';
                targetEl.style.transition = '';
            }, 1900));
        }

        // Fin de la secuencia -> aviso al componente padre
        const doneTimer = setTimeout(() => {
            if (onCompleteRef.current) onCompleteRef.current();
        }, 2050);
        timers.push(doneTimer);

        return () => {
            timers.forEach(clearTimeout);
            nodes.forEach((n) => n.remove());
            if (targetEl) {
                targetEl.style.transform = '';
                targetEl.style.boxShadow = '';
                targetEl.style.transition = '';
            }
        };
    }, [points, targetSelector, originSelector]); // Remove onComplete from deps

    return null; // este componente no renderiza JSX: solo orquesta nodos DOM temporales
}
