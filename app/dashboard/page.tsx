'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { Usuario, calcularEstadisticasHoy } from '../data/demoData';
import {
  Users,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  UserX
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any | null>(null);

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

  const [loading, setLoading] = useState(true);

  const fetchStats = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      const today = new Date(now.getTime() - offset).toISOString().split('T')[0];

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
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    // Escuchar cambios en tiempo real en la tabla de asistencia
    const channel = supabase
      .channel('attendance_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asistencia_pae'
        },
        () => {
          // Recargar estadísticas silenciosamente cuando hay cambios externos
          fetchStats(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
      <div className="mb-4 -mx-4 lg:mx-0">
        <div className="h-40 md:h-64 relative overflow-hidden lg:rounded-2xl">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: 'url("/hero-cafeteria.jpg")' }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 text-white pb-6">
            <h1 className="text-2xl md:text-3xl font-bold leading-tight mb-1">
              Sistema de Asistencia PAE
            </h1>
            <p className="text-xs md:text-base text-gray-100 opacity-90 line-clamp-1 md:line-clamp-none">
              Gestión integral del Programa de Alimentación Escolar en Barroblanco Institución
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button className="bg-orange-400 hover:bg-orange-500 text-white rounded-xl py-3 px-2 flex flex-row items-center justify-center gap-2 font-bold shadow-sm transition-colors cursor-not-allowed opacity-90">
          <UploadCloud className="w-6 h-6" />
          <span className="text-sm">Migrar Local</span>
        </button>
        <button className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-3 px-2 flex flex-row items-center justify-center gap-2 font-bold shadow-sm transition-colors cursor-not-allowed opacity-90">
          <FileSpreadsheet className="w-6 h-6" />
          <span className="text-sm">Cargar Excel</span>
        </button>
      </div>


      {/* Statistics */}
      <div>
        <h3 className="text-xl font-extrabold text-gray-900 mb-4">Estadísticas de Hoy</h3>
        <div className="grid grid-cols-2 gap-3">
          {/* Total Estudiantes */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-blue-600 tracking-tight">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    stats.totalEstudiantes.toLocaleString()
                  )}
                </div>
                <div className="text-gray-500 text-[10px] md:text-xs font-bold uppercase mt-1">TOTAL</div>
              </div>
              <div className="bg-blue-50 p-1.5 rounded-full">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-3 w-20" />
            ) : (
              <div className="text-[10px] text-blue-400 font-semibold truncate">En las 3 sedes</div>
            )}
          </div>

          {/* Recibieron */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-emerald-500 tracking-tight">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    stats.recibieron.toLocaleString()
                  )}
                </div>
                <div className="text-gray-500 text-[10px] md:text-xs font-bold uppercase mt-1">RECIBIERON</div>
              </div>
              <div className="bg-emerald-50 p-1.5 rounded-full">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-3 w-24" />
            ) : (
              <div className="text-[10px] text-emerald-600 font-semibold truncate">PAE Entregado</div>
            )}
          </div>

          {/* No Recibieron */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-yellow-500 tracking-tight">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    stats.noRecibieron.toLocaleString()
                  )}
                </div>
                <div className="text-gray-500 text-[10px] md:text-xs font-bold uppercase mt-1">NO RECIBIERON</div>
              </div>
              <div className="bg-yellow-100 p-1.5 rounded-full">
                <XCircle className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-3 w-28" />
            ) : (
              <div className="text-[10px] text-yellow-600 font-semibold truncate">Sin alimentación</div>
            )}
          </div>

          {/* No Asistieron (Ausentes) */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-red-500 tracking-tight">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    stats.ausentes.toLocaleString()
                  )}
                </div>
                <div className="text-gray-500 text-[10px] md:text-xs font-bold uppercase mt-1">NO ASISTIERON</div>
              </div>
              <div className="bg-red-50 p-1.5 rounded-full">
                <UserX className="w-5 h-5 text-red-500" />
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-3 w-32" />
            ) : (
              <div className="text-[10px] text-red-600 font-semibold truncate">
                {stats.totalEstudiantes > 0 ? ((stats.ausentes / stats.totalEstudiantes * 100).toFixed(1)) : 0}% inasistencia
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
