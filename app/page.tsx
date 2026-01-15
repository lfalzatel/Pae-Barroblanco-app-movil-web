'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usuariosDemo } from './data/demoData';
import { Utensils, Eye, EyeOff, LogIn } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const usuario = usuariosDemo.find(
      u => u.email === email && u.password === password
    );

    if (usuario) {
      // Guardar en localStorage
      localStorage.setItem('currentUser', JSON.stringify(usuario));
      
      // Redirigir al dashboard
      router.push('/dashboard');
    } else {
      setError('Correo o contraseña incorrectos');
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
                placeholder="admin@greenforce.com"
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
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Botón Login */}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors duration-200 flex items-center justify-center gap-2 shadow-lg"
          >
            <LogIn className="w-5 h-5" />
            Iniciar Sesión
          </button>
        </form>

        {/* Usuarios de demostración */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-center text-gray-500 mb-3">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
              Usuarios de demostración
            </span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {usuariosDemo.map((user) => (
              <button
                key={user.email}
                onClick={() => {
                  setEmail(user.email);
                  setPassword(user.password);
                }}
                className="bg-blue-50 hover:bg-blue-100 text-left px-3 py-2 rounded-lg text-xs transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    user.rol === 'admin' ? 'bg-blue-500' :
                    user.rol === 'coordinador' ? 'bg-green-500' :
                    user.rol === 'docente' ? 'bg-purple-500' :
                    'bg-yellow-500'
                  }`}></div>
                  <div>
                    <div className="font-semibold text-gray-900 capitalize">{user.rol}</div>
                    <div className="text-gray-600 truncate">{user.email.split('@')[0]}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
