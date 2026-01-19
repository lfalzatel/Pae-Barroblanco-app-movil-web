'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Usuario, sedes, calcularEstadisticasHoy } from '@/app/data/demoData';
import { ArrowLeft, FileDown, Calendar, CheckCircle, XCircle, UserX, Users, Trash2, ChevronDown, UserMinus, Info, X } from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Skeleton } from '@/components/ui/Skeleton';

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
  const [stats, setStats] = useState<any>({
    totalEstudiantes: 0,
    recibieron: 0,
    noRecibieron: 0,
    ausentes: 0,
    inactivos: 0,
    groupDetails: { noRecibieron: [], ausentes: [], inactivos: [] }
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<{ title: string, color: string, icon: any } | null>(null);
  const [modalData, setModalData] = useState<{ grupo: string, count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [distributionData, setDistributionData] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
        const offset = today.getTimezoneOffset() * 60000;
        let startDate = new Date(today.getTime() - offset).toISOString().split('T')[0];
        let isSpecificDate = false;

        // Calcular rango de fechas
        if (periodo === 'semana') {
          const firstDay = new Date(today.setDate(today.getDate() - today.getDay() + 1)); // Lunes
          startDate = new Date(firstDay.getTime() - firstDay.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        } else if (periodo === 'mes') {
          const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
          startDate = new Date(firstDay.getTime() - firstDay.getTimezoneOffset() * 60000).toISOString().split('T')[0];
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

        // 3. Consultar Inactivos y Datos de Grupos
        let queryEst = supabase.from('estudiantes').select('id, grupo, estado');
        if (sedeFilter !== 'todas') {
          queryEst = queryEst.eq('sede', sedeMap[sedeFilter] || 'Principal');
        }
        const { data: todosEst } = await queryEst;
        const ests = todosEst || [];

        // Calcular contadores
        const recibieronCount = asistenciaData?.filter((a: any) => a.estado === 'recibio').length || 0;
        const noRecibieronCount = asistenciaData?.filter((a: any) => a.estado === 'no_recibio').length || 0;
        const ausentesCount = asistenciaData?.filter((a: any) => a.estado === 'ausente').length || 0;
        const inactivosCount = ests.filter(e => e.estado === 'inactivo').length;

        // Agregación por Grupos para Modales
        const groupAgg = {
          noRecibieron: {} as Record<string, number>,
          ausentes: {} as Record<string, number>,
          inactivos: {} as Record<string, number>
        };

        ests.filter(e => e.estado === 'inactivo').forEach(e => {
          groupAgg.inactivos[e.grupo] = (groupAgg.inactivos[e.grupo] || 0) + 1;
        });

        asistenciaData?.forEach((a: any) => {
          if (a.estado === 'no_recibio') {
            groupAgg.noRecibieron[a.estudiantes.grupo] = (groupAgg.noRecibieron[a.estudiantes.grupo] || 0) + 1;
          } else if (a.estado === 'ausente') {
            groupAgg.ausentes[a.estudiantes.grupo] = (groupAgg.ausentes[a.estudiantes.grupo] || 0) + 1;
          }
        });

        setStats({
          totalEstudiantes: totalCount || 0,
          recibieron: recibieronCount,
          noRecibieron: noRecibieronCount,
          ausentes: ausentesCount,
          inactivos: inactivosCount,
          groupDetails: {
            noRecibieron: Object.entries(groupAgg.noRecibieron).map(([grupo, count]) => ({ grupo, count })).sort((a, b) => b.count - a.count),
            ausentes: Object.entries(groupAgg.ausentes).map(([grupo, count]) => ({ grupo, count })).sort((a, b) => b.count - a.count),
            inactivos: Object.entries(groupAgg.inactivos).map(([grupo, count]) => ({ grupo, count })).sort((a, b) => b.count - a.count)
          }
        });

        // Guardar los registros para la lista (limitado a los últimos 50 para no saturar)
        setRegistros(asistenciaData?.slice(0, 50) || []);

        // 3. Procesar datos para gráficos
        // Gráfico de Distribución (Donut)
        setDistributionData([
          { name: 'Recibieron', value: recibieronCount, color: '#10B981' },
          { name: 'No Recibieron', value: noRecibieronCount, color: '#EF4444' },
          { name: 'Ausentes', value: ausentesCount, color: '#6B7280' }
        ]);

        // Gráfico de Tendencias (Barras)
        if (periodo === 'hoy' || periodo === 'fecha') {
          // Si es un solo día, mostrar por hora o simplemente no mostrar tendencia temporal larga
          setChartData([]);
        } else {
          const trendsMap: Record<string, any> = {};

          // Inicializar fechas en el rango
          let curr = new Date(startDate + 'T00:00:00');
          const end = new Date(); // Hasta hoy
          while (curr <= end) {
            const dStr = curr.toISOString().split('T')[0];
            const dayOfWeek = curr.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Solo días de semana
              trendsMap[dStr] = { fecha: dStr, recibio: 0, no_recibio: 0, ausente: 0 };
            }
            curr.setDate(curr.getDate() + 1);
          }

          asistenciaData?.forEach((a: any) => {
            if (trendsMap[a.fecha]) {
              if (a.estado === 'recibio') trendsMap[a.fecha].recibio++;
              else if (a.estado === 'no_recibio') trendsMap[a.fecha].no_recibio++;
              else if (a.estado === 'ausente') trendsMap[a.fecha].ausente++;
            }
          });

          const sortedTrends = Object.values(trendsMap).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
          setChartData(sortedTrends);
        }

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
        const registeredDaysSet = new Set<string>();

        if (studentIds.length > 0) {
          const { data: attendanceData } = await supabase
            .from('asistencia_pae')
            .select('estado, fecha')
            .in('estudiante_id', studentIds)
            .gte('fecha', startDate)
            .lte('fecha', endDate);

          (attendanceData || []).forEach(a => {
            if (a.estado === 'recibio') recibieron++;
            else if (a.estado === 'no_recibio') noRecibieron++;
            else if (a.estado === 'ausente') ausentes++;
            registeredDaysSet.add(a.fecha);
          });
        }

        const totalRegisteredDays = registeredDaysSet.size;
        const totalExpected = students.length * totalRegisteredDays;
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
          .select('estado, fecha')
          .in('estudiante_id', studentIds)
          .gte('fecha', startDate)
          .lte('fecha', endDate);

        let recibieron = 0;
        let noRecibieron = 0;
        let ausentes = 0;
        const registeredDaysSet = new Set<string>();

        (attendanceData || []).forEach(a => {
          if (a.estado === 'recibio') recibieron++;
          else if (a.estado === 'no_recibio') noRecibieron++;
          else if (a.estado === 'ausente') ausentes++;
          registeredDaysSet.add(a.fecha);
        });

        const totalRegisteredDays = registeredDaysSet.size;
        const totalExpected = students.length * totalRegisteredDays;
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
        ['REPORTE DE ASISTENCIA PAE BARROBLANCO', '', '', '', 'CONVENCIONES:'],
        ['Fecha de Análisis:', analysisDate.toLocaleDateString('es-CO', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }).toLowerCase(), '← La fecha reportada', '', '✅ Recibió'],
        ['Período del Reporte:', `${startDate} al ${endDate}`, '', '', '❌ No recibió'],
        ['Fecha de Generación:', new Date().toLocaleDateString('es-CO', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }), '← Cuándo se descargó', '', '⚪ Ausente'],
        ['', '', '', '', '- Sin registro'],
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

          // Identify days that have at least one record for this group
          const registeredDaysSetForGroup = new Set<string>();
          (rangeAttendance || []).forEach(record => {
            registeredDaysSetForGroup.add(record.fecha);
          });

          // Generate date list for header (School days only: Mon-Fri)
          const dates: string[] = [];
          let current = new Date(startDate + 'T00:00:00');
          const end = new Date(endDate + 'T00:00:00');
          while (current <= end) {
            const dayOfWeek = current.getDay();
            // 0 = Sunday, 6 = Saturday. Skip weekends.
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              dates.push(new Date(current.getTime() - current.getTimezoneOffset() * 60000).toISOString().split('T')[0]);
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
            }), 'Registrados', '% Asistencia', 'Estado']
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

            // Calculate individual percentage based ONLY on registered days for the group
            const totalGroupRegisteredDays = registeredDaysSetForGroup.size;
            const percentage = totalGroupRegisteredDays > 0 ? (totalRecibio / totalGroupRegisteredDays) * 100 : 0;
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

      // Set column widths dynamically based on content
      const colWidths = excelData.reduce((acc: any[], row: any[]) => {
        row.forEach((cell, i) => {
          const w = cell ? cell.toString().length + 2 : 10;
          if (!acc[i] || acc[i].wch < w) {
            acc[i] = { wch: Math.min(w, 30) }; // Cap at 30
          }
        });
        return acc;
      }, []);
      ws['!cols'] = colWidths;

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

  const handleExportPDF = async () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const todayStr = new Date().toLocaleDateString('es-CO');

      // 1. Título y Cabecera
      doc.setFontSize(18);
      doc.setTextColor(22, 101, 52); // Verde esmeralda
      doc.text('REPORTE DE ASISTENCIA PAE', pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('Institución Educativa Barroblanco', pageWidth / 2, 28, { align: 'center' });
      doc.text(`Generado el: ${todayStr}`, pageWidth / 2, 34, { align: 'center' });

      // Info de Filtros
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text(`Periodo: ${periodo === 'fecha' ? selectedDate : periodo.toUpperCase()}`, 14, 45);
      doc.text(`Sede: ${sedeFilter === 'todas' ? 'Todas las Sedes' : sedeFilter.toUpperCase()}`, 14, 51);
      doc.text(`Grupo: ${grupoFilter === 'todos' ? 'Todos los Grupos' : grupoFilter}`, 14, 57);

      // 2. Tabla Resumen
      doc.setFontSize(13);
      doc.text('Resumen General', 14, 70);

      autoTable(doc, {
        startY: 75,
        head: [['Concepto', 'Total']],
        body: [
          ['Total Estudiantes', stats.totalEstudiantes.toString()],
          ['Recibieron Ración', stats.recibieron.toString()],
          ['No Recibieron', stats.noRecibieron.toString()],
          ['Ausentes', stats.ausentes.toString()],
          ['% Asistencia', `${((stats.recibieron / (stats.totalEstudiantes || 1)) * 100).toFixed(1)}%`]
        ],
        theme: 'striped',
        headStyles: { fillColor: [22, 101, 52] }
      });

      // 3. Detalle de Registros
      const finalY = (doc as any).lastAutoTable.finalY || 75;
      doc.setFontSize(13);
      doc.text('Detalle de Asistencia Reciente', 14, finalY + 15);

      const tableData = registros.map(r => [
        r.estudiantes?.nombre || '-',
        r.estudiantes?.grupo || '-',
        r.estado === 'recibio' ? 'Recibió' : r.estado === 'no_recibio' ? 'No Recibió' : 'Ausente',
        new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        new Date(r.created_at).toLocaleDateString('es-CO')
      ]);

      autoTable(doc, {
        startY: finalY + 20,
        head: [['Estudiante', 'Grupo', 'Estado', 'Hora', 'Fecha']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235] }, // Blue-600
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 25 },
          2: { cellWidth: 30 },
          3: { cellWidth: 25 },
          4: { cellWidth: 30 }
        }
      });

      // Pie de página con numeración
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Página ${i} de ${pageCount} - PAE Barroblanco Digital`,
          pageWidth / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }

      // Descargar
      const filename = `Reporte_PAE_${sedeFilter}_${periodo}_${selectedDate}.pdf`;
      doc.save(filename);
      setShowExportMenu(false);

    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      alert('Error al generar el archivo PDF.');
    }
  };

  const openGroupModal = (category: string) => {
    let title = "";
    let data = [];
    let color = "";
    let Icon = null;

    if (category === 'noRecibieron') {
      title = "No Recibieron Ración";
      data = stats.groupDetails.noRecibieron;
      color = "text-amber-600 bg-amber-50";
      Icon = XCircle;
    } else if (category === 'ausentes') {
      title = "Estudiantes Ausentes";
      data = stats.groupDetails.ausentes;
      color = "text-rose-600 bg-rose-50";
      Icon = UserX;
    } else if (category === 'inactivos') {
      title = "Estudiantes Inactivos";
      data = stats.groupDetails.inactivos;
      color = "text-blue-700 bg-blue-50";
      Icon = UserMinus;
    }

    if (data.length > 0) {
      setModalCategory({ title, color, icon: Icon });
      setModalData(data);
      setModalOpen(true);
    }
  };

  if (!usuario) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Modal de Detalle por Grupo */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-md relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className={`p-6 flex items-center justify-between border-b ${modalCategory?.color.split(' ')[1]}`}>
              <div className="flex items-center gap-3">
                <div className={`${modalCategory?.color} p-2 rounded-xl`}>
                  {modalCategory?.icon && <modalCategory.icon className="w-6 h-6" />}
                </div>
                <h3 className="font-black text-gray-900 leading-tight">{modalCategory?.title}</h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 hover:bg-black/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">DISTRIBUCIÓN ACUMULADA</p>
              <div className="space-y-3">
                {modalData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-blue-200 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="bg-white px-3 py-1 rounded-lg text-sm font-black text-gray-700 shadow-sm border border-gray-100">
                        {item.grupo}
                      </div>
                      <span className="text-sm font-medium text-gray-600">Número de estudiantes</span>
                    </div>
                    <span className="text-xl font-black text-gray-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-gray-50 flex justify-center">
              <button
                onClick={() => setModalOpen(false)}
                className="w-full py-3 bg-gray-900 text-white rounded-2xl font-black hover:bg-gray-800 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

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
                <p className="text-[10px] text-gray-400 font-mono">ESTABLE v1.1</p>
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
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowExportMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 z-50 py-1">
                      <button
                        onClick={handleExportExcel}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700"
                      >
                        <span className="text-green-600 font-bold">XLS</span> Descargar Excel
                      </button>
                      <button
                        onClick={handleExportPDF}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700 border-t border-gray-100"
                      >
                        <span className="text-red-500 font-bold">PDF</span> Descargar PDF
                      </button>
                    </div>
                  </>
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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
          {/* Total Estudiantes */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-2xl md:text-3xl font-black text-blue-600 tracking-tighter">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    stats.totalEstudiantes.toLocaleString()
                  )}
                </div>
                <div className="text-gray-400 text-[10px] font-black uppercase tracking-wider">TOTAL</div>
              </div>
              <div className="bg-blue-50 p-2 rounded-xl">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="text-[10px] text-blue-400 font-bold">
              En sedes filtradas
            </div>
          </div>

          {/* Recibieron */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-2xl md:text-3xl font-black text-emerald-500 tracking-tighter">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    stats.recibieron.toLocaleString()
                  )}
                </div>
                <div className="text-gray-400 text-[10px] font-black uppercase tracking-wider">RECIBIERON</div>
              </div>
              <div className="bg-emerald-50 p-2 rounded-xl">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            <div className="text-[10px] text-emerald-600 font-bold">
              Periodo: {periodo}
            </div>
          </div>

          {/* No Recibieron */}
          <button
            onClick={() => openGroupModal('noRecibieron')}
            disabled={stats.noRecibieron === 0}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group hover:border-amber-400 hover:shadow-lg hover:shadow-amber-50 transition-all text-left"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-2xl md:text-3xl font-black text-amber-500 tracking-tighter">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    stats.noRecibieron.toLocaleString()
                  )}
                </div>
                <div className="text-gray-400 text-[10px] font-black uppercase tracking-wider">NO RECIBIERON</div>
              </div>
              <div className="bg-amber-50 p-2 rounded-xl group-hover:bg-amber-500 group-hover:text-white transition-colors duration-300">
                <XCircle className="w-5 h-5 text-amber-600 group-hover:text-white transition-colors" />
              </div>
            </div>
            <div className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
              Ver grupos <Info className="w-3 h-3" />
            </div>
          </button>

          {/* No Asistieron (Ausentes) */}
          <button
            onClick={() => openGroupModal('ausentes')}
            disabled={stats.ausentes === 0}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group hover:border-rose-400 hover:shadow-lg hover:shadow-rose-50 transition-all text-left"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-2xl md:text-3xl font-black text-rose-500 tracking-tighter">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    stats.ausentes.toLocaleString()
                  )}
                </div>
                <div className="text-gray-400 text-[10px] font-black uppercase tracking-wider">NO ASISTIERON</div>
              </div>
              <div className="bg-rose-50 p-2 rounded-xl group-hover:bg-rose-500 group-hover:text-white transition-colors duration-300">
                <UserX className="w-5 h-5 text-rose-500 group-hover:text-white transition-colors" />
              </div>
            </div>
            <div className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
              Ver grupos <Info className="w-3 h-3" />
            </div>
          </button>

          {/* Inactivos (Renunciaron) */}
          <button
            onClick={() => openGroupModal('inactivos')}
            disabled={stats.inactivos === 0}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group hover:border-blue-400 hover:shadow-lg hover:shadow-blue-50 transition-all text-left"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-2xl md:text-3xl font-black text-gray-700 tracking-tighter">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    stats.inactivos.toLocaleString()
                  )}
                </div>
                <div className="text-gray-400 text-[10px] font-black uppercase tracking-wider">INACTIVOS</div>
              </div>
              <div className="bg-gray-100 p-2 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                <UserMinus className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
              </div>
            </div>
            <div className="text-[10px] text-gray-500 font-bold flex items-center gap-1">
              Ver detalles <Info className="w-3 h-3" />
            </div>
          </button>
        </div>

        {/* Análisis Visual */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Distribución de Asistencia */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6">Distribución de Asistencia</h3>
            <div className="h-[250px] w-full">
              {loading || !isMounted ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-40 h-40 rounded-full border-8 border-gray-100 border-t-blue-500 animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Tendencia Temporal */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6">
              {periodo === 'hoy' || periodo === 'fecha' ? 'Detalle por Sede' : 'Tendencia de Asistencia'}
            </h3>
            <div className="h-[250px] w-full">
              {loading || !isMounted ? (
                <div className="space-y-3 pt-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                      dataKey="fecha"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      tickFormatter={(val) => {
                        const d = new Date(val + 'T12:00:00');
                        return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
                      }}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      labelFormatter={(val) => {
                        const d = new Date(val + 'T12:00:00');
                        const s = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).toLowerCase();
                        return s.charAt(0).toUpperCase() + s.slice(1);
                      }}
                    />
                    <Bar dataKey="recibio" name="Recibieron" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="no_recibio" name="No Recibieron" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-400">
                  <Calendar className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm">Selecciona una semana o mes para ver tendencias temporales</p>
                </div>
              )}
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
