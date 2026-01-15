'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
// import { toast } from 'sonner'; // Removed to fix build error

// Extendemos la interfaz de Grupo para incluir el estado de completado
interface GrupoConEstado extends Grupo {
  completado: boolean;
}

export default function RegistroPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any | null>(null);
  const [step, setStep] = useState<'sede' | 'grupo' | 'registro'>('sede');
  const [sedeSeleccionada, setSedeSeleccionada] = useState<Sede | null>(null);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<Grupo | null>(null);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [asistencias, setAsistencias] = useState<Record<string, 'recibio' | 'no-recibio' | 'ausente'>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [totalEstudiantesPrincipal, setTotalEstudiantesPrincipal] = useState(0);

  // Nuevos estados para grupos dinámicos y fecha
  const [gruposReales, setGruposReales] = useState<GrupoConEstado[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

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

    const fetchCounts = async () => {
      // Solo contamos estudiantes reales para sede principal
      const { count } = await supabase
        .from('estudiantes')
        .select('*', { count: 'exact', head: true });

      if (count !== null) {
        setTotalEstudiantesPrincipal(count);
      }
    };

    checkUser();
    fetchCounts();
  }, [router]);

  // Efecto para recargar grupos cuando cambia la fecha o la sede (si ya estamos en paso grupo)
  useEffect(() => {
    if (step === 'grupo' && sedeSeleccionada?.id === 'principal') {
      fetchGruposReales();
    }
  }, [selectedDate, step, sedeSeleccionada]);

  // Función para cargar grupos reales desde la BD y verificar estado de asistencia
  const fetchGruposReales = async () => {
    setLoadingGrupos(true);

    // 1. Traer estudiantes y grupos
    const { data: estudiantesData, error } = await supabase
      .from('estudiantes')
      .select('grupo, grado, id');

    if (error) {
      console.error('Error fetching grupos:', error);
      setLoadingGrupos(false);
      return;
    }

    // 2. Traer asistencias para la fecha seleccionada para saber qué estudiantes ya tienen registro
    // Esto nos dirá qué grupos ya han sido gestionados hoy
    const { data: asistenciaData } = await supabase
      .from('asistencia_pae')
      .select('estudiante_id')
      .eq('fecha', selectedDate);

    const estudiantesConAsistencia = new Set(asistenciaData?.map((a: any) => a.estudiante_id));

    // 3. Agrupar y procesar
    const gruposMap = new Map<string, { count: number, grado: string, estudiantesIds: string[] }>();

    estudiantesData.forEach((est: any) => {
      const key = est.grupo;
      if (!gruposMap.has(key)) {
        gruposMap.set(key, { count: 0, grado: est.grado, estudiantesIds: [] });
      }
      const current = gruposMap.get(key)!;
      current.count++;
      current.grado = est.grado;
      current.estudiantesIds.push(est.id);
    });

    // 4. Convertir a array y determinar si está "completado"
    // Consideramos "completado" si la mayoría de los estudiantes del grupo tienen asistencia registrada esa fecha
    // O simplificando: si al menos uno tiene asistencia (asumiendo que se registran en lote)
    const gruposArray: GrupoConEstado[] = Array.from(gruposMap.entries()).map(([nombre, info]) => {
      // Verificar cuántos de este grupo tienen asistencia
      const registrados = info.estudiantesIds.filter(id => estudiantesConAsistencia.has(id)).length;
      // Si más del 50% (o > 0 para empezar) tienen registro, lo marcamos
      const completado = registrados > 0;

      return {
        id: nombre,
        nombre,
        grado: info.grado,
        estudiantes: info.count,
        sedeId: 'principal',
        completado
      };
    });

    // Ordenar logic: 6° a 11°.
    gruposArray.sort((a, b) => {
      const gradoA = parseInt(a.grado.replace(/\D/g, '')) || 0;
      const gradoB = parseInt(b.grado.replace(/\D/g, '')) || 0;

      if (gradoA !== gradoB) {
        return gradoA - gradoB;
      }
      return a.nombre.localeCompare(b.nombre, undefined, { numeric: true });
    });

    setGruposReales(gruposArray);
    setLoadingGrupos(false);
  };

  const handleSedeSelect = (sede: Sede) => {
    setSedeSeleccionada(sede);
    setStep('grupo');
    // El useEffect se encargará de cargar los datos
  };

  const handleGrupoSelect = async (grupo: Grupo) => {
    setGrupoSeleccionado(grupo);
    setStep('registro');

    // Cargar estudiantes del grupo
    const { data, error } = await supabase
      .from('estudiantes')
      .select('*')
      .eq('grupo', grupo.nombre)
      .order('nombre');

    if (data) {
      setEstudiantes(data as any);

      // Cargar asistencias existentes para este grupo y fecha
      const { data: asistenciasExistentes } = await supabase
        .from('asistencia_pae')
        .select('estudiante_id, estado')
        .eq('fecha', selectedDate)
        .in('estudiante_id', data.map((e: any) => e.id));

      const mapaAsistencias: Record<string, 'recibio' | 'no-recibio' | 'ausente'> = {};

      // Si hay datos previos, cargarlos
      if (asistenciasExistentes && asistenciasExistentes.length > 0) {
        asistenciasExistentes.forEach((a: any) => {
          mapaAsistencias[a.estudiante_id] = a.estado;
        });
      } else {
        // Si no hay datos, predeterminar 'recibio'
        data.forEach((est: any) => {
          mapaAsistencias[est.id] = 'recibio';
        });
      }

      setAsistencias(mapaAsistencias);
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
      // Preparamos los registros para insertar/upsert
      // Usamos upsert para manejar actualizaciones si ya existen registros ese día
      const registros = Object.entries(asistencias).map(([estudianteId, estado]) => ({
        estudiante_id: estudianteId,
        fecha: selectedDate,
        estado,
        registrado_por: usuario.id
      }));

      // Primero borramos registros existentes de estos estudiantes para esta fecha
      // (Supabase upsert a veces requiere manejo cuidadoso de constraints, delete+insert es más seguro para este caso simple sin ID fijo de asistencia)
      // Ojo: Si la tabla tiene unique constraint en (estudiante_id, fecha), upsert funciona directo.
      // Asumiremos que no hay constraint o usaremos delete+insert para asegurar limpieza.

      // Eliminamos previos para este grupo en esta fecha
      await supabase
        .from('asistencia_pae')
        .delete()
        .eq('fecha', selectedDate)
        .in('estudiante_id', estudiantes.map(e => e.id));

      // Insertamos nuevos
      const { error } = await supabase
        .from('asistencia_pae')
        .insert(registros);

      if (error) throw error;

      alert(`✅ Asistencia guardada para el ${selectedDate}`);

      // Volver a selección de grupo y recargar datos para ver el check verde
      if (sedeSeleccionada?.id === 'principal') {
        await fetchGruposReales();
      }
      setStep('grupo');

    } catch (error: any) {
      console.error('Error guardando:', error);
      alert(`❌ Error al guardar la asistencia: ${error.message || 'Error desconocido'}`);
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
    noRecibieron: Object.values(asistencias).filter(a => a === 'no-recibio').length,
    ausentes: Object.values(asistencias).filter(a => a === 'ausente').length,
    // pendientes: estudiantes.length - Object.keys(asistencias).length // This was incorrect, it should be total students
  };

  // Formatear fecha para el título
  const dateTitle = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'long' });

  if (!usuario) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={step === 'sede' ? '/dashboard' : '#'}
                onClick={(e) => {
                  if (step !== 'sede') {
                    e.preventDefault();
                    if (step === 'grupo') setStep('sede');
                    if (step === 'registro') setStep('grupo');
                  }
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-none mb-1">
                  {step === 'sede' && 'Seleccionar Sede'}
                  {step === 'grupo' && 'Seleccionar Grupo'}
                  {step === 'registro' && 'Registro de Asistencia'}
                </h1>
                <p className="text-sm text-gray-600 capitalize">
                  {step === 'sede' && dateTitle}
                  {step === 'grupo' && dateTitle}
                  {step === 'registro' && `Grupo ${grupoSeleccionado?.nombre} • ${dateTitle}`}
                </p>
              </div>
            </div>

            {/* Selector de Fecha */}
            {(step === 'grupo' || step === 'registro') && (
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                />
                <button className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors relative z-10 pointer-events-none">
                  <Calendar className="w-6 h-6" />
                </button>
              </div>
            )}

            {step === 'sede' && (
              <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg">
                <Calendar className="w-6 h-6 text-gray-400" />
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Selección de Sede */}
        {step === 'sede' && (
          <div className="space-y-4">
            {/* Sede Principal */}
            <button
              onClick={() => handleSedeSelect(sedes.find(s => s.id === 'principal')!)}
              className="w-full relative h-32 rounded-2xl overflow-hidden shadow-md group transition-all hover:shadow-xl hover:scale-[1.01]"
            >
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url("/sede_principal.png")' }} />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
              <div className="absolute inset-0 p-4 flex items-center gap-4 text-white">
                <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm flex-shrink-0">
                  <School className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-xl font-bold leading-tight">Sede Principal</h3>
                  <p className="text-gray-200 text-sm mb-1">Grados 6° - 11°</p>
                  <div className="inline-flex bg-white/20 px-3 py-1 rounded-full backdrop-blur-md items-center gap-1.5 pt-0.5">
                    <span className="font-bold text-xs">{totalEstudiantesPrincipal} Estudiantes</span>
                    <Users className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </button>

            {/* Sede Primaria */}
            <button
              onClick={() => handleSedeSelect(sedes.find(s => s.id === 'primaria')!)}
              className="w-full relative h-32 rounded-2xl overflow-hidden shadow-md group transition-all hover:shadow-xl hover:scale-[1.01]"
            >
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url("/sede_primaria.png")' }} />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
              <div className="absolute inset-0 p-4 flex items-center gap-4 text-white">
                <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm flex-shrink-0">
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-xl font-bold leading-tight">Sede Primaria</h3>
                  <p className="text-gray-200 text-sm mb-1">Educación Primaria</p>
                  <div className="inline-flex bg-white/20 px-3 py-1 rounded-full backdrop-blur-md items-center gap-1.5 pt-0.5">
                    <span className="font-bold text-xs">0 Estudiantes</span>
                    <Users className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </button>

            {/* María Inmaculada */}
            <button
              onClick={() => handleSedeSelect(sedes.find(s => s.id === 'maria-inmaculada')!)}
              className="w-full relative h-32 rounded-2xl overflow-hidden shadow-md group transition-all hover:shadow-xl hover:scale-[1.01]"
            >
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url("/sede_maria.png")' }} />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
              <div className="absolute inset-0 p-4 flex items-center gap-4 text-white">
                <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm flex-shrink-0">
                  <Home className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-xl font-bold leading-tight">María Inmaculada</h3>
                  <p className="text-gray-200 text-sm mb-1">Educación Primaria</p>
                  <div className="inline-flex bg-white/20 px-3 py-1 rounded-full backdrop-blur-md items-center gap-1.5 pt-0.5">
                    <span className="font-bold text-xs">0 Estudiantes</span>
                    <Users className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </button>
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
                          ? 'bg-[#10B981] border-[#10B981] text-white' // Estilo Completado
                          : 'bg-white border-gray-200 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md' // Estilo Normal
                        }
                        `}
                    >
                      <div className={`text-2xl font-bold mb-1 flex items-center gap-2 ${grupo.completado ? 'text-white' : 'text-gray-900'}`}>
                        {grupo.nombre}
                        {grupo.completado && <CheckCircle className="w-6 h-6 text-white" fill="currentColor" stroke="none" />}
                        {/* Usamos un ícono rellenable o estilo solido para mejor visibilidad */}
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

        {/* Registro de Asistencia (sin cambios mayores, solo integración) */}
        {step === 'registro' && grupoSeleccionado && (
          <div>
            {/* Estadísticas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <div className="text-3xl font-bold text-green-600">{contadores.recibieron}</div>
                <div className="text-sm text-green-700">Recibieron</div>
              </div>

              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <div className="text-3xl font-bold text-red-600">{contadores.noRecibieron}</div>
                <div className="text-sm text-red-700">No Recibieron</div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="text-3xl font-bold text-gray-600">{contadores.ausentes}</div>
                <div className="text-sm text-gray-700">No Asistieron</div>
              </div>

              <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                <div className="text-3xl font-bold text-yellow-600">{estudiantes.length}</div>
                <div className="text-sm text-yellow-700">Total</div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-3 mb-6 sticky top-[140px] z-10 bg-gray-50 pb-2">
              <button
                onClick={handleMarcarTodos}
                className="flex-1 bg-white hover:bg-gray-50 text-green-600 border border-green-200 rounded-xl py-3 px-4 font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <CheckCircle className="w-5 h-5" />
                <span className="hidden sm:inline">Todos Recibieron</span>
                <span className="sm:hidden">Todos</span>
              </button>

              <button
                onClick={handleGuardar}
                disabled={saving}
                className="flex-[1.5] bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 px-4 font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md shadow-blue-200"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {saving ? 'Guardando...' : 'Guardar Asistencia'}
              </button>
            </div>

            {/* Buscador */}
            <div className="mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar estudiante por nombre o matrícula..."
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
            </div>

            {/* Lista de estudiantes */}
            <div className="space-y-3">
              {estudiantesFiltrados.map(estudiante => (
                <div
                  key={estudiante.id}
                  className={`bg-white rounded-xl p-4 shadow-sm border-2 ${asistencias[estudiante.id] === 'recibio' ? 'border-green-200' :
                    asistencias[estudiante.id] === 'no-recibio' ? 'border-red-200' :
                      asistencias[estudiante.id] === 'ausente' ? 'border-gray-200 opacity-75' :
                        'border-yellow-200'
                    } transition-all`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold
                        ${asistencias[estudiante.id] === 'recibio' ? 'bg-green-100 text-green-600' :
                        asistencias[estudiante.id] === 'no-recibio' ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-500'}`}>
                      {estudiante.nombre.charAt(0)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate text-sm sm:text-base">
                        {estudiante.nombre}
                      </div>
                      <div className="text-xs text-gray-500">
                        {estudiante.matricula}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <button
                      onClick={() => setAsistencias({ ...asistencias, [estudiante.id]: 'recibio' })}
                      className={`py-2 px-1 rounded-lg text-xs font-medium transition-colors flex flex-col items-center gap-1 ${asistencias[estudiante.id] === 'recibio'
                        ? 'bg-green-500 text-white shadow-md shadow-green-200'
                        : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                        }`}
                    >
                      <CheckCircle className="w-5 h-5" />
                      Recibió
                    </button>

                    <button
                      onClick={() => setAsistencias({ ...asistencias, [estudiante.id]: 'no_recibio' })}
                      className={`py-2 px-1 rounded-lg text-xs font-medium transition-colors flex flex-col items-center gap-1 ${asistencias[estudiante.id] === 'no_recibio'
                        ? 'bg-red-500 text-white shadow-md shadow-red-200'
                        : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                        }`}
                    >
                      <XCircle className="w-5 h-5" />
                      No Recibió
                    </button>

                    <button
                      onClick={() => setAsistencias({ ...asistencias, [estudiante.id]: 'ausente' })}
                      className={`py-2 px-1 rounded-lg text-xs font-medium transition-colors flex flex-col items-center gap-1 ${asistencias[estudiante.id] === 'ausente'
                        ? 'bg-gray-600 text-white shadow-md shadow-gray-200'
                        : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                        }`}
                    >
                      <UserX className="w-5 h-5" />
                      Ausente
                    </button>
                  </div>

                </div>
              ))}

              {estudiantesFiltrados.length === 0 && (
                <div className="text-center py-8 text-gray-500 bg-white rounded-xl border border-gray-200 border-dashed">
                  No se encontraron estudiantes
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
