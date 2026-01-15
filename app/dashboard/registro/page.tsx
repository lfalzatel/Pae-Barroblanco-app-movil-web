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
    const { data: estudiantesData, error } = await supabase
      .from('estudiantes')
      .select('grupo, grado, id');

    if (error) {
      console.error('Error:', error);
      setLoadingGrupos(false);
      return;
    }

    const { data: asistenciaData } = await supabase
      .from('asistencia_pae')
      .select('estudiante_id')
      .eq('fecha', selectedDate);

    const estudiantesConAsistencia = new Set(asistenciaData?.map((a: any) => a.estudiante_id));
    const gruposMap = new Map<string, { count: number, grado: string, estudiantesIds: string[] }>();

    estudiantesData.forEach((est: any) => {
      const key = est.grupo;
      if (!gruposMap.has(key)) gruposMap.set(key, { count: 0, grado: est.grado, estudiantesIds: [] });
      const current = gruposMap.get(key)!;
      current.count++;
      current.grado = est.grado;
      current.estudiantesIds.push(est.id);
    });

    const gruposArray: GrupoConEstado[] = Array.from(gruposMap.entries()).map(([nombre, info]) => {
      const registrados = info.estudiantesIds.filter(id => estudiantesConAsistencia.has(id)).length;
      return {
        id: nombre,
        nombre,
        grado: info.grado,
        estudiantes: info.count,
        sedeId: 'principal',
        completado: registrados > 0
      };
    });

    gruposArray.sort((a, b) => {
      const gradoA = parseInt(a.grado.replace(/\D/g, '')) || 0;
      const gradoB = parseInt(b.grado.replace(/\D/g, '')) || 0;
      if (gradoA !== gradoB) return gradoA - gradoB;
      return a.nombre.localeCompare(b.nombre, undefined, { numeric: true });
    });

    setGruposReales(gruposArray);
    setLoadingGrupos(false);
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

    // Cargar estudiantes
    const { data, error } = await supabase
      .from('estudiantes')
      .select('*')
      .eq('grupo', grupo.nombre)
      .order('nombre');

    if (data) {
      setEstudiantes(data as any);
      const { data: asistenciasExistentes } = await supabase
        .from('asistencia_pae')
        .select('estudiante_id, estado')
        .eq('fecha', selectedDate)
        .in('estudiante_id', data.map((e: any) => e.id));

      const mapaAsistencias: Record<string, 'recibio' | 'no_recibio' | 'ausente'> = {};
      if (asistenciasExistentes && asistenciasExistentes.length > 0) {
        asistenciasExistentes.forEach((a: any) => {
          mapaAsistencias[a.estudiante_id] = a.estado;
        });
      } else {
        data.forEach((est: any) => {
          mapaAsistencias[est.id] = 'recibio';
        });
      }
      setAsistencias(mapaAsistencias);
    }
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    updateUrl({ fecha: newDate });
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
      nuevasAsistencias[est.id] = 'recibio';
    });
    setAsistencias(nuevasAsistencias);
  };

  const handleGuardar = async () => {
    if (!usuario?.id) return;
    setSaving(true);
    try {
      const registros = Object.entries(asistencias).map(([estudianteId, estado]) => ({
        estudiante_id: estudianteId,
        fecha: selectedDate,
        estado, // Ya es compatible con DB (no_recibio)
        registrado_por: usuario.id
      }));

      await supabase
        .from('asistencia_pae')
        .delete()
        .eq('fecha', selectedDate)
        .in('estudiante_id', estudiantes.map(e => e.id));

      const { error } = await supabase
        .from('asistencia_pae')
        .insert(registros);

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

  const estudiantesFiltrados = estudiantes.filter(est =>
    est.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    est.matricula.includes(searchQuery)
  );

  const contadores = {
    recibieron: Object.values(asistencias).filter(a => a === 'recibio').length,
    noRecibieron: Object.values(asistencias).filter(a => a === 'no_recibio').length,
    ausentes: Object.values(asistencias).filter(a => a === 'ausente').length,
  };

  const dateTitle = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'long' });

  if (!usuario) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Visual Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-fade-in-down
          ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10 transition-all">
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
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
              <div className="bg-green-50 rounded-xl p-4 border border-green-200 text-center">
                <span className="block text-2xl font-bold text-green-600">{contadores.recibieron}</span>
                <span className="text-xs text-green-700 uppercase tracking-wide">Recibieron</span>
              </div>
              <div className="bg-red-50 rounded-xl p-4 border border-red-200 text-center">
                <span className="block text-2xl font-bold text-red-600">{contadores.noRecibieron}</span>
                <span className="text-xs text-red-700 uppercase tracking-wide">No Recibieron</span>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-center">
                <span className="block text-2xl font-bold text-gray-600">{contadores.ausentes}</span>
                <span className="text-xs text-gray-700 uppercase tracking-wide">Ausentes</span>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 text-center">
                <span className="block text-2xl font-bold text-blue-600">{estudiantes.length}</span>
                <span className="text-xs text-blue-700 uppercase tracking-wide">Total</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mb-6 sticky top-[140px] z-10 bg-gray-50 pb-2">
              <button onClick={handleMarcarTodos} className="flex-1 bg-white hover:bg-gray-50 text-green-600 border border-green-200 rounded-xl py-3 px-4 font-medium flex items-center justify-center gap-2 transition-colors shadow-sm">
                <CheckCircle className="w-5 h-5" />
                <span className="hidden sm:inline">Todos Recibieron</span>
                <span className="sm:hidden">Todos</span>
              </button>
              <button onClick={handleGuardar} disabled={saving} className="flex-[1.5] bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 px-4 font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md shadow-blue-200">
                {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
                {saving ? '...' : 'Guardar'}
              </button>
            </div>

            {/* Buscador */}
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar estudiante..." className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm mb-4" />

            {/* Lista */}
            <div className="space-y-3">
              {estudiantesFiltrados.map(estudiante => (
                <div key={estudiante.id} className={`bg-white rounded-xl p-4 shadow-sm border-2 transition-all ${asistencias[estudiante.id] === 'recibio' ? 'border-green-200' : asistencias[estudiante.id] === 'no_recibio' ? 'border-red-200' : asistencias[estudiante.id] === 'ausente' ? 'border-gray-200 opacity-60' : 'border-yellow-200'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${asistencias[estudiante.id] === 'recibio' ? 'bg-green-100 text-green-700' : asistencias[estudiante.id] === 'no_recibio' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>{estudiante.nombre.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{estudiante.nombre}</div>
                      <div className="text-xs text-gray-500">{estudiante.matricula}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <button onClick={() => setAsistencias({ ...asistencias, [estudiante.id]: 'recibio' })} className={`py-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 ${asistencias[estudiante.id] === 'recibio' ? 'bg-green-500 text-white shadow-lg shadow-green-200 transform scale-105' : 'bg-gray-50 text-gray-400'}`}><CheckCircle className="w-5 h-5" />Recibió</button>
                    <button onClick={() => setAsistencias({ ...asistencias, [estudiante.id]: 'no_recibio' })} className={`py-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 ${asistencias[estudiante.id] === 'no_recibio' ? 'bg-red-500 text-white shadow-lg shadow-red-200 transform scale-105' : 'bg-gray-50 text-gray-400'}`}><XCircle className="w-5 h-5" />No</button>
                    <button onClick={() => setAsistencias({ ...asistencias, [estudiante.id]: 'ausente' })} className={`py-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 ${asistencias[estudiante.id] === 'ausente' ? 'bg-gray-500 text-white shadow-lg shadow-gray-200 transform scale-105' : 'bg-gray-50 text-gray-400'}`}><UserX className="w-5 h-5" />Ausente</button>
                  </div>
                </div>
              ))}
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
