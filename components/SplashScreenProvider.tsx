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
  const [currentDuration, setCurrentDuration] = useState(3500); // Default placeholder

  // Determinar duración inicial basada en si ya se ha visto en esta pestaña (sessionStorage)
  useEffect(() => {
    const seen = sessionStorage.getItem('pae_splash_seen');
    if (seen === 'true') {
        setCurrentDuration(2000); // Agilidad en recargas (F5)
    } else {
        setCurrentDuration(3500); // Impacto en primera apertura
    }
  }, []);

  // Mark splash as complete
  const handleSplashComplete = () => {
    setShowSplash(false);
    setIsSplashComplete(true);
    // Marcamos como visto (solo afecta a la duración del próximo refresh, NO lo oculta)
    sessionStorage.setItem('pae_splash_seen', 'true');
  };

  const startManualSplash = (messages?: [string, string, string]) => {
    setCurrentDuration(3500); // Premium para Login/Logout
    setIsManualMode(true);
    setCustomMessages(messages);
    setIsSplashComplete(false);
    setShowSplash(true);
  };

  const finishManualSplash = () => {
    setIsManualMode(false);
  };

  return (
    <SplashScreenContext.Provider value={{ isSplashComplete, startManualSplash, finishManualSplash }}>
      {showSplash && (
        <SplashScreen 
           onComplete={handleSplashComplete} 
           duration={currentDuration} 
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
