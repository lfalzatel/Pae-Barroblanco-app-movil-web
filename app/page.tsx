'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { AlertCircle, Eye, EyeOff, LogIn, Fingerprint } from 'lucide-react';
import Image from 'next/image';
import InstallPrompt from '../components/InstallPrompt';
import { useSplash } from '../components/SplashScreenProvider';

export default function LoginPage() {
  const router = useRouter();
  const { startManualSplash } = useSplash();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoginSuccess, setIsLoginSuccess] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);

  useEffect(() => {
    // Forzar limpieza inmediata
    setEmail('');
    setPassword('');
    
    // Pequeño retraso para vaciar si el navegador auto-rellena muy rápido al montar
    const timer = setTimeout(() => {
      setEmail('');
      setPassword('');
    }, 100);

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/dashboard');
      }
    };
    checkSession();
    return () => clearTimeout(timer);
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Correo o contraseña incorrectos');
        }
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Debes confirmar tu correo electrónico');
        }
        throw error;
      }

      if (data.user) {
        // Activar Splash Global
        const nombre = data.user.user_metadata?.nombre || 'Usuario';
        startManualSplash([
            'Autenticación exitosa',
            'Preparando tu espacio',
            `¡Bienvenido, ${nombre}!`
        ]);
        
        setIsLoginSuccess(true);
        // Redirigir inmediatamente, el Splash global cubrirá la carga
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al iniciar sesión');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    localStorage.setItem('pae_show_google_splash', 'true');
    setError('');
    setLoading(true);
    try {
      let origin = window.location.origin;
      if (!origin || origin === 'null') {
        origin = `${window.location.protocol}//${window.location.host}`;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/dashboard`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Error al conectar con Google');
      setLoading(false);
    }
  };

  return (
    <>
      <div className={`min-h-screen bg-gradient-to-br from-[#1b5e20] via-[#2e7d32] to-[#40a851] flex items-center justify-center p-4 transition-opacity duration-500 ${isLoginSuccess ? 'opacity-0' : 'opacity-100'}`}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <div className="bg-[#40a851] rounded-2xl p-4 shadow-lg border-2 border-white/10 ring-4 ring-green-500/10 text-center">
              <Image 
                src="/icon-512x512-1.png" 
                alt="Logo PAE" 
                width={80} 
                height={80} 
                className="priority"
                priority
              />
            </div>
          </div>

          {/* Título */}
          <div className="text-center mb-4">
            <h1 className="text-2xl font-black text-gray-900 mb-1 tracking-tight">Sistema PAE</h1>
            <p className="text-[#388e3c] text-[10px] font-black uppercase tracking-widest">Barroblanco Institución Educativa</p>
            <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wider">Programa de Alimentación Escolar</p>
          </div>

          {/* Botón Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 font-black py-3 px-4 rounded-xl border border-gray-100 transition-all duration-200 flex items-center justify-center gap-3 shadow-md active:scale-95 text-xs uppercase tracking-widest"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Ingresar con Google
          </button>
                  {/* Separador y Toggle de Credenciales */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center">
              <button 
                type="button"
                onClick={() => setShowCredentials(!showCredentials)}
                className="bg-white px-4 text-[10px] uppercase font-black tracking-widest text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-2"
              >
                {showCredentials ? 'Ocultar credenciales directas' : 'Usar credenciales directas'}
                <svg className={`w-3 h-3 transition-transform duration-300 ${showCredentials ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Formulario (Oculto por defecto) */}
          <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showCredentials ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <form onSubmit={handleLogin} className="space-y-4 pt-2">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-2">
                  Correo Institucional
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500/30 transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-inner"
                    placeholder="ejemplo@paebarroblanco.edu.co"
                    required={showCredentials}
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-2">
                  Contraseña Administrativa
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500/30 transition-all font-bold text-gray-700 placeholder:text-gray-300 pr-12 shadow-inner"
                    placeholder="••••••••"
                    required={showCredentials}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50/50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-in shake">
                  <AlertCircle size={18} className="flex-shrink-0" />
                  <p className="text-xs font-bold leading-tight">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#2e7d32] to-[#40a851] text-white font-black py-4 px-4 rounded-2xl transition-all flex justify-center items-center gap-2 shadow-xl shadow-green-900/20 hover:shadow-green-900/40 active:scale-95 disabled:opacity-50 text-[11px] uppercase tracking-widest"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn size={18} />
                    Ingresar al Sistema
                  </>
                )}
              </button>
            </form>
          </div>

            {/* Botón Huella */}
            <button
              type="button"
              onClick={async () => {
                setError('');
                if (!email) {
                  setError('Ingresa tu correo institucional primero');
                  return;
                }
                setLoading(true);
                try {
                  const { data, error } = await (supabase.auth as any).signInWithWebAuthn({
                    email,
                  });
                  if (error) throw error;
                } catch (e: any) {
                  setError(e.message || 'Error al validar identidad biométrica');
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="w-full mt-2 bg-white hover:bg-gray-50 text-purple-600 font-black py-3 px-4 rounded-2xl border border-gray-100 transition-all duration-300 flex items-center justify-center gap-3 shadow-sm active:scale-95 text-[9px] uppercase tracking-widest"
            >
              <Fingerprint className="w-4 h-4" />
              Ingresar con Huella / FaceID
            </button>

            <InstallPrompt />
          </form>
        </div>
      </div>
    </>
  );
}
