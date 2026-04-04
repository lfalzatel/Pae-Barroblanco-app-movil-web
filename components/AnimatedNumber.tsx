'use client';

import React, { useState, useEffect } from 'react';

interface AnimatedNumberProps {
    value: number;
    duration?: number;
    delay?: number;
    className?: string;
}

export default function AnimatedNumber({ 
    value, 
    duration = 1000, 
    delay = 0, 
    className = '' 
}: AnimatedNumberProps) {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        let startTimestamp: number | null = null;
        let timeoutId: NodeJS.Timeout;

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            
            // Cálculo del valor actual
            setDisplayValue(Math.floor(progress * value));

            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };

        timeoutId = setTimeout(() => {
            window.requestAnimationFrame(step);
        }, delay);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [value, duration, delay]);

    return (
        <span className={className}>
            {displayValue.toLocaleString('es-CO')}
        </span>
    );
}
