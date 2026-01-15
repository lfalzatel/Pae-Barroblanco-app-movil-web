'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Search, Eye, FileDown, Users } from 'lucide-react';
import Link from 'next/link';

interface Estudiante {
  id: string;
  nombre: string;
  matricula: string;
  grado: string;
  grupo: string;
  sede: string;
  estado?: string;
}

export default function GestionPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sedeFilter, setSedeFilter] = useState('todas');
  const [grupoFilter, setGrupoFilter] = useState('todos');
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [gruposDisponibles, setGruposDisponibles] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Estudiante | null>(null);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [grupoDropdownOpen, setGrupoDropdownOpen] = useState(false);

  const sedes = [
    { id: 'todas', nombre: 'Todas' },
    { id: 'Principal', nombre: 'Principal' },
    { id: 'Primaria', nombre: 'Primaria' },
    { id: 'Maria Inmaculada', nombre: 'María I.' }
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
        nombre: session.user.user_metadata?.nombre || 'Usuario',
        rol: session.user.user_metadata?.rol || 'docente',
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

  // Fetch student history when modal opens
  useEffect(() => {
    const fetchStudentHistory = async () => {
      if (!selectedStudent) return;

      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data, error } = await supabase
          .from('asistencia_pae')
          .select('*')
          .eq('estudiante_id', selectedStudent.id)
          .gte('fecha', thirtyDaysAgo.toISOString().split('T')[0])
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

      // Get all attendance records for filtered students in last 30 days
      const studentIds = estudiantesFiltrados.map(e => e.id);

      if (studentIds.length === 0) return 0;

      const { data, error } = await supabase
        .from('asistencia_pae')
        .select('estado')
        .in('estudiante_id', studentIds)
        .gte('fecha', thirtyDaysAgo.toISOString().split('T')[0]);

      if (error) throw error;

      if (!data || data.length === 0) return 0;

      const recibieron = data.filter(a => a.estado === 'recibio').length;
      return ((recibieron / data.length) * 100).toFixed(1);
    } catch (error) {
      console.error('Error calculating attendance:', error);
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
          {/* Sede Filter */}
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
                    setGrupoFilter('todos'); // Reset group filter
                  }}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium whitespace-nowrap transition-colors ${sedeFilter === sede.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  {sede.nombre}
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar */}
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

          {/* Group Filter - Custom Dropdown */}
          <div className="relative">
            <button
              onClick={() => setGrupoDropdownOpen(!grupoDropdownOpen)}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between"
            >
              <span className="text-gray-900">
                {grupoFilter === 'todos' ? 'Todos los Grupos' : grupoFilter}
              </span>
              <svg className={`w-5 h-5 text-gray-400 transition-transform ${grupoDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {grupoDropdownOpen && (
              <>
                {/* Backdrop to close dropdown */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setGrupoDropdownOpen(false)}
                ></div>

                {/* Dropdown Menu */}
                <div className="absolute z-20 w-full mt-2 bg-white border border-gray-300 rounded-xl shadow-lg max-h-96 overflow-y-auto">
                  <div className="p-3 grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setGrupoFilter('todos');
                        setGrupoDropdownOpen(false);
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${grupoFilter === 'todos'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      Todos
                    </button>
                    {gruposDisponibles.map(grupo => (
                      <button
                        key={grupo}
                        onClick={() => {
                          setGrupoFilter(grupo);
                          setGrupoDropdownOpen(false);
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${grupoFilter === grupo
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                          }`}
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
            <div className="text-3xl font-bold text-blue-600">{estudiantesFiltrados.length}</div>
            <div className="text-sm text-gray-600">Estudiantes</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <div className="text-3xl font-bold text-green-600">
              {attendancePercentage}%
            </div>
            <div className="text-sm text-gray-600">Asistencia Real (30d)</div>
          </div>
        </div>

        {/* Lista de estudiantes */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {estudiantesFiltrados.map(estudiante => (
              <div
                key={estudiante.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-bold text-lg">
                      {estudiante.nombre.charAt(0)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm leading-tight mb-1">{estudiante.nombre}</div>
                    <div className="text-xs text-gray-600">
                      {estudiante.matricula}
                    </div>
                    <div className="text-xs text-gray-500">
                      {estudiante.grado}-{estudiante.grupo}
                    </div>

                    {/* Buttons inline below student info */}
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => setSelectedStudent(estudiante)}
                        className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        Ver Historial
                      </button>

                      <button className="flex-1 px-3 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors text-sm">
                        <FileDown className="w-4 h-4" />
                        Reporte
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {estudiantesFiltrados.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No se encontraron estudiantes con los filtros seleccionados.
              </div>
            )}
          </div>
        )}

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
                  {studentHistory.length > 0 ? (
                    studentHistory.map((asistencia, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg flex items-center justify-between ${asistencia.estado === 'recibio' ? 'bg-green-50' :
                          asistencia.estado === 'no_recibio' ? 'bg-red-50' :
                            'bg-gray-50'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${asistencia.estado === 'recibio' ? 'bg-green-500' :
                            asistencia.estado === 'no_recibio' ? 'bg-red-500' :
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
                          asistencia.estado === 'no_recibio' ? 'text-red-600' :
                            'text-gray-600'
                          }`}>
                          {asistencia.estado === 'recibio' ? 'Recibió' :
                            asistencia.estado === 'no_recibio' ? 'No Recibió' :
                              'Ausente'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No hay registros de asistencia en los últimos 30 días
                    </div>
                  )}
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
