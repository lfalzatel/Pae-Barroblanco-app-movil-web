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
  Home
} from 'lucide-react';
import Link from 'next/link';

// Extendemos la interfaz de Grupo para incluir el estado de completado
interface GrupoConEstado extends Grupo {
  completado: boolean;
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

  // Estado para toast personalizado
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | null } | null>(null);

  // Estados para Novedades
  const [novedades, setNovedades] = useState<Record<string, { tipo: string; descripcion: string }>>({});
  const [modalNovedad, setModalNovedad] = useState<{ open: boolean; estudianteId: string; nombre: string } | null>(null);
  const [tempNovedad, setTempNovedad] = useState({ tipo: '', descripcion: '' });

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
        nombre: session.user.user_metadata?.nombre || 'Usuario',
        rol: session.user.user_metadata?.rol || 'docente',
        id: session.user.id
      });
    };
    checkUser();
  }, [router]);

  // 2. Cargar conteo general (solo una vez)
  useEffect(() => {
    const fetchCounts = async () => {
      const { count } = await supabase
        .from('estudiantes')
        .select('*', { count: 'exact', head: true });

      if (count !== null) setTotalEstudiantesPrincipal(count);
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
          // Si hay grupo, vamos directo a registro, pero necesitamos cargar info del grupo primero si no está
          // Como Grupo es un objeto complejo en este código legado (demoData), lo reconstruimos o buscamos
          // Para simplificar, si estamos en modo URL, asumimos datos básicos o esperamos a fetchGruposReales
          setStep('registro');
          // La carga de datos del grupo se hará cuando fetchGruposReales termine o via efecto secundario
          // Pero fetchGruposReales solo corre en paso 'grupo', así que necesitamos lógica específica aquí.

          // Estrategia: Cargar lista de grupos siempre que haya sede, y luego seleccionar el grupo si está en URL
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

  // 4. Cargar Grupos cuando hay sede seleccionada (independiente del step visual, para tener la data)
  useEffect(() => {
    if (sedeSeleccionada?.id === 'principal') {
      fetchGruposReales();
    }
  }, [sedeSeleccionada, selectedDate]); // Recargar si cambia sede o fecha

  // 5. Establecer grupo seleccionado si viene de la URL y ya cargaron los grupos
  useEffect(() => {
    const grupoNombre = searchParams.get('grupo');
    if (grupoNombre && gruposReales.length > 0 && !grupoSeleccionado) {
      const grupo = gruposReales.find(g => g.nombre === grupoNombre);
      if (grupo) {
        handleGrupoSelect(grupo, false); // false = no actualizar URL (ya está ahí)
      }
    }
  }, [gruposReales, searchParams]);


  // Función helper para actualizar URL
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
    setLoadingGrupos(true);
    try {
      const today = selectedDate;

      // 1. Obtener grupos únicos de estudiantes
      const { data: gruposData, error: gruposError } = await supabase
        .from('estudiantes')
        .select('grupo, grado')
        .eq('sede', 'Principal') // Ajustar si es necesario para otras sedes
        .order('grado', { ascending: true }); // Ordenar por grado para consistencia

      if (gruposError) throw gruposError;

      // Agrupar y limpiar duplicados
      const gruposMap = new Map();
      gruposData?.forEach((item: any) => {
        if (!gruposMap.has(item.grupo)) {
          gruposMap.set(item.grupo, {
            id: item.grupo,
            nombre: item.grupo,
            grado: item.grado,
            estudiantes: 0,
            completado: false
          });
        }
      });

      const gruposUnicos: GrupoConEstado[] = Array.from(gruposMap.values());

      // 2. Contar estudiantes por grupo
      for (let grupo of gruposUnicos) {
        const { count } = await supabase
          .from('estudiantes')
          .select('*', { count: 'exact', head: true })
          .eq('grupo', grupo.nombre);
        grupo.estudiantes = count || 0;
      }

      // 3. Verificar completitud (si ya se registró asistencia hoy)
      const { data: asistenciaData } = await supabase
        .from('asistencia_pae')
        .select('estudiante_id, estudiantes!inner(grupo)')
        .eq('fecha', today);

      const gruposCompletados = new Set();
      if (asistenciaData) {
        // Agrupar asistencias por grupo
        const conteoPorGrupo: Record<string, number> = {};
        asistenciaData.forEach((a: any) => {
          const g = a.estudiantes.grupo;
          conteoPorGrupo[g] = (conteoPorGrupo[g] || 0) + 1;
        });

        // Si el conteo de asistencia >= estudiantes del grupo, marcar como completado
        gruposUnicos.forEach(g => {
          if (conteoPorGrupo[g.nombre] && conteoPorGrupo[g.nombre] >= g.estudiantes && g.estudiantes > 0) {
            g.completado = true;
          }
        });
      }

      // Ordenar: primero por grado numérico, luego por letra de grupo
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

    setLoadingGrupos(true); // Reusamos loading state para la carga de estudiantes
    try {
      // Cargar Estudiantes del Grupo
      const { data: estudiantesData, error } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('grupo', grupo.nombre)
        .order('nombre');

      if (error) throw error;
      setEstudiantes(estudiantesData || []);

      // Cargar Asistencias existentes para la fecha
      const { data: asistenciasData, error: asistError } = await supabase
        .from('asistencia_pae')
        .select('*')
        .eq('fecha', selectedDate)
        .in('estudiante_id', (estudiantesData || []).map(e => e.id));

      if (asistError) throw asistError;

      const newAsistencias: Record<string, 'recibio' | 'no_recibio' | 'ausente'> = {};
      const newNovedades: Record<string, { tipo: string; descripcion: string }> = {};

      asistenciasData?.forEach((a: any) => {
        newAsistencias[a.estudiante_id] = a.estado;
        if (a.novedad_tipo || a.novedad_descripcion) {
          newNovedades[a.estudiante_id] = {
            tipo: a.novedad_tipo || '',
            descripcion: a.novedad_descripcion || ''
          };
        }
      });
      setAsistencias(newAsistencias);
      setNovedades(newNovedades);

    } catch (error) {
      console.error('Error loading group details:', error);
    } finally {
      setLoadingGrupos(false);
    }
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    updateUrl({ fecha: newDate });
    // Si estamos en un grupo, recargar asistencias
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
      // Recargar grupos para actualizar colores
      if (sedeSeleccionada?.id === 'principal') fetchGruposReales();
    }
  };

  const handleMarcarTodos = () => {
    const nuevasAsistencias = { ...asistencias };
    estudiantes.forEach(est => {
      // Solo marcar si no tiene estado
      if (!nuevasAsistencias[est.id]) {
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
      const updates = Object.entries(asistencias).map(([estudianteId, estado]) => ({
        estudiante_id: estudianteId,
        fecha: selectedDate,
        estado, // Ya es compatible con DB (no_recibio)
        registrado_por: usuario.id,
        novedad_tipo: novedades[estudianteId]?.tipo || null,
        novedad_descripcion: novedades[estudianteId]?.descripcion || null
      }));

      // Upsert (Insertar o Actualizar)
      const { error } = await supabase
        .from('asistencia_pae')
        .upsert(updates, { onConflict: 'estudiante_id,fecha' });

      if (error) throw error;

      showToast(`Asistencia guardada para el ${selectedDate}`, 'success');

      // Regresar a la lista de grupos y recargar estado
      await fetchGruposReales(); // Esperar para asegurar consistencia
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
    ausentes: Object.values(asistencias).filter(a => a === 'ausente').length,
    total: estudiantes.length
  };
  const pendientes = statsCount.total - (statsCount.recibieron + statsCount.noRecibieron + statsCount.ausentes);

  const dateTitle = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'long' });

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

      {/* Header Sticky Principal */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                disabled={step === 'sede'} // Deshabilitar si no hay historial visual
                className={`p-2 rounded-lg transition-colors ${step === 'sede' ? 'text-gray-300 cursor-default' : 'hover:bg-gray-100 text-gray-700'}`}
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-none mb-1">
                  {step === 'sede' && 'Seleccionar Sede'}
                  {step === 'grupo' && 'Seleccionar Grupo'}
                  {step === 'registro' && 'Registro de Asistencia'}
                </h1>
                <p className="text-sm text-gray-600 capitalize">
                  {step === 'registro' ? `Grupo ${grupoSeleccionado?.nombre} • ${dateTitle}` : dateTitle}
                </p>
              </div>
            </div>

            {/* Selector de Fecha */}
            {(step === 'grupo' || step === 'registro') && (
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                />
                <button className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors relative z-10 pointer-events-none">
                  <Calendar className="w-6 h-6" />
                </button>
              </div>
            )}
            {step === 'sede' && (
              <div className="p-2">
                <Calendar className="w-6 h-6 text-gray-400" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Selección de Sede */}
        {step === 'sede' && (
          <div className="space-y-4">
            {sedes.map(sede => (
              <button
                key={sede.id}
                onClick={() => handleSedeSelect(sede)}
                className="w-full relative h-32 rounded-2xl overflow-hidden shadow-md group transition-all hover:shadow-xl hover:scale-[1.01]"
              >
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("/${sede.id === 'principal' ? 'sede_principal.png' : sede.id === 'primaria' ? 'sede_primaria.png' : 'sede_maria.png'}")` }} />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
                <div className="absolute inset-0 p-4 flex items-center gap-4 text-white">
                  <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm flex-shrink-0">
                    {sede.id === 'principal' ? <School className="w-8 h-8" /> : sede.id === 'primaria' ? <GraduationCap className="w-8 h-8" /> : <Home className="w-8 h-8" />}
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-xl font-bold leading-tight">{sede.nombre}</h3>
                    <p className="text-gray-200 text-sm mb-1">{sede.id === 'principal' ? 'Grados 6° - 11°' : 'Educación Primaria'}</p>
                    <div className="inline-flex bg-white/20 px-3 py-1 rounded-full backdrop-blur-md items-center gap-1.5 pt-0.5">
                      <span className="font-bold text-xs">{sede.id === 'principal' ? totalEstudiantesPrincipal : 0} Estudiantes</span>
                      <Users className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Selección de Grupo */}
        {step === 'grupo' && sedeSeleccionada && (
          <div>
            {loadingGrupos ? (
              <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 mb-8">
                {gruposReales
                  .map(grupo => (
                    <button
                      key={grupo.id}
                      onClick={() => handleGrupoSelect(grupo)}
                      className={`rounded-xl p-4 shadow-sm border transition-all text-center flex flex-col items-center justify-center min-h-[130px] relative overflow-hidden group
                            ${grupo.completado
                          ? 'bg-[#10B981] border-[#10B981] text-white'
                          : 'bg-white border-gray-200 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md'
                        }
                        `}
                    >
                      <div className={`text-2xl font-bold mb-1 flex items-center gap-2 ${grupo.completado ? 'text-white' : 'text-gray-900'}`}>
                        {grupo.nombre}
                        {grupo.completado && <CheckCircle className="w-6 h-6 text-white" fill="currentColor" stroke="none" />}
                      </div>
                      <div className={`text-sm mb-2 ${grupo.completado ? 'text-green-50' : 'text-gray-600'}`}>{grupo.grado}</div>
                      <div className={`text-xs ${grupo.completado ? 'text-green-100' : 'text-gray-400'}`}>
                        {grupo.estudiantes} estudiantes
                      </div>

                      {grupo.completado && (
                        <div className="mt-3 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-white uppercase tracking-wider">
                          Completado
                        </div>
                      )}
                    </button>
                  ))}
                {gruposReales.length === 0 && (
                  <div className="col-span-3 text-center py-8 text-gray-500">
                    No se encontraron grupos para esta sede.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Registro de Asistencia */}
        {step === 'registro' && grupoSeleccionado && (
          <div>
            {/* Contenedor Sticky para Stats, Botones y Buscador */}
            <div className="sticky top-[73px] z-30 bg-gray-50 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
              {/* Stats Row - 5 Cards */}
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-4">
                <div className="bg-white rounded-xl p-3 border border-gray-200 text-center min-w-[90px] flex-1">
                  <span className="block text-xl font-bold text-blue-600">{statsCount.total}</span>
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Total</span>
                </div>
                <div className="bg-white rounded-xl p-3 border border-green-200 text-center min-w-[90px] flex-1">
                  <span className="block text-xl font-bold text-green-600">{statsCount.recibieron}</span>
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Recibieron</span>
                </div>
                <div className="bg-white rounded-xl p-3 border border-red-200 text-center min-w-[90px] flex-1">
                  <span className="block text-xl font-bold text-red-600">{statsCount.noRecibieron}</span>
                  <span className="text-[10px] text-gray-500 uppercase font-bold">No Recibieron</span>
                </div>
                <div className="bg-white rounded-xl p-3 border border-gray-200 text-center min-w-[90px] flex-1">
                  <span className="block text-xl font-bold text-gray-600">{statsCount.ausentes}</span>
                  <span className="text-[10px] text-gray-500 uppercase font-bold">No Asistieron</span>
                </div>
                <div className="bg-white rounded-xl p-3 border border-yellow-200 text-center min-w-[90px] flex-1">
                  <span className="block text-xl font-bold text-yellow-600">{pendientes}</span>
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Pendientes</span>
                </div>
              </div>

              {/* Actions & Search */}
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <button onClick={handleMarcarTodos} className="flex-1 bg-[#10B981] hover:bg-green-600 text-white rounded-xl py-3 px-4 font-bold flex items-center justify-center gap-2 transition-colors shadow-sm">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm">Todos Recibieron</span>
                  </button>
                  <button onClick={handleGuardar} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 px-4 font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md shadow-blue-200">
                    {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
                    <span className="text-sm">{saving ? 'Guardando...' : 'Guardar'}</span>
                  </button>
                </div>
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar estudiante..." className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
              </div>
            </div>

            {/* Lista */}
            <div className="space-y-4 pt-2">
              {estudiantesFiltrados.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  No se encontraron estudiantes
                </div>
              ) : (
                estudiantesFiltrados.map(estudiante => (
                  <div key={estudiante.id} className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 transition-all ${asistencias[estudiante.id] === 'recibio' ? 'border-l-4 border-l-green-500' : asistencias[estudiante.id] === 'no_recibio' ? 'border-l-4 border-l-red-500' : asistencias[estudiante.id] === 'ausente' ? 'opacity-75 border-l-4 border-l-gray-400' : 'border-l-4 border-l-yellow-400'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl text-white ${['bg-purple-200 text-purple-700', 'bg-blue-200 text-blue-700', 'bg-pink-200 text-pink-700'][estudiante.nombre.length % 3]}`}>
                          {estudiante.nombre.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 leading-tight">{estudiante.nombre}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{estudiante.matricula} • {estudiante.grupo}</div>
                          <div className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${asistencias[estudiante.id] ? 'hidden' : 'bg-yellow-100 text-yellow-700'}`}>
                            Pendiente
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end">
                        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${asistencias[estudiante.id] ? 'bg-blue-600' : 'bg-gray-300'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${asistencias[estudiante.id] ? 'translate-x-4' : ''}`} />
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium mt-1">Activo</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <button onClick={() => setAsistencias({ ...asistencias, [estudiante.id]: 'recibio' })} className={`py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${asistencias[estudiante.id] === 'recibio' ? 'bg-white border-2 border-green-500 text-green-700 shadow-sm' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        <CheckCircle className={`w-5 h-5 ${asistencias[estudiante.id] === 'recibio' ? 'text-green-500' : 'text-gray-400'}`} />
                        <span className="hidden sm:inline">Recibió</span>
                      </button>
                      <button onClick={() => setAsistencias({ ...asistencias, [estudiante.id]: 'no_recibio' })} className={`py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${asistencias[estudiante.id] === 'no_recibio' ? 'bg-red-500 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        <XCircle className={`w-5 h-5 ${asistencias[estudiante.id] === 'no_recibio' ? 'text-white' : 'text-gray-400'}`} />
                        <span className="hidden sm:inline">No Recibió</span>
                      </button>
                      <button onClick={() => setAsistencias({ ...asistencias, [estudiante.id]: 'ausente' })} className={`py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${asistencias[estudiante.id] === 'ausente' ? 'bg-white border-2 border-gray-500 text-gray-700' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        <UserX className={`w-5 h-5 ${asistencias[estudiante.id] === 'ausente' ? 'text-gray-500' : 'text-gray-400'}`} />
                        <span className="hidden sm:inline">No Asistió</span>
                      </button>
                    </div>

                    {/* Botón Registrar Novedad (Solo si No Recibió) */}
                    {asistencias[estudiante.id] === 'no_recibio' && (
                      <button
                        onClick={() => openNovedadModal(estudiante)}
                        className="w-full mt-4 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-yellow-200"
                      >
                        <AlertCircle className="w-5 h-5 text-yellow-600" />
                        Registrar Novedad
                        {novedades[estudiante.id] && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse ml-1" />}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
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
