'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Usuario, sedes, calcularEstadisticasHoy } from '@/app/data/demoData';
import { ArrowLeft, FileDown, Calendar, CheckCircle, XCircle, UserX, Users, Trash2, ChevronDown, UserMinus, Info, X, ChevronLeft, School, Clock } from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Skeleton } from '@/components/ui/Skeleton';
import StatsDetailModal from '@/components/StatsDetailModal';

export default function ReportesPage() {
  const router = useRouter();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [usuario, setUsuario] = useState<any | null>(null);
  const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes' | 'fecha'>('hoy');
  const [sedeFilter, setSedeFilter] = useState('principal');
  const [showSedeDropdown, setShowSedeDropdown] = useState(false);
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
    inactivos: 0,
    porcentajeAsistencia: '0',
    groupDetails: { recibieron: [], noRecibieron: [], ausentes: [], inactivos: [] },
    pendingGroupsCount: 0,
    totalActiveGroups: 0
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<any>(null);
  const [modalData, setModalData] = useState<{ grupo: string, count: number, total: number, percentage: string }[]>([]);

  // Estados para Detalle Premium (Segundo nivel)
  const [allPeriodRecords, setAllPeriodRecords] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [deepDetailOpen, setDeepDetailOpen] = useState(false);
  const [deepDetailTitle, setDeepDetailTitle] = useState("");
  const [deepDetailData, setDeepDetailData] = useState<any[]>([]);
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
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        let startDate = new Date(now.getTime() - offset).toISOString().split('T')[0];
        let endDate = startDate;
        let isSpecificDate = false;

        // Calcular rango de fechas
        if (periodo === 'semana') {
          const d = new Date(now.getTime() - offset);
          const day = d.getDay();
          const first = d.getDate() - (day === 0 ? 6 : day - 1);
          const firstDay = new Date(d.setDate(first));
          startDate = new Date(firstDay.getTime()).toISOString().split('T')[0];

          const lastDay = new Date(firstDay.getTime());
          lastDay.setDate(firstDay.getDate() + 6);
          endDate = new Date(lastDay.getTime()).toISOString().split('T')[0];
        } else if (periodo === 'mes') {
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate = new Date(firstDay.getTime() - firstDay.getTimezoneOffset() * 60000).toISOString().split('T')[0];

          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          endDate = new Date(lastDay.getTime() - lastDay.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        } else if (periodo === 'fecha') {
          startDate = selectedDate;
          endDate = selectedDate;
          isSpecificDate = true;
        } else {
          // Hoy
          startDate = new Date(now.getTime() - offset).toISOString().split('T')[0];
          endDate = startDate;
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
          .select('*', { count: 'exact', head: true })
          .not('grupo', 'ilike', '%2025%');

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
        let queryEst = supabase.from('estudiantes').select('id, nombre, grupo, estado').not('grupo', 'ilike', '%2025%');
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
          recibieron: {} as Record<string, number>,
          noRecibieron: {} as Record<string, number>,
          ausentes: {} as Record<string, number>,
          inactivos: {} as Record<string, number>
        };

        ests.filter(e => e.estado === 'inactivo').forEach(e => {
          groupAgg.inactivos[e.grupo] = (groupAgg.inactivos[e.grupo] || 0) + 1;
        });

        asistenciaData?.forEach((a: any) => {
          if (a.estado === 'recibio') {
            groupAgg.recibieron[a.estudiantes.grupo] = (groupAgg.recibieron[a.estudiantes.grupo] || 0) + 1;
          } else if (a.estado === 'no_recibio') {
            groupAgg.noRecibieron[a.estudiantes.grupo] = (groupAgg.noRecibieron[a.estudiantes.grupo] || 0) + 1;
          } else if (a.estado === 'ausente') {
            groupAgg.ausentes[a.estudiantes.grupo] = (groupAgg.ausentes[a.estudiantes.grupo] || 0) + 1;
          }
        });

        // Calcular totales por grupo para porcentajes (considerando solo activos para ausentes/recibieron?)
        // Para "recibieron", idealmente es sobre el total de activos del grupo.
        const totalByGroup: Record<string, number> = {};
        // Usamos los estudiantes filtrados (ests) que ya están cargados
        ests.filter(e => e.estado === 'activo').forEach(e => {
          if (e.grupo) totalByGroup[e.grupo] = (totalByGroup[e.grupo] || 0) + 1;
        });

        const mapDetails = (agg: Record<string, number>) => {
          return Object.entries(agg).map(([grupo, count]) => {
            const total = totalByGroup[grupo] || 0;
            // Si es inactivo, el total debería ser sobre inactivos? No, el usuario pide ranking.
            // Para inactivos, el total podría ser distinto, pero usaremos activos como base o total general?
            // Para simplicidad y consistencia con Dashboard, usaremos total activos para Recibieron/NoRecibieron/Ausentes.
            const percentage = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
            return { grupo, count, total, percentage };
          }).sort((a, b) => b.count - a.count);
        };

        // Calculate Active Groups for Pending Logic
        const uniqueActiveGroups = new Set<string>();
        ests.forEach(e => {
          if (e.grupo && (e.estado === 'activo' || e.estado === 'active')) uniqueActiveGroups.add(e.grupo);
        });

        const uniqueReportedGroups = new Set<string>();
        asistenciaData?.forEach((a: any) => {
          // Find group from ests array since a.estudiantes might be array or object depending on join
          // a.estudiantes is object due to select
          if (a.estudiantes && a.estudiantes.grupo) uniqueReportedGroups.add(a.estudiantes.grupo);
        });

        // Calculate Business Days in Range
        let businessDays = 0;
        let d = new Date(startDate);
        const dEnd = new Date(endDate);
        while (d <= dEnd) {
          const day = d.getDay();
          if (day !== 0 && day !== 6) businessDays++;
          d.setDate(d.getDate() + 1);
        }
        if (businessDays === 0) businessDays = 1; // Fallback

        // Formula: Recibieron / (Total Activos * Business Days)
        const totalPotentialRations = (totalCount || 0) * businessDays;

        setStats({
          totalEstudiantes: totalCount || 0,
          recibieron: recibieronCount,
          noRecibieron: noRecibieronCount,
          ausentes: ausentesCount,
          inactivos: inactivosCount,
          porcentajeAsistencia: totalPotentialRations > 0 ? ((recibieronCount / totalPotentialRations) * 100).toFixed(1) : '0',
          groupDetails: {
            recibieron: mapDetails(groupAgg.recibieron),
            noRecibieron: mapDetails(groupAgg.noRecibieron),
            ausentes: mapDetails(groupAgg.ausentes),
            inactivos: mapDetails(groupAgg.inactivos)
          },
          pendingGroupsCount: uniqueActiveGroups.size - uniqueReportedGroups.size,
          totalActiveGroups: uniqueActiveGroups.size
        });

        setAllPeriodRecords(asistenciaData || []);
        setAllStudents(ests);

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

        if (students.length > 0) {
          // FIX: Use join filtering instead of large .in() to avoid URL length error 400
          let query = supabase
            .from('asistencia_pae')
            .select('estado, fecha, estudiantes!inner(sede)')
            .eq('estudiantes.sede', sede)
            .gte('fecha', startDate)
            .lte('fecha', endDate);

          if (grupoFilter !== 'todos') {
            query = query.eq('estudiantes.grupo', grupoFilter);
          }

          const { data: attendanceData } = await query;

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

        // FIX: Use join filtering instead of .in() to avoid 400 Bad Request
        const { data: attendanceData } = await supabase
          .from('asistencia_pae')
          .select('estado, fecha, estudiantes!inner(grupo, sede)')
          .eq('estudiantes.grupo', grupo)
          .eq('estudiantes.sede', sede)
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
    } else if (category === 'recibieron') {
      title = "Recibieron Ración";
      data = stats.groupDetails.recibieron;
      color = "text-emerald-600 bg-emerald-50";
      Icon = CheckCircle;
    }

    if (data.length > 0) {
      setModalCategory({ id: category, title, color, icon: Icon });
      setModalData(data);
      setModalOpen(true);
    }
  };

  const openDeepDetail = (grupo: string) => {
    const category = modalCategory?.id;
    let records: any[] = [];
    let title = `${grupo} - ${modalCategory?.title}`;

    if (category === 'inactivos') {
      records = allStudents
        .filter(e => e.grupo === grupo && e.estado === 'inactivo')
        .map(e => ({
          nombre: e.nombre,
          fecha: 'Estado Actual',
          id: e.id
        }));
    } else {
      const state = category === 'recibieron' ? 'recibio' : (category === 'noRecibieron' ? 'no_recibio' : 'ausente');
      records = allPeriodRecords
        .filter(a => a.estudiantes.grupo === grupo && a.estado === state)
        .map(a => ({
          nombre: a.estudiantes.nombre,
          fecha: a.fecha,
          id: a.id
        }))
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
    }

    setDeepDetailTitle(title);
    setDeepDetailData(records);
    setDeepDetailOpen(true);
  };

  if (!usuario) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Modal de Detalle por Grupo */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setModalOpen(false)}></div>
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl w-full max-w-md relative z-10 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden border border-white/20 ring-1 ring-black/5">
            <div className="p-6 flex items-center justify-between border-b border-gray-100/50 bg-white/40">
              <div className="flex items-center gap-4">
                <div className={`${modalCategory?.color.split(' ')[0].replace('text-', 'bg-').replace('600', '100').replace('700', '100')} ${modalCategory?.color.split(' ')[0]} p-3 rounded-2xl shadow-sm ring-1 ring-black/5`}>
                  {modalCategory?.icon && <modalCategory.icon className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="font-black text-gray-900 leading-tight text-lg">{modalCategory?.title}</h3>
                  <p className="text-xs font-medium text-gray-500 mt-0.5">Desglose por grupos</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2.5 hover:bg-black/5 rounded-full transition-all duration-200 text-gray-400 hover:text-gray-900 hover:rotate-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar relative">
              <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-white/40 to-transparent z-10 pointer-events-none" />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 px-1 flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                Distribución Acumulada
              </p>
              <div className="space-y-3 pb-2">
                {modalData.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => openDeepDetail(item.grupo)}
                    className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-100/80 hover:border-blue-300/50 hover:bg-blue-50/40 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 text-left bg-white/60 backdrop-blur-sm group animate-in slide-in-from-bottom-2 fade-in fill-mode-both"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/60 shadow-inner text-sm font-black text-gray-700 group-hover:from-blue-500 group-hover:to-blue-600 group-hover:text-white group-hover:border-blue-500 group-hover:shadow-blue-200 transition-all duration-300">
                        {item.grupo.replace('Grado ', '').split('-')[0]}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-medium text-gray-500 bg-gray-100/80 px-1.5 py-0.5 rounded-md group-hover:bg-blue-100/50 group-hover:text-blue-600 transition-colors">Ver estudiantes</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 pr-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-400">{item.count}/{item.total}</span>
                        <span className="text-2xl font-black text-gray-900 tracking-tight group-hover:scale-110 transition-transform duration-300">{item.percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 w-24">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${item.percentage}%` }}></div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white/60 to-transparent z-10 pointer-events-none" />
            </div>

            <div className="p-4 bg-gray-50/80 backdrop-blur-md border-t border-gray-100/50 flex justify-center">
              <button
                onClick={() => setModalOpen(false)}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl shadow-gray-200 hover:bg-black hover:shadow-2xl hover:shadow-gray-300 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
              >
                Cerrar Vista
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Premium de Detalle Estudiante (Segundo Nivel) */}
      {deepDetailOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setDeepDetailOpen(false)}></div>
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl w-full max-w-md relative z-10 shadow-2xl animate-in slide-in-from-bottom-5 duration-300 overflow-hidden border border-white/20">
            <div className="p-6 flex items-center justify-between border-b border-gray-100 bg-white/50">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDeepDetailOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-900"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="font-black text-gray-900 leading-tight">{deepDetailTitle}</h3>
              </div>
              <button
                onClick={() => {
                  setDeepDetailOpen(false);
                  setModalOpen(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[65vh] overflow-y-auto">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">LISTADO DETALLADO</p>
              <div className="space-y-4">
                {deepDetailData.length > 0 ? (
                  deepDetailData.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-blue-600/70">{item.fecha}</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500/20" />
                      </div>
                      <p className="font-bold text-gray-900 uppercase text-sm leading-tight">{item.nombre}</p>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center">
                    <p className="text-gray-400 font-medium">No hay registros detallados</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex justify-center">
              <button
                onClick={() => setDeepDetailOpen(false)}
                className="w-full py-4 bg-white text-gray-900 border border-gray-200 rounded-2xl font-black hover:bg-gray-50 transition-colors shadow-sm"
              >
                Volver al resumen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Premium (Synced with Gestion) */}
      <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 shadow-xl shadow-cyan-900/10 sticky top-16 md:top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:pt-6 md:pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="p-2 md:p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 shadow-lg border border-white/10"
              >
                <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
              </Link>
              <div className="relative">
                <h1 className="text-lg md:text-2xl font-black text-white leading-none tracking-tight">Reportes del Sistema</h1>
                <div className="flex items-center gap-2 mt-1 opacity-90">
                  <p className="text-[9px] md:text-[11px] font-bold text-cyan-50 uppercase tracking-[0.2em]">
                    {periodo === 'fecha'
                      ? `Datos del ${selectedDate}`
                      : periodo === 'hoy' ? 'Datos de Hoy' : periodo === 'semana' ? 'Esta Semana' : 'Este Mes'
                    }
                  </p>
                  <span className="w-1 h-1 rounded-full bg-cyan-200/50"></span>
                  <p className="text-[9px] md:text-[10px] font-black text-cyan-100/60 uppercase tracking-widest">ESTABLE v1.2</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Export Button Premium */}
              <div className="relative group">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="p-2 md:p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all shadow-lg border border-white/10 active:scale-95 flex items-center gap-2"
                >
                  <FileDown className="w-5 h-5 md:w-6 md:h-6" />
                  <span className="hidden md:block text-[10px] font-black tracking-widest uppercase">Exportar</span>
                </button>

                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute right-0 mt-3 w-56 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-cyan-100 z-[70] py-3 p-2 animate-in fade-in zoom-in-95 duration-200">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-4 mb-2">Formato de salida</p>
                      <button
                        onClick={handleExportExcel}
                        className="w-full text-left px-4 py-3 hover:bg-cyan-50 rounded-2xl flex items-center gap-3 transition-colors group/item"
                      >
                        <div className="bg-emerald-100 p-2 rounded-xl group-hover/item:bg-emerald-500 group-hover/item:text-white transition-colors">
                          <span className="font-black text-[10px]">XLS</span>
                        </div>
                        <span className="text-sm font-bold text-gray-700">Descargar Excel</span>
                      </button>
                      <button
                        onClick={handleExportPDF}
                        className="w-full text-left px-4 py-3 hover:bg-cyan-50 rounded-2xl flex items-center gap-3 transition-colors border-t border-gray-50 mt-2 group/item"
                      >
                        <div className="bg-rose-100 p-2 rounded-xl group-hover/item:bg-rose-500 group-hover/item:text-white transition-colors">
                          <span className="font-black text-[10px]">PDF</span>
                        </div>
                        <span className="text-sm font-bold text-gray-700">Descargar PDF</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Date Picker Premium */}
              <div className="relative">
                <button
                  onClick={() => {
                    if (dateInputRef.current) {
                      try { dateInputRef.current.showPicker(); } catch (e) { dateInputRef.current.click(); }
                    }
                  }}
                  className={`p-2 md:p-3 rounded-2xl transition-all shadow-lg border active:scale-95 ${periodo === 'fecha' ? 'bg-white text-cyan-700 border-white' : 'bg-white/10 hover:bg-white/20 text-white border-white/10'}`}
                >
                  <Calendar className="w-5 h-5 md:w-6 md:h-6" />
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

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-8">
        {/* Filtros de período (Estilo Tabs Gestión) */}
        <div className="bg-gray-100/80 p-0.5 rounded-2xl flex items-center shrink-0 relative w-full mb-4">
          {(['hoy', 'semana', 'mes'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`flex-1 md:px-6 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${periodo === p ? 'text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {p}
            </button>
          ))}
          {/* Sliding Indicator */}
          <div
            className={`absolute inset-y-0.5 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-xl shadow-md shadow-cyan-200/50 ${periodo === 'hoy' ? 'left-0.5 w-[calc(33.33%-2px)]' :
              periodo === 'semana' ? 'left-[calc(33.33%)] w-[calc(33.33%-2px)]' :
                'left-[calc(66.66%)] w-[calc(33.33%-2px)]'
              }`}
          />
        </div>

        {/* Filters Container (Estilo Card Gestión) */}
        <div className="bg-white p-3 rounded-[2rem] shadow-xl shadow-cyan-900/5 border border-gray-100 mb-8 space-y-3">
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {/* Sede Filter */}
            <div className="relative z-20" ref={dropdownRef}>
              <button
                onClick={() => setShowSedeDropdown(!showSedeDropdown)}
                className="w-full pl-3 pr-3 md:pl-5 md:pr-5 py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-cyan-700 bg-cyan-50/50 border border-cyan-100/50 rounded-2xl flex items-center justify-between focus:outline-none focus:ring-4 focus:ring-cyan-500/10 hover:bg-white hover:border-cyan-300 transition-all shadow-sm cursor-pointer"
              >
                <span className="truncate mr-2">
                  {sedeFilter === 'todas' ? 'SEDES' : sedes.find(s => s.id === sedeFilter)?.nombre.toUpperCase()}
                </span>
                <ChevronDown className={`w-3 h-3 text-cyan-400 transition-transform duration-300 ${showSedeDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showSedeDropdown && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setShowSedeDropdown(false)}></div>
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl border border-cyan-100/50 rounded-2xl shadow-xl shadow-cyan-100/50 overflow-hidden transition-all duration-300 origin-top z-[70] animate-in fade-in zoom-in-95 duration-200">
                    <div className="max-h-48 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                      <button
                        onClick={() => { setSedeFilter('todas'); setShowSedeDropdown(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-between ${sedeFilter === 'todas' ? 'bg-cyan-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-cyan-50 hover:text-cyan-700'}`}
                      >
                        TODAS LAS SEDES
                        {sedeFilter === 'todas' && <CheckCircle className="w-3.5 h-3.5" />}
                      </button>
                      {sedes.map((sede) => (
                        <button
                          key={sede.id}
                          onClick={() => { setSedeFilter(sede.id); setShowSedeDropdown(false); }}
                          className={`w-full text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-between ${sedeFilter === sede.id ? 'bg-cyan-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-cyan-50 hover:text-cyan-700'}`}
                        >
                          {sede.nombre.toUpperCase()}
                          {sedeFilter === sede.id && <CheckCircle className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Group Filter (Identical to Gestion) */}
            <div className="relative z-10">
              <button
                onClick={() => setGrupoDropdownOpen(!grupoDropdownOpen)}
                className="w-full pl-3 pr-3 md:pl-5 md:pr-5 py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-cyan-700 bg-cyan-50/50 border border-cyan-100/50 rounded-2xl flex items-center justify-between focus:outline-none focus:ring-4 focus:ring-cyan-500/10 hover:bg-white hover:border-cyan-300 transition-all shadow-sm cursor-pointer"
              >
                <span className="truncate">{grupoFilter === 'todos' ? 'GRUPOS' : `${grupoFilter}`}</span>
                <ChevronDown className={`w-3 h-3 text-cyan-400 transition-transform duration-300 ${grupoDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {grupoDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setGrupoDropdownOpen(false)}></div>
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl border border-cyan-100/50 rounded-3xl shadow-xl shadow-cyan-100/50 max-h-72 overflow-y-auto p-4 animate-in fade-in zoom-in-95 duration-200 z-[70]">
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => { setGrupoFilter('todos'); setGrupoDropdownOpen(false); }}
                        className={`px-2 py-2.5 rounded-xl text-[10px] font-black transition-all ${grupoFilter === 'todos' ? 'bg-cyan-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-cyan-50'}`}
                      >
                        TODOS
                      </button>
                      {gruposDisponibles.map(grupo => (
                        <button
                          key={grupo}
                          onClick={() => { setGrupoFilter(grupo); setGrupoDropdownOpen(false); }}
                          className={`px-2 py-2.5 rounded-xl text-[10px] font-black transition-all ${grupoFilter === grupo ? 'bg-cyan-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-cyan-50'}`}
                        >
                          {grupo.replace(/-20\d{2}/, '')}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Estadísticas principales */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {/* Pending Groups - New Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-2xl font-black text-orange-500 tracking-tighter">
                  {loading ? <Skeleton className="h-8 w-16" /> : stats.pendingGroupsCount}
                </div>
                <div className="text-gray-400 text-[10px] font-black uppercase tracking-wider">GRUPOS PENDIENTES</div>
              </div>
              <div className="bg-orange-50 p-2 rounded-xl">
                <Clock className="w-5 h-5 text-orange-500" />
              </div>
            </div>
            <div className="text-[10px] text-orange-400 font-bold">
              {stats.totalActiveGroups > 0 ? ((stats.pendingGroupsCount / stats.totalActiveGroups) * 100).toFixed(0) : 0}% sin reportar
            </div>
          </div>
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
          <button
            onClick={() => openGroupModal('recibieron')}
            disabled={stats.recibieron === 0}
            className="bg-white rounded-[2.25rem] p-5 shadow-xl shadow-cyan-900/5 border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group hover:shadow-2xl hover:scale-[1.02] transition-all text-left"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-3xl font-black text-emerald-500 tracking-tighter">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    stats.recibieron.toLocaleString()
                  )}
                </div>
                <div className="text-gray-400 text-[9px] font-black uppercase tracking-widest">RECIBIERON</div>
              </div>
              <div className="bg-emerald-50 p-2.5 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 shadow-inner">
                <CheckCircle className="w-5 h-5 text-emerald-500 group-hover:text-white transition-colors" />
              </div>
            </div>
            <div className="text-[9px] text-emerald-500 font-black uppercase tracking-widest flex items-center gap-1 mt-2">
              {stats.porcentajeAsistencia}% • DETALLE <Info className="w-3 h-3 ml-0.5" />
            </div>
          </button>

          {/* No Recibieron */}
          <button
            onClick={() => openGroupModal('noRecibieron')}
            disabled={stats.noRecibieron === 0}
            className="bg-white rounded-[2.25rem] p-5 shadow-xl shadow-cyan-900/5 border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group hover:shadow-2xl hover:scale-[1.02] transition-all text-left"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-3xl font-black text-amber-500 tracking-tighter">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    stats.noRecibieron.toLocaleString()
                  )}
                </div>
                <div className="text-gray-400 text-[9px] font-black uppercase tracking-widest">NO RECIBIERON</div>
              </div>
              <div className="bg-amber-50 p-2.5 rounded-2xl group-hover:bg-amber-500 group-hover:text-white transition-all duration-300 shadow-inner">
                <XCircle className="w-5 h-5 text-amber-600 group-hover:text-white transition-colors" />
              </div>
            </div>
            <div className="text-[9px] text-amber-500 font-black uppercase tracking-widest flex items-center gap-1 mt-2">
              VER GRUPOS <Info className="w-3 h-3 ml-0.5" />
            </div>
          </button>

          {/* No Asistieron (Ausentes) */}
          <button
            onClick={() => openGroupModal('ausentes')}
            disabled={stats.ausentes === 0}
            className="bg-white rounded-[2.25rem] p-5 shadow-xl shadow-cyan-900/5 border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group hover:shadow-2xl hover:scale-[1.02] transition-all text-left"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-3xl font-black text-rose-500 tracking-tighter">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    stats.ausentes.toLocaleString()
                  )}
                </div>
                <div className="text-gray-400 text-[9px] font-black uppercase tracking-widest">NO ASISTIERON</div>
              </div>
              <div className="bg-rose-50 p-2.5 rounded-2xl group-hover:bg-rose-500 group-hover:text-white transition-all duration-300 shadow-inner">
                <UserX className="w-5 h-5 text-rose-500 group-hover:text-white transition-colors" />
              </div>
            </div>
            <div className="text-[9px] text-rose-500 font-black uppercase tracking-widest flex items-center gap-1 mt-2">
              VER GRUPOS <Info className="w-3 h-3 ml-0.5" />
            </div>
          </button>

          {/* Inactivos (Renunciaron) */}
          <button
            onClick={() => openGroupModal('inactivos')}
            disabled={stats.inactivos === 0}
            className="bg-white rounded-[2.25rem] p-5 shadow-xl shadow-cyan-900/5 border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group hover:shadow-2xl hover:scale-[1.02] transition-all text-left"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-3xl font-black text-gray-700 tracking-tighter">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    stats.inactivos.toLocaleString()
                  )}
                </div>
                <div className="text-gray-400 text-[9px] font-black uppercase tracking-widest">INACTIVOS</div>
              </div>
              <div className="bg-gray-100 p-2.5 rounded-2xl group-hover:bg-cyan-600 group-hover:text-white transition-all duration-300 shadow-inner">
                <UserMinus className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
              </div>
            </div>
            <div className="text-[9px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-1 mt-2">
              VER DETALLES <Info className="w-3 h-3 ml-0.5" />
            </div>
          </button>
        </div>

        {/* Análisis Visual */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Distribución de Asistencia */}
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-cyan-900/5 border border-gray-100">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-8 px-1">Distribución Operativa</h3>
            <div className="h-[250px] w-full">
              {loading || !isMounted ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-32 h-32 rounded-full border-8 border-gray-50 border-t-cyan-500 animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={95}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: '16px' }}
                    />
                    <Legend iconType="circle" verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: '20px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Tendencia Temporal */}
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-cyan-900/5 border border-gray-100">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-8 px-1">
              {periodo === 'hoy' || periodo === 'fecha' ? 'Dinamismo por Sedes' : 'Evolución de Asistencia'}
            </h3>
            <div className="h-[250px] w-full">
              {loading || !isMounted ? (
                <div className="space-y-4 pt-10 px-4">
                  <Skeleton className="h-4 w-full rounded-full" />
                  <Skeleton className="h-28 w-full rounded-3xl" />
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="fecha"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }}
                      tickFormatter={(val) => {
                        const d = new Date(val + 'T12:00:00');
                        return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).toUpperCase();
                      }}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: '16px' }}
                      labelFormatter={(val) => {
                        const d = new Date(val + 'T12:00:00');
                        return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
                      }}
                    />
                    <Bar dataKey="recibio" name="RECIBIÓ" fill="#10B981" radius={[6, 6, 0, 0]} barSize={16} />
                    <Bar dataKey="no_recibio" name="NO RECIBIÓ" fill="#EF4444" radius={[6, 6, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                  <Calendar className="w-12 h-12 mb-4 text-cyan-200" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Amplía el periodo para ver tendencias</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Registros recientes */}
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-cyan-900/5 border border-gray-100 overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">Registros Recientes</h2>
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse shadow-sm shadow-cyan-200" />
          </div>

          <div className="overflow-x-auto">
            {registros.length === 0 ? (
              <div className="p-16 text-center text-gray-400 py-8">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-10" />
                <p className="text-[10px] font-black uppercase tracking-widest">Sin actividad en este rango</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">Estudiante</th>
                    <th className="px-6 py-4 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">Estado</th>
                    <th className="px-6 py-4 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">Instante</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {registros.map((registro: any) => {
                    const fecha = new Date(registro.created_at);
                    const hora = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const fechaStr = fecha.toLocaleDateString();

                    return (
                      <tr key={registro.id} className="hover:bg-cyan-50/30 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="text-xs font-black text-gray-800 uppercase leading-tight group-hover:text-cyan-600 transition-colors">{registro.estudiantes?.nombre}</div>
                          <div className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-tight">{registro.estudiantes?.grupo}</div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className={`px-4 py-1.5 inline-flex text-[9px] font-black uppercase tracking-widest rounded-full shadow-sm border ${registro.estado === 'recibio' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            registro.estado === 'no_recibio' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                              'bg-gray-50 text-gray-500 border-gray-100'
                            }`}>
                            {registro.estado === 'recibio' ? 'Recibió' :
                              registro.estado === 'no_recibio' ? 'Faltó' : 'Ausente'}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="text-[10px] font-black text-gray-700">{hora}</div>
                          <div className="text-[9px] font-bold text-gray-400 uppercase">{fechaStr}</div>
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
