'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { SplashScreen } from './SplashScreen';

interface SplashScreenContextType {
  isSplashComplete: boolean;
  startManualSplash: (messages?: [string, string, string]) => void;
  finishManualSplash: () => void;
}

const SplashScreenContext = createContext<SplashScreenContextType | undefined>(undefined);

export function SplashScreenProvider({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(true);
  const [isSplashComplete, setIsSplashComplete] = useState(false);
  const [customMessages, setCustomMessages] = useState<[string, string, string] | undefined>(undefined);
  const [isManualMode, setIsManualMode] = useState(false);

  // Mark splash as complete
  const handleSplashComplete = () => {
    // Si estamos en modo manual, esperamos a que termine su tiempo interno
    // para ocultarlo, pero permitimos que continúe si isManualMode ya es false.
    setShowSplash(false);
    setIsSplashComplete(true);
    sessionStorage.setItem('pae_splash_seen', 'true');
  };

  const startManualSplash = (messages?: [string, string, string]) => {
    setIsManualMode(true);
    setCustomMessages(messages);
    setIsSplashComplete(false);
    setShowSplash(true);
  };

  const finishManualSplash = () => {
    // Ya no hacemos nada aquí que afecte la duración,
    // el componente SplashScreen interno se encargará de completar su tiempo.
    setIsManualMode(false);
  };

  // Check if splash was already seen in this session (only for initial load)
  useEffect(() => {
    const seen = sessionStorage.getItem('pae_splash_seen');
    // Solo ocultar automáticamente al MONTAR el componente si no estamos en modo manual
    // y ya se ha visto. No reaccionar a cambios posteriores de isManualMode.
    if (seen === 'true' && !isManualMode) {
        setShowSplash(false);
        setIsSplashComplete(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo al montar

  return (
    <SplashScreenContext.Provider value={{ isSplashComplete, startManualSplash, finishManualSplash }}>
      {showSplash && (
        <SplashScreen 
           onComplete={handleSplashComplete} 
           duration={3500} 
           customMessages={customMessages}
        />
      )}
      
      <div className={isSplashComplete ? 'opacity-100' : 'opacity-0'}>
        {children}
      </div>
    </SplashScreenContext.Provider>
  );
}

export const useSplash = () => {
  const context = useContext(SplashScreenContext);
  if (!context) throw new Error("useSplash must be used within a SplashScreenProvider");
  return context;
};
