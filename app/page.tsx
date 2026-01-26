'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { Utensils, Eye, EyeOff, LogIn } from 'lucide-react';
import Image from 'next/image';
import InstallPrompt from '../components/InstallPrompt';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/dashboard');
      }
    };
    checkSession();
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
        // Traducir algunos errores comunes
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Correo o contraseña incorrectos');
        }
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Debes confirmar tu correo electrónico');
        }
        throw error;
      }

      if (data.user) {
        // Redirigir al dashboard
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      // Intentar obtener el origin de forma más robusta para evitar el error "null" en móviles
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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-700 to-blue-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="bg-blue-600 rounded-2xl p-4 shadow-lg">
            <Utensils className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* Título */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sistema PAE</h1>
          <p className="text-gray-600">Barroblanco Institución Educativa</p>
          <p className="text-sm text-gray-500 mt-1">Programa de Alimentación Escolar</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-6">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Correo Electrónico
            </label>
            <div className="relative">
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="admin@paebarroblanco.edu.co"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 pr-12"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className={`border px-4 py-3 rounded-xl text-sm ${error.includes('pronto') ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {error}
            </div>
          )}

          {/* Botón Login */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors duration-200 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Iniciar Sesión
              </>
            )}
          </button>

          {/* Separador */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">O continuar con</span>
            </div>
          </div>

          {/* Botón Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-xl border border-gray-300 transition-all duration-200 flex items-center justify-center gap-2 shadow-sm"
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
            Google
          </button>

          {/* Botón Huella */}
          <button
            type="button"
            onClick={async () => {
              setError('');
              if (!email) {
                setError('Ingresa tu correo arriba primero para usar huella');
                return;
              }
              setLoading(true);
              try {
                const { data, error } = await (supabase.auth as any).signInWithWebAuthn({
                  email,
                });
                if (error) throw error;
                // Supabase handles the rest
              } catch (e: any) {
                setError(e.message || 'Error al validar huella');
                setLoading(false);
              }
            }}
            disabled={loading}
            className="w-full mt-3 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold py-3 px-4 rounded-xl border border-purple-100 transition-all duration-200 flex items-center justify-center gap-2 shadow-sm"
          >
            <span className="text-xl">👆</span>
            Ingresar con Huella
          </button>

          <InstallPrompt />
        </form>
      </div>
    </div >
  );
}
