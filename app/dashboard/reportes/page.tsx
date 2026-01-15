'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Usuario, sedes, calcularEstadisticasHoy } from '@/app/data/demoData';
import { ArrowLeft, FileDown, Calendar, CheckCircle, XCircle, UserX, Users, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function ReportesPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any | null>(null);
  const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes'>('hoy');
  const [sedeFilter, setSedeFilter] = useState('todas');

  const [registros, setRegistros] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalEstudiantes: 0,
    recibieron: 0,
    noRecibieron: 0,
    ausentes: 0
  });
  const [loading, setLoading] = useState(true);

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
    };

    checkUser();
  }, [router]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const today = new Date();
        let startDate = today.toISOString().split('T')[0];

        // Calcular rango de fechas
        if (periodo === 'semana') {
          const firstDay = new Date(today.setDate(today.getDate() - today.getDay() + 1)); // Lunes
          startDate = firstDay.toISOString().split('T')[0];
        } else if (periodo === 'mes') {
          const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
          startDate = firstDay.toISOString().split('T')[0];
        } else {
          // Hoy
          startDate = new Date().toISOString().split('T')[0];
        }

        const sedeMap: Record<string, string> = {
          'principal': 'Principal',
          'primaria': 'Sede Primaria',
          'maria-inmaculada': 'María Inmaculada'
        };

        // 1. Consultar Total Estudiantes (filtrado por sede)
        let queryEstudiantes = supabase
          .from('estudiantes')
          .select('*', { count: 'exact', head: true });

        if (sedeFilter !== 'todas') {
          // Ajuste: La base de datos usa ''Principal'' por defecto.
          // Si el filtro es otro, usamos el mapa.
          // Nota: Actualmente solo hay datos de 'Principal' en seed.
          queryEstudiantes = queryEstudiantes.eq('sede', sedeMap[sedeFilter] || 'Principal');
        }

        const { count: totalCount, error: errorEst } = await queryEstudiantes;
        if (errorEst) throw errorEst;

        // 2. Consultar Asistencia (Stats + Registros)
        let queryAsistencia = supabase
          .from('asistencia_pae')
          .select(`
            id,
            estado,
            fecha,
            created_at,
            estudiantes!inner (
              nombre,
              grupo,
              sede
            )
          `)
          .gte('fecha', startDate)
          .order('created_at', { ascending: false });

        // Filtro adicional para 'hoy' para asegurar que sea SOLO hoy (no futuro)
        if (periodo === 'hoy') {
          queryAsistencia = queryAsistencia.lte('fecha', startDate);
        }

        if (sedeFilter !== 'todas') {
          queryAsistencia = queryAsistencia.eq('estudiantes.sede', sedeMap[sedeFilter] || 'Principal');
        }

        const { data: asistenciaData, error: errorAsist } = await queryAsistencia;
        if (errorAsist) throw errorAsist;

        // Calcular contadores
        const recibieronCount = asistenciaData?.filter((a: any) => a.estado === 'recibio').length || 0;
        const noRecibieronCount = asistenciaData?.filter((a: any) => a.estado === 'no_recibio').length || 0;
        const ausentesCount = asistenciaData?.filter((a: any) => a.estado === 'ausente').length || 0;

        setStats({
          totalEstudiantes: totalCount || 0,
          recibieron: recibieronCount,
          noRecibieron: noRecibieronCount,
          ausentes: ausentesCount
        });

        // Guardar los registros para la lista (limitado a los últimos 50 para no saturar)
        setRegistros(asistenciaData?.slice(0, 50) || []);

      } catch (error) {
        console.error('Error fetching reports data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (usuario) {
      fetchData();
    }
  }, [usuario, periodo, sedeFilter]);

  if (!usuario) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Reportes y Estadísticas</h1>
                <p className="text-sm text-gray-600">Análisis de asistencia en tiempo real</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="p-2 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                <FileDown className="w-6 h-6 text-green-600" />
              </button>
              <button className="p-2 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                <Calendar className="w-6 h-6 text-blue-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtros de período */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setPeriodo('hoy')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${periodo === 'hoy'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            Hoy
          </button>
          <button
            onClick={() => setPeriodo('semana')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${periodo === 'semana'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            Semana
          </button>
          <button
            onClick={() => setPeriodo('mes')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${periodo === 'mes'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            Mes
          </button>
        </div>

        {/* Filtro de sede */}
        <div className="mb-6 flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => setSedeFilter('todas')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${sedeFilter === 'todas'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            Todas
          </button>
          {sedes.map(sede => (
            <button
              key={sede.id}
              onClick={() => setSedeFilter(sede.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${sedeFilter === sede.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
            >
              {sede.nombre}
            </button>
          ))}
        </div>

        {/* Estadísticas principales */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {/* Total */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-1">
              <div>
                <div className="text-2xl font-bold text-blue-600 tracking-tight">
                  {loading ? '...' : stats.totalEstudiantes}
                </div>
                <div className="text-gray-500 text-[10px] font-bold uppercase mt-0.5">TOTAL</div>
              </div>
              <div className="bg-blue-50 p-1.5 rounded-full">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Recibieron */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-1">
              <div>
                <div className="text-2xl font-bold text-emerald-500 tracking-tight">
                  {loading ? '...' : stats.recibieron}
                </div>
                <div className="text-gray-500 text-[10px] font-bold uppercase mt-0.5">RECIBIERON</div>
              </div>
              <div className="bg-emerald-50 p-1.5 rounded-full">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </div>

          {/* No Recibieron */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-1">
              <div>
                <div className="text-2xl font-bold text-yellow-500 tracking-tight">
                  {loading ? '...' : stats.noRecibieron}
                </div>
                <div className="text-gray-500 text-[10px] font-bold uppercase mt-0.5">NO RECIBIERON</div>
              </div>
              <div className="bg-yellow-100 p-1.5 rounded-full">
                <XCircle className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
          </div>

          {/* Ausentes */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-1">
              <div>
                <div className="text-2xl font-bold text-red-500 tracking-tight">
                  {loading ? '...' : stats.ausentes}
                </div>
                <div className="text-gray-500 text-[10px] font-bold uppercase mt-0.5">AUSENTES</div>
              </div>
              <div className="bg-red-50 p-1.5 rounded-full">
                <UserX className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Registros recientes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-900">Registros Recientes</h2>
          </div>

          <div className="overflow-x-auto">
            {registros.length === 0 ? (
              <div className="p-6 text-center text-gray-500 py-8">
                No hay registros recientes para este periodo
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Estudiante</th>
                    <th className="px-3 sm:px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Hora</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {registros.map((registro: any) => {
                    const fecha = new Date(registro.created_at);
                    const hora = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const fechaStr = fecha.toLocaleDateString();

                    return (
                      <tr key={registro.id}>
                        <td className="px-3 sm:px-6 py-3 max-w-[140px] sm:max-w-none">
                          <div className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight">{registro.estudiantes?.nombre}</div>
                          <div className="text-xs text-gray-500">{registro.estudiantes?.grupo}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-center">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${registro.estado === 'recibio' ? 'bg-green-100 text-green-800' :
                            registro.estado === 'no_recibio' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                            {registro.estado === 'recibio' ? 'Recibió' :
                              registro.estado === 'no_recibio' ? 'No Recibió' : 'Ausente'}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-right">
                          <div className="text-sm text-gray-900">{hora}</div>
                          <div className="text-xs text-gray-500">{fechaStr}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Exportar datos */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Exportar Datos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button className="bg-green-50 hover:bg-green-100 text-green-700 py-4 px-6 rounded-xl font-medium flex items-center justify-center gap-3 transition-colors border border-green-200">
              <FileDown className="w-5 h-5" />
              Descargar Excel
            </button>
            <button className="bg-blue-50 hover:bg-blue-100 text-blue-700 py-4 px-6 rounded-xl font-medium flex items-center justify-center gap-3 transition-colors border border-blue-200">
              <FileDown className="w-5 h-5" />
              Descargar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
