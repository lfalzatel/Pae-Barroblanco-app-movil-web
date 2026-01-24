'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Search, Eye, FileDown, Users, User, X, AlertCircle, UserPlus, UserMinus, Calendar, Clock, CheckCircle2, School, ChevronDown, Info, Shield } from 'lucide-react';
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
  const [sedeFilter, setSedeFilter] = useState('Principal');
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
  const [selectedDateActivity, setSelectedDateActivity] = useState<{
    fecha: string;
    grupos: { name: string; count: number; timestamp: string }[];
    total: number;
    firstRegister?: string;
    lastRegister?: string;
  } | null>(null);
  const [selectedStudentDate, setSelectedStudentDate] = useState<any | null>(null);
  const [docenteParaRol, setDocenteParaRol] = useState<Docente | null>(null);
  const [modificandoRol, setModificandoRol] = useState(false);

  // Create Student State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newStudent, setNewStudent] = useState({
    nombre: '',
    matricula: '',
    grado: '',
    grupo: '',
    sede: 'Principal'
  });

  const sedes = [
    { id: 'todas', nombre: 'Todas' },
    { id: 'Principal', nombre: 'Principal' },
    { id: 'Primaria', nombre: 'Primaria' },
    { id: 'Maria Inmaculada', nombre: 'Maria Inmaculada' }
  ];

  const handleCreateStudent = async () => {
    setCreateError(null);
    if (!newStudent.nombre || !newStudent.matricula || !newStudent.grado || !newStudent.grupo) {
      setCreateError('Todos los campos son obligatorios');
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase
        .from('estudiantes')
        .insert([{
          ...newStudent,
          estado: 'activo'
        }]);

      if (error) {
        if (error.code === '23505') throw new Error('La matrícula ya está registrada');
        throw error;
      }

      // Success
      setIsCreateModalOpen(false);
      setNewStudent({ nombre: '', matricula: '', grado: '', grupo: '', sede: 'Principal' });

      // Refresh list (hacky re-trigger of useEffect by toggling filter momentarily or just simpler: call fetch logic?) 
      // Better: force re-fetch by updating a dummy dependency or refactoring fetch into a useCallback.
      // For now, let's just manually update local state to avoid full re-fetch if we want speed,
      // but re-fetch is safer for ID. Let's trigger re-fetch by touching sedeFilter.
      const currentFilter = sedeFilter;
      setSedeFilter(currentFilter === 'todas' ? 'todas' : currentFilter); // Won't trigger if same.
      // Let's just create a refresh trigger
      setSedeFilter(prev => prev); // Still might not trigger.

      // Ideally, extract fetchEstudiantes. But given the structure, I'll just reload page or better:
      window.location.reload(); // Simplest for now given the context, or better yet, optimistic update?
      // Let's do optimistic update + reload or just optimistic.
      // Actually, let's just add it to the list if we had the ID. Supabase returns data if select() is used.

    } catch (err: any) {
      setCreateError(err.message || 'Error al guardar');
    } finally {
      setCreating(false);
    }
  };

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
          .not('grupo', 'ilike', '%2025%')
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
            created_at,
            estudiantes!inner(grupo, grado)
          `)
          .eq('registrado_por', selectedDocente.id)
          .order('fecha', { ascending: false });

        if (error) throw error;

        const dailyActivity: Record<string, {
          grupos: Map<string, { count: number, timestamp: string }>,
          total: number
        }> = {};

        data?.forEach((a: any) => {
          if (!dailyActivity[a.fecha]) {
            dailyActivity[a.fecha] = {
              grupos: new Map(),
              total: 0
            };
          }
          const groupKey = `${a.estudiantes.grado}-${a.estudiantes.grupo}`;
          const currentData = dailyActivity[a.fecha].grupos.get(groupKey) || { count: 0, timestamp: a.created_at };

          // Use the EARLIEST timestamp found for the group to represent "start time"
          // Since we are iterating, we check if the new 'a.created_at' is older (smaller) than valid stored timestamp
          const olderTimestamp = new Date(currentData.timestamp) < new Date(a.created_at) ? currentData.timestamp : a.created_at;

          dailyActivity[a.fecha].grupos.set(groupKey, {
            count: currentData.count + 1,
            timestamp: olderTimestamp
          });
          dailyActivity[a.fecha].total += 1;
        });

        const historyArray = Object.entries(dailyActivity).map(([fecha, activity]) => {
          return {
            fecha,
            grupos: Array.from(activity.grupos.entries())
              .map(([name, data]) => ({ name, count: data.count, timestamp: data.timestamp }))
              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
            total: activity.total
          };
        });

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

  const handleConfirmUpdateRol = async (newRol: string) => {
    if (!docenteParaRol || modificandoRol) return;

    const originalRol = docenteParaRol.rol;
    const docenteId = docenteParaRol.id;

    setModificandoRol(true);
    // Optimistic update
    setDocentes(prev => prev.map(d => d.id === docenteId ? { ...d, rol: newRol } : d));

    const { error } = await supabase
      .from('perfiles_publicos')
      .update({ rol: newRol })
      .eq('id', docenteId);

    if (error) {
      console.error('Error updating role:', error);
      // Revert on error
      setDocentes(prev => prev.map(d => d.id === docenteId ? { ...d, rol: originalRol } : d));
    }

    setModificandoRol(false);
    setDocenteParaRol(null);
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
      <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 shadow-xl shadow-cyan-900/10 sticky top-16 md:top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:pt-6 md:pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="p-2 md:p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 shadow-lg border border-white/10">
                <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
              </Link>
              <div>
                <h1 className="text-lg md:text-2xl font-black text-white leading-none tracking-tight">Gestión del Sistema</h1>
                <p className="text-[9px] md:text-[11px] font-bold text-cyan-50 uppercase tracking-[0.2em] mt-1 opacity-90">Historial y reportes administrativos</p>
              </div>
            </div>

            {usuario?.rol === 'admin' && activeTab === 'estudiantes' && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="p-2 md:px-4 md:py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl md:rounded-2xl transition-all shadow-xl shadow-cyan-900/20 font-black uppercase text-[9px] md:text-[10px] tracking-widest flex items-center gap-2 border border-emerald-400/30 active:scale-95"
              >
                <UserPlus className="w-4 h-4 md:w-5 md:h-5" />
                <span className="hidden sm:inline">CREAR ESTUDIANTE</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        {/* Pestañas */}
        {usuario?.rol === 'admin' && (
          <div className="bg-gray-100/80 p-0.5 rounded-2xl flex items-center shrink-0 relative w-full md:w-auto mb-4">
            <button
              onClick={() => setActiveTab('estudiantes')}
              className={`flex-1 md:px-6 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${activeTab === 'estudiantes' ? 'text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Estudiantes
            </button>
            <button
              onClick={() => setActiveTab('docentes')}
              className={`flex-1 md:px-6 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${activeTab === 'docentes' ? 'text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Docentes
            </button>
            {/* Sliding Indicator */}
            <div
              className={`absolute inset-y-0.5 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-xl shadow-md shadow-cyan-200/50 ${activeTab === 'estudiantes' ? 'left-0.5 w-[50%]' : 'left-[50%] w-[49%]'}`}
              style={{
                width: activeTab === 'estudiantes' ? 'calc(50% - 2px)' : 'calc(50% - 2px)',
                left: activeTab === 'estudiantes' ? '2px' : 'calc(50%)'
              }}
            />
          </div>
        )}

        {activeTab === 'estudiantes' ? (
          <>
            <div className="bg-white p-3 rounded-[2rem] shadow-xl shadow-cyan-900/5 border border-gray-100 mb-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4">
                <div className="flex items-center">
                  <div className="relative flex-1">
                    <select
                      value={sedeFilter}
                      onChange={(e) => {
                        setSedeFilter(e.target.value);
                        setGrupoFilter('todos');
                      }}
                      className="block w-full pl-3 pr-8 md:pl-5 md:pr-10 py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-cyan-700 bg-cyan-50/50 border border-cyan-100/50 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 hover:bg-white hover:border-cyan-300 transition-all shadow-sm cursor-pointer appearance-none"
                    >
                      <option value="todas">SEDES</option>
                      {sedes.filter((s) => s.id !== 'todas').map((sede) => (
                        <option key={sede.id} value={sede.id}>
                          {sede.nombre.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 md:pr-4 flex items-center pointer-events-none">
                      <ChevronDown className="h-4 w-4 text-cyan-500" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center">
                  <div className="relative flex-1">
                    <button
                      onClick={() => setGrupoDropdownOpen(!grupoDropdownOpen)}
                      className="w-full pl-3 pr-3 md:pl-5 md:pr-5 py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-cyan-700 bg-cyan-50/50 border border-cyan-100/50 rounded-2xl flex items-center justify-between focus:outline-none focus:ring-4 focus:ring-cyan-500/10 hover:bg-white hover:border-cyan-300 transition-all shadow-sm cursor-pointer"
                    >
                      <span className="truncate">{grupoFilter === 'todos' ? 'GRUPOS' : `${grupoFilter}`}</span>
                      <ChevronDown className={`w-4 h-4 text-cyan-500 transition-transform ${grupoDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {grupoDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setGrupoDropdownOpen(false)}></div>
                        <div className="absolute z-[70] w-full mt-2 bg-white/90 backdrop-blur-md border border-cyan-100 rounded-3xl shadow-2xl max-h-72 overflow-y-auto p-4 animate-in fade-in zoom-in-95 duration-200">
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => { setGrupoFilter('todos'); setGrupoDropdownOpen(false); }}
                              className={`px-2 py-2.5 rounded-xl text-[10px] font-black transition-all ${grupoFilter === 'todos' ? 'bg-cyan-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-cyan-50'}`}
                            >
                              TODOS
                            </button>
                            {gruposDisponibles.map(grupo => (
                              <button
                                key={grupo}
                                onClick={() => { setGrupoFilter(grupo); setGrupoDropdownOpen(false); }}
                                className={`px-2 py-2.5 rounded-xl text-[10px] font-black transition-all ${grupoFilter === grupo ? 'bg-cyan-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-cyan-50'}`}
                              >
                                {grupo.replace(/-20\d{2}/, '')}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-cyan-400 w-5 h-5 group-focus-within:text-cyan-600 transition-colors" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar estudiante o matrícula..."
                  className="w-full pl-14 pr-6 py-4 bg-gray-50/50 border border-gray-100 rounded-[2rem] focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 shadow-inner transition-all font-bold text-gray-700 text-sm placeholder:text-gray-300 placeholder:font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-[2rem] p-5 shadow-xl shadow-cyan-900/5 border border-gray-100 flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-black text-cyan-600 leading-none mb-2">
                  {loading ? <Skeleton className="h-9 w-12" /> : estudiantesFiltrados.length}
                </div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estudiantes</div>
              </div>
              <div className="bg-white rounded-[2rem] p-5 shadow-xl shadow-cyan-900/5 border border-gray-100 flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-black text-emerald-500 leading-none mb-2">
                  {loading ? <Skeleton className="h-9 w-16" /> : `${attendancePercentage}%`}
                </div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Asistencia Real (30d)</div>
              </div>
            </div>

            {/* Lista de estudiantes */}
            < div className="space-y-3" >
              {
                loading ? (
                  [...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-[2rem]" />)
                ) : (
                  estudiantesFiltrados.map(estudiante => (
                    <div key={estudiante.id} className={`bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 transition-all hover:shadow-md ${estudiante.estado === 'inactivo' ? 'opacity-50 grayscale' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner ${['bg-cyan-50 text-cyan-600', 'bg-emerald-50 text-emerald-600', 'bg-blue-50 text-blue-600'][estudiante.nombre.length % 3]}`}>
                          <span className="font-black text-xl leading-none">{estudiante.nombre.charAt(0)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-black text-gray-900 text-sm truncate uppercase tracking-tight">{estudiante.nombre}</div>
                          <div className="text-[10px] font-bold text-gray-400 mt-0.5">
                            <span className="bg-gray-100 px-2 py-0.5 rounded-lg text-gray-500 mr-2">{estudiante.matricula}</span>
                            <span className="text-cyan-600 font-black">{estudiante.grado}-{estudiante.grupo}</span>
                          </div>

                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => setSelectedStudent(estudiante)}
                              className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-cyan-100 transition-all active:scale-95"
                            >
                              Historial
                            </button>
                            <button
                              onClick={() => handleGenerateReport(estudiante)}
                              className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl transition-all hover:bg-emerald-500 hover:text-white"
                            >
                              <FileDown className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleEstado(estudiante)}
                              className={`px-4 py-2 rounded-xl transition-all ${estudiante.estado === 'inactivo' ? 'bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white' : 'bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white'}`}
                            >
                              {estudiante.estado === 'inactivo' ? <UserPlus className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )
              }
            </div >
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
                <Skeleton className="h-28 rounded-[2rem]" />
              ) : (
                docentes.map(docente => (
                  <div key={docente.id} className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                      {docente.avatar_url ? (
                        <img
                          src={docente.avatar_url}
                          alt={docente.nombre}
                          className="w-14 h-14 rounded-2xl border border-gray-100 shadow-inner object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-cyan-50 rounded-2xl flex items-center justify-center font-black text-cyan-600 text-xl leading-none shadow-inner">
                          {docente.nombre.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-gray-900 truncate uppercase text-sm tracking-tight leading-none mb-1">{docente.nombre}</div>
                        <div className="text-[10px] font-bold text-gray-400 truncate">{docente.email}</div>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => setSelectedDocente(docente)}
                            className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-cyan-100 transition-all active:scale-95"
                          >
                            Actividad
                          </button>
                          <button
                            onClick={() => setDocenteParaRol(docente)}
                            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm flex flex-col items-center justify-center min-w-[70px]"
                            title="Cambiar Rol"
                          >
                            <User className="w-4 h-4" />
                            <span className="text-[7px] font-black uppercase mt-0.5">{docente.rol}</span>
                          </button>
                          <button
                            onClick={() => handleGenerateDocenteReport(docente)}
                            className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                          >
                            <FileDown className="w-4 h-4" />
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
        {
          isCreateModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] max-w-md w-full max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 custom-scrollbar-premium">
                <div className="p-6 md:p-8 bg-gradient-to-br from-cyan-600 to-cyan-700 text-white relative">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 p-2.5 rounded-2xl shadow-inner border border-white/10">
                        <UserPlus className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-black text-xl tracking-tight leading-none">Nuevo Estudiante</h3>
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-80 mt-1.5 text-cyan-50">Registro Administrativo</p>
                      </div>
                    </div>
                    <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="p-6 md:p-8 space-y-5 bg-white">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-2">Nombre Completo</label>
                      <input
                        type="text"
                        placeholder="Ej: Juan Pérez"
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-inner"
                        value={newStudent.nombre}
                        onChange={e => setNewStudent({ ...newStudent, nombre: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-2">Matrícula</label>
                      <input
                        type="text"
                        placeholder="Ej: 2024001"
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-inner"
                        value={newStudent.matricula}
                        onChange={e => setNewStudent({ ...newStudent, matricula: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-2">Grado</label>
                        <input
                          type="text"
                          placeholder="Ej: 10"
                          className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-inner"
                          value={newStudent.grado}
                          onChange={e => setNewStudent({ ...newStudent, grado: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-2">Grupo</label>
                        <input
                          type="text"
                          placeholder="Ej: 10-1"
                          className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-inner"
                          value={newStudent.grupo}
                          onChange={e => setNewStudent({ ...newStudent, grupo: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-2">Sede</label>
                      <div className="relative">
                        <select
                          className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-black text-cyan-700 uppercase text-[10px] tracking-widest appearance-none cursor-pointer shadow-inner"
                          value={newStudent.sede}
                          onChange={e => setNewStudent({ ...newStudent, sede: e.target.value })}
                        >
                          {sedes.filter(s => s.id !== 'todas').map(s => (
                            <option key={s.id} value={s.nombre}>{s.nombre.toUpperCase()}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                          <ChevronDown className="h-4 w-4 text-cyan-500" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {createError && (
                    <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-pulse">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      {createError}
                    </div>
                  )}

                  <div className="flex gap-4 pt-4">
                    <button
                      onClick={() => setIsCreateModalOpen(false)}
                      className="flex-1 px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-gray-200 active:scale-95"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCreateStudent}
                      disabled={creating}
                      className="flex-1 px-6 py-4 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-200 transition-all hover:bg-emerald-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {creating ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {creating ? 'GUARDANDO...' : 'GUARDAR'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Modal Estudiante Detalle (History) */}
        {
          selectedStudent && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 md:p-8 bg-gradient-to-br from-cyan-600 to-cyan-700 text-white relative shrink-0">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="bg-white/20 p-3 rounded-2xl shadow-inner border border-white/10">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-black text-xl md:text-2xl tracking-tight leading-none uppercase">{selectedStudent.nombre}</h3>
                        <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] opacity-80 mt-1.5 text-cyan-50">Historial Académico - PAE</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedStudent(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="mt-8 grid grid-cols-3 gap-3">
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
                      <div className="text-xl md:text-2xl font-black">
                        {studentHistory.filter(a => {
                          const thirtyDaysAgo = new Date();
                          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                          return a.fecha >= thirtyDaysAgo.toISOString().split('T')[0] && a.estado === 'recibio';
                        }).length}
                      </div>
                      <div className="text-[9px] uppercase font-black tracking-widest opacity-70">Recibió</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
                      <div className="text-xl md:text-2xl font-black">
                        {studentHistory.filter(a => {
                          const thirtyDaysAgo = new Date();
                          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                          return a.fecha >= thirtyDaysAgo.toISOString().split('T')[0] && a.estado === 'no_recibio';
                        }).length}
                      </div>
                      <div className="text-[9px] uppercase font-black tracking-widest opacity-70">No Recibió</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
                      <div className="text-xl md:text-2xl font-black text-white/60">
                        {studentHistory.filter(a => {
                          const thirtyDaysAgo = new Date();
                          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                          return a.fecha >= thirtyDaysAgo.toISOString().split('T')[0] && a.estado === 'ausente';
                        }).length}
                      </div>
                      <div className="text-[9px] uppercase font-black tracking-widest opacity-70">Ausente</div>
                    </div>
                  </div>
                </div>

                <div className="p-6 md:p-8 overflow-y-auto space-y-8 bg-white custom-scrollbar-premium">
                  {/* Vista de Calendario (Mini Grid) */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-cyan-600" />
                        Mapa de Asistencia
                      </h4>
                      <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider">Últimas 5 semanas</span>
                    </div>

                    <div className="bg-gray-50/50 p-4 rounded-3xl border border-gray-100/50 shadow-inner">
                      {/* Headers */}
                      <div className="grid grid-cols-7 gap-1.5 mb-2">
                        {['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'].map(d => (
                          <div key={d} className="text-center text-[9px] font-black text-gray-300 tracking-tighter">{d}</div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-1.5">
                        {Array.from({ length: 35 }).map((_, i) => {
                          const d = (() => {
                            const today = new Date();
                            const currentDay = today.getDay();
                            const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;
                            const startOfWeek = new Date(today);
                            startOfWeek.setDate(today.getDate() - daysSinceMonday);
                            const startDate = new Date(startOfWeek);
                            startDate.setDate(startOfWeek.getDate() - 28);
                            const date = new Date(startDate);
                            date.setDate(startDate.getDate() + i);
                            return date;
                          })();
                          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                          const todayStr = new Date().toISOString().split('T')[0];
                          const record = studentHistory.find(r => r.fecha === dateStr);
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                          const hasNovelty = record?.novedad_tipo || record?.novedad_descripcion;
                          const isFuture = dateStr > todayStr;

                          return (
                            <button
                              key={i}
                              onClick={() => record && setSelectedStudentDate(record)}
                              disabled={!record}
                              className={`aspect-square rounded-xl flex flex-col items-center justify-center relative border transition-all duration-300 ${isFuture ? 'opacity-10 bg-gray-100 border-transparent cursor-default' :
                                record ? (
                                  record.estado === 'recibio' ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-100 active:scale-90' :
                                    record.estado === 'no_recibio' ? 'bg-rose-500 border-rose-400 text-white shadow-lg shadow-rose-100 active:scale-90' :
                                      'bg-gray-400 border-gray-300 text-white active:scale-90'
                                ) : isWeekend ? 'bg-gray-100 border-transparent text-gray-300' : 'bg-white border-gray-100 text-gray-200'
                                }`}
                            >
                              <span className="text-[10px] font-black">{d.getDate()}</span>
                              {hasNovelty && (
                                <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse shadow-sm shadow-amber-200"></div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex gap-4 text-[9px] font-black uppercase tracking-widest justify-center pt-2 opacity-60">
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-emerald-500 rounded-full shadow-sm"></div> Recibió</div>
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-rose-500 rounded-full shadow-sm"></div> Faltó</div>
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-amber-400 rounded-full shadow-sm"></div> Novedad</div>
                    </div>
                  </div>

                  {/* Novedades Recientes */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      Observación Directiva
                    </h4>
                    <div className="space-y-3">
                      {studentHistory.filter(a => a.novedad_tipo || a.novedad_descripcion).length > 0 ? (
                        studentHistory.filter(a => a.novedad_tipo || a.novedad_descripcion).slice(0, 3).map((a, i) => (
                          <div key={i} className="bg-amber-50/50 p-5 rounded-[2rem] border border-amber-100/50 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                              <School className="w-12 h-12 text-amber-600" />
                            </div>
                            <div className="flex justify-between items-start mb-2 relative">
                              <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{a.novedad_tipo || 'General'}</span>
                              <span className="text-[9px] font-black text-amber-400 uppercase">{new Date(a.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
                            </div>
                            <p className="text-sm text-amber-900 font-bold leading-relaxed relative italic">"{a.novedad_descripcion || 'Sin descripción detallada'}"</p>
                          </div>
                        ))
                      ) : (
                        <div className="bg-gray-50 p-8 rounded-[2rem] border border-dashed border-gray-200 text-center">
                          <CheckCircle2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Sin novedades críticas</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Línea de Tiempo Completa</h4>
                    <div className="space-y-2">
                      {studentHistory.length > 0 ? (
                        studentHistory.map((h, i) => (
                          <div key={i} className="flex justify-between items-center p-4 bg-gray-50/50 border border-gray-100/50 rounded-2xl hover:bg-white transition-colors duration-300">
                            <div className="flex items-center gap-4">
                              <div className={`w-3 h-3 rounded-full shadow-sm hover:scale-125 transition-transform ${h.estado === 'recibio' ? 'bg-emerald-500 shadow-emerald-100' : h.estado === 'no_recibio' ? 'bg-rose-500 shadow-rose-100' : 'bg-gray-400'}`}></div>
                              <div>
                                <p className="text-sm font-black text-gray-700">{new Date(h.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}</p>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{h.estado === 'recibio' ? 'Operación Normal' : 'Ausencia / Novedad'}</p>
                              </div>
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${h.estado === 'recibio' ? 'bg-emerald-50 text-emerald-600' : h.estado === 'no_recibio' ? 'bg-rose-50 text-rose-600' : 'bg-gray-100 text-gray-500'}`}>{h.estado.replace('_', ' ')}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-300 text-sm font-black uppercase tracking-widest">Esperando primer registro...</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Modal Detalle Día Estudiante */}
        {
          selectedStudentDate && (
            <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
              <div
                className="bg-white rounded-[2.5rem] w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300 custom-scrollbar-premium"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 bg-gradient-to-br from-cyan-600 to-cyan-700 text-white flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-white/60 uppercase tracking-widest leading-none mb-1.5">Detalle del Registro</p>
                    <h3 className="text-xl font-black capitalize leading-none tracking-tight">
                      {new Date(selectedStudentDate.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedStudentDate(null)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-8 space-y-6 bg-white">
                  {/* Status Badge */}
                  <div className={`p-5 rounded-3xl flex items-center gap-4 shadow-xl shadow-cyan-900/5 ${selectedStudentDate.estado === 'recibio' ? 'bg-emerald-50/50 border border-emerald-100/50' :
                    selectedStudentDate.estado === 'no_recibio' ? 'bg-rose-50/50 border border-rose-100/50' :
                      'bg-gray-50/50 border border-gray-100/50'
                    }`}>
                    <div className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center shadow-lg ${selectedStudentDate.estado === 'recibio' ? 'bg-emerald-500 text-white shadow-emerald-200' :
                      selectedStudentDate.estado === 'no_recibio' ? 'bg-rose-500 text-white shadow-rose-200' :
                        'bg-gray-400 text-white shadow-gray-200'
                      }`}>
                      {selectedStudentDate.estado === 'recibio' && <CheckCircle2 className="w-7 h-7" />}
                      {selectedStudentDate.estado === 'no_recibio' && <X className="w-7 h-7" />}
                      {selectedStudentDate.estado === 'ausente' && <AlertCircle className="w-7 h-7" />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 leading-none">Status</p>
                      <p className={`text-xl font-black uppercase tracking-tight ${selectedStudentDate.estado === 'recibio' ? 'text-emerald-600' :
                        selectedStudentDate.estado === 'no_recibio' ? 'text-rose-600' :
                          'text-gray-600'
                        }`}>
                        {selectedStudentDate.estado.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  {/* Time Info */}
                  <div className="flex items-center gap-4 p-4 bg-cyan-50/50 rounded-2xl border border-cyan-100/30">
                    <div className="bg-white p-2.5 rounded-xl shadow-sm">
                      <Clock className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-cyan-600 uppercase tracking-widest leading-none mb-1">Hora de Registro</p>
                      <p className="text-sm font-black text-gray-700">
                        {new Date(selectedStudentDate.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  {/* Novelties */}
                  {(selectedStudentDate.novedad_tipo || selectedStudentDate.novedad_descripcion) && (
                    <div className="bg-amber-50/50 p-6 rounded-[2rem] border border-amber-100/50 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Info className="w-10 h-10 text-amber-600" />
                      </div>
                      <div className="flex items-center gap-2 mb-3 relative">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Novedad Registrada</p>
                      </div>
                      {selectedStudentDate.novedad_tipo && (
                        <p className="font-black text-amber-900 mb-2 relative leading-tight">{selectedStudentDate.novedad_tipo}</p>
                      )}
                      {selectedStudentDate.novedad_descripcion && (
                        <p className="text-sm text-amber-800 font-bold italic border-l-2 border-amber-200 pl-3 py-1 relative leading-relaxed">"{selectedStudentDate.novedad_descripcion}"</p>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedStudentDate(null)}
                    className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl shadow-gray-200"
                  >
                    Confirmar Lectura
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* Modal Docente Detalle (Activity) */}
        {
          selectedDocente && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 md:p-8 bg-gradient-to-br from-cyan-600 to-cyan-700 text-white relative shrink-0">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      {selectedDocente.avatar_url ? (
                        <img src={selectedDocente.avatar_url} className="w-16 h-16 rounded-2xl border-2 border-white/30 shadow-xl object-cover" />
                      ) : (
                        <div className="bg-white/20 p-4 rounded-2xl border border-white/10 shadow-inner">
                          <User className="w-8 h-8" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-black text-xl md:text-2xl tracking-tight leading-none uppercase">{selectedDocente.nombre}</h3>
                        <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] opacity-80 mt-1.5 text-cyan-50">Registro de Actividad Administrativa</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedDocente(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="p-6 md:p-8 overflow-y-auto space-y-8 bg-white custom-scrollbar-premium">
                  {/* Vista de Calendario (Mini Grid Historial Docente) */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-cyan-600" />
                        Mapa de Productividad
                      </h4>
                      <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider">Últimos 35 días</span>
                    </div>

                    <div className="bg-gray-50/50 p-5 rounded-[2rem] border border-gray-100/50 shadow-inner">
                      {/* Day Headers */}
                      <div className="grid grid-cols-7 gap-1.5 mb-3">
                        {['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'].map(day => (
                          <div key={day} className="text-center text-[9px] font-black text-gray-300 tracking-tighter">
                            {day}
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-1.5">
                        {Array.from({ length: 35 }).map((_, i) => {
                          const d = (() => {
                            const today = new Date();
                            const currentDay = today.getDay();
                            const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;
                            const startOfWeek = new Date(today);
                            startOfWeek.setDate(today.getDate() - daysSinceMonday);
                            const startDate = new Date(startOfWeek);
                            startDate.setDate(startOfWeek.getDate() - 28);
                            const date = new Date(startDate);
                            date.setDate(startDate.getDate() + i);
                            return date;
                          })();
                          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                          const todayStr = new Date().toISOString().split('T')[0];
                          const record = docenteHistory.find(r => r.fecha === dateStr);
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                          const isFuture = dateStr > todayStr;

                          return (
                            <button
                              key={i}
                              onClick={() => record && setSelectedDateActivity(record)}
                              disabled={!record}
                              title={dateStr + (record ? ` - ${record.total} registros` : '')}
                              className={`aspect-square rounded-xl flex flex-col items-center justify-center border transition-all duration-300
                          ${isFuture ? 'opacity-10 bg-gray-100 border-transparent cursor-default' :
                                  record
                                    ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-100 active:scale-95 cursor-pointer'
                                    : isWeekend
                                      ? 'bg-gray-100 border-transparent text-gray-300'
                                      : 'bg-white border-gray-100 text-gray-200'
                                }
                            `}
                            >
                              <span className={`text-[10px] font-black ${record ? 'text-white' : ''}`}>
                                {d.getDate()}
                              </span>
                              {record && (
                                <span className="text-[8px] font-black opacity-70 mt-0.5 leading-none">
                                  {record.total}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Sesiones de Registro</h4>
                    <div className="space-y-3">
                      {docenteHistory.map((h, i) => (
                        <div key={i} className="p-5 bg-gradient-to-br from-white to-gray-50/30 border border-gray-100 rounded-[2rem] shadow-sm hover:shadow-md hover:border-cyan-100 transition-all group">
                          <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                              <div className="bg-cyan-50 p-2 rounded-xl group-hover:bg-cyan-100 transition-colors">
                                <Calendar className="w-4 h-4 text-cyan-600" />
                              </div>
                              <span className="text-sm font-black text-gray-700 capitalize">{new Date(h.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}</span>
                            </div>
                            <span className="text-[10px] font-black bg-white border border-gray-100 text-cyan-600 px-3 py-1 rounded-full uppercase tracking-widest">{h.grupos.length} {h.grupos.length === 1 ? 'Grupo' : 'Grupos'}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {h.grupos.map((g: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-xs">
                                <span className="text-[10px] font-black text-gray-900">{g.name}</span>
                                <div className="w-px h-2 bg-gray-200"></div>
                                <span className="text-[9px] font-bold text-cyan-500 uppercase">{g.count} REG</span>
                              </div>
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
                  <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div
                      className="bg-white rounded-[2.5rem] w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300 custom-scrollbar-premium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-6 bg-gradient-to-br from-cyan-600 to-cyan-700 text-white flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-black text-white/50 uppercase tracking-widest leading-none mb-1.5">Bitácora de Sesión</p>
                          <h3 className="text-lg font-black capitalize leading-none tracking-tight">
                            {new Date(selectedDateActivity.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </h3>
                        </div>
                        <button
                          onClick={() => setSelectedDateActivity(null)}
                          className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                          <X className="w-5 h-5 text-white" />
                        </button>
                      </div>

                      <div className="p-8 space-y-8 bg-white">
                        {/* Detailed Group List with Timestamps */}
                        <div>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2 px-1">
                            <Users className="w-4 h-4 text-cyan-500" />
                            Grupos Atendidos en esta Fecha
                          </h4>
                          <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar-premium">
                            {selectedDateActivity.grupos.map((g, idx) => (
                              <div key={idx} className="flex items-center justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-2xl group transition-all duration-300 hover:bg-white hover:border-cyan-100">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-cyan-600 text-xs text-transform uppercase border border-cyan-50 group-hover:bg-cyan-600 group-hover:text-white transition-colors duration-300">
                                    {g.name.split('-')[0]}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-black text-gray-700 text-sm leading-none mb-1.5 uppercase tracking-tighter">Grupo {g.name.split('-')[1] || g.name}</span>
                                    <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1.5 uppercase">
                                      <Clock className="w-3 h-3 text-cyan-400" />
                                      {new Date(g.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span className="text-sm font-black text-gray-900 leading-none mb-1">
                                    {g.count}
                                  </span>
                                  <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">REG</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-6 border-t border-gray-100 flex items-center justify-between px-2">
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Resumen Total</div>
                          <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-lg font-black shadow-sm shadow-emerald-50">
                            {selectedDateActivity.total}
                          </div>
                        </div>

                        <button
                          onClick={() => setSelectedDateActivity(null)}
                          className="w-full py-4 bg-cyan-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl shadow-cyan-100"
                        >
                          Cerrar Detalle
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        }

        {/* Modal Cambio de Rol (Security First) */}
        {docenteParaRol && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 z-[300] animate-in fade-in duration-500">
            <div className="bg-white rounded-[3rem] max-w-md w-full overflow-hidden shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 flex flex-col">
              <div className="p-8 bg-gradient-to-br from-rose-600 to-rose-700 text-white relative">
                <div className="flex items-center gap-4 mb-6">
                  <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md border border-white/10">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-black text-2xl tracking-tight leading-none">Aviso de Seguridad</h3>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mt-2 text-rose-100">Acción Administrativa Crítica</p>
                  </div>
                </div>
                <p className="text-sm font-bold opacity-90 leading-relaxed italic">
                  Estás a punto de modificar los privilegios de acceso para <span className="underline decoration-2 underline-offset-4">{docenteParaRol.nombre}</span>. Esta acción puede comprometer la integridad de la gestión del sistema.
                </p>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-4 text-center">Selecciona el Nuevo Nivel de Acceso</label>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'admin', label: 'Administrador Total', desc: 'Control total de usuarios y reportes', icon: 'Shield', color: 'text-rose-600', bg: 'bg-rose-50' },
                      { id: 'coordinador_pae', label: 'Coordinador PAE', desc: 'Gestión de horarios y registros', icon: 'Clock', color: 'text-cyan-600', bg: 'bg-cyan-50' },
                      { id: 'docente', label: 'Docente / Monitor', desc: 'Solo lectura y registros básicos', icon: 'User', color: 'text-emerald-600', bg: 'bg-emerald-50' }
                    ].map((role) => (
                      <button
                        key={role.id}
                        onClick={() => handleConfirmUpdateRol(role.id)}
                        disabled={modificandoRol}
                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 group ${docenteParaRol.rol === role.id ? 'bg-gray-900 border-gray-900 text-white' : 'bg-gray-50 border-gray-100 hover:border-cyan-200 hover:bg-white'}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${docenteParaRol.rol === role.id ? 'bg-white/20' : role.bg + ' ' + role.color}`}>
                          {role.id === 'admin' ? <Shield className="w-5 h-5" /> : role.id === 'coordinador_pae' ? <Clock className="w-5 h-5" /> : <User className="w-5 h-5" />}
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-black uppercase tracking-tight leading-none mb-1">{role.label}</p>
                          <p className={`text-[9px] font-bold uppercase tracking-widest opacity-60 ${docenteParaRol.rol === role.id ? 'text-white' : ''}`}>{role.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => setDocenteParaRol(null)}
                    className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-gray-200 active:scale-95"
                  >
                    Abortar Operación
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
