'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Search, Eye, FileDown, Users, X, AlertCircle, UserPlus, UserMinus, Calendar } from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { Skeleton } from '@/components/ui/Skeleton';

interface Estudiante {
  id: string;
  nombre: string;
  matricula: string;
  grado: string;
  grupo: string;
  sede: string;
  estado?: string;
}

interface Docente {
  id: string;
  nombre: string;
  email: string;
  avatar_url: string;
  rol: string;
}

export default function GestionPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sedeFilter, setSedeFilter] = useState('todas');
  const [grupoFilter, setGrupoFilter] = useState('todos');
  const [activeTab, setActiveTab] = useState<'estudiantes' | 'docentes'>('estudiantes');
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [gruposDisponibles, setGruposDisponibles] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Estudiante | null>(null);
  const [selectedDocente, setSelectedDocente] = useState<Docente | null>(null);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [docenteHistory, setDocenteHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [grupoDropdownOpen, setGrupoDropdownOpen] = useState(false);
  const [selectedDateActivity, setSelectedDateActivity] = useState<{ fecha: string, grupos: string[], total: number } | null>(null);

  const sedes = [
    { id: 'todas', nombre: 'Todas' },
    { id: 'Principal', nombre: 'Principal' },
    { id: 'Primaria', nombre: 'Primaria' },
    { id: 'Maria Inmaculada', nombre: 'Maria Inmaculada' }
  ];

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/');
        return;
      }

      setUsuario({
        email: session.user.email,
        nombre: session.user.user_metadata?.nombre || session.user.user_metadata?.full_name || 'Usuario',
        rol: session.user.user_metadata?.rol || 'docente',
        foto: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null
      });
    };

    checkUser();
  }, [router]);

  // Fetch students from Supabase
  useEffect(() => {
    const fetchEstudiantes = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('estudiantes')
          .select('*')
          .order('nombre', { ascending: true });

        if (sedeFilter !== 'todas') {
          query = query.eq('sede', sedeFilter);
        }

        const { data, error } = await query;

        if (error) throw error;

        setEstudiantes(data || []);

        // Extract unique grupos for the filter
        const grupos = Array.from(new Set((data || []).map(e => e.grupo))).sort();
        setGruposDisponibles(grupos);

      } catch (error) {
        console.error('Error fetching students:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEstudiantes();
  }, [sedeFilter]);

  // Fetch teachers from Supabase
  useEffect(() => {
    const fetchDocentes = async () => {
      if (activeTab !== 'docentes') return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('perfiles_publicos')
          .select('*')
          .order('nombre', { ascending: true });

        if (error) throw error;
        setDocentes(data || []);
      } catch (error) {
        console.error('Error fetching teachers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDocentes();
  }, [activeTab]);

  // Fetch student history when modal opens
  useEffect(() => {
    const fetchStudentHistory = async () => {
      if (!selectedStudent) return;

      try {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const { data, error } = await supabase
          .from('asistencia_pae')
          .select('*')
          .eq('estudiante_id', selectedStudent.id)
          .gte('fecha', new Date(ninetyDaysAgo.getTime() - ninetyDaysAgo.getTimezoneOffset() * 60000).toISOString().split('T')[0])
          .order('fecha', { ascending: false });

        if (error) throw error;

        setStudentHistory(data || []);
      } catch (error) {
        console.error('Error fetching student history:', error);
        setStudentHistory([]);
      }
    };

    fetchStudentHistory();
  }, [selectedStudent]);

  // Fetch teacher activity history when modal opens
  useEffect(() => {
    const fetchDocenteHistory = async () => {
      if (!selectedDocente) return;

      try {
        const { data, error } = await supabase
          .from('asistencia_pae')
          .select(`
            fecha,
            estudiantes!inner(grupo, grado)
          `)
          .eq('registrado_por', selectedDocente.id)
          .order('fecha', { ascending: false });

        if (error) throw error;

        const dailyActivity: Record<string, { grupos: Set<string>, total: number }> = {};
        data?.forEach((a: any) => {
          if (!dailyActivity[a.fecha]) {
            dailyActivity[a.fecha] = { grupos: new Set(), total: 0 };
          }
          dailyActivity[a.fecha].grupos.add(`${a.estudiantes.grado}-${a.estudiantes.grupo}`);
          dailyActivity[a.fecha].total += 1;
        });

        const historyArray = Object.entries(dailyActivity).map(([fecha, activity]) => ({
          fecha,
          grupos: Array.from(activity.grupos),
          total: activity.total
        }));

        setDocenteHistory(historyArray);
      } catch (error) {
        console.error('Error fetching teacher history:', error);
        setDocenteHistory([]);
      }
    };

    fetchDocenteHistory();
  }, [selectedDocente]);

  const estudiantesFiltrados = estudiantes.filter(est => {
    const matchSearch = est.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      est.matricula.includes(searchQuery);
    const matchGrupo = grupoFilter === 'todos' || est.grupo === grupoFilter;
    return matchSearch && matchGrupo;
  });

  const calcularAsistenciaReal = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const studentIds = estudiantesFiltrados.map(e => e.id);
      if (studentIds.length === 0) return 0;

      const { data, error } = await supabase
        .from('asistencia_pae')
        .select('estado')
        .in('estudiante_id', studentIds)
        .gte(
          'fecha',
          new Date(thirtyDaysAgo.getTime() - thirtyDaysAgo.getTimezoneOffset() * 60000)
            .toISOString()
            .split('T')[0]
        );

      if (error) throw error;
      if (!data || data.length === 0) return 0;

      const recibieron = data.filter((a: any) => a.estado === 'recibio').length;
      return ((recibieron / data.length) * 100).toFixed(1);
    } catch (error) {
      console.error('Error calculando asistencia:', error);
      return 0;
    }
  };

  const [attendancePercentage, setAttendancePercentage] = useState<string>('0.0');

  useEffect(() => {
    const updateStats = async () => {
      const percentage = await calcularAsistenciaReal();
      setAttendancePercentage(String(percentage));
    };
    updateStats();
  }, [estudiantesFiltrados]);

  const handleGenerateDocenteReport = async (docente: Docente) => {
    try {
      // 1. Fetch activity history for this teacher
      const { data, error } = await supabase
        .from('asistencia_pae')
        .select(`
          fecha,
          estudiantes!inner(grupo, grado)
        `)
        .eq('registrado_por', docente.id)
        .order('fecha', { ascending: false });

      if (error) throw error;

      // 2. Process data: count records and group by date
      const dailyActivity: Record<string, { grupos: Set<string>, total: number }> = {};
      data?.forEach((a: any) => {
        if (!dailyActivity[a.fecha]) {
          dailyActivity[a.fecha] = { grupos: new Set(), total: 0 };
        }
        dailyActivity[a.fecha].grupos.add(`${a.estudiantes.grado}-${a.estudiantes.grupo}`);
        dailyActivity[a.fecha].total += 1;
      });

      const historyArray = Object.entries(dailyActivity).map(([fecha, activity]) => ({
        fecha,
        grupos: Array.from(activity.grupos),
        total: activity.total
      }));

      // 3. Generate Excel
      const excelData: any[][] = [
        ['REPORTE DE ACTIVIDAD DOCENTE - PAE BARROBLANCO'],
        [''],
        ['Información del Docente'],
        ['Nombre:', docente.nombre],
        ['Email:', docente.email],
        ['Rol:', docente.rol.charAt(0).toUpperCase() + docente.rol.slice(1)],
        [''],
        ['Historial de Actividad'],
        ['Fecha', 'Grupos Atendidos', 'Total Registros'],
      ];

      if (historyArray.length > 0) {
        historyArray.forEach(h => {
          const [year, month, day] = h.fecha.split('-').map(Number);
          const dateObj = new Date(year, month - 1, day);

          excelData.push([
            dateObj.toLocaleDateString('es-CO', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }).toLowerCase(),
            h.grupos.join(', '),
            h.total
          ]);
        });
      } else {
        excelData.push(['No se encontró actividad registrada', '', '']);
      }

      const ws = XLSX.utils.aoa_to_sheet(excelData);
      ws['!cols'] = [{ wch: 25 }, { wch: 40 }, { wch: 15 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Historial Docente');
      XLSX.writeFile(wb, `Reporte_Trabajo_${docente.nombre.replace(/\s+/g, '_')}.xlsx`);

    } catch (error) {
      console.error('Error generating teacher report:', error);
    }
  };

  const handleToggleEstado = async (estudiante: Estudiante) => {
    const newState = estudiante.estado === 'activo' ? 'inactivo' : 'activo';

    setEstudiantes((prev) =>
      prev.map((e) => (e.id === estudiante.id ? { ...e, estado: newState } : e))
    );

    const { error } = await supabase
      .from('estudiantes')
      .update({ estado: newState })
      .eq('id', estudiante.id);

    if (error) {
      console.error('Error updating status:', error);
      setEstudiantes((prev) =>
        prev.map((e) => (e.id === estudiante.id ? { ...e, estado: estudiante.estado } : e))
      );
    }
  };

  const handleGenerateReport = async (estudiante: Estudiante) => {
    try {
      const { data: attendanceData, error } = await supabase
        .from('asistencia_pae')
        .select('*')
        .eq('estudiante_id', estudiante.id)
        .order('fecha', { ascending: false });

      if (error) throw error;

      const excelData = [
        ['REPORTE DE ASISTENCIA - PAE BARROBLANCO'],
        [''],
        ['Información del Estudiante'],
        ['Nombre:', estudiante.nombre],
        ['Matrícula:', estudiante.matricula],
        ['Grado:', estudiante.grado],
        ['Grupo:', estudiante.grupo],
        ['Sede:', estudiante.sede],
        [''],
        ['Historial de Asistencia'],
        ['Fecha', 'Estado', 'Tipo de Novedad', 'Descripción de Novedad'],
      ];

      if (attendanceData && attendanceData.length > 0) {
        attendanceData.forEach((record: any) => {
          const [year, month, day] = record.fecha.split('-').map(Number);
          const dateObj = new Date(year, month - 1, day);

          excelData.push([
            dateObj.toLocaleDateString('es-CO', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }).toLowerCase(),
            record.estado === 'recibio' ? 'Recibió' :
              record.estado === 'no_recibio' ? 'No Recibió' :
                'Ausente',
            record.novedad_tipo || '-',
            record.novedad_descripcion || '-'
          ]);
        });
      }

      const ws = XLSX.utils.aoa_to_sheet(excelData);
      ws['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 40 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Reporte de Asistencia');
      const filename = `Reporte_${estudiante.nombre.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);

    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

  if (!usuario) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Gestión del Sistema</h1>
              <p className="text-sm text-gray-600">Historial de asistencia y reportes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Pestañas */}
        <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 mb-8">
          {usuario?.rol === 'admin' && (
            <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
              <button
                onClick={() => setActiveTab('estudiantes')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'estudiantes' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Estudiantes
              </button>
              <button
                onClick={() => setActiveTab('docentes')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'docentes' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Docentes
              </button>
            </div>
          )}
        </div>

        {activeTab === 'estudiantes' ? (
          <>
            {/* Filtros */}
            <div className="mb-6 space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Filtrar por Sede:
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {sedes.map(sede => (
                    <button
                      key={sede.id}
                      onClick={() => {
                        setSedeFilter(sede.id);
                        setGrupoFilter('todos');
                      }}
                      className={`px-3 py-1.5 text-sm rounded-full font-medium whitespace-nowrap transition-colors ${sedeFilter === sede.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
                    >
                      {sede.nombre}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre o matrícula..."
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="relative">
                <button
                  onClick={() => setGrupoDropdownOpen(!grupoDropdownOpen)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl flex items-center justify-between"
                >
                  <span className="text-gray-900">{grupoFilter === 'todos' ? 'Todos los Grupos' : grupoFilter}</span>
                  <svg className={`w-5 h-5 text-gray-400 transition-transform ${grupoDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {grupoDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setGrupoDropdownOpen(false)}></div>
                    <div className="absolute z-20 w-full mt-2 bg-white border border-gray-300 rounded-xl shadow-lg max-h-96 overflow-y-auto">
                      <div className="p-3 grid grid-cols-3 gap-2">
                        <button
                          onClick={() => { setGrupoFilter('todos'); setGrupoDropdownOpen(false); }}
                          className={`px-3 py-2 rounded-lg text-sm font-medium ${grupoFilter === 'todos' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'}`}
                        >
                          Todos
                        </button>
                        {gruposDisponibles.map(grupo => (
                          <button
                            key={grupo}
                            onClick={() => { setGrupoFilter(grupo); setGrupoDropdownOpen(false); }}
                            className={`px-3 py-2 rounded-lg text-sm font-medium ${grupoFilter === grupo ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'}`}
                          >
                            {grupo}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                <div className="text-3xl font-bold text-blue-600">{loading ? <Skeleton className="h-9 w-12" /> : estudiantesFiltrados.length}</div>
                <div className="text-sm text-gray-600">Estudiantes</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                <div className="text-3xl font-bold text-green-600">{loading ? <Skeleton className="h-9 w-16" /> : `${attendancePercentage}%`}</div>
                <div className="text-sm text-gray-600">Asistencia Real (30d)</div>
              </div>
            </div>

            {/* Lista de estudiantes */}
            <div className="space-y-3">
              {loading ? (
                [...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
              ) : (
                estudiantesFiltrados.map(estudiante => (
                  <div key={estudiante.id} className={`bg-white rounded-xl p-4 shadow-sm border border-gray-200 ${estudiante.estado === 'inactivo' ? 'opacity-50 grayscale' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${['bg-purple-100 text-purple-600', 'bg-blue-100 text-blue-600', 'bg-pink-100 text-pink-600'][estudiante.nombre.length % 3]}`}>
                        <span className="font-bold text-lg">{estudiante.nombre.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 text-sm truncate">{estudiante.nombre}</div>
                        <div className="text-xs text-gray-500">{estudiante.matricula} • {estudiante.grado}-{estudiante.grupo}</div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => setSelectedStudent(estudiante)}
                            className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold"
                          >
                            Historial
                          </button>
                          <button
                            onClick={() => handleGenerateReport(estudiante)}
                            className="px-3 py-2 bg-green-50 text-green-600 rounded-lg"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleEstado(estudiante)}
                            className={`px-3 py-2 rounded-lg ${estudiante.estado === 'inactivo' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'}`}
                          >
                            {estudiante.estado === 'inactivo' ? <UserPlus className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          /* Vista de Docentes */
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Sección administrativa de docentes.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loading ? (
                <Skeleton className="h-24 rounded-xl" />
              ) : (
                docentes.map(docente => (
                  <div key={docente.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                    <div className="flex items-center gap-4">
                      {docente.avatar_url ? (
                        <img
                          src={docente.avatar_url}
                          alt={docente.nombre}
                          className="w-12 h-12 rounded-full border border-gray-100"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-700">
                          {docente.nombre.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 truncate">{docente.nombre}</div>
                        <div className="text-xs text-gray-500 truncate">{docente.email}</div>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => setSelectedDocente(docente)}
                            className="flex-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold"
                          >
                            Actividad
                          </button>
                          <button
                            onClick={() => handleGenerateDocenteReport(docente)}
                            className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Modal Estudiante */}
        {selectedStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b flex justify-between items-center">
                <h3 className="font-bold text-xl">{selectedStudent.nombre}</h3>
                <button onClick={() => setSelectedStudent(null)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-green-50 p-3 rounded-xl border border-green-100 text-center">
                    <div className="text-xl font-bold text-green-700">
                      {studentHistory.filter(a => {
                        const thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                        return a.fecha >= thirtyDaysAgo.toISOString().split('T')[0] && a.estado === 'recibio';
                      }).length}
                    </div>
                    <div className="text-[10px] uppercase text-green-600 font-bold">Recibidos</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-center">
                    <div className="text-xl font-bold text-red-700">
                      {studentHistory.filter(a => {
                        const thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                        return a.fecha >= thirtyDaysAgo.toISOString().split('T')[0] && a.estado === 'no_recibio';
                      }).length}
                    </div>
                    <div className="text-[10px] uppercase text-red-600 font-bold">No Recibidos</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                    <div className="text-xl font-bold text-gray-700">
                      {studentHistory.filter(a => {
                        const thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                        return a.fecha >= thirtyDaysAgo.toISOString().split('T')[0] && a.estado === 'ausente';
                      }).length}
                    </div>
                    <div className="text-[10px] uppercase text-gray-600 font-bold">Ausentes</div>
                  </div>
                </div>

                {/* Vista de Calendario (Mini Grid) */}
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-900 border-b pb-2 flex justify-between items-center">
                    Vista Calendario (Últimos 30 días)
                    <span className="text-xs font-normal text-gray-500">Días escolares</span>
                  </h4>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 35 }).map((_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - (34 - i));
                      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                      const record = studentHistory.find(r => r.fecha === dateStr);
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                      return (
                        <div
                          key={i}
                          title={dateStr}
                          className={`aspect-square rounded-md flex items-center justify-center text-[10px] border ${isWeekend ? 'bg-gray-100 text-gray-300 border-transparent' :
                            record ? (
                              record.estado === 'recibio' ? 'bg-green-500 border-green-600 text-white' :
                                record.estado === 'no_recibio' ? 'bg-red-500 border-red-600 text-white' :
                                  'bg-gray-400 border-gray-500 text-white'
                            ) : 'bg-white border-gray-100 text-gray-300'
                            }`}
                        >
                          {d.getDate()}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-4 text-[10px] justify-center pt-2">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-sm"></div> Recibió</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-sm"></div> No Recibió</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-gray-400 rounded-sm"></div> Ausente</div>
                  </div>
                </div>

                {/* Novedades Recientes */}
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-900 border-b pb-2">Novedades y Observaciones</h4>
                  <div className="space-y-2">
                    {studentHistory.filter(a => a.novedad_tipo || a.novedad_descripcion).length > 0 ? (
                      studentHistory.filter(a => a.novedad_tipo || a.novedad_descripcion).map((a, i) => (
                        <div key={i} className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-yellow-800 uppercase">{a.novedad_tipo || 'Observación'}</span>
                            <span className="text-[10px] text-yellow-600">{a.fecha}</span>
                          </div>
                          <p className="text-sm text-yellow-900">{a.novedad_descripcion || 'Sin descripción detallada'}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 italic text-center py-4">No hay novedades registradas recientemente</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-gray-900 border-b pb-2">Registros Recientes</h4>
                  <div className="space-y-2">
                    {studentHistory.length > 0 ? (
                      studentHistory.slice(0, 10).map((h, i) => (
                        <div key={i} className={`flex justify-between items-center p-3 border rounded-xl ${h.estado === 'recibio' ? 'border-green-100 bg-white' : h.estado === 'no_recibio' ? 'border-red-100 bg-white' : 'border-gray-100 bg-white'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${h.estado === 'recibio' ? 'bg-green-500' : h.estado === 'no_recibio' ? 'bg-red-500' : 'bg-gray-400'}`}></div>
                            <span className="text-sm font-medium">{h.fecha}</span>
                          </div>
                          <span className={`text-[10px] font-bold uppercase ${h.estado === 'recibio' ? 'text-green-600' : h.estado === 'no_recibio' ? 'text-red-600' : 'text-gray-600'}`}>{h.estado.replace('_', ' ')}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500 text-sm">No hay registros de asistencia</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Docente */}
        {selectedDocente && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b flex justify-between items-center">
                <h3 className="font-bold text-xl">{selectedDocente.nombre}</h3>
                <button onClick={() => setSelectedDocente(null)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 overflow-y-auto space-y-6">
                {/* Vista de Calendario (Mini Grid Historial Docente) */}
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-900 border-b pb-2 flex justify-between items-center">
                    Actividad de Registro (Últimos 30 días)
                    <span className="text-xs font-normal text-gray-500">Días con registros</span>
                  </h4>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 35 }).map((_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - (34 - i));
                      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                      const record = docenteHistory.find(r => r.fecha === dateStr);
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                      return (
                        <button
                          key={i}
                          onClick={() => record && setSelectedDateActivity(record)}
                          disabled={!record}
                          title={dateStr + (record ? ` - ${record.grupos.length} grupos` : '')}
                          className={`aspect-square rounded-md flex items-center justify-center text-[10px] border transition-transform ${isWeekend ? 'bg-gray-50 text-gray-300 border-transparent' :
                            record ? 'bg-blue-600 border-blue-700 text-white font-bold cursor-pointer hover:scale-110 shadow-sm' : 'bg-white border-gray-100 text-gray-300'
                            }`}
                        >
                          {d.getDate()}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-4 text-[10px] justify-center pt-2">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-600 rounded-sm"></div> Día con registros</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-white border border-gray-100 rounded-sm"></div> Sin registros</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-gray-900 border-b pb-2">Historial Detallado</h4>
                  <div className="space-y-4">
                    {docenteHistory.map((h, i) => (
                      <div key={i} className="p-4 border rounded-xl bg-white shadow-sm hover:border-blue-200 transition-colors">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-blue-600 flex items-center gap-2"><Calendar className="w-4 h-4" />{h.fecha}</span>
                          <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-full uppercase tracking-wider">{h.grupos.length} Grupos</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {h.grupos.map((g: string, idx: number) => (
                            <span key={idx} className="bg-green-50 text-green-700 text-[10px] font-bold px-2 py-1 rounded-md border border-green-100">{g}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {docenteHistory.length === 0 && (
                      <div className="text-center py-8 text-gray-500 text-sm italic">No se encontraron registros de actividad para este docente</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal de Segundo Nivel: Detalle del Día Docente */}
              {selectedDateActivity && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
                  <div
                    className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-4 border-b bg-blue-50 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Actividad del Día</p>
                        <h3 className="font-black text-lg text-gray-900">{selectedDateActivity.fecha}</h3>
                      </div>
                      <button
                        onClick={() => setSelectedDateActivity(null)}
                        className="p-1.5 hover:bg-blue-100 text-blue-700 rounded-full transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">Total Grupos</span>
                        <span className="text-2xl font-black text-blue-600">{selectedDateActivity.total}</span>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Grupos Atendidos</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedDateActivity.grupos.map((g, idx) => (
                            <span key={idx} className="bg-white border border-gray-200 text-gray-700 text-sm font-bold px-3 py-1.5 rounded-lg shadow-sm">
                              {g}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
