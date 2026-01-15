'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { Usuario, calcularEstadisticasHoy, sedes } from '../data/demoData';
import {
  Users,
  Upload,
  FileDown,
  Search,
  CheckCircle,
  XCircle
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/');
        return;
      }

      setUsuario({
        email: session.user.email,
        nombre: session.user.user_metadata?.nombre || 'Usuario',
        rol: session.user.user_metadata?.rol || 'docente',
      });

      fetchStats();
    };

    checkUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. Total Estudiantes
      const { count: totalEstudiantes, error: errEst } = await supabase
        .from('estudiantes')
        .select('*', { count: 'exact', head: true });

      if (errEst) throw errEst;

      // 2. Asistencias de Hoy
      const { data: asistencias, error: errAsist } = await supabase
        .from('asistencia_pae')
        .select('estado')
        .eq('fecha', today);

      if (errAsist) throw errAsist;

      const total = totalEstudiantes || 0;
      const asistenciasHoy = asistencias || [];

      const recibieron = asistenciasHoy.filter(a => a.estado === 'recibio').length;
      const noRecibieron = asistenciasHoy.filter(a => a.estado === 'no_recibio').length;
      const ausentesRegistrados = asistenciasHoy.filter(a => a.estado === 'ausente').length;

      const presentesHoy = recibieron + noRecibieron;
      const ausentesCalculados = total - presentesHoy;
      const porcentaje = total > 0 ? ((presentesHoy / total) * 100).toFixed(1) : '0';

      setStats({
        totalEstudiantes: total,
        presentesHoy,
        porcentajeAsistencia: parseFloat(porcentaje),
        recibieron,
        noRecibieron,
        ausentes: ausentesCalculados
      });

    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  const [stats, setStats] = useState({
    totalEstudiantes: 0,
    presentesHoy: 0,
    porcentajeAsistencia: 0,
    recibieron: 0,
    noRecibieron: 0,
    ausentes: 0
  });

  if (!usuario) return null;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-cover bg-center h-48 relative"
            style={{
              backgroundImage: 'url("/hero-cafeteria.jpg")'
            }}>
            <div className="absolute inset-0 bg-gradient-to-t from-blue-900/90 via-blue-900/50 to-transparent"></div>
            <div className="relative h-full flex flex-col justify-end p-6">
              <h2 className="text-3xl font-bold text-white mb-2">
                Sistema de Asistencia PAE
              </h2>
              <p className="text-blue-100">
                Gestión integral del Programa de Alimentación Escolar en Barroblanco Institución
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl p-4 flex items-center justify-center gap-3 font-semibold shadow-lg transition-colors">
          <Upload className="w-6 h-6" />
          Migrar Local
        </button>
        <button className="bg-green-500 hover:bg-green-600 text-white rounded-xl p-4 flex items-center justify-center gap-3 font-semibold shadow-lg transition-colors">
          <FileDown className="w-6 h-6" />
          Cargar Excel
        </button>
      </div>

      {/* Search */}
      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar estudiante por nombre o matrícula..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Statistics */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Estadísticas de Hoy</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Total Estudiantes */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-blue-600 mb-1">
              {stats.totalEstudiantes.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Estudiantes</div>
            <div className="text-xs text-gray-500 mt-1">En las 3 sedes</div>
          </div>

          {/* Presentes Hoy */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-green-600 mb-1">
              {stats.presentesHoy.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Presentes Hoy</div>
            <div className="text-xs text-gray-500 mt-1">
              {stats.porcentajeAsistencia}% asistencia
            </div>
          </div>

          {/* Recibieron */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-emerald-600 mb-1">
              {stats.recibieron.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Recibieron</div>
            <div className="text-xs text-gray-500 mt-1">Alimentación escolar</div>
          </div>

          {/* No Recibieron */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-red-600 mb-1">
              {stats.noRecibieron.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">No Recibieron</div>
            <div className="text-xs text-gray-500 mt-1">Sin alimentación</div>
          </div>
        </div>
      </div>
      {/* Overlay for mobile sidebar - Removed since it's handled by layout */}
    </div>
  );
}
