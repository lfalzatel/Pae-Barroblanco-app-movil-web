'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  sedes,
  Sede,
  Grupo,
  Estudiante
} from '@/app/data/demoData';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  XCircle,
  UserX,
  Save,
  AlertCircle,
  School,
  GraduationCap,
  Users,
  Home,
  UploadCloud
} from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/Skeleton';
import { OfflineService, PendingAttendance } from '@/lib/offlineService';
import { MiniCalendar } from '@/components/ui/MiniCalendar';

// Extendemos la interfaz de Grupo para incluir el estado de completado
interface GrupoConEstado extends Grupo {
  completado: boolean;
  estudiantesActivos?: number;
}

function RegistroContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usuario, setUsuario] = useState<any | null>(null);

  // Estados derivados de la URL o por defecto
  const [step, setStep] = useState<'sede' | 'grupo' | 'registro'>('sede');
  const [sedeSeleccionada, setSedeSeleccionada] = useState<Sede | null>(null);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<Grupo | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    searchParams.get('fecha') || (() => {
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      return new Date(now.getTime() - offset).toISOString().split('T')[0];
    })()
  );

  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [asistencias, setAsistencias] = useState<Record<string, 'recibio' | 'no_recibio' | 'ausente'>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [totalEstudiantesPrincipal, setTotalEstudiantesPrincipal] = useState(0);

  // Nuevos estados para grupos dinámicos
  const [gruposReales, setGruposReales] = useState<GrupoConEstado[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [duenos, setDuenos] = useState<Record<string, string>>({});
  const [mapaNombres, setMapaNombres] = useState<Record<string, string>>({});
  const [countsBySede, setCountsBySede] = useState<Record<string, number>>({
    principal: 0,
    primaria: 0,
    maria: 0
  });

  // Estado para toast personalizado
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | null } | null>(null);

  // Estados para Novedades
  const [novedades, setNovedades] = useState<Record<string, { tipo: string; descripcion: string }>>({});
  const [modalNovedad, setModalNovedad] = useState<{ open: boolean; estudianteId: string; nombre: string } | null>(null);
  const [tempNovedad, setTempNovedad] = useState({ tipo: '', descripcion: '' });
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [showCalendar, setShowCalendar] = useState(false);
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, number>>({});
  const [calendarView, setCalendarView] = useState({
    month: new Date(selectedDate).getMonth(),
    year: new Date(selectedDate).getFullYear()
  });

  useEffect(() => {
    const updateStatus = () => {
      setIsOnline(OfflineService.isOnline());
      setPendingCount(OfflineService.getPending().length);
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();

    // Polling opcional para actualizar contador de pendientes si cambia en otro lado (o tras sync)
    const interval = setInterval(updateStatus, 5000);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      clearInterval(interval);
    };
  }, []);

  // 1. Cargar Usuario
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
        id: session.user.id,
        foto: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null
      });
    };
    checkUser();
  }, [router]);

  // Sincronización automática al volver a estar online
  useEffect(() => {
    const handleOnline = () => {
      console.log('App is online. Attempting sync...');
      syncPendingRecords();
    };

    window.addEventListener('online', handleOnline);
    // Intentar sincronizar al cargar la página si hay algo pendiente
    syncPendingRecords();

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const syncPendingRecords = async () => {
    const pending = OfflineService.getPending();
    if (pending.length === 0) return;

    try {
      const { error } = await supabase
        .from('asistencia_pae')
        .upsert(pending, { onConflict: 'estudiante_id,fecha' });

      if (error) throw error;

      OfflineService.clearPending();
      showToast('Sincronización completada con éxito', 'success');

      // Si estamos en la vista de registro, recargar para ver datos frescos
      if (step === 'registro' && grupoSeleccionado) {
        handleGrupoSelect(grupoSeleccionado, false);
      } else if (step === 'grupo') {
        fetchGruposReales();
      }
    } catch (error) {
      console.error('Error durante la sincronización:', error);
    }
  };

  // 2. Cargar conteo general por sedes
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const { data, error } = await supabase
          .from('estudiantes')
          .select('sede, grupo');

        if (error) throw error;

        const validData = (data || []).filter(e => !e.grupo || !e.grupo.includes('2025')); // Filter 2025

        const counts = {
          principal: validData.filter(e => e.sede === 'Principal').length,
          primaria: validData.filter(e => e.sede === 'Primaria').length,
          maria: validData.filter(e => e.sede === 'Maria Inmaculada').length,
        };

        setCountsBySede(counts);
        setTotalEstudiantesPrincipal(counts.principal); // Mantener por compatibilidad si se usa en otro lado
      } catch (err) {
        console.error('Error fetching sede counts:', err);
      }
    };
    fetchCounts();
  }, []);

  // 3. Sincronizar Estado con URL al cargar o cambiar parámetros
  useEffect(() => {
    const sedeId = searchParams.get('sede');
    const grupoNombre = searchParams.get('grupo');
    const fecha = searchParams.get('fecha');

    if (fecha && fecha !== selectedDate) {
      setSelectedDate(fecha);
    }

    if (sedeId) {
      const sede = sedes.find(s => s.id === sedeId);
      if (sede) {
        setSedeSeleccionada(sede);
        if (grupoNombre) {
          setStep('registro');
        } else {
          setStep('grupo');
        }
      }
    } else {
      setStep('sede');
      setSedeSeleccionada(null);
      setGrupoSeleccionado(null);
    }
  }, [searchParams]);

  // 4. Cargar Grupos cuando hay sede seleccionada
  useEffect(() => {
    if (sedeSeleccionada) {
      fetchGruposReales();
    }
  }, [sedeSeleccionada, selectedDate]);

  // 5. Cargar fechas con asistencia para el calendario
  useEffect(() => {
    const fetchAttendanceDates = async () => {
      if (!sedeSeleccionada) return;
      setAttendanceCounts({});

      try {
        const { year, month } = calendarView;
        const startOfMonth = `${year}-${(month + 1).toString().padStart(2, '0')}-01`;
        const endOfMonth = `${year}-${(month + 1).toString().padStart(2, '0')}-31`;

        const sedeDbName = sedeSeleccionada.id === 'principal' ? 'Principal' :
          sedeSeleccionada.id === 'primaria' ? 'Primaria' :
            'Maria Inmaculada';

        // 1. Obtener umbrales de estudiantes por grupo (para saber cuándo está completo)
        const { data: studentsData, error: studentsError } = await supabase
          .from('estudiantes')
          .select('grupo, estado')
          .eq('sede', sedeDbName);

        if (studentsError) throw studentsError;

        const groupThresholds = new Map<string, number>();
        studentsData?.forEach((s: any) => {
          if (s.grupo && !s.grupo.includes('2025')) {
            const g = s.grupo;
            if (!groupThresholds.has(g)) groupThresholds.set(g, 0);
            if (s.estado === 'activo' || !s.estado) {
              groupThresholds.set(g, groupThresholds.get(g)! + 1);
            }
          }
        });

        // 2. Obtener asistencia del mes
        let query = supabase
          .from('asistencia_pae')
          .select('fecha, estudiantes!inner(grupo)') // Remove implicit Sede filter on logs
          .gte('fecha', startOfMonth)
          .lte('fecha', endOfMonth);

        if (grupoSeleccionado) {
          query = query.eq('estudiantes.grupo', grupoSeleccionado.nombre);
        }

        const { data, error: fetchError } = await query.limit(40000);

        if (fetchError) throw fetchError;

        if (data) {
          // Mapa: Fecha -> { Grupo -> Conteo }
          const dailyGroupCounts = new Map<string, Map<string, number>>();

          data.forEach((row: any) => {
            const date = row.fecha;
            const grupo = row.estudiantes?.grupo;

            // Contamos TODOS los registros (igual que en fetchGruposReales)
            // El umbral (denominador) sigue siendo solo estudiantes activos.
            if (grupo && groupThresholds.has(grupo)) {
              if (!dailyGroupCounts.has(date)) {
                dailyGroupCounts.set(date, new Map());
              }
              const dateMap = dailyGroupCounts.get(date)!;
              dateMap.set(grupo, (dateMap.get(grupo) || 0) + 1);
            }
          });

          // 3. Contar grupos que cumplieron el umbral por día
          const counts: Record<string, number> = {};

          dailyGroupCounts.forEach((groupsMap, date) => {
            let completedGroups = 0;
            groupsMap.forEach((count, grupo) => {
              const threshold = groupThresholds.get(grupo) || 0;
              if (threshold > 0 && count >= threshold) {
                completedGroups++;
              }
            });
            // Si hay grupo seleccionado, usamos bool (1 o 0), si no, el total
            counts[date] = grupoSeleccionado ? (completedGroups > 0 ? 1 : 0) : completedGroups;
          });

          setAttendanceCounts(counts);
        }
      } catch (error) {
        console.error('Error fetching attendance dates:', error);
      }
    };

    fetchAttendanceDates();

    // 6. Realtime attendance listener
    const channel = supabase
      .channel('attendance_live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asistencia_pae'
        },
        () => {
          fetchAttendanceDates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sedeSeleccionada, grupoSeleccionado, calendarView]);

  // 7. Establecer grupo seleccionado si viene de la URL
  useEffect(() => {
    const grupoNombre = searchParams.get('grupo');
    if (grupoNombre && gruposReales.length > 0 && !grupoSeleccionado) {
      const grupo = gruposReales.find(g => g.nombre === grupoNombre);
      if (grupo) {
        handleGrupoSelect(grupo, false);
      }
    }
  }, [gruposReales, searchParams]);

  const updateUrl = (params: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value === null) newParams.delete(key);
      else newParams.set(key, value);
    });
    router.replace(`?${newParams.toString()}`);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchGruposReales = async () => {
    if (!sedeSeleccionada) return;
    setLoadingGrupos(true);
    try {
      const today = selectedDate;
      const sedeDbName = sedeSeleccionada.id === 'principal' ? 'Principal' :
        sedeSeleccionada.id === 'primaria' ? 'Primaria' :
          'Maria Inmaculada';

      const { data: allStudents, error: studentsError } = await supabase
        .from('estudiantes')
        .select('grupo, grado, estado')
        .eq('sede', sedeDbName);

      if (studentsError) throw studentsError;

      const gruposMap = new Map();
      allStudents?.forEach((item: any) => {
        if (item.grupo && item.grupo.includes('2025')) return; // Filter out 2025 groups

        if (!gruposMap.has(item.grupo)) {
          gruposMap.set(item.grupo, {
            id: item.grupo,
            nombre: item.grupo,
            grado: item.grado,
            estudiantes: 0,
            estudiantesActivos: 0,
            completado: false
          });
        }
        const g = gruposMap.get(item.grupo);
        g.estudiantes++;
        if (item.estado === 'activo' || !item.estado) {
          g.estudiantesActivos++;
        }
      });

      const gruposUnicos: GrupoConEstado[] = Array.from(gruposMap.values());

      const { data: asistenciaData } = await supabase
        .from('asistencia_pae')
        .select('estudiante_id, estudiantes!inner(grupo)')
        .eq('fecha', today);

      if (asistenciaData) {
        const conteoPorGrupo: Record<string, number> = {};
        asistenciaData.forEach((a: any) => {
          const g = a.estudiantes.grupo;
          conteoPorGrupo[g] = (conteoPorGrupo[g] || 0) + 1;
        });

        gruposUnicos.forEach(g => {
          const threshold = (g as any).estudiantesActivos;
          if (conteoPorGrupo[g.nombre] && conteoPorGrupo[g.nombre] >= threshold && threshold > 0) {
            g.completado = true;
          }
        });
      }

      gruposUnicos.sort((a, b) => {
        const gradeA = parseInt(a.grado) || 0;
        const gradeB = parseInt(b.grado) || 0;
        if (gradeA !== gradeB) return gradeA - gradeB;
        return a.nombre.localeCompare(b.nombre);
      });

      setGruposReales(gruposUnicos);

    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoadingGrupos(false);
    }
  };

  const handleSedeSelect = (sede: Sede) => {
    setSedeSeleccionada(sede);
    setStep('grupo');
    updateUrl({ sede: sede.id, grupo: null });
  };

  const handleGrupoSelect = async (grupo: Grupo, updateUrlParam = true) => {
    setGrupoSeleccionado(grupo);
    setStep('registro');
    if (updateUrlParam) updateUrl({ grupo: grupo.nombre });

    setLoadingGrupos(true);
    try {
      const { data: estudiantesData, error } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('grupo', grupo.nombre)
        .order('nombre');

      if (error) throw error;
      setEstudiantes(estudiantesData || []);

      const { data: asistenciasData, error: asistError } = await supabase
        .from('asistencia_pae')
        .select('*')
        .eq('fecha', selectedDate)
        .in('estudiante_id', (estudiantesData || []).map(e => e.id));

      if (asistError) throw asistError;

      const newAsistencias: Record<string, 'recibio' | 'no_recibio' | 'ausente'> = {};
      const newNovedades: Record<string, { tipo: string; descripcion: string }> = {};
      const newDuenos: Record<string, string> = {};
      const asistenciaMap = new Map();

      asistenciasData?.forEach((a: any) => {
        asistenciaMap.set(a.estudiante_id, a);
      });

      estudiantesData?.forEach((est: any) => {
        if (asistenciaMap.has(est.id)) {
          const a = asistenciaMap.get(est.id);
          newAsistencias[est.id] = a.estado;
          if (a.novedad_tipo || a.novedad_descripcion) {
            newNovedades[est.id] = {
              tipo: a.novedad_tipo || '',
              descripcion: a.novedad_descripcion || ''
            };
          }
          if (a.registrado_por) {
            newDuenos[est.id] = a.registrado_por;
          }
        } else {
          const isActivo = est.estado === 'activo' || !est.estado;
          if (isActivo) {
            newAsistencias[est.id] = 'recibio';
          }
        }
      });

      setAsistencias(newAsistencias);
      setNovedades(newNovedades);
      setDuenos(newDuenos);

      // Cargar nombres de los responsables desde perfiles_publicos
      const uniqueUids = Array.from(new Set(Object.values(newDuenos)));
      if (uniqueUids.length > 0) {
        const { data: perfiles } = await supabase
          .from('perfiles_publicos')
          .select('id, nombre')
          .in('id', uniqueUids);

        if (perfiles) {
          const m: Record<string, string> = {};
          perfiles.forEach(p => { m[p.id] = p.nombre; });
          setMapaNombres(m);
        }
      } else {
        setMapaNombres({});
      }

    } catch (error) {
      console.error('Error loading group details:', error);
    } finally {
      setLoadingGrupos(false);
    }
  };

  const handleToggleEstado = async (estudiante: Estudiante) => {
    const newState = estudiante.estado === 'activo' ? 'inactivo' : 'activo';
    setEstudiantes(prev => prev.map(e => e.id === estudiante.id ? { ...e, estado: newState } : e));

    if (newState === 'inactivo') {
      const newAsist = { ...asistencias };
      delete newAsist[estudiante.id];
      setAsistencias(newAsist);
    } else {
      setAsistencias(prev => ({ ...prev, [estudiante.id]: 'recibio' }));
    }

    const { error } = await supabase
      .from('estudiantes')
      .update({ estado: newState })
      .eq('id', estudiante.id);

    if (error) {
      console.error('Error updating status:', error);
      showToast('Error al actualizar estado', 'error');
    }
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    updateUrl({ fecha: newDate });
    if (grupoSeleccionado) {
      handleGrupoSelect(grupoSeleccionado, false);
    }
  };

  const handleBack = () => {
    if (step === 'grupo') {
      updateUrl({ sede: null, grupo: null });
      setStep('sede');
      setSedeSeleccionada(null);
    }
    if (step === 'registro') {
      updateUrl({ grupo: null });
      setStep('grupo');
      setGrupoSeleccionado(null);
      if (sedeSeleccionada) fetchGruposReales();
    }
  };

  const handleMarcarTodos = () => {
    const nuevasAsistencias = { ...asistencias };
    estudiantes.forEach(est => {
      if (est.estado !== 'inactivo' && !nuevasAsistencias[est.id]) {
        nuevasAsistencias[est.id] = 'recibio';
      }
    });
    setAsistencias(nuevasAsistencias);
    showToast('Se marcaron todos los pendientes como "Recibió"', 'success');
  };

  const handleGuardar = async () => {
    if (!usuario?.id) return;
    setSaving(true);
    try {
      const updates: PendingAttendance[] = Object.entries(asistencias).map(([estudianteId, estado]) => ({
        estudiante_id: estudianteId,
        fecha: selectedDate,
        estado,
        registrado_por: usuario.id,
        novedad_tipo: novedades[estudianteId]?.tipo || null,
        novedad_descripcion: novedades[estudianteId]?.descripcion || null
      }));

      if (!OfflineService.isOnline()) {
        OfflineService.savePending(updates);
        showToast('Sin internet. Guardado localmente para sincronizar después.', 'success');
        handleBack();
        return;
      }

      // Si hay registros pendientes de antes, incluirlos en el upsert
      const pending = OfflineService.getPending();
      const allUpdates = [...pending, ...updates];

      const { error } = await supabase
        .from('asistencia_pae')
        .upsert(allUpdates, { onConflict: 'estudiante_id,fecha' });

      if (error) throw error;

      OfflineService.clearPending();
      showToast(`Asistencia guardada para el ${selectedDate}`, 'success');
      handleBack();
    } catch (error: any) {
      console.error('Error guardando:', error);
      showToast(`Error: ${error.message || 'Desconocido'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const openNovedadModal = (estudiante: Estudiante) => {
    const existingValue = novedades[estudiante.id] || { tipo: '', descripcion: '' };
    setTempNovedad(existingValue);
    setModalNovedad({ open: true, estudianteId: estudiante.id, nombre: estudiante.nombre });
  };

  const saveNovedad = () => {
    if (modalNovedad) {
      setNovedades(prev => ({
        ...prev,
        [modalNovedad.estudianteId]: tempNovedad
      }));
      setModalNovedad(null);
    }
  };

  const estudiantesFiltrados = estudiantes.filter(est =>
    est.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    est.matricula.includes(searchQuery)
  );

  const statsCount = {
    recibieron: Object.values(asistencias).filter(a => a === 'recibio').length,
    noRecibieron: Object.values(asistencias).filter(a => a === 'no_recibio').length,
    noAsistieron: Object.values(asistencias).filter(a => a === 'ausente').length,
    inactivos: estudiantes.filter(e => e.estado === 'inactivo').length
  };

  const fullDateStr = new Date(selectedDate + 'T12:00:00')
    .toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
    .toLowerCase();

  const dateTitle = fullDateStr.split(',').map(part => part.trim().charAt(0).toUpperCase() + part.trim().slice(1)).join(', ');

  if (!usuario) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Modal de Novedad */}
      {modalNovedad && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Registrar Novedad</h3>
              <button onClick={() => setModalNovedad(null)} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-4">{modalNovedad.nombre}</p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Novedad</label>
                <div className="flex flex-wrap gap-2">
                  {['Alergia', 'Rechazo Alimento', 'Problema Calidad', 'Porción Insuficiente', 'Otro'].map(tipo => (
                    <button
                      key={tipo}
                      onClick={() => setTempNovedad(prev => ({ ...prev, tipo }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${tempNovedad.tipo === tipo
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}
                    >
                      {tipo}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
                <textarea
                  value={tempNovedad.descripcion}
                  onChange={(e) => setTempNovedad(prev => ({ ...prev, descripcion: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm h-24 resize-none"
                  placeholder="Describa la novedad..."
                />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setModalNovedad(null)} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={saveNovedad} className="flex-1 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white font-bold shadow-md shadow-yellow-200">
                  Guardar Novedad
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visual Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[70] px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-fade-in-down
          ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* STICKY HEADER BLOCK: Title + Stats + Buttons */}
      <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 shadow-xl shadow-cyan-900/10 sticky top-16 md:top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:pt-6 md:pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  if (step === 'sede') router.push('/dashboard');
                  else handleBack();
                }}
                className="p-2 md:p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 shadow-lg border border-white/10"
              >
                <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              <div className="relative">
                <h1 className="text-lg md:text-2xl font-black text-white leading-none tracking-tight">
                  {step === 'sede' && 'Seleccionar Sede'}
                  {step === 'grupo' && (sedeSeleccionada ? `Grupos: ${sedeSeleccionada.nombre}` : 'Seleccionar Grupo')}
                  {step === 'registro' && 'Registro de Asistencia'}
                </h1>
                <p className="text-[9px] md:text-[11px] font-bold text-cyan-50 uppercase tracking-[0.2em] mt-1 opacity-90">
                  {step === 'registro' ? `GRUPO ${grupoSeleccionado?.nombre.replace(/-20\d{2,}/, '')} • ${dateTitle}` : `${dateTitle}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isOnline && (
                <div className="flex items-center gap-2 bg-red-500/20 backdrop-blur-md text-white px-2 py-1 md:px-3 md:py-2 rounded-xl text-[8px] md:text-[9px] font-black tracking-widest border border-white/10">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  OFFLINE
                </div>
              )}
              {pendingCount > 0 && (
                <div className="flex items-center gap-2 bg-amber-500/20 backdrop-blur-md text-white px-2 py-1 md:px-3 md:py-2 rounded-xl text-[8px] md:text-[9px] font-black tracking-widest border border-white/10">
                  <UploadCloud className="w-3 h-3 md:w-3.5 md:h-3.5 animate-bounce" />
                  {pendingCount} PEND.
                </div>
              )}
              {(step === 'grupo' || step === 'registro') && (
                <button
                  onClick={() => setShowCalendar(true)}
                  className="p-2 md:p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all shadow-lg border border-white/10 active:scale-95 group"
                >
                  <Calendar className="w-5 h-5 md:w-6 md:h-6 group-hover:rotate-12 transition-transform" />
                </button>
              )}
            </div>
          </div>
        </div>
        {step === 'registro' && grupoSeleccionado && (
          <div className="space-y-2 pt-2 pb-5 bg-white shadow-lg transition-all">
            <div className="flex flex-col md:flex-row justify-between px-2 items-center md:items-end gap-3 md:gap-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex gap-4 md:gap-8 justify-center w-full md:w-auto">
                <div className="flex flex-col items-center">
                  <span className="text-2xl md:text-3xl font-black text-emerald-400 leading-none">{statsCount.recibieron}</span>
                  <span className="text-[9px] md:text-[10px] font-bold text-gray-400 mt-0.5">Recibieron</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl md:text-3xl font-black text-red-500 leading-none">{statsCount.noRecibieron}</span>
                  <span className="text-[9px] md:text-[10px] font-bold text-gray-400 mt-0.5">No Recibieron</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl md:text-3xl font-black text-slate-500 leading-none">{statsCount.noAsistieron}</span>
                  <span className="text-[9px] md:text-[10px] font-bold text-gray-400 mt-0.5">Ausentes</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl md:text-3xl font-black text-orange-400 leading-none">{statsCount.inactivos}</span>
                  <span className="text-[9px] md:text-[10px] font-bold text-gray-400 mt-0.5">Inactivos</span>
                </div>
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                <button
                  onClick={handleMarcarTodos}
                  className="flex-1 md:flex-none justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl md:rounded-2xl py-2.5 md:py-3 px-4 md:px-6 font-black uppercase text-[9px] md:text-[10px] tracking-widest flex items-center gap-2 shadow-xl shadow-cyan-900/20 transition-all active:scale-95 border border-emerald-400/30"
                >
                  <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span>TODOS RECIBIERON</span>
                </button>
                <button
                  onClick={handleGuardar}
                  disabled={saving}
                  className="flex-1 md:flex-none justify-center bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl md:rounded-2xl py-2.5 md:py-3 px-4 md:px-8 font-black uppercase text-[9px] md:text-[10px] tracking-widest flex items-center gap-2 shadow-xl shadow-cyan-900/20 disabled:opacity-50 transition-all active:scale-95"
                >
                  {saving ? <div className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin border-2 border-white/30 border-t-white rounded-full" /> : <Save className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                  <span>{saving ? '...' : 'GUARDAR'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {step === 'sede' && (
          <div className="space-y-4">
            {sedes.map(sede => (
              <button
                key={sede.id}
                onClick={() => handleSedeSelect(sede)}
                className="w-full relative h-28 rounded-[2rem] overflow-hidden shadow-lg group transition-all hover:shadow-2xl hover:scale-[1.01] active:scale-[0.99] border-2 border-transparent hover:border-cyan-400/50"
              >
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: `url("/${sede.id === 'principal' ? 'sede_principal.png' : sede.id === 'primaria' ? 'sede_primaria.png' : 'sede_maria.png'}")` }} />
                <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent" />
                <div className="absolute inset-0 p-6 flex items-center gap-4 text-white">
                  <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md flex-shrink-0 border border-white/20 shadow-xl group-hover:bg-cyan-500/20 group-hover:border-cyan-400 transition-all">
                    {sede.id === 'principal' ? <School className="w-8 h-8" /> : sede.id === 'primaria' ? <GraduationCap className="w-8 h-8" /> : <Home className="w-8 h-8" />}
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-xl font-black leading-tight tracking-tight uppercase">{sede.nombre}</h3>
                    <p className="text-cyan-50/70 text-[10px] font-black uppercase tracking-[0.2em] mb-3">{sede.id === 'principal' ? 'GRADOS 6° - 11°' : 'EDUCACIÓN PRIMARIA'}</p>
                    <div className="inline-flex bg-white/10 px-4 py-1.5 rounded-xl backdrop-blur-md items-center gap-2 border border-white/10 shadow-inner">
                      <span className="font-black text-[10px] uppercase tracking-widest">{countsBySede[sede.id] || 0} ESTUDIANTES</span>
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 'grupo' && sedeSeleccionada && (
          <div>
            {loadingGrupos ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-8">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="rounded-lg p-3 border border-gray-100 bg-white min-h-[100px] flex flex-col items-center justify-center space-y-2">
                    <Skeleton className="h-6 w-12" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
                {gruposReales.map(grupo => (
                  <button
                    key={grupo.id}
                    onClick={() => handleGrupoSelect(grupo)}
                    className={`rounded-2xl p-3 shadow-sm border transition-all text-center flex flex-col items-center justify-center min-h-[90px] group active:scale-[0.97]
                      ${grupo.completado ? 'bg-cyan-600 border-cyan-500 text-white shadow-md shadow-cyan-100' : 'bg-white border-gray-100 hover:border-cyan-400 hover:bg-cyan-50/50'}
                    `}
                    style={grupo.completado ? { backgroundColor: '#0891b2', color: 'white' } : {}}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className={`text-lg font-black ${grupo.completado ? 'text-white' : 'text-gray-900 group-hover:text-cyan-700'}`}>
                        {grupo.nombre.replace(/-20\d{2,}/, '')}
                      </div>
                      {grupo.completado && (
                        <CheckCircle className="w-4 h-4 text-cyan-200" />
                      )}
                    </div>

                    <div className={`text-[11px] font-medium leading-none mb-2 ${grupo.completado ? 'text-cyan-100' : 'text-gray-400'}`}>
                      {grupo.estudiantes} estudiantes
                    </div>

                    <div className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${grupo.completado ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-cyan-100 group-hover:text-cyan-600'}`}>
                      {grupo.completado ? 'COMPLETADO' : 'PENDIENTE'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'registro' && grupoSeleccionado && (
          <div>
            {loadingGrupos ? (
              <div className="space-y-4">
                <div className="h-12 bg-gray-100 rounded-xl mb-6 animate-pulse" />
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-12 h-12 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <Skeleton className="w-11 h-6 rounded-full" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Skeleton className="h-12 rounded-xl" />
                      <Skeleton className="h-12 rounded-xl" />
                      <Skeleton className="h-12 rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="relative group">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre o matrícula..."
                    className="w-full pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-full focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 shadow-xl shadow-gray-200/50 transition-all font-bold text-gray-700 text-sm"
                  />
                  <Users className="w-5 h-5 text-gray-300 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-cyan-500 transition-colors" />
                </div>

                {/* Info de responsable */}
                {Object.keys(duenos).length > 0 && (
                  <div className="mt-2 px-1 flex items-center gap-2 text-[10px] text-gray-500 font-medium">
                    <Users className="w-3 h-3 text-blue-500" />
                    <span>
                      Registrado por: {' '}
                      <span className="text-blue-600 font-bold">
                        {Array.from(new Set(Object.values(duenos)))
                          .map(uid => mapaNombres[uid] || 'Cargando...')
                          .join(', ')}
                      </span>
                    </span>
                  </div>
                )}

                <div className="space-y-4 pt-2">
                  {estudiantesFiltrados.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">No se encontraron estudiantes</div>
                  ) : (
                    estudiantesFiltrados.map(estudiante => {
                      const isLocked = !!(duenos[estudiante.id] && duenos[estudiante.id] !== usuario?.id && usuario?.rol !== 'admin');
                      const currentAsist = asistencias[estudiante.id];

                      return (
                        <div
                          key={estudiante.id}
                          className={`bg-white rounded-[1.5rem] p-4 shadow-sm border-2 transition-all relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300
                            ${estudiante.estado === 'inactivo' ? 'opacity-50 grayscale bg-gray-50 border-gray-100 shadow-none' : 'border-transparent hover:shadow-xl hover:shadow-cyan-900/5'}
                            ${currentAsist === 'recibio' ? 'border-cyan-500/30 bg-cyan-50/10 shadow-cyan-100/50' : currentAsist === 'no_recibio' ? 'border-red-500/30 bg-red-50/10 shadow-red-100/50' : currentAsist === 'ausente' ? 'border-gray-300/30 bg-gray-50/50' : ''}
                          `}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-inner border border-white/50 transition-all duration-300
                                ${currentAsist === 'recibio' ? 'bg-cyan-500 text-white rotate-3 shadow-cyan-200' : 'bg-gradient-to-br from-gray-50 to-gray-100 text-gray-400'}
                              `}>
                                {estudiante.nombre.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="font-black text-gray-900 leading-tight tracking-tight text-[12px]">{estudiante.nombre}</div>
                                  {isLocked && (
                                    <div className="bg-amber-100 text-amber-600 p-1.5 rounded-lg border border-amber-200 shadow-sm" title="Registro de otro docente. Solo lectura.">
                                      <AlertCircle className="w-3.5 h-3.5" />
                                    </div>
                                  )}
                                </div>
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{estudiante.matricula} • {estudiante.grupo.replace(/-20\d{2,}/, '')}</div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleToggleEstado(estudiante)}
                              disabled={isLocked}
                              className="bg-gray-50 px-2 py-2 rounded-xl flex flex-col items-center gap-1 hover:bg-gray-100 transition-colors border border-gray-100 active:scale-95 disabled:opacity-30 h-14 w-14 justify-center"
                            >
                              <div className={`w-8 h-4 rounded-full relative transition-colors duration-300 flex-shrink-0 ${estudiante.estado !== 'inactivo' ? 'bg-cyan-500' : 'bg-gray-300'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all duration-300 ${estudiante.estado !== 'inactivo' ? 'left-4.5 translate-x-1' : 'left-0.5'}`} />
                              </div>
                              <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest leading-none">
                                {estudiante.estado !== 'inactivo' ? 'ACTIVO' : 'INACTIVO'}
                              </span>
                            </button>
                          </div>

                          {estudiante.estado !== 'inactivo' && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-3 gap-3">
                                <button
                                  onClick={() => setAsistencias({ ...asistencias, [estudiante.id]: 'recibio' })}
                                  disabled={isLocked}
                                  className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1 border-2 active:scale-95 disabled:opacity-30
                                    ${currentAsist === 'recibio' ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-200' : 'bg-white border-gray-100 text-gray-400 hover:border-cyan-200 hover:text-cyan-600'}
                                  `}
                                >
                                  <CheckCircle className={`w-4 h-4 ${currentAsist === 'recibio' ? 'animate-bounce' : ''}`} />
                                  <span>Recibió</span>
                                </button>
                                <button
                                  onClick={() => setAsistencias({ ...asistencias, [estudiante.id]: 'no_recibio' })}
                                  disabled={isLocked}
                                  className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1 border-2 active:scale-95 disabled:opacity-30
                                    ${currentAsist === 'no_recibio' ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-200' : 'bg-white border-gray-100 text-gray-400 hover:border-red-200 hover:text-red-500'}
                                  `}
                                >
                                  <XCircle className="w-4 h-4" />
                                  <span>No Recibió</span>
                                </button>
                                <button
                                  onClick={() => setAsistencias({ ...asistencias, [estudiante.id]: 'ausente' })}
                                  disabled={isLocked}
                                  className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1 border-2 active:scale-95 disabled:opacity-30
                                    ${currentAsist === 'ausente' ? 'bg-gray-800 border-gray-700 text-white shadow-lg shadow-gray-200' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-300 hover:text-gray-700'}
                                  `}
                                >
                                  <UserX className="w-4 h-4" />
                                  <span>Ausente</span>
                                </button>
                              </div>

                              {currentAsist === 'no_recibio' && (
                                <button
                                  onClick={() => openNovedadModal(estudiante)}
                                  disabled={isLocked}
                                  className="w-full bg-amber-50 hover:bg-amber-100 text-amber-700 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-amber-200 active:scale-95"
                                >
                                  <AlertCircle className="w-4 h-4" />
                                  REGISTRAR NOVEDAD
                                  {novedades[estudiante.id] && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse ml-1" />}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Date Picker Modal */}
      {showCalendar && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowCalendar(false)}></div>
          <div className="bg-white/95 backdrop-blur-2xl rounded-[2.5rem] w-full max-w-[90vw] md:max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-white/20 mx-auto">
            <div className="p-6 border-b border-gray-100 bg-gradient-to-br from-cyan-600 to-cyan-700 flex items-center justify-between text-white">
              <h3 className="font-black flex items-center gap-3 uppercase text-[11px] tracking-[0.2em]">
                <Calendar className="w-5 h-5" />
                Seleccionar Fecha
              </h3>
              <button
                onClick={() => setShowCalendar(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-all hover:rotate-90"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 bg-white">
              <MiniCalendar
                selectedDate={selectedDate}
                onSelectDate={(date) => {
                  handleDateChange(date);
                  setShowCalendar(false);
                }}
                mode="attendance"
                dateData={attendanceCounts}
                showCounters={!grupoSeleccionado}
                onMonthChange={(year, month) => {
                  setCalendarView({ year, month });
                }}
              />
            </div>
            <div className="p-6 pt-0 bg-white">
              <button
                onClick={() => setShowCalendar(false)}
                className="w-full py-4 bg-cyan-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-cyan-100 hover:bg-cyan-700 active:scale-[0.98] transition-all"
              >
                LISTO, VOLVER
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RegistroPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div></div>}>
      <RegistroContent />
    </Suspense>
  );
}
