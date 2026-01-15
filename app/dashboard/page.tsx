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
    <div className="p-4 lg:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
      {/* Header Image */}
      <div className="mb-6 -mx-4 lg:mx-0">
        <div className="h-48 md:h-64 relative overflow-hidden lg:rounded-2xl">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: 'url("/hero-cafeteria.jpg")' }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 text-white">
            <h2 className="text-xl md:text-3xl font-bold leading-tight mb-2">
              Gestión integral del Programa de Alimentación Escolar en Barroblanco Institución
            </h2>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button className="bg-orange-400 hover:bg-orange-500 text-white rounded-xl py-4 px-2 flex flex-col items-center justify-center gap-2 font-bold shadow-sm transition-colors cursor-not-allowed opacity-90">
          <Upload className="w-6 h-6 md:w-8 md:h-8" />
          <span className="text-sm md:text-base">Migrar Local</span>
        </button>
        <button className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-4 px-2 flex flex-col items-center justify-center gap-2 font-bold shadow-sm transition-colors cursor-not-allowed opacity-90">
          <FileDown className="w-6 h-6 md:w-8 md:h-8" />
          <span className="text-sm md:text-base">Cargar Excel</span>
        </button>
      </div>

      {/* Search */}
      <div className="mb-8">
        <div className="relative shadow-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar estudiante por nombre o matrícula..."
            className="w-full pl-12 pr-4 py-4 bg-white border-0 ring-1 ring-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600 shadow-sm"
          />
        </div>
      </div>

      {/* Statistics */}
      <div>
        <h3 className="text-xl font-extrabold text-gray-900 mb-4">Estadísticas de Hoy</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Total Estudiantes */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-gray-500 text-sm font-medium mb-1">Total Estudiantes</div>
                <div className="text-3xl font-bold text-blue-600 tracking-tight">
                  {stats.totalEstudiantes.toLocaleString()}
                </div>
              </div>
              <div className="bg-blue-100 p-2 rounded-full">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="text-xs text-blue-500 font-medium">En las 3 sedes</div>
          </div>

          {/* Presentes Hoy */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-gray-500 text-sm font-medium mb-1">Presentes Hoy</div>
                <div className="text-3xl font-bold text-emerald-500 tracking-tight">
                  {stats.presentesHoy.toLocaleString()}
                </div>
              </div>
              <div className="bg-emerald-100 p-2 rounded-full">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
            <div className="text-xs text-emerald-600 font-medium">{stats.porcentajeAsistencia}% asistencia</div>
          </div>

          {/* Recibieron */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-gray-500 text-sm font-medium mb-1">Recibieron</div>
                <div className="text-3xl font-bold text-emerald-500 tracking-tight">
                  {stats.recibieron.toLocaleString()}
                </div>
              </div>
              <div className="bg-emerald-100 p-2 rounded-full">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
            <div className="text-xs text-emerald-600 font-medium">Alimentación escolar</div>
          </div>

          {/* No Recibieron */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-gray-500 text-sm font-medium mb-1">No Recibieron</div>
                <div className="text-3xl font-bold text-red-500 tracking-tight">
                  {stats.noRecibieron.toLocaleString()}
                </div>
              </div>
              <div className="bg-red-100 p-2 rounded-full">
                <XCircle className="w-6 h-6 text-red-500" />
              </div>
            </div>
            <div className="text-xs text-red-600 font-medium">Sin alimentación</div>
          </div>
        </div>
      </div>
    </div>
  );
}
