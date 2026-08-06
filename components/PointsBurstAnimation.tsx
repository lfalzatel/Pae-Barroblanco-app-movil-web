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

        const targetEl = pickVisible(targetSelector);
        const originEl = originSelector ? pickVisible(originSelector) : null;

        const targetRect = targetEl?.getBoundingClientRect();
        const originRect = originEl?.getBoundingClientRect();

        const targetX = targetRect ? targetRect.left + targetRect.width / 2 : window.innerWidth - 40;
        const targetY = targetRect ? targetRect.top + targetRect.height / 2 : 40;
        const originX = originRect ? originRect.left + originRect.width / 2 : window.innerWidth / 2;
        const originY = originRect ? originRect.top : window.innerHeight * 0.7;

        const nodes: HTMLElement[] = [];
        const timers: ReturnType<typeof setTimeout>[] = [];

        // 1. Flash blanco de pantalla
        const flash = document.createElement('div');
        Object.assign(flash.style, {
            position: 'fixed', inset: '0', background: '#fff', opacity: '0',
            zIndex: '9996', pointerEvents: 'none', transition: 'opacity 90ms ease-out',
        });
        document.body.appendChild(flash);
        nodes.push(flash);
        requestAnimationFrame(() => { flash.style.opacity = '0.35'; });
        timers.push(setTimeout(() => {
            flash.style.transition = 'opacity 350ms ease-in';
            flash.style.opacity = '0';
        }, 90));

        // 2. Doble onda expansiva
        [0, 1].forEach((r) => {
            const ring = document.createElement('div');
            Object.assign(ring.style, {
                position: 'fixed', left: `${originX}px`, top: `${originY}px`,
                width: '10px', height: '10px', borderRadius: '50%',
                border: `3px solid ${r === 0 ? '#fbbf24' : '#fb923c'}`,
                zIndex: '9998', transform: 'translate(-50%,-50%) scale(1)', opacity: '0.9',
                transition: 'transform 550ms ease-out, opacity 550ms ease-out',
            });
            document.body.appendChild(ring);
            nodes.push(ring);
            timers.push(setTimeout(() => requestAnimationFrame(() => {
                ring.style.transform = `translate(-50%,-50%) scale(${9 + r * 3})`;
                ring.style.opacity = '0';
            }), r * 80));
            timers.push(setTimeout(() => ring.remove(), 700 + r * 80));
        });

        // 3. Destello radial dorado
        const glow = document.createElement('div');
        Object.assign(glow.style, {
            position: 'fixed', left: `${originX}px`, top: `${originY}px`,
            width: '90px', height: '90px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,237,180,0.95) 0%, rgba(251,191,36,0.6) 40%, rgba(251,191,36,0) 70%)',
            zIndex: '9997', transform: 'translate(-50%,-50%) scale(0.3)', opacity: '1',
            transition: 'transform 350ms ease-out, opacity 400ms ease-out',
        });
        document.body.appendChild(glow);
        nodes.push(glow);
        requestAnimationFrame(() => {
            glow.style.transform = 'translate(-50%,-50%) scale(1.6)';
            glow.style.opacity = '0';
        });
        timers.push(setTimeout(() => glow.remove(), 450));

        // 4. Estrellas en abanico -> convergen a la cápsula, con estela de chispas
        const starsN = Math.max(points, 5); // nunca menos de 5, para que siempre se sienta generoso
        for (let i = 0; i < starsN; i++) {
            const angle = (Math.PI / (starsN + 1)) * (i + 1) + Math.PI;
            const spreadX = originX + Math.cos(angle) * 55;
            const spreadY = originY + Math.sin(angle) * 35;

            const star = document.createElement('div');
            star.innerHTML = '★';
            Object.assign(star.style, {
                position: 'fixed', left: `${originX}px`, top: `${originY}px`,
                zIndex: '9999', color: '#fbbf24', fontSize: '30px', lineHeight: '1',
                filter: 'drop-shadow(0 0 12px rgba(251,191,36,1)) drop-shadow(0 0 24px rgba(251,146,60,0.7))',
                transform: 'translate(-50%,-50%) scale(0.2) rotate(0deg)', opacity: '0',
                transition: 'left 900ms cubic-bezier(.22,1.6,.4,1), top 900ms cubic-bezier(.22,1.6,.4,1), transform 900ms cubic-bezier(.22,1.6,.4,1), opacity 900ms ease',
            });
            document.body.appendChild(star);
            nodes.push(star);

            requestAnimationFrame(() => {
                star.style.left = `${spreadX}px`;
                star.style.top = `${spreadY}px`;
                star.style.transform = 'translate(-50%,-50%) scale(1.8) rotate(40deg)';
                star.style.opacity = '1';
            });

            // estela de chispas al llegar al punto de abanico
            timers.push(setTimeout(() => {
                for (let s = 0; s < 4; s++) {
                    const dot = document.createElement('div');
                    Object.assign(dot.style, {
                        position: 'fixed', left: `${spreadX}px`, top: `${spreadY}px`,
                        width: '5px', height: '5px', borderRadius: '50%',
                        background: s % 2 === 0 ? '#fde68a' : '#fb923c',
                        zIndex: '9998', opacity: '1', boxShadow: '0 0 6px rgba(251,191,36,0.9)',
                        transition: 'transform 500ms ease-out, opacity 500ms ease-out',
                    });
                    document.body.appendChild(dot);
                    nodes.push(dot);
                    const dx = (Math.random() - 0.5) * 60;
                    const dy = (Math.random() - 0.5) * 60 - 10;
                    requestAnimationFrame(() => {
                        dot.style.transform = `translate(${dx}px, ${dy}px) scale(0.3)`;
                        dot.style.opacity = '0';
                    });
                    timers.push(setTimeout(() => dot.remove(), 520));
                }
            }, 240 + i * 80));

            timers.push(setTimeout(() => {
                star.style.left = `${targetX}px`;
                star.style.top = `${targetY}px`;
                star.style.transform = 'translate(-50%,-50%) scale(0.4) rotate(480deg)';
                star.style.opacity = '0.9';
            }, 260 + i * 80));

            timers.push(setTimeout(() => star.remove(), 1180 + i * 80));
        }

        // 5. Texto "+N GESTOR PAE"
        const label = document.createElement('div');
        label.textContent = `+${points} GESTOR PAE`;
        Object.assign(label.style, {
            position: 'fixed', left: `${originX}px`, top: `${originY - 10}px`,
            zIndex: '9999', transform: 'translate(-50%,-50%) scale(0.5)', opacity: '0',
            color: '#f59e0b', fontWeight: '500', fontSize: '22px', letterSpacing: '0.5px',
            textShadow: '0 0 14px rgba(251,191,36,0.95), 0 2px 4px rgba(0,0,0,0.3)',
            transition: 'transform 1000ms cubic-bezier(.22,1.6,.4,1), opacity 1000ms ease',
        });
        document.body.appendChild(label);
        nodes.push(label);
        requestAnimationFrame(() => {
            label.style.transform = 'translate(-50%,-240%) scale(1.3)';
            label.style.opacity = '1';
        });
        timers.push(setTimeout(() => { label.style.opacity = '0'; }, 800));
        timers.push(setTimeout(() => label.remove(), 1100));

        // 6. Pulso con halo en la cápsula, justo cuando "aterrizan" los puntos
        timers.push(setTimeout(() => {
            if (targetEl instanceof HTMLElement) {
                targetEl.style.transition = 'transform 300ms cubic-bezier(.22,1.6,.4,1), box-shadow 300ms ease';
                targetEl.style.transform = 'scale(1.2)';
                targetEl.style.boxShadow = '0 0 0 8px rgba(251,191,36,0.55)';
                timers.push(setTimeout(() => {
                    targetEl.style.transform = '';
                    targetEl.style.boxShadow = '';
                    targetEl.style.transition = '';
                }, 300));
            }
        }, 1150));

        // Fin de la secuencia -> se avisa al componente padre
        const doneTimer = setTimeout(() => {
            if (onCompleteRef.current) onCompleteRef.current();
        }, 1350);
        timers.push(doneTimer);

        return () => {
            timers.forEach(clearTimeout);
            nodes.forEach((n) => n.remove());
            if (targetEl instanceof HTMLElement) {
                targetEl.style.transform = '';
                targetEl.style.boxShadow = '';
                targetEl.style.transition = '';
            }
        };
    }, [points, targetSelector, originSelector]); // Remove onComplete from deps

    return null; // este componente no renderiza JSX: solo orquesta nodos DOM temporales
}
