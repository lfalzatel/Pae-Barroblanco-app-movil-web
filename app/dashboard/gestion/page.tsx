'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Search, Eye, FileDown, Users, X } from 'lucide-react';
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
    { id: 'Maria Inmaculada', nombre: 'Maria Inmaculada' }
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
        // Obtenemos los últimos 90 días para tener un historial más robusto
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
        .gte('fecha', new Date(thirtyDaysAgo.getTime() - thirtyDaysAgo.getTimezoneOffset() * 60000).toISOString().split('T')[0]);

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

  const handleGenerateReport = async (estudiante: Estudiante) => {
    try {
      // Fetch all attendance records for this student
      const { data: attendanceData, error } = await supabase
        .from('asistencia_pae')
        .select('*')
        .eq('estudiante_id', estudiante.id)
        .order('fecha', { ascending: false });

      if (error) throw error;

      // Prepare data for Excel
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

      // Add attendance records
      if (attendanceData && attendanceData.length > 0) {
        attendanceData.forEach((record: any) => {
          const [year, month, day] = record.fecha.split('-').map(Number);
          const dateObj = new Date(year, month - 1, day);

          excelData.push([
            dateObj.toLocaleDateString('es-CO', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }),
            record.estado === 'recibio' ? 'Recibió' :
              record.estado === 'no_recibio' ? 'No Recibió' :
                'Ausente',
            record.novedad_tipo || '-',
            record.novedad_descripcion || '-'
          ]);
        });
      } else {
        excelData.push(['No hay registros de asistencia disponibles', '', '', '']);
      }

      // Calculate statistics
      const totalRecords = attendanceData?.length || 0;
      const recibio = attendanceData?.filter((r: any) => r.estado === 'recibio').length || 0;
      const noRecibio = attendanceData?.filter((r: any) => r.estado === 'no_recibio').length || 0;
      const ausente = attendanceData?.filter((r: any) => r.estado === 'ausente').length || 0;
      const porcentajeAsistencia = totalRecords > 0 ? ((recibio / totalRecords) * 100).toFixed(1) : '0.0';

      excelData.push(
        [''],
        ['Estadísticas Generales'],
        ['Total de registros:', totalRecords.toString()],
        ['Recibió:', recibio.toString()],
        ['No Recibió:', noRecibio.toString()],
        ['Ausente:', ausente.toString()],
        ['Porcentaje de Asistencia:', `${porcentajeAsistencia}%`]
      );

      // Create worksheet and workbook
      const ws = XLSX.utils.aoa_to_sheet(excelData);

      // Set column widths
      ws['!cols'] = [
        { wch: 25 },
        { wch: 20 },
        { wch: 20 },
        { wch: 40 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Reporte de Asistencia');

      // Generate filename
      const now = new Date();
      const filename = `Reporte_${estudiante.nombre.replace(/ /g, '_')}_${new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0]}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);

    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error al generar el reporte. Por favor, intenta de nuevo.');
    }
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
                  className={`px-3 py-1.5 text-sm rounded-full font-medium whitespace-nowrap transition-colors ${sedeFilter === sede.id
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
            <div className="text-3xl font-bold text-blue-600">
              {loading ? <Skeleton className="h-9 w-12" /> : estudiantesFiltrados.length}
            </div>
            <div className="text-sm text-gray-600">Estudiantes</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <div className="text-3xl font-bold text-green-600">
              {loading ? <Skeleton className="h-9 w-16" /> : `${attendancePercentage}%`}
            </div>
            <div className="text-sm text-gray-600">Asistencia Real (30d)</div>
          </div>
        </div>

        {/* Lista de estudiantes */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                <div className="flex items-start gap-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-20" />
                    <div className="flex gap-2 mt-3">
                      <Skeleton className="h-9 flex-1 rounded-lg" />
                      <Skeleton className="h-9 flex-1 rounded-lg" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
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

                      <button
                        onClick={() => handleGenerateReport(estudiante)}
                        className="flex-1 px-3 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors text-sm"
                      >
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
              <div className="p-6 border-b border-gray-200 relative">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="absolute right-6 top-6 p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="w-6 h-6" />
                </button>

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
              <div className="p-6 overflow-y-auto max-h-[60vh] md:max-h-[500px] space-y-6">

                {/* Estadísticas Rápidas (Últimos 30 días) */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-green-50 p-3 rounded-xl border border-green-100 text-center">
                    <div className="text-xl font-bold text-green-700">
                      {studentHistory.filter(a => {
                        const thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                        return a.fecha >= thirtyDaysAgo.toISOString().split('T')[0] && a.estado === 'recibio';
                      }).length}
                    </div>
                    <div className="text-[10px] uppercase text-green-600 font-bold">Recibidos</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-center">
                    <div className="text-xl font-bold text-red-700">
                      {studentHistory.filter(a => {
                        const thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                        return a.fecha >= thirtyDaysAgo.toISOString().split('T')[0] && a.estado === 'no_recibio';
                      }).length}
                    </div>
                    <div className="text-[10px] uppercase text-red-600 font-bold">No Recibidos</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                    <div className="text-xl font-bold text-gray-700">
                      {studentHistory.filter(a => {
                        const thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                        return a.fecha >= thirtyDaysAgo.toISOString().split('T')[0] && a.estado === 'ausente';
                      }).length}
                    </div>
                    <div className="text-[10px] uppercase text-gray-600 font-bold">Ausentes</div>
                  </div>
                </div>

                {/* Vista de Calendario (Mini Grid) */}
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-900 border-b pb-2 flex justify-between items-center">
                    Vista Calendario (Últimos 30 días)
                    <span className="text-xs font-normal text-gray-500">Días escolares</span>
                  </h4>
                  <div className="grid grid-cols-7 gap-1">
                    {/* Generar un grid de los últimos 35 días para que parezca un mes aproximado */}
                    {Array.from({ length: 35 }).map((_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - (34 - i));
                      // Formatear fecha localmente sin desplazamiento UTC
                      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                      const record = studentHistory.find(r => r.fecha === dateStr);
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                      return (
                        <div
                          key={i}
                          title={dateStr}
                          className={`aspect-square rounded-md flex items-center justify-center text-[10px] border ${isWeekend ? 'bg-gray-100 text-gray-300 border-transparent' :
                            record ? (
                              record.estado === 'recibio' ? 'bg-green-500 border-green-600 text-white' :
                                record.estado === 'no_recibio' ? 'bg-red-500 border-red-600 text-white' :
                                  'bg-gray-400 border-gray-500 text-white'
                            ) : 'bg-white border-gray-100 text-gray-300'
                            }`}
                        >
                          {d.getDate()}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-4 text-[10px] justify-center pt-2">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-sm"></div> Recibió</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-sm"></div> No Recibió</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-gray-400 rounded-sm"></div> Ausente</div>
                  </div>
                </div>

                {/* Novedades Recientes */}
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-900 border-b pb-2">Novedades y Observaciones</h4>
                  <div className="space-y-2">
                    {studentHistory.filter(a => a.novedad_tipo || a.novedad_descripcion).length > 0 ? (
                      studentHistory.filter(a => a.novedad_tipo || a.novedad_descripcion).map((a, i) => (
                        <div key={i} className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-yellow-800 uppercase">{a.novedad_tipo || 'Observación'}</span>
                            <span className="text-[10px] text-yellow-600">{a.fecha}</span>
                          </div>
                          <p className="text-sm text-yellow-900">{a.novedad_descripcion || 'Sin descripción detallada'}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 italic text-center py-4">No hay novedades registradas recientemente</p>
                    )}
                  </div>
                </div>

                {/* Listado Detallado */}
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-900 border-b pb-2">Registros Recientes</h4>
                  <div className="space-y-2">
                    {studentHistory.length > 0 ? (
                      studentHistory.slice(0, 10).map((asistencia, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-xl flex items-center justify-between border ${asistencia.estado === 'recibio' ? 'bg-white border-green-100' :
                            asistencia.estado === 'no_recibio' ? 'bg-white border-red-100' :
                              'bg-white border-gray-100'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${asistencia.estado === 'recibio' ? 'bg-green-500' :
                              asistencia.estado === 'no_recibio' ? 'bg-red-500' :
                                'bg-gray-400'
                              }`}></div>
                            <span className="text-sm font-medium text-gray-900">
                              {(() => {
                                const [year, month, day] = asistencia.fecha.split('-').map(Number);
                                const dateObj = new Date(year, month - 1, day);
                                return dateObj.toLocaleDateString('es-CO', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short'
                                });
                              })()}
                            </span>
                          </div>
                          <span className={`text-[11px] font-bold uppercase ${asistencia.estado === 'recibio' ? 'text-green-600' :
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
                        No hay registros de asistencia
                      </div>
                    )}
                  </div>
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
