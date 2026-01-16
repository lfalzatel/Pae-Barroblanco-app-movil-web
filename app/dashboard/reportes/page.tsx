'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Usuario, sedes, calcularEstadisticasHoy } from '@/app/data/demoData';
import { ArrowLeft, FileDown, Calendar, CheckCircle, XCircle, UserX, Users, Trash2, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

export default function ReportesPage() {
  const router = useRouter();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [usuario, setUsuario] = useState<any | null>(null);
  const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes' | 'fecha'>('hoy');
  const [sedeFilter, setSedeFilter] = useState('todas');
  const [grupoFilter, setGrupoFilter] = useState('todos');
  const [grupoDropdownOpen, setGrupoDropdownOpen] = useState(false);
  const [gruposDisponibles, setGruposDisponibles] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  });

  // Estado para menú de exportar
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [registros, setRegistros] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalEstudiantes: 0,
    recibieron: 0,
    noRecibieron: 0,
    ausentes: 0
  });
  const [loading, setLoading] = useState(true);

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

  // Fetch available grupos when sede changes
  useEffect(() => {
    const fetchGrupos = async () => {
      try {
        const sedeMap: Record<string, string> = {
          'principal': 'Principal',
          'primaria': 'Primaria',
          'maria-inmaculada': 'Maria Inmaculada'
        };

        let query = supabase
          .from('estudiantes')
          .select('grupo');

        if (sedeFilter !== 'todas') {
          query = query.eq('sede', sedeMap[sedeFilter] || 'Principal');
        }

        const { data, error } = await query;

        if (error) throw error;

        const grupos = Array.from(new Set((data || []).map((e: any) => e.grupo))).sort();
        setGruposDisponibles(grupos as string[]);

      } catch (error) {
        console.error('Error fetching grupos:', error);
      }
    };

    fetchGrupos();
  }, [sedeFilter]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const today = new Date();
        let startDate = today.toISOString().split('T')[0];
        let isSpecificDate = false;

        // Calcular rango de fechas
        if (periodo === 'semana') {
          const firstDay = new Date(today.setDate(today.getDate() - today.getDay() + 1)); // Lunes
          startDate = firstDay.toISOString().split('T')[0];
        } else if (periodo === 'mes') {
          const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
          startDate = firstDay.toISOString().split('T')[0];
        } else if (periodo === 'fecha') {
          startDate = selectedDate;
          isSpecificDate = true;
        } else {
          // Hoy
          const now = new Date();
          const offset = now.getTimezoneOffset() * 60000;
          startDate = new Date(now.getTime() - offset).toISOString().split('T')[0];
          isSpecificDate = true;
        }

        const sedeMap: Record<string, string> = {
          'principal': 'Principal',
          'primaria': 'Sede Primaria',
          'maria-inmaculada': 'María Inmaculada'
        };

        // 1. Consultar Total Estudiantes (filtrado por sede)
        let queryEstudiantes = supabase
          .from('estudiantes')
          .select('*', { count: 'exact', head: true });

        if (sedeFilter !== 'todas') {
          queryEstudiantes = queryEstudiantes.eq('sede', sedeMap[sedeFilter] || 'Principal');
        }

        const { count: totalCount, error: errorEst } = await queryEstudiantes;
        if (errorEst) throw errorEst;

        // 2. Consultar Asistencia (Stats + Registros)
        let queryAsistencia = supabase
          .from('asistencia_pae')
          .select(`
            id,
            estado,
            fecha,
            created_at,
            estudiantes!inner (
              nombre,
              grupo,
              sede
            )
          `)
          .gte('fecha', startDate)
          .order('created_at', { ascending: false });

        if (isSpecificDate) {
          // Si es fecha específica (hoy o seleccionada), filtrar también con lte para que sea SOLO ese día
          queryAsistencia = queryAsistencia.lte('fecha', startDate);
        }

        if (sedeFilter !== 'todas') {
          queryAsistencia = queryAsistencia.eq('estudiantes.sede', sedeMap[sedeFilter] || 'Principal');
        }

        if (grupoFilter !== 'todos') {
          queryAsistencia = queryAsistencia.eq('estudiantes.grupo', grupoFilter);
        }

        const { data: asistenciaData, error: errorAsist } = await queryAsistencia;
        if (errorAsist) throw errorAsist;

        // Calcular contadores
        const recibieronCount = asistenciaData?.filter((a: any) => a.estado === 'recibio').length || 0;
        const noRecibieronCount = asistenciaData?.filter((a: any) => a.estado === 'no_recibio').length || 0;
        const ausentesCount = asistenciaData?.filter((a: any) => a.estado === 'ausente').length || 0;

        setStats({
          totalEstudiantes: totalCount || 0,
          recibieron: recibieronCount,
          noRecibieron: noRecibieronCount,
          ausentes: ausentesCount
        });

        // Guardar los registros para la lista (limitado a los últimos 50 para no saturar)
        setRegistros(asistenciaData?.slice(0, 50) || []);

      } catch (error) {
        console.error('Error fetching reports data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (usuario) {
      fetchData();
    }
  }, [usuario, periodo, sedeFilter, grupoFilter, selectedDate]);

  const handleExportExcel = async () => {
    try {
      // Determine period label and date range
      let periodoLabel = '';
      let reportDate = selectedDate; // Default to selected date

      const today = new Date();

      if (periodo === 'hoy') {
        periodoLabel = 'Hoy';
        const offset = today.getTimezoneOffset() * 60000;
        reportDate = new Date(today.getTime() - offset).toISOString().split('T')[0];
      } else if (periodo === 'semana') {
        periodoLabel = 'Esta Semana';
        const offset = today.getTimezoneOffset() * 60000;
        reportDate = new Date(today.getTime() - offset).toISOString().split('T')[0];
      } else if (periodo === 'mes') {
        periodoLabel = 'Este Mes';
        const offset = today.getTimezoneOffset() * 60000;
        reportDate = new Date(today.getTime() - offset).toISOString().split('T')[0];
      } else if (periodo === 'fecha') {
        periodoLabel = `Fecha específica: ${selectedDate}`;
        reportDate = selectedDate;
      }

      // Calculate analysis date for header
      const [pYear, pMonth, pDay] = reportDate.split('-').map(Number);
      const analysisDate = new Date(pYear, pMonth - 1, pDay);

      // Range calculation for multi-day reports
      let startDate = reportDate;
      let endDate = reportDate;

      if (periodo === 'semana') {
        const d = new Date(analysisDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const start = new Date(d.getFullYear(), d.getMonth(), diff);
        const end = new Date(d.getFullYear(), d.getMonth(), diff + 6);

        startDate = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        endDate = new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      } else if (periodo === 'mes') {
        const start = new Date(analysisDate.getFullYear(), analysisDate.getMonth(), 1);
        const end = new Date(analysisDate.getFullYear(), analysisDate.getMonth() + 1, 0);

        startDate = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        endDate = new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      }

      // Fetch ALL students to calculate totals per sede and grupo
      const sedeMap: Record<string, string> = {
        'principal': 'Principal',
        'primaria': 'Primaria',
        'maria-inmaculada': 'Maria Inmaculada'
      };

      // All possible sedes
      const allSedes = ['Principal', 'Primaria', 'Maria Inmaculada'];

      let queryAllStudents = supabase.from('estudiantes').select('id, nombre, grupo, sede');

      if (sedeFilter !== 'todas') {
        queryAllStudents = queryAllStudents.eq('sede', sedeMap[sedeFilter] || 'Principal');
      }

      if (grupoFilter !== 'todos') {
        queryAllStudents = queryAllStudents.eq('grupo', grupoFilter);
      }

      const { data: allStudents } = await queryAllStudents;

      // Group students by sede
      const studentsBySede: Record<string, any[]> = {};
      const studentsByGrupo: Record<string, any[]> = {};

      // Initialize all sedes with empty arrays
      allSedes.forEach(sede => {
        studentsBySede[sede] = [];
      });

      (allStudents || []).forEach(student => {
        if (!studentsBySede[student.sede]) {
          studentsBySede[student.sede] = [];
        }
        studentsBySede[student.sede].push(student);

        const grupoKey = `${student.grupo}-${student.sede}`;
        if (!studentsByGrupo[grupoKey]) {
          studentsByGrupo[grupoKey] = [];
        }
        studentsByGrupo[grupoKey].push(student);
      });

      // Calculate statistics per sede
      const sedeStats: any[] = [];
      for (const sede of allSedes) {
        const students = studentsBySede[sede] || [];
        const studentIds = students.map(s => s.id);

        let recibieron = 0;
        let noRecibieron = 0;
        let ausentes = 0;

        if (studentIds.length > 0) {
          const { data: attendanceData } = await supabase
            .from('asistencia_pae')
            .select('estado')
            .in('estudiante_id', studentIds)
            .gte('fecha', startDate)
            .lte('fecha', endDate);

          recibieron = (attendanceData || []).filter(a => a.estado === 'recibio').length;
          noRecibieron = (attendanceData || []).filter(a => a.estado === 'no_recibio').length;
          ausentes = (attendanceData || []).filter(a => a.estado === 'ausente').length;
        }

        const totalExpected = students.length * (periodo === 'hoy' || periodo === 'fecha' ? 1 : (periodo === 'semana' ? 7 : 30));
        const porcentaje = totalExpected > 0 ? ((recibieron / totalExpected) * 100).toFixed(1) : '0.0';

        sedeStats.push({
          sede,
          total: students.length,
          recibieron,
          noRecibieron,
          ausentes,
          porcentaje
        });
      }

      // Calculate statistics per grupo
      const grupoStats: any[] = [];
      for (const [grupoKey, students] of Object.entries(studentsByGrupo)) {
        const [grupo, sede] = grupoKey.split('-');
        const studentIds = students.map(s => s.id);

        const { data: attendanceData } = await supabase
          .from('asistencia_pae')
          .select('estado')
          .in('estudiante_id', studentIds)
          .gte('fecha', startDate)
          .lte('fecha', endDate);

        const recibieron = (attendanceData || []).filter(a => a.estado === 'recibio').length;
        const noRecibieron = (attendanceData || []).filter(a => a.estado === 'no_recibio').length;
        const ausentes = (attendanceData || []).filter(a => a.estado === 'ausente').length;
        const totalExpected = students.length * (periodo === 'hoy' || periodo === 'fecha' ? 1 : (periodo === 'semana' ? 7 : 30));
        const porcentaje = totalExpected > 0 ? ((recibieron / totalExpected) * 100) : 0;

        // Determine estado based on percentage
        let estado = 'Crítico';
        if (porcentaje >= 90) {
          estado = 'Excelente';
        } else if (porcentaje >= 70) {
          estado = 'Bueno';
        } else if (porcentaje >= 50) {
          estado = 'Regular';
        }

        grupoStats.push({
          grupo,
          sede,
          total: students.length,
          recibieron,
          noRecibieron,
          ausentes,
          porcentaje: porcentaje.toFixed(1),
          estado
        });
      }

      // Sort grupo stats
      grupoStats.sort((a, b) => {
        if (a.sede !== b.sede) return a.sede.localeCompare(b.sede);
        return a.grupo.localeCompare(b.grupo);
      });

      const excelData: any[][] = [
        ['REPORTE DE ASISTENCIA PAE BARROBLANCO'],
        ['Fecha de Análisis:', analysisDate.toLocaleDateString('es-CO', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }), '← La fecha que se está reportando'],
        ['Período del Reporte:', `${startDate} al ${endDate}`],
        ['Fecha de Generación:', new Date().toLocaleDateString('es-CO', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }), '← Cuándo se descargó el archivo'],
        [''],
        ['RESUMEN POR SEDE (Consolidado Período)'],
        ['Sede', 'Estudiantes Únicos', 'Total Raciones Recibidas', 'Total No Recibieron', 'Total Ausentes', '% Asistencia']
      ];

      // Add sede statistics (always show all 3 sedes)
      sedeStats.forEach(stat => {
        excelData.push([
          `Sede ${stat.sede}`,
          stat.total.toString(),
          stat.recibieron.toString(),
          stat.noRecibieron.toString(),
          stat.ausentes.toString(),
          `${stat.porcentaje}%`
        ]);
      });

      excelData.push(
        [''],
        ['DETALLE POR GRUPO (Consolidado Período)'],
        ['Grupo', 'Sede', 'Total Estudiantes', 'Recibieron (Total)', 'No Recibieron', 'No Asistieron', '% Asistencia', 'Estado']
      );

      // Add grupo statistics
      grupoStats.forEach(stat => {
        excelData.push([
          stat.grupo,
          stat.sede,
          stat.total.toString(),
          stat.recibieron.toString(),
          stat.noRecibieron.toString(),
          stat.ausentes.toString(),
          `${stat.porcentaje}%`,
          stat.estado
        ]);
      });

      // NEW: If a specific group is selected, add MATRIX for week/month OR detailed list for day
      if (grupoFilter !== 'todos' && (periodo === 'semana' || periodo === 'mes')) {
        const selectedSedeLabel = sedeFilter === 'todas' ? '' : sedeMap[sedeFilter];
        const grupoKey = Object.keys(studentsByGrupo).find(key =>
          key.startsWith(`${grupoFilter}-`) && (selectedSedeLabel ? key.endsWith(`-${selectedSedeLabel}`) : true)
        );

        if (grupoKey) {
          const studentsInGroup = studentsByGrupo[grupoKey];
          const studentIds = studentsInGroup.map(s => s.id);

          // Fetch all attendance for range
          const { data: rangeAttendance } = await supabase
            .from('asistencia_pae')
            .select('estudiante_id, estado, fecha')
            .in('estudiante_id', studentIds)
            .gte('fecha', startDate)
            .lte('fecha', endDate);

          // Generate date list for header (School days only: Mon-Fri)
          const dates: string[] = [];
          let current = new Date(startDate + 'T00:00:00');
          const end = new Date(endDate + 'T00:00:00');
          while (current <= end) {
            const dayOfWeek = current.getDay();
            // 0 = Sunday, 6 = Saturday. Skip weekends.
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              dates.push(current.toISOString().split('T')[0]);
            }
            current.setDate(current.getDate() + 1);
          }

          excelData.push(
            [''],
            [`MATRIZ DE ASISTENCIA DIARIA - GRUPO ${grupoFilter}`],
            ['Estudiante', ...dates.map(d => {
              const dateObj = new Date(d + 'T00:00:00');
              const dayName = dateObj.toLocaleDateString('es-CO', { weekday: 'short' });
              return `${dayName} ${dateObj.getDate()}`;
            }), 'Días Recibidos', '% Asistencia', 'Estado']
          );

          const studentMatrix: Record<string, Record<string, string>> = {};
          (rangeAttendance || []).forEach(record => {
            if (!studentMatrix[record.estudiante_id]) studentMatrix[record.estudiante_id] = {};
            studentMatrix[record.estudiante_id][record.fecha] = record.estado;
          });

          // Sort students by name
          const sortedStudents = [...studentsInGroup].sort((a, b) => a.nombre.localeCompare(b.nombre));

          sortedStudents.forEach(student => {
            const row: any[] = [student.nombre];
            let totalRecibio = 0;

            dates.forEach(d => {
              const estado = studentMatrix[student.id]?.[d];
              if (estado === 'recibio') {
                row.push('✅');
                totalRecibio++;
              } else if (estado === 'no_recibio') {
                row.push('❌');
              } else if (estado === 'ausente') {
                row.push('⚪');
              } else {
                row.push('-');
              }
            });

            row.push(totalRecibio);

            // Calculate individual percentage and state
            const totalSchoolDays = dates.length;
            const percentage = totalSchoolDays > 0 ? (totalRecibio / totalSchoolDays) * 100 : 0;
            row.push(`${percentage.toFixed(1)}%`);

            let studentEstado = 'Crítico';
            if (percentage >= 90) studentEstado = 'Excelente';
            else if (percentage >= 70) studentEstado = 'Bueno';
            else if (percentage >= 50) studentEstado = 'Regular';
            row.push(studentEstado);

            excelData.push(row);
          });
        }
      } else if (grupoFilter !== 'todos') {
        // Single day detailed list
        excelData.push(
          [''],
          [`DETALLE DE ESTUDIANTES - GRUPO ${grupoFilter}`],
          ['Estudiante', 'Estado', 'Novedad', 'Descripción']
        );

        const selectedSedeLabel = sedeFilter === 'todas' ? '' : sedeMap[sedeFilter];
        const grupoKey = Object.keys(studentsByGrupo).find(key =>
          key.startsWith(`${grupoFilter}-`) && (selectedSedeLabel ? key.endsWith(`-${selectedSedeLabel}`) : true)
        );

        if (grupoKey) {
          const studentsInGroup = studentsByGrupo[grupoKey];
          const studentIds = studentsInGroup.map(s => s.id);

          const { data: attendanceDetails } = await supabase
            .from('asistencia_pae')
            .select('estudiante_id, estado, novedad_tipo, novedad_descripcion')
            .in('estudiante_id', studentIds)
            .eq('fecha', reportDate);

          const attendanceMap: Record<string, any> = {};
          (attendanceDetails || []).forEach(record => {
            attendanceMap[record.estudiante_id] = record;
          });

          const sortedStudents = [...studentsInGroup].sort((a, b) => a.nombre.localeCompare(b.nombre));
          sortedStudents.forEach(student => {
            const record = attendanceMap[student.id];
            let estadoLabel = 'No Registrado';
            if (record) {
              estadoLabel = record.estado === 'recibio' ? 'Recibió' :
                record.estado === 'no_recibio' ? 'No Recibió' : 'Ausente';
            }
            excelData.push([student.nombre, estadoLabel, record?.novedad_tipo || '-', record?.novedad_descripcion || '-']);
          });
        }
      }

      // Create worksheet and workbook
      const ws = XLSX.utils.aoa_to_sheet(excelData);

      // Set column widths
      ws['!cols'] = [
        { wch: 20 },  // Grupo/Sede
        { wch: 18 },  // Sede/Total
        { wch: 15 },  // Total/Recibieron
        { wch: 15 },  // Recibieron/No Recibieron
        { wch: 18 },  // No Recibieron/No Asistieron
        { wch: 15 },  // % Asistencia
        { wch: 15 },  // Estado
        { wch: 12 }   // Extra
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Reporte de Asistencia');

      // Generate filename
      const sedeFilename = sedeFilter === 'todas' ? 'Todas' : sedeFilter;
      const periodoFilename = periodo === 'fecha' ? selectedDate : periodo;
      const filename = `Reporte_Asistencia_${sedeFilename}_${periodoFilename}_${reportDate}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);

      // Close export menu
      setShowExportMenu(false);

    } catch (error) {
      console.error('Error generating Excel report:', error);
      alert('Error al generar el reporte Excel. Por favor, intenta de nuevo.');
    }
  };

  if (!usuario) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Reportes</h1>
                <p className="text-sm text-gray-600">
                  {periodo === 'fecha'
                    ? `Datos del ${selectedDate}`
                    : periodo === 'hoy' ? 'Datos de Hoy' : periodo === 'semana' ? 'Esta Semana' : 'Este Mes'
                  }
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {/* Export Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="p-2 bg-green-50 hover:bg-green-100 rounded-lg transition-colors relative"
                >
                  <FileDown className="w-6 h-6 text-green-600" />
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 z-50 py-1">
                    <button
                      onClick={handleExportExcel}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700"
                    >
                      <span className="text-green-600 font-bold">XLS</span> Descargar Excel
                    </button>
                    <button className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700 border-t border-gray-100">
                      <span className="text-red-500 font-bold">PDF</span> Descargar PDF
                    </button>
                  </div>
                )}
              </div>

              {/* Date Picker Button */}
              <div className="relative">
                <button
                  onClick={() => {
                    // Intentar abrir el picker nativo
                    if (dateInputRef.current) {
                      try {
                        dateInputRef.current.showPicker();
                      } catch (e) {
                        dateInputRef.current.click(); // Fallback
                      }
                    }
                  }}
                  className={`p-2 rounded-lg transition-colors ${periodo === 'fecha' ? 'bg-blue-100 ring-2 ring-blue-500' : 'bg-blue-50 hover:bg-blue-100'}`}
                >
                  <Calendar className="w-6 h-6 text-blue-600" />
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer pointer-events-none"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setPeriodo('fecha');
                  }}
                  style={{ visibility: 'hidden', position: 'absolute' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtros de período */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setPeriodo('hoy')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${periodo === 'hoy'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            Hoy
          </button>
          <button
            onClick={() => setPeriodo('semana')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${periodo === 'semana'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            Semana
          </button>
          <button
            onClick={() => setPeriodo('mes')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${periodo === 'mes'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            Mes
          </button>
        </div>

        {/* Filtro de sede */}
        <div className="mb-6 flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => setSedeFilter('todas')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${sedeFilter === 'todas'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            Todas
          </button>
          <button
            onClick={() => setSedeFilter('principal')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${sedeFilter === 'principal'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            Principal
          </button>
          <button
            onClick={() => setSedeFilter('primaria')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${sedeFilter === 'primaria'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            Primaria
          </button>
          <button
            onClick={() => setSedeFilter('maria-inmaculada')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${sedeFilter === 'maria-inmaculada'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            Maria Inmaculada
          </button>
        </div>

        {/* Filtro de grupo */}
        <div className="mb-6">
          <div className="text-sm font-medium text-gray-700 mb-2">Filtrar por Grupo:</div>
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
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setGrupoDropdownOpen(false)}
                ></div>

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

        {/* Estadísticas principales */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {/* Total */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-1">
              <div>
                <div className="text-2xl font-bold text-blue-600 tracking-tight">
                  {loading ? '...' : stats.totalEstudiantes}
                </div>
                <div className="text-gray-500 text-[10px] font-bold uppercase mt-0.5">TOTAL</div>
              </div>
              <div className="bg-blue-50 p-1.5 rounded-full">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Recibieron */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-1">
              <div>
                <div className="text-2xl font-bold text-emerald-500 tracking-tight">
                  {loading ? '...' : stats.recibieron}
                </div>
                <div className="text-gray-500 text-[10px] font-bold uppercase mt-0.5">RECIBIERON</div>
              </div>
              <div className="bg-emerald-50 p-1.5 rounded-full">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </div>

          {/* No Recibieron */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-1">
              <div>
                <div className="text-2xl font-bold text-yellow-500 tracking-tight">
                  {loading ? '...' : stats.noRecibieron}
                </div>
                <div className="text-gray-500 text-[10px] font-bold uppercase mt-0.5">NO RECIBIERON</div>
              </div>
              <div className="bg-yellow-100 p-1.5 rounded-full">
                <XCircle className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
          </div>

          {/* Ausentes */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-1">
              <div>
                <div className="text-2xl font-bold text-red-500 tracking-tight">
                  {loading ? '...' : stats.ausentes}
                </div>
                <div className="text-gray-500 text-[10px] font-bold uppercase mt-0.5">AUSENTES</div>
              </div>
              <div className="bg-red-50 p-1.5 rounded-full">
                <UserX className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Registros recientes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-900">Registros Recientes</h2>
          </div>

          <div className="overflow-x-auto">
            {registros.length === 0 ? (
              <div className="p-6 text-center text-gray-500 py-8">
                No hay registros recientes para este periodo
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Estudiante</th>
                    <th className="px-3 sm:px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Hora</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {registros.map((registro: any) => {
                    const fecha = new Date(registro.created_at);
                    const hora = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const fechaStr = fecha.toLocaleDateString();

                    return (
                      <tr key={registro.id}>
                        <td className="px-3 sm:px-6 py-3 max-w-[140px] sm:max-w-none">
                          <div className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight">{registro.estudiantes?.nombre}</div>
                          <div className="text-xs text-gray-500">{registro.estudiantes?.grupo}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-center">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${registro.estado === 'recibio' ? 'bg-green-100 text-green-800' :
                            registro.estado === 'no_recibio' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                            {registro.estado === 'recibio' ? 'Recibió' :
                              registro.estado === 'no_recibio' ? 'No Recibió' : 'Ausente'}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-right">
                          <div className="text-sm text-gray-900">{hora}</div>
                          <div className="text-xs text-gray-500">{fechaStr}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>


      </div>
    </div>
  );
}
