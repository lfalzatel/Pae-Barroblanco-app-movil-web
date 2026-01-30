'use client';

import { useCallback } from 'react';

export function useHaptics() {
    const vibrate = useCallback((pattern: number | number[] = 10) => {
        if (typeof window !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }, []);

    const triggerLight = () => vibrate(10);
    const triggerMedium = () => vibrate(40);
    const triggerHeavy = () => vibrate([50, 50, 50]);
    const triggerSuccess = () => vibrate([30, 50, 30]);
    const triggerError = () => vibrate([50, 100, 50, 100]);

    return {
        vibrate,
        triggerLight,
        triggerMedium,
        triggerHeavy,
        triggerSuccess,
        triggerError
    };
}
