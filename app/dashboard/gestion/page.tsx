'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Usuario, grupos, generarEstudiantesGrupo, Estudiante } from '@/app/data/demoData';
import { ArrowLeft, Search, Eye, FileDown } from 'lucide-react';
import Link from 'next/link';

export default function GestionPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [grupoFilter, setGrupoFilter] = useState('todos');
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Estudiante | null>(null);

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

    // Cargar estudiantes de algunos grupos de ejemplo
    const estudiantesDemo: Estudiante[] = [];
    ['601', '801', '1002'].forEach(grupoId => {
      const grupo = grupos.find(g => g.id === grupoId);
      if (grupo) {
        estudiantesDemo.push(...generarEstudiantesGrupo(grupoId, Math.min(grupo.estudiantes, 10)));
      }
    });
    setEstudiantes(estudiantesDemo);
  }, [router]);

  const estudiantesFiltrados = estudiantes.filter(est => {
    const matchSearch = est.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      est.matricula.includes(searchQuery);
    const matchGrupo = grupoFilter === 'todos' || est.grupo === grupoFilter;
    return matchSearch && matchGrupo;
  });

  const calcularAsistenciaReal = (estudiante: Estudiante) => {
    const total = estudiante.asistencias.length;
    const asistieron = estudiante.asistencias.filter(a => a.estado === 'recibio').length;
    return total > 0 ? ((asistieron / total) * 100).toFixed(1) : '0';
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
              <h1 className="text-xl font-bold text-gray-900">Gestión de Estudiantes</h1>
              <p className="text-sm text-gray-600">Historial de asistencia y reportes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtros */}
        <div className="mb-6 space-y-4">
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

          <div className="flex gap-3">
            <select
              value={grupoFilter}
              onChange={(e) => setGrupoFilter(e.target.value)}
              className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos los Grupos</option>
              {Array.from(new Set(estudiantes.map(e => e.grupo))).map(grupo => (
                <option key={grupo} value={grupo}>{grupo}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-3xl font-bold text-blue-600">{estudiantes.length}</div>
              <div className="text-sm text-gray-600">Estudiantes</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">94.6%</div>
              <div className="text-sm text-gray-600">Asistencia Real (30d)</div>
            </div>
          </div>
        </div>

        {/* Lista de estudiantes */}
        <div className="space-y-3">
          {estudiantesFiltrados.map(estudiante => (
            <div
              key={estudiante.id}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-bold text-lg">
                    {estudiante.nombre.charAt(0)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">{estudiante.nombre}</div>
                  <div className="text-sm text-gray-600">
                    {estudiante.matricula} • {estudiante.grado}-{estudiante.grupo}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSelectedStudent(estudiante)}
                    className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Ver Historial
                  </button>

                  <button className="px-4 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg flex items-center gap-2 transition-colors">
                    <FileDown className="w-4 h-4" />
                    Reporte
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modal de historial */}
        {selectedStudent && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedStudent(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header del modal */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-2xl">
                      {selectedStudent.nombre.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {selectedStudent.nombre}
                    </h3>
                    <p className="text-gray-600">
                      {selectedStudent.matricula} • {selectedStudent.grado}-{selectedStudent.grupo}
                    </p>
                  </div>
                </div>

                <div className="mt-4 text-sm text-gray-600">
                  <strong>Últimos 30 días</strong>
                </div>
              </div>

              {/* Contenido del modal */}
              <div className="p-6 overflow-y-auto max-h-96">
                <div className="space-y-2">
                  {selectedStudent.asistencias.slice(0, 10).map((asistencia, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg flex items-center justify-between ${asistencia.estado === 'recibio' ? 'bg-green-50' :
                        asistencia.estado === 'no-recibio' ? 'bg-red-50' :
                          'bg-gray-50'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${asistencia.estado === 'recibio' ? 'bg-green-500' :
                          asistencia.estado === 'no-recibio' ? 'bg-red-500' :
                            'bg-gray-400'
                          }`}></div>
                        <span className="text-sm font-medium text-gray-900">
                          {new Date(asistencia.fecha).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                      <span className={`text-sm font-medium ${asistencia.estado === 'recibio' ? 'text-green-600' :
                        asistencia.estado === 'no-recibio' ? 'text-red-600' :
                          'text-gray-600'
                        }`}>
                        {asistencia.estado === 'recibio' ? 'Recibió' :
                          asistencia.estado === 'no-recibio' ? 'No Recibió' :
                            'Ausente'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer del modal */}
              <div className="p-6 border-t border-gray-200">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-medium transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
