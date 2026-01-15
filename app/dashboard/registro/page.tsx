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
  const [gruposReales, setGruposReales] = useState<Grupo[]>([]);
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

  // Función para cargar grupos reales desde la BD
  const fetchGruposReales = async () => {
    setLoadingGrupos(true);
    // Traemos todos los estudiantes para agrupar (podría optimizarse con RPC o vista, pero el dataset es pequeño)
    const { data, error } = await supabase
      .from('estudiantes')
      .select('grupo, grado, id');

    if (error) {
      console.error('Error fetching grupos:', error);
      setLoadingGrupos(false);
      return;
    }

    // Agrupar y contar
    const gruposMap = new Map<string, { count: number, grado: string }>();

    data.forEach((est: any) => {
      const key = est.grupo;
      if (!gruposMap.has(key)) {
        gruposMap.set(key, { count: 0, grado: est.grado });
      }
      const current = gruposMap.get(key)!;
      current.count++;
      current.grado = est.grado; // Asegurar que tenemos el grado
    });

    // Convertir a array y ordenar
    const gruposArray: Grupo[] = Array.from(gruposMap.entries()).map(([nombre, info]) => ({
      id: nombre, // Usamos el nombre como ID para simplificar
      nombre,
      grado: info.grado,
      estudiantes: info.count,
      sedeId: 'principal' // Asumimos principal por los datos actuales
    }));

    // Ordenar logic: 6° a 11°. Extraemos el número del grado.
    gruposArray.sort((a, b) => {
      const gradoA = parseInt(a.grado.replace(/\D/g, '')) || 0;
      const gradoB = parseInt(b.grado.replace(/\D/g, '')) || 0;

      if (gradoA !== gradoB) {
        return gradoA - gradoB;
      }
      // Si son del mismo grado, ordenar por nombre de grupo (ej: 601 vs 602)
      return a.nombre.localeCompare(b.nombre, undefined, { numeric: true });
    });

    setGruposReales(gruposArray);
    setLoadingGrupos(false);
  };

  const handleSedeSelect = (sede: Sede) => {
    setSedeSeleccionada(sede);
    if (sede.id === 'principal') {
      fetchGruposReales();
    } else {
      setGruposReales([]); // O manejar lógica para otras sedes si tuvieran datos
    }
    setStep('grupo');
  };

  const handleGrupoSelect = async (grupo: Grupo) => {
    setGrupoSeleccionado(grupo);
    setStep('registro');

    // Cargar estudiantes reales del grupo seleccionado
    // Nota: Usamos el nombre del grupo porque en los datos reales id y nombre son similares o relacionados
    const { data, error } = await supabase
      .from('estudiantes')
      .select('*')
      .eq('grupo', grupo.nombre)
      .order('nombre');

    if (data) {
      // Mapear a la estructura Estudiante local si es necesario, aunque parece compatible
      // Si 'asistencias' no viene de la BD (es relacional), aquí vendrá vacío o nulo.
      // Inicializamos asistencias vacías o buscamos si ya existen para la fecha seleccionada (pendiente de implementación completa de persistencia)
      setEstudiantes(data as any); // Casting rápido, ajustar tipado estricto luego

      // Inicializar asistencias (por ahora todas en 'recibio' por defecto visual, o resetear)
      const asistenciasIniciales: Record<string, 'recibio' | 'no-recibio' | 'ausente'> = {};
      data.forEach((est: any) => {
        asistenciasIniciales[est.id] = 'recibio';
      });
      setAsistencias(asistenciasIniciales);
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
    setSaving(true);

    // Aquí iría la lógica real de guardado en Supabase (tabla 'asistencias')
    // Usando selectedDate y el estado de asistencias

    // Simulación
    await new Promise(resolve => setTimeout(resolve, 1500));

    alert(`Asistencia guardada correctamente para el ${selectedDate}`);
    setSaving(false);
    router.push('/dashboard');
  };

  const estudiantesFiltrados = estudiantes.filter(est =>
    est.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    est.matricula.includes(searchQuery)
  );

  const contadores = {
    recibieron: Object.values(asistencias).filter(a => a === 'recibio').length,
    noRecibieron: Object.values(asistencias).filter(a => a === 'no-recibio').length,
    ausentes: Object.values(asistencias).filter(a => a === 'ausente').length,
    pendientes: estudiantes.length - Object.keys(asistencias).length
  };

  // Formatear fecha para el título
  const dateTitle = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'long' });

  if (!usuario) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
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
                <h1 className="text-xl font-bold text-gray-900">
                  {step === 'sede' && 'Seleccionar Sede'}
                  {step === 'grupo' && 'Seleccionar Grupo'}
                  {step === 'registro' && 'Registro de Asistencia'}
                </h1>
                <p className="text-sm text-gray-600 capitalize">
                  {step === 'sede' && dateTitle}
                  {step === 'grupo' && dateTitle}
                  {/* En registro mostramos info del grupo */}
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
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <button className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors">
                  <Calendar className="w-6 h-6" />
                </button>
              </div>
            )}

            {/* Calendar Icon for Sede step just as visual or link */}
            {step === 'sede' && (
              <Link
                href="/dashboard"
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Calendar className="w-6 h-6 text-gray-400" />
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {gruposReales
                  .map(grupo => (
                    <button
                      key={grupo.id}
                      onClick={() => handleGrupoSelect(grupo)}
                      className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-center flex flex-col items-center justify-center min-h-[120px]"
                    >
                      <div className="text-xl font-bold text-gray-900 mb-1">
                        {grupo.nombre}
                      </div>
                      <div className="text-gray-600 text-sm mb-2">{grupo.grado}</div>
                      <div className="text-xs text-gray-400">
                        {grupo.estudiantes} estudiantes
                      </div>
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
            {/* Estadísticas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
                <div className="text-sm text-yellow-700">Pendientes</div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={handleMarcarTodos}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl py-3 px-4 font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <CheckCircle className="w-5 h-5" />
                Todos Recibieron
              </button>

              <button
                onClick={handleGuardar}
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 px-4 font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>

            {/* Buscador */}
            <div className="mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar estudiante..."
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Lista de estudiantes */}
            <div className="space-y-3">
              {estudiantesFiltrados.map(estudiante => (
                <div
                  key={estudiante.id}
                  className={`bg-white rounded-xl p-4 shadow-sm border-2 ${asistencias[estudiante.id] === 'recibio' ? 'border-green-200' :
                    asistencias[estudiante.id] === 'no-recibio' ? 'border-red-200' :
                      asistencias[estudiante.id] === 'ausente' ? 'border-gray-300' :
                        'border-yellow-200'
                    } transition-all`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 font-bold text-lg">
                        {estudiante.nombre.charAt(0)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">
                        {estudiante.nombre}
                      </div>
                      <div className="text-sm text-gray-600">
                        {estudiante.matricula} • {estudiante.grado}-{estudiante.grupo}
                      </div>
                      {asistencias[estudiante.id] === 'recibio' && (
                        <div className="text-xs text-green-600 mt-1">Pendiente</div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setAsistencias({
                          ...asistencias,
                          [estudiante.id]: 'recibio'
                        })}
                        className={`p-2 rounded-lg transition-colors ${asistencias[estudiante.id] === 'recibio'
                          ? 'bg-green-500 text-white'
                          : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                        title="Recibió"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>

                      <button
                        onClick={() => setAsistencias({
                          ...asistencias,
                          [estudiante.id]: 'no-recibio'
                        })}
                        className={`p-2 rounded-lg transition-colors ${asistencias[estudiante.id] === 'no-recibio'
                          ? 'bg-red-500 text-white'
                          : 'bg-red-50 text-red-600 hover:bg-red-100'
                          }`}
                        title="No Recibió"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>

                      <button
                        onClick={() => setAsistencias({
                          ...asistencias,
                          [estudiante.id]: 'ausente'
                        })}
                        className={`p-2 rounded-lg transition-colors ${asistencias[estudiante.id] === 'ausente'
                          ? 'bg-gray-500 text-white'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                          }`}
                        title="No Asistió"
                      >
                        <UserX className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Botón de novedad */}
                  {asistencias[estudiante.id] && asistencias[estudiante.id] !== 'recibio' && (
                    <button
                      className="w-full mt-3 py-2 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 rounded-lg text-yellow-700 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <AlertCircle className="w-4 h-4" />
                      Registrar Novedad
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
