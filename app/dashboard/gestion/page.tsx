'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useModalBack } from '@/hooks/useModalBack';
import { ArrowLeft, Search, Eye, FileDown, Users, User, X, AlertCircle, UserPlus, UserMinus, Calendar, Clock, CheckCircle2, School, ChevronDown, Info, Shield, FileText, Truck, Edit2, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { Skeleton } from '@/components/ui/Skeleton';
import AnimatedNumber from '@/components/AnimatedNumber';
import DocenteActivityModal from '@/components/dashboard/DocenteActivityModal';
import StudentHistoryModal from '@/components/dashboard/StudentHistoryModal';

interface Estudiante {
  id: string;
  nombre: string;
  matricula: string;
  grado: string;
  grupo: string;
  sede: string;
  estado?: string;
  email?: string | null;
}

interface Docente {
  id: string;
  nombre: string;
  email: string;
  avatar_url: string;
  rol: string;
  puntos_gestor_pae?: number;
}

export default function GestionPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [periodoFilter, setPeriodoFilter] = useState('30_dias');
  const [sedeFilter, setSedeFilter] = useState('Principal');
  const [grupoFilter, setGrupoFilter] = useState('todos');
  const [activeTab, setActiveTab] = useState<'estudiantes' | 'docentes'>('estudiantes');
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [gruposDisponibles, setGruposDisponibles] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Estudiante | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  useModalBack(!!selectedStudent, () => setSelectedStudent(null), 'student-history-modal');

  const [selectedDocente, setSelectedDocente] = useState<Docente | null>(null);
  useModalBack(!!selectedDocente, () => setSelectedDocente(null), 'teacher-activity-modal');

  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [docenteHistory, setDocenteHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [grupoDropdownOpen, setGrupoDropdownOpen] = useState(false);
  const [showSedeDropdown, setShowSedeDropdown] = useState(false);
  const [selectedDateActivity, setSelectedDateActivity] = useState<{
    fecha: string;
    grupos: { name: string; count: number; timestamp: string }[];
    total: number;
    firstRegister?: string;
    lastRegister?: string;
  } | null>(null);

  useModalBack(!!selectedDateActivity, () => setSelectedDateActivity(null), 'teacher-date-detail-modal');

  const [selectedStudentDate, setSelectedStudentDate] = useState<any | null>(null);
  useModalBack(!!selectedStudentDate, () => setSelectedStudentDate(null), 'student-date-detail-modal');

  const [docenteParaRol, setDocenteParaRol] = useState<Docente | null>(null);
  useModalBack(!!docenteParaRol, () => setDocenteParaRol(null), 'role-change-modal');

  const [modificandoRol, setModificandoRol] = useState(false);

  // Create Student State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useModalBack(isCreateModalOpen, () => setIsCreateModalOpen(false), 'create-student-modal');

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newStudent, setNewStudent] = useState({
    nombre: '',
    matricula: '',
    grado: '',
    grupo: '',
    sede: 'Principal',
    email: ''
  });

  // Edit Student State
  const [editingStudent, setEditingStudent] = useState<Estudiante | null>(null);
  const [editFormData, setEditFormData] = useState({
    nombre: '',
    matricula: '',
    grado: '',
    grupo: '',
    sede: 'Principal',
    email: ''
  });
  useModalBack(!!editingStudent, () => setEditingStudent(null), 'edit-student-modal');

  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Selector dynamic group state
  const [isNewGroup, setIsNewGroup] = useState(false);

  const sedes = [
    { id: 'todas', nombre: 'Todas' },
    { id: 'Principal', nombre: 'Sede Principal' },
    { id: 'Primaria', nombre: 'Primaria' },
    { id: 'Maria Inmaculada', nombre: 'Maria Inmaculada' }
  ];

  const handleCreateStudent = async () => {
    setCreateError(null);
    if (!newStudent.nombre || !newStudent.matricula || !newStudent.grupo) {
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

      // Guardar fecha de actualización
      localStorage.setItem('lastStudentListUpdate', new Date().toISOString());

      // Success
      setIsCreateModalOpen(false);
      setNewStudent({ nombre: '', matricula: '', grado: '', grupo: '', sede: 'Principal', email: '' });

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

  const handleUpdateStudent = async () => {
    setUpdateError(null);
    if (!editingStudent) return;
    if (!editFormData.nombre || !editFormData.matricula || !editFormData.grupo) {
      setUpdateError('Todos los campos son obligatorios');
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('estudiantes')
        .update({
          nombre: editFormData.nombre,
          matricula: editFormData.matricula,
          grado: editFormData.grado,
          grupo: editFormData.grupo,
          sede: editFormData.sede,
          email: editFormData.email || null
        })
        .eq('id', editingStudent.id);

      if (error) {
        if (error.code === '23505') throw new Error('La matrícula ya está registrada');
        throw error;
      }

      // Guardar fecha de actualización
      localStorage.setItem('lastStudentListUpdate', new Date().toISOString());

      // Success
      setEditingStudent(null);

      // Force refresh data
      const currentFilter = sedeFilter;
      setSedeFilter(currentFilter === 'todas' ? 'todas' : currentFilter);
      window.location.reload();

    } catch (err: any) {
      setUpdateError(err.message || 'Error al actualizar el estudiante');
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/');
        return;
      }

      const { data: profile } = await supabase
        .from('perfiles_publicos')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        setUsuario(profile);
      } else {
        let userRole = session.user.user_metadata?.rol;
        const userEmail = session.user.email || '';

        if (!userRole) {
            userRole = userEmail.endsWith('@barroblanco.edu.co') ? 'estudiante' : 'acudiente';
            await supabase.auth.updateUser({
                data: { rol: userRole }
            });
        }

        setUsuario({
          email: userEmail,
          nombre: session.user.user_metadata?.nombre || session.user.user_metadata?.full_name || 'Usuario',
          rol: userRole,
          id: session.user.id,
          foto: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null
        });
      }
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
        setCurrentMonth(new Date());
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

        const { data, error } = await supabase
          .from('asistencia_pae')
          .select('*')
          .eq('estudiante_id', selectedStudent.id)
          .gte('fecha', new Date(sixMonthsAgo.getTime() - sixMonthsAgo.getTimezoneOffset() * 60000).toISOString().split('T')[0])
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
      setCurrentMonth(new Date());

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

  const [docenteSearchQuery, setDocenteSearchQuery] = useState('');
  const [docenteRolFilter, setDocenteRolFilter] = useState('todos');

  const docentesFiltrados = docentes.filter(doc => {
    const matchSearch = doc.nombre.toLowerCase().includes(docenteSearchQuery.toLowerCase()) ||
      doc.email.toLowerCase().includes(docenteSearchQuery.toLowerCase());
    const matchRol = docenteRolFilter === 'todos' || doc.rol === docenteRolFilter;
    return matchSearch && matchRol;
  });

  /* New State for Stats Modal */
  const [showStatsModal, setShowStatsModal] = useState(false);

  // Hook for Stats Modal
  useModalBack(showStatsModal, () => setShowStatsModal(false), 'stats-modal');

  const [statsDetail, setStatsDetail] = useState<{
    avgDaily: number;
    totalStudents: number;
    daysCounted: number;
    dailyHistory: { date: string; count: number; percentage: number }[];
  } | null>(null);

  const calcularAsistenciaReal = async () => {
    try {
      const totalStudentsCount = estudiantesFiltrados.length;
      if (totalStudentsCount === 0) return { percentage: '0.0', details: null };

      const now = new Date();
      const currentYear = now.getFullYear();
      let startDateStr = '';
      let endDateStr = '';

      if (periodoFilter === '30_dias') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        startDateStr = new Date(thirtyDaysAgo.getTime() - thirtyDaysAgo.getTimezoneOffset() * 60000)
          .toISOString()
          .split('T')[0];
      } else {
        // periodoFilter is 'MM' (month number)
        const monthNum = parseInt(periodoFilter) - 1;
        const firstDay = new Date(currentYear, monthNum, 1);
        const lastDay = new Date(currentYear, monthNum + 1, 0);
        
        startDateStr = new Date(firstDay.getTime() - firstDay.getTimezoneOffset() * 60000)
          .toISOString()
          .split('T')[0];
        endDateStr = new Date(lastDay.getTime() - lastDay.getTimezoneOffset() * 60000)
          .toISOString()
          .split('T')[0];
      }

      // Use Join to filter by students directly in Supabase (Avoids URL length issues)
      // Proceso de carga masiva por bloques para superar el límite de 1000 filas de Supabase
      let allData: any[] = [];
      let from = 0;
      const PAGE_SIZE = 1000;
      let hasMore = true;

      const sedeMap: Record<string, string> = {
        'principal': 'Principal',
        'primaria': 'Sede Primaria',
        'maria-inmaculada': 'Sede Maria Inmaculada'
      };

      while (hasMore) {
        let pageQuery = supabase
          .from('asistencia_pae')
          .select('fecha, estado, estudiantes!inner(id, nombre, sede, grupo, matricula)')
          .eq('estado', 'recibio')
          .not('estudiantes.grupo', 'ilike', '%2025%')
          .gte('fecha', startDateStr);

        if (endDateStr) {
          pageQuery = pageQuery.lte('fecha', endDateStr);
        }

        if (sedeFilter !== 'todas') {
          pageQuery = pageQuery.eq('estudiantes.sede', sedeMap[sedeFilter] || 'Principal');
        }

        if (grupoFilter !== 'todos') {
          pageQuery = pageQuery.eq('estudiantes.grupo', grupoFilter);
        }

        if (searchQuery) {
          pageQuery = pageQuery.or(`nombre.ilike.%${searchQuery}%,matricula.ilike.%${searchQuery}%`, { foreignTable: 'estudiantes' });
        }

        const { data: pageData, error: pageError } = await pageQuery.range(from, from + PAGE_SIZE - 1);

        if (pageError) throw pageError;

        if (pageData && pageData.length > 0) {
          allData = [...allData, ...pageData];
          if (pageData.length < PAGE_SIZE) {
            hasMore = false;
          } else {
            from += PAGE_SIZE;
          }
        } else {
          hasMore = false;
        }
      }

      if (allData.length === 0) return { percentage: '0.0', details: null };
      const data = allData;

      // Group by date to find unique days and daily counts
      const dailyCounts: Record<string, number> = {};
      data.forEach((r: any) => {
        dailyCounts[r.fecha] = (dailyCounts[r.fecha] || 0) + 1;
      });

      const uniqueDays = Object.keys(dailyCounts).sort((a, b) => b.localeCompare(a)); // Descending
      const totalRecibio = data.length;
      const numberOfDays = uniqueDays.length;

      if (numberOfDays === 0) return { percentage: '0.0', details: null };

      const avgDailyAttendance = totalRecibio / numberOfDays;
      const coveragePercentage = (avgDailyAttendance / totalStudentsCount) * 100;

      // Build detail history
      const history = uniqueDays.map(date => ({
        date,
        count: dailyCounts[date],
        percentage: (dailyCounts[date] / totalStudentsCount) * 100
      }));

      return {
        percentage: coveragePercentage.toFixed(1),
        details: {
          avgDaily: Math.round(avgDailyAttendance),
          totalStudents: totalStudentsCount,
          daysCounted: numberOfDays,
          dailyHistory: history
        }
      };
    } catch (error) {
      console.error('Error calculando asistencia:', error);
      return { percentage: '0.0', details: null };
    }
  };

  const [attendancePercentage, setAttendancePercentage] = useState<string>('0.0');

  useEffect(() => {
    const updateStats = async () => {
      const result = await calcularAsistenciaReal();
      setAttendancePercentage(result.percentage);
      setStatsDetail(result.details);
    };
    updateStats();
  }, [estudiantesFiltrados, periodoFilter]);

  // ... (Report Generation functions remain the same) ...

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
      .rpc('update_user_role', {
        target_user_id: docenteId,
        new_role: newRol
      });

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
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

            {(usuario?.rol === 'admin' || usuario?.rol === 'coordinador_pae') && activeTab === 'estudiantes' && (
              <button
                onClick={() => {
                  setIsCreateModalOpen(true);
                  setIsNewGroup(false);
                }}
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
        {(usuario?.rol === 'admin' || usuario?.rol === 'coordinador_pae') && (
          <div className="bg-gray-100/80 p-0.5 rounded-2xl flex items-center shrink-0 relative w-full md:w-auto mb-4 dark:bg-gray-800">
            <button
              onClick={() => setActiveTab('estudiantes')}
              className={`flex-1 md:px-6 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${activeTab === 'estudiantes' ? 'text-white' : 'text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200'}`}
            >
              Estudiantes
            </button>
            <button
              onClick={() => setActiveTab('docentes')}
              className={`flex-1 md:px-6 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${activeTab === 'docentes' ? 'text-white' : 'text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200'}`}
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
            <div className="bg-white p-3 rounded-[2rem] shadow-xl shadow-cyan-900/5 border border-gray-100 mb-4 space-y-3 dark:bg-gray-800 dark:border-gray-700">
              <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4">
                <div className="flex items-center">
                  <div className="relative flex-1">
                    <button
                      onClick={() => setShowSedeDropdown(!showSedeDropdown)}
                      className="w-full pl-3 pr-3 md:pl-5 md:pr-5 py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-cyan-700 bg-cyan-50/50 border border-cyan-100/50 rounded-2xl flex items-center justify-between focus:outline-none focus:ring-4 focus:ring-cyan-500/10 hover:bg-white hover:border-cyan-300 transition-all shadow-sm cursor-pointer dark:bg-cyan-900/20 dark:border-cyan-800/30 dark:text-cyan-400 dark:hover:bg-gray-700 dark:hover:border-cyan-700"
                    >
                      <span className="truncate">{sedeFilter === 'todas' ? 'SEDES' : sedes.find(s => s.id === sedeFilter)?.nombre.toUpperCase()}</span>
                      <ChevronDown className={`w-4 h-4 text-cyan-500 transition-transform ${showSedeDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showSedeDropdown && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setShowSedeDropdown(false)}></div>
                        <div className="absolute z-[70] w-full mt-2 bg-white/90 backdrop-blur-md border border-cyan-100 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 dark:bg-gray-800/95 dark:border-gray-700">
                          <div className="p-1.5 space-y-1">
                            <button
                              onClick={() => { setSedeFilter('todas'); setGrupoFilter('todos'); setShowSedeDropdown(false); }}
                              className={`w-full text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-between ${sedeFilter === 'todas' ? 'bg-cyan-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-cyan-50 hover:text-cyan-700 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-cyan-400'}`}
                            >
                              SEDES
                              {sedeFilter === 'todas' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                            {sedes.filter((s) => s.id !== 'todas').map((sede) => (
                              <button
                                key={sede.id}
                                onClick={() => { setSedeFilter(sede.id); setGrupoFilter('todos'); setShowSedeDropdown(false); }}
                                className={`w-full text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-between ${sedeFilter === sede.id ? 'bg-cyan-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-cyan-50 hover:text-cyan-700 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-cyan-400'}`}
                              >
                                {sede.nombre.toUpperCase()}
                                {sedeFilter === sede.id && <CheckCircle2 className="w-3.5 h-3.5" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center">
                  <div className="relative flex-1">
                    <button
                      onClick={() => setGrupoDropdownOpen(!grupoDropdownOpen)}
                      className="w-full pl-3 pr-3 md:pl-5 md:pr-5 py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-cyan-700 bg-cyan-50/50 border border-cyan-100/50 rounded-2xl flex items-center justify-between focus:outline-none focus:ring-4 focus:ring-cyan-500/10 hover:bg-white hover:border-cyan-300 transition-all shadow-sm cursor-pointer dark:bg-cyan-900/20 dark:border-cyan-800/30 dark:text-cyan-400 dark:hover:bg-gray-700 dark:hover:border-cyan-700"
                    >
                      <span className="truncate">{grupoFilter === 'todos' ? 'GRUPOS' : `${grupoFilter}`}</span>
                      <ChevronDown className={`w-4 h-4 text-cyan-500 transition-transform ${grupoDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {grupoDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setGrupoDropdownOpen(false)}></div>
                        <div className="absolute z-[70] w-full mt-2 bg-white/90 backdrop-blur-md border border-cyan-100 rounded-3xl shadow-2xl max-h-72 overflow-y-auto p-4 animate-in fade-in zoom-in-95 duration-200 dark:bg-gray-800/95 dark:border-gray-700">
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => { setGrupoFilter('todos'); setGrupoDropdownOpen(false); }}
                              className={`px-2 py-2.5 rounded-xl text-[10px] font-black transition-all ${grupoFilter === 'todos' ? 'bg-cyan-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-cyan-50 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600'}`}
                            >
                              TODOS
                            </button>
                            {gruposDisponibles.map(grupo => (
                              <button
                                key={grupo}
                                onClick={() => { setGrupoFilter(grupo); setGrupoDropdownOpen(false); }}
                                className={`px-2 py-2.5 rounded-xl text-[10px] font-black transition-all ${grupoFilter === grupo ? 'bg-cyan-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-cyan-50 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600'}`}
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

              <div className="flex flex-row gap-2 mb-4">
                <div className="flex-1 relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400 w-4 h-4 group-focus-within:text-cyan-600 transition-colors" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full pl-10 pr-3 py-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 shadow-inner transition-all font-bold text-gray-700 text-[11px] placeholder:text-gray-300 dark:bg-gray-700/50 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500"
                  />
                </div>
                
                <div className="flex-1 relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                    <Calendar className="w-4 h-4 text-cyan-500 shrink-0" />
                    <div className="w-[1px] h-3.5 bg-cyan-200 dark:bg-cyan-800"></div>
                  </div>
                  <select
                    value={periodoFilter}
                    onChange={(e) => setPeriodoFilter(e.target.value)}
                    className="w-full pl-10 pr-8 py-3.5 bg-white/50 backdrop-blur-md border border-cyan-100/50 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 shadow-sm transition-all font-black text-cyan-700 text-[9px] uppercase tracking-wider appearance-none cursor-pointer dark:bg-gray-800/50 dark:border-cyan-900/30 dark:text-cyan-400"
                  >
                    <option value="30_dias">Últimos 30 días</option>
                    <option value="02">Febrero</option>
                    <option value="03">Marzo</option>
                    <option value="04">Abril</option>
                    <option value="05">Mayo</option>
                    <option value="06">Junio</option>
                    <option value="07">Julio</option>
                    <option value="08">Agosto</option>
                    <option value="09">Septiembre</option>
                    <option value="10">Octubre</option>
                    <option value="11">Noviembre</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-500 w-3 h-3 pointer-events-none transition-transform" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div 
                className="bg-white rounded-[2rem] p-5 shadow-xl shadow-cyan-900/5 border border-gray-100 flex flex-col items-center justify-center text-center dark:bg-gray-800 dark:border-gray-700 animate-card-mix"
                style={{ animationDelay: '0.1s' }}
              >
                <div className="text-3xl font-black text-cyan-600 leading-none mb-2 dark:text-cyan-400">
                  {loading ? <Skeleton className="h-9 w-12" /> : <AnimatedNumber value={estudiantesFiltrados.length} />}
                </div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest dark:text-gray-500">Total Estudiantes</div>
              </div>
              <button
                onClick={() => setShowStatsModal(true)}
                className="bg-white rounded-[2rem] p-5 shadow-xl shadow-cyan-900/5 border border-gray-100 flex flex-col items-center justify-center text-center hover:bg-cyan-50 transition-all cursor-pointer active:scale-95 group relative overflow-hidden dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 animate-card-mix"
                style={{ animationDelay: '0.35s' }}
              >
                <div className="absolute inset-0 bg-cyan-100/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="text-3xl font-black text-emerald-500 leading-none mb-2 relative z-10 flex items-center gap-1">
                  {loading ? <Skeleton className="h-9 w-16" /> : (
                    <>
                      <AnimatedNumber value={parseFloat(attendancePercentage)} />%
                    </>
                  )}
                  <Info className="w-4 h-4 text-emerald-300 group-hover:text-emerald-500 transition-colors" />
                </div>
                <div className="text-[10px] font-black text-gray-400 group-hover:text-cyan-600 uppercase tracking-widest px-1 relative z-10">Cobertura Real (30d)</div>
              </button>
            </div>

            {/* Modal de Estadísticas Detalladas */}
            {showStatsModal && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-[500] animate-in fade-in duration-300" onClick={() => setShowStatsModal(false)}>
                <div className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] p-0 w-full max-w-[360px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] relative overflow-hidden animate-in zoom-in-95 duration-200 dark:bg-gray-900/90 border border-white/50" onClick={e => e.stopPropagation()}>
                  
                  {/* Decorative Header Mesh */}
                  <div className="absolute top-0 left-0 right-0 h-44 bg-gradient-to-br from-cyan-500 via-emerald-400 to-cyan-600">
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>
                  </div>

                  <button onClick={() => setShowStatsModal(false)} className="absolute top-5 right-5 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-all active:scale-90 z-10 backdrop-blur-lg border border-white/30">
                    <X size={18} />
                  </button>

                  <div className="relative pt-10 pb-6 px-8 text-center text-white">
                    <div className="w-20 h-20 bg-white rounded-[2rem] mx-auto flex items-center justify-center shadow-2xl mb-5 transform -rotate-6 transition-transform hover:rotate-0 duration-500">
                      <div className="bg-gradient-to-br from-cyan-400 to-emerald-500 text-transparent bg-clip-text">
                        <Users size={32} />
                      </div>
                    </div>
                    <h3 className="font-black text-2xl tracking-tighter mb-1 drop-shadow-sm">Cobertura Real</h3>
                    <div className="flex items-center justify-center gap-2">
                       <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-pulse"></span>
                       <p className="text-white/80 text-[9px] font-black uppercase tracking-[0.2em]">{periodoFilter === '30_dias' ? 'Últimos 30 días' : 'Datos del Mes'}</p>
                    </div>
                  </div>

                  <div className="px-6 pb-8 space-y-5 -mt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/50 border border-white p-5 rounded-[1.8rem] shadow-sm text-center backdrop-blur-xl relative group overflow-hidden dark:bg-gray-800/50 dark:border-gray-700/50">
                        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400 opacity-50"></div>
                        <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 leading-none mb-1.5">{statsDetail?.avgDaily}</div>
                        <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest dark:text-gray-500">Promedio Día</div>
                      </div>
                      <div className="bg-white/50 border border-white p-5 rounded-[1.8rem] shadow-sm text-center backdrop-blur-xl relative group overflow-hidden dark:bg-gray-800/50 dark:border-gray-700/50">
                        <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 opacity-50"></div>
                        <div className="text-3xl font-black text-gray-800 dark:text-white leading-none mb-1.5">{statsDetail?.totalStudents}</div>
                        <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest dark:text-gray-500">Matrícula Sede</div>
                      </div>
                    </div>

                    <div className="bg-gray-50/50 backdrop-blur-md rounded-[2rem] p-5 border border-white/50 dark:bg-gray-800/20 dark:border-gray-700">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest dark:text-gray-500 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div>
                          Historial Diario
                        </h4>
                        <div className="px-2 py-0.5 bg-gray-100 rounded-lg text-[8px] font-black text-gray-400 dark:bg-gray-700">{statsDetail?.daysCounted} Días</div>
                      </div>
                      
                      <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                        {statsDetail?.dailyHistory.map((day, i) => {
                          // Health Indicator Logic
                          const colorClass = day.percentage > 40 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 
                                           day.percentage > 20 ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 
                                           'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
                          
                          return (
                            <div key={i} className="flex justify-between items-center px-3 py-2.5 bg-white/40 border border-white/50 rounded-xl dark:bg-gray-800/40 dark:border-gray-700/30 transition-all hover:translate-x-1 duration-300">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${colorClass}`} />
                                <span className="text-[11px] font-bold text-gray-600 capitalize dark:text-gray-300">
                                  {new Date(day.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                                </span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-xs font-black text-gray-900 dark:text-white">{day.count}</span>
                                <div className="min-w-[32px] text-right">
                                  <span className={`text-[10px] font-black ${day.percentage > 40 ? 'text-emerald-500' : 'text-gray-400'}`}>
                                    {day.percentage.toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {(!statsDetail?.dailyHistory || statsDetail.dailyHistory.length === 0) && (
                          <div className="text-center text-[10px] text-gray-400 py-6 font-bold uppercase tracking-widest italic animate-pulse">
                            Esperando registros...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {
                loading ? (
                  [...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-[2rem]" />)
                ) : (
                  estudiantesFiltrados.map((estudiante, index) => (
                    <div 
                      key={estudiante.id} 
                      className={`bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 transition-all hover:shadow-md ${estudiante.estado === 'inactivo' ? 'opacity-50 grayscale' : ''} dark:bg-gray-800 dark:border-gray-700 animate-card-mix`}
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="font-black text-gray-900 text-base truncate uppercase tracking-tight dark:text-white">{estudiante.nombre}</div>
                            <div className="text-[10px] font-bold text-gray-400 mt-0.5 flex items-center gap-2 dark:text-gray-500">
                              <span className="bg-gray-100 px-2 py-0.5 rounded-lg text-gray-500 dark:bg-gray-700 dark:text-gray-300">{estudiante.matricula}</span>
                              <span className="text-cyan-600 font-extrabold dark:text-cyan-400">{estudiante.grupo}</span>
                            </div>
                          </div>

                          {/* Toggle de Estado Estilo Registro - Solo Admin/Coordinador */}
                          {(usuario?.rol === 'admin' || usuario?.rol === 'coordinador_pae') && (
                            <button
                              onClick={() => handleToggleEstado(estudiante)}
                              className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl flex flex-col items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-100 dark:border-gray-700 active:scale-95 h-12 w-14 justify-center flex-shrink-0"
                            >
                              <div className={`w-7 h-3.5 rounded-full relative transition-colors duration-300 ${estudiante.estado !== 'inactivo' ? 'bg-cyan-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                <div className={`w-2.5 h-2.5 bg-white rounded-full absolute top-0.5 transition-all duration-300 ${estudiante.estado !== 'inactivo' ? 'right-0.5 translate-x-0' : 'left-0.5'}`} style={{ left: estudiante.estado !== 'inactivo' ? '16px' : '2px' }}></div>
                              </div>
                              <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest leading-none">
                                {estudiante.estado !== 'inactivo' ? 'ACTIVO' : 'INACTIVO'}
                              </span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedStudent(estudiante)}
                            className="flex-1 px-4 py-3 bg-cyan-600 text-white rounded-xl shadow-lg shadow-cyan-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                            title="Ver Historial"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">HISTORIAL</span>
                          </button>
                          {usuario?.rol === 'admin' && (
                            <button
                              onClick={() => {
                                setEditingStudent(estudiante);
                                setEditFormData({
                                  nombre: estudiante.nombre,
                                  matricula: estudiante.matricula,
                                  grado: estudiante.grado,
                                  grupo: estudiante.grupo,
                                  sede: estudiante.sede,
                                  email: estudiante.email || ''
                                });
                                setIsNewGroup(false);
                              }}
                              className="p-3 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-sm flex items-center justify-center"
                              title="Editar Estudiante"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleGenerateReport(estudiante)}
                            className="p-3 bg-emerald-50 text-emerald-600 rounded-xl transition-all hover:bg-emerald-500 hover:text-white flex items-center justify-center"
                            title="Descargar Excel"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )
              }
            </div>
          </>
        ) : (
          /* Vista de Docentes */
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Sección administrativa de docentes.
            </div>

            {/* Filtros de Docentes */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o email..."
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
                  value={docenteSearchQuery}
                  onChange={(e) => setDocenteSearchQuery(e.target.value)}
                />
              </div>
              <div className="w-full md:w-64 relative">
                <select
                  className="w-full px-5 py-3 bg-white border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-black text-cyan-700 uppercase text-[10px] tracking-widest appearance-none cursor-pointer shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-cyan-400"
                  value={docenteRolFilter}
                  onChange={(e) => setDocenteRolFilter(e.target.value)}
                >
                  <option value="todos">TODOS LOS ROLES</option>
                  <option value="admin">Administrador Total</option>
                  <option value="secretaria_educacion">Secretaría Educación</option>
                  <option value="coordinador_pae">Coordinador PAE</option>
                  <option value="operador">Operador PAE</option>
                  <option value="docente">Docente / Monitor</option>
                  <option value="estudiante_pae">Estudiante PAE</option>
                  <option value="estudiante">Estudiante</option>
                  <option value="acudiente">Acudiente / Padre</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <ChevronDown className="h-4 w-4 text-cyan-500" />
                </div>
              </div>
            </div>

            {/* Resultados Vaciados */}
            {docentesFiltrados.length === 0 && !loading && (
              <div className="col-span-1 md:col-span-2 text-center py-12">
                <div className="bg-gray-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-gray-800">
                  <User className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                </div>
                <h3 className="text-gray-900 font-black text-lg mb-1 dark:text-white">No hay resultados</h3>
                <p className="text-gray-400 text-sm font-bold dark:text-gray-500">No se encontraron docentes con esos filtros.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loading ? (
                <Skeleton className="h-28 rounded-[2rem]" />
              ) : (
                docentesFiltrados.map(docente => (
                  <div key={docente.id} className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex items-center gap-4">
                      {docente.avatar_url ? (
                        <img
                          src={docente.avatar_url}
                          alt={docente.nombre}
                          className="w-14 h-14 rounded-2xl border border-gray-100 shadow-inner object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-cyan-50 rounded-2xl flex items-center justify-center font-black text-cyan-600 text-xl leading-none shadow-inner dark:bg-cyan-900/20 dark:text-cyan-400">
                          {docente.nombre.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0 relative">
                        {typeof docente.puntos_gestor_pae === 'number' && docente.puntos_gestor_pae > 0 && (
                          <div className="absolute top-0 right-0 flex items-center gap-0.5 bg-amber-400/20 text-amber-600 dark:bg-amber-400/10 dark:text-amber-500 text-[10px] font-black px-2 py-1 rounded-full shrink-0">
                            <Star className="w-3 h-3" fill="currentColor" />
                            {docente.puntos_gestor_pae}
                          </div>
                        )}
                        <div className="font-black text-gray-900 truncate uppercase text-sm tracking-tight leading-none mb-1 pr-14 dark:text-white">{docente.nombre}</div>
                        <div className="text-[10px] font-bold text-gray-400 truncate pr-14 dark:text-gray-500">{docente.email}</div>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => setSelectedDocente(docente)}
                            className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-cyan-100 transition-all active:scale-95"
                          >
                            Actividad
                          </button>
                          {usuario?.rol === 'admin' && (
                            <button
                              onClick={() => setDocenteParaRol(docente)}
                              className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm flex flex-col items-center justify-center min-w-[70px]"
                              title="Cambiar Rol"
                            >
                              <User className="w-4 h-4" />
                              <span className="text-[7px] font-black uppercase mt-0.5">{docente.rol}</span>
                            </button>
                          )}
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

        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-300" onClick={() => setIsCreateModalOpen(false)}>
            <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 custom-scrollbar-premium dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
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

                <div className="p-6 md:p-8 space-y-5 bg-white dark:bg-gray-800">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-2 dark:text-gray-500">Nombre Completo</label>
                      <input
                        type="text"
                        placeholder="Ej: Juan Pérez"
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-inner dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500"
                        value={newStudent.nombre}
                        onChange={e => setNewStudent({ ...newStudent, nombre: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-2 dark:text-gray-500">Matrícula</label>
                      <input
                        type="text"
                        placeholder="Ej: 2024001"
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-inner dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500"
                        value={newStudent.matricula}
                        onChange={e => setNewStudent({ ...newStudent, matricula: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-2 dark:text-gray-500">
                        Correo Electrónico <span className="text-gray-300 dark:text-gray-600 font-normal ml-1 text-[9px]">(Opcional)</span>
                      </label>
                      <input
                        type="email"
                        placeholder="Ej: estudiante@correo.com"
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-inner dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500"
                        value={newStudent.email}
                        onChange={e => setNewStudent({ ...newStudent, email: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-2 dark:text-gray-500">Grupo</label>
                        {!isNewGroup ? (
                          <div className="relative">
                            <select
                              className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-black text-cyan-700 uppercase text-[10px] tracking-widest appearance-none cursor-pointer shadow-inner dark:bg-gray-700 dark:border-gray-600 dark:text-cyan-400"
                              value={newStudent.grupo}
                              onChange={(e) => {
                                if (e.target.value === 'nuevo') {
                                  setIsNewGroup(true);
                                  setNewStudent({ ...newStudent, grupo: '' });
                                } else {
                                  setNewStudent({ ...newStudent, grupo: e.target.value });
                                }
                              }}
                            >
                              <option value="" disabled>Seleccione un grupo</option>
                              {gruposDisponibles.map((grupo) => (
                                <option key={grupo} value={grupo}>
                                  {grupo}
                                </option>
                              ))}
                              <option value="nuevo">-- Nuevo Grupo... --</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                              <ChevronDown className="h-4 w-4 text-cyan-500" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Ej: 10-1"
                              className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-inner dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500"
                              value={newStudent.grupo}
                              onChange={e => setNewStudent({ ...newStudent, grupo: e.target.value })}
                              autoFocus
                            />
                            <button
                              onClick={() => setIsNewGroup(false)}
                              className="px-4 bg-gray-100 text-gray-500 rounded-2xl transition-all hover:bg-gray-200"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-2 dark:text-gray-500">Sede</label>
                        <div className="relative">
                          <select
                            className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-black text-cyan-700 uppercase text-[10px] tracking-widest appearance-none cursor-pointer shadow-inner dark:bg-gray-700 dark:border-gray-600 dark:text-cyan-400"
                            value={newStudent.sede}
                            onChange={e => setNewStudent({ ...newStudent, sede: e.target.value })}
                          >
                            {sedes.filter(s => s.id !== 'todas').map(s => (
                              <option key={s.id} value={s.id}>{s.nombre.toUpperCase()}</option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                            <ChevronDown className="h-4 w-4 text-cyan-500" />
                          </div>
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
                      className="flex-1 px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-gray-200 active:scale-95 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
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

        {editingStudent && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-300" onClick={() => setEditingStudent(null)}>
              <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 custom-scrollbar-premium dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 md:p-8 bg-gradient-to-br from-amber-500 to-amber-600 text-white relative">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 p-2.5 rounded-2xl shadow-inner border border-white/10">
                        <Edit2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-black text-xl tracking-tight leading-none">Editar Estudiante</h3>
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-80 mt-1.5 text-amber-50">Registro Administrativo</p>
                      </div>
                    </div>
                    <button onClick={() => setEditingStudent(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="p-6 md:p-8 space-y-5 bg-white dark:bg-gray-800">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-2 dark:text-gray-500">Nombre Completo</label>
                      <input
                        type="text"
                        placeholder="Ej: Juan Pérez"
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500/30 transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-inner dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500"
                        value={editFormData.nombre}
                        onChange={e => setEditFormData({ ...editFormData, nombre: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-2 dark:text-gray-500">Matrícula</label>
                      <input
                        type="text"
                        placeholder="Ej: 2024001"
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500/30 transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-inner dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500"
                        value={editFormData.matricula}
                        onChange={e => setEditFormData({ ...editFormData, matricula: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-2 dark:text-gray-500">
                        Correo Electrónico <span className="text-gray-300 dark:text-gray-600 font-normal ml-1 text-[9px]">(Opcional)</span>
                      </label>
                      <input
                        type="email"
                        placeholder="Ej: estudiante@correo.com"
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500/30 transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-inner dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500"
                        value={editFormData.email}
                        onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-2 dark:text-gray-500">Grupo</label>
                        {!isNewGroup ? (
                          <div className="relative">
                            <select
                              className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500/30 transition-all font-black text-amber-700 uppercase text-[10px] tracking-widest appearance-none cursor-pointer shadow-inner dark:bg-gray-700 dark:border-gray-600 dark:text-amber-400"
                              value={gruposDisponibles.includes(editFormData.grupo) ? editFormData.grupo : (editFormData.grupo ? 'nuevo' : '')}
                              onChange={(e) => {
                                if (e.target.value === 'nuevo') {
                                  setIsNewGroup(true);
                                  // Mantener el texto anterior por si quiere usarlo o clear: setEditFormData({ ...editFormData, grupo: '' });
                                } else {
                                  setEditFormData({ ...editFormData, grupo: e.target.value });
                                }
                              }}
                            >
                              <option value="" disabled>Seleccione un grupo</option>
                              {gruposDisponibles.map((grupo) => (
                                <option key={grupo} value={grupo}>
                                  {grupo}
                                </option>
                              ))}
                              {/* Add current group if it's not in the list for some reason */}
                              {editFormData.grupo && !gruposDisponibles.includes(editFormData.grupo) && <option value={editFormData.grupo}>{editFormData.grupo}</option>}
                              <option value="nuevo">-- Nuevo Grupo... --</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                              <ChevronDown className="h-4 w-4 text-amber-500" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Ej: 10-1"
                              className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500/30 transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-inner dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500"
                              value={editFormData.grupo}
                              onChange={e => setEditFormData({ ...editFormData, grupo: e.target.value })}
                              autoFocus
                            />
                            <button
                              onClick={() => setIsNewGroup(false)}
                              className="px-4 bg-gray-100 text-gray-500 rounded-2xl transition-all hover:bg-gray-200"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-2 dark:text-gray-500">Sede</label>
                        <div className="relative">
                          <select
                            className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500/30 transition-all font-black text-amber-700 uppercase text-[10px] tracking-widest appearance-none cursor-pointer shadow-inner dark:bg-gray-700 dark:border-gray-600 dark:text-amber-400"
                            value={editFormData.sede}
                            onChange={e => setEditFormData({ ...editFormData, sede: e.target.value })}
                          >
                            {sedes.filter(s => s.id !== 'todas').map(s => (
                              <option key={s.id} value={s.id}>{s.nombre.toUpperCase()}</option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                            <ChevronDown className="h-4 w-4 text-amber-500" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {updateError && (
                    <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-pulse">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      {updateError}
                    </div>
                  )}

                  <div className="flex gap-4 pt-4">
                    <button
                      onClick={() => setEditingStudent(null)}
                      className="flex-1 px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-gray-200 active:scale-95 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleUpdateStudent}
                      disabled={isUpdating}
                      className="flex-1 px-6 py-4 bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-amber-200 transition-all hover:bg-amber-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isUpdating ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {isUpdating ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Modal Estudiante Detalle (History) */}
        <StudentHistoryModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />

        {/* Modal Docente Detalle (Activity) */}
        {selectedDocente && (
          <DocenteActivityModal
            docente={selectedDocente}
            onClose={() => setSelectedDocente(null)}
          />
        )}

        {/* Modal Cambio de Rol (Security First) */}
        {docenteParaRol && (
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={() => setDocenteParaRol(null)}
          >
            <div 
              className="bg-white rounded-3xl max-w-md w-full max-h-[88vh] overflow-hidden shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 flex flex-col dark:bg-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8 bg-gradient-to-br from-rose-600 to-rose-700 text-white relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md border border-white/10">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="font-black text-2xl tracking-tight leading-none">Aviso de Seguridad</h3>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mt-2 text-rose-100">Acción Administrativa Crítica</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setDocenteParaRol(null)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-white" />
                  </button>
                </div>
                <p className="text-sm font-bold opacity-90 leading-relaxed italic">
                  Estás a punto de modificar los privilegios de acceso para <span className="underline decoration-2 underline-offset-4">{docenteParaRol.nombre}</span>. Esta acción puede comprometer la integridad de la gestión del sistema.
                </p>
              </div>

              <div className="p-5 space-y-6 overflow-y-auto flex-1 custom-scrollbar-premium">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-4 text-center">Selecciona el Nuevo Nivel de Acceso</label>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'admin', label: 'Administrador Total', desc: 'Control total de usuarios y reportes', icon: 'Shield', color: 'text-rose-600', bg: 'bg-rose-50' },
                      { id: 'secretaria_educacion', label: 'Secretaría Educación', desc: 'Auditoría y Gestión Global', icon: 'FileText', color: 'text-purple-600', bg: 'bg-purple-50' },
                      { id: 'coordinador_pae', label: 'Coordinador PAE', desc: 'Gestión de horarios y registros', icon: 'Clock', color: 'text-cyan-600', bg: 'bg-cyan-50' },
                      { id: 'operador', label: 'Operador PAE', desc: 'Logística y Visualización', icon: 'Truck', color: 'text-amber-600', bg: 'bg-amber-50' },
                      { id: 'docente', label: 'Docente / Monitor', desc: 'Solo lectura y registros básicos', icon: 'User', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { id: 'estudiante_pae', label: 'Estudiante PAE', desc: 'Registro de asistencia al restaurante', icon: 'User', color: 'text-teal-600', bg: 'bg-teal-50' },
                      { id: 'estudiante', label: 'Estudiante', desc: 'Acceso a horarios y novedades diarias', icon: 'User', color: 'text-blue-600', bg: 'bg-blue-50' },
                      { id: 'acudiente', label: 'Acudiente / Padre', desc: 'Acceso a horarios y novedades diarias', icon: 'Users', color: 'text-indigo-600', bg: 'bg-indigo-50' }
                    ].map((role) => (
                      <button
                        key={role.id}
                        onClick={() => handleConfirmUpdateRol(role.id)}
                        disabled={modificandoRol}
                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 group ${docenteParaRol.rol === role.id ? 'bg-gray-900 border-gray-900 text-white dark:bg-black dark:border-black' : 'bg-gray-50 border-gray-100 hover:border-cyan-200 hover:bg-white text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600 dark:text-gray-200'}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${docenteParaRol.rol === role.id ? 'bg-white/20' : role.bg + ' ' + role.color}`}>
                          {role.id === 'admin' ? <Shield className="w-5 h-5" /> :
                            role.id === 'secretaria_educacion' ? <FileText className="w-5 h-5" /> :
                              role.id === 'operador' ? <Truck className="w-5 h-5" /> :
                                role.id === 'coordinador_pae' ? <Clock className="w-5 h-5" /> : <User className="w-5 h-5" />}
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-black uppercase tracking-tight leading-none mb-1">{role.label}</p>
                          <p className={`text-[9px] font-bold uppercase tracking-widest opacity-60 ${docenteParaRol.rol === role.id ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>{role.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => setDocenteParaRol(null)}
                    className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-gray-200 active:scale-95 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
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
