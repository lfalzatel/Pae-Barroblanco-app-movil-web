import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Usuario,
  sedes,
  grupos,
  Sede,
  Grupo,
  Estudiante,
  generarEstudiantesGrupo
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
  Users
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

  const handleSedeSelect = (sede: Sede) => {
    setSedeSeleccionada(sede);
    setStep('grupo');
  };

  const handleGrupoSelect = (grupo: Grupo) => {
    setGrupoSeleccionado(grupo);
    const estudiantesGenerados = generarEstudiantesGrupo(grupo.id, grupo.estudiantes);
    setEstudiantes(estudiantesGenerados);

    // Inicializar todos como pendientes
    const asistenciasIniciales: Record<string, 'recibio' | 'no-recibio' | 'ausente'> = {};
    estudiantesGenerados.forEach(est => {
      asistenciasIniciales[est.id] = 'recibio'; // Por defecto recibió
    });
    setAsistencias(asistenciasIniciales);

    setStep('registro');
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

    // Simular guardado
    await new Promise(resolve => setTimeout(resolve, 1500));

    alert('Asistencia guardada correctamente');
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

  if (!usuario) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
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
                <p className="text-sm text-gray-600">
                  {step === 'sede' && `miércoles ${new Date().getDate()} de enero`}
                  {step === 'grupo' && sedeSeleccionada?.nombre}
                  {step === 'registro' && `Grupo ${grupoSeleccionado?.nombre} • ${grupoSeleccionado?.grado} • miércoles ${new Date().getDate()} de enero`}
                </p>
              </div>
            </div>

            {step === 'registro' && (
              <Link
                href="/dashboard"
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Calendar className="w-6 h-6" />
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Selección de Sede */}
        {step === 'sede' && (
          <div className="space-y-4">
            {sedes.map(sede => (
              <button
                key={sede.id}
                onClick={() => handleSedeSelect(sede)}
                className="w-full bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-left"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${sede.id === 'principal' ? 'bg-blue-100' :
                    sede.id === 'primaria' ? 'bg-green-100' :
                      'bg-purple-100'
                    }`}>
                    {sede.id === 'principal' ? (
                      <School className={`w-8 h-8 ${sede.id === 'principal' ? 'text-blue-600' : ''
                        }`} />
                    ) : (
                      <GraduationCap className={`w-8 h-8 ${sede.id === 'primaria' ? 'text-green-600' : 'text-purple-600'
                        }`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900">{sede.nombre}</h3>
                    <p className="text-gray-600">{sede.descripcion}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Users className="w-5 h-5" />
                      <span className="text-sm font-medium">
                        {sede.estudiantesTotal} Estudiantes
                      </span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {grupos
                .filter(g => g.sedeId === sedeSeleccionada.id)
                .map(grupo => (
                  <button
                    key={grupo.id}
                    onClick={() => handleGrupoSelect(grupo)}
                    className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-200 hover:border-blue-500 transition-all text-center"
                  >
                    <div className="text-3xl font-bold text-gray-900 mb-2">
                      {grupo.nombre}
                    </div>
                    <div className="text-gray-600 mb-3">{grupo.grado}</div>
                    <div className="text-sm text-gray-500">
                      {grupo.estudiantes} estudiantes
                    </div>
                  </button>
                ))}
            </div>

            <button
              onClick={() => {
                // Cargar estudiantes desde Excel (simulado)
                alert('Función disponible próximamente');
              }}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl p-4 font-medium transition-colors"
            >
              Cargar Estudiantes
            </button>
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
