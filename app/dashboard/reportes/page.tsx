'use client';

import { useEffect, useState, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Usuario, sedes, calcularEstadisticasHoy } from '@/app/data/demoData';
import { ArrowLeft, FileDown, Calendar, CheckCircle, XCircle, UserX, Users, Trash2, ChevronDown, UserMinus, Info, X, ChevronLeft, School, Clock, FileText, Download, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { DateSelectionModal } from '@/components/ui/DateSelectionModal';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Skeleton } from '@/components/ui/Skeleton';
import StatsDetailModal from '@/components/StatsDetailModal';
import AnimatedNumber from '@/components/AnimatedNumber';
import PointsBurstAnimation from '@/components/PointsBurstAnimation';
import html2canvas from 'html2canvas';

function ReportesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [usuario, setUsuario] = useState<any | null>(null);
  const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes' | 'fecha'>('hoy');
  const [sedeFilter, setSedeFilter] = useState('todas');
  const [showSedeDropdown, setShowSedeDropdown] = useState(false);
  const [grupoFilter, setGrupoFilter] = useState('todos');
  const [grupoDropdownOpen, setGrupoDropdownOpen] = useState(false);
  const [gruposDisponibles, setGruposDisponibles] = useState<string[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  });

  // Proyecciones
  const [viewMode, setViewMode] = useState<'historico' | 'proyeccion'>('historico');
  const [showTestAnimation, setShowTestAnimation] = useState(false);
  const [projectionData, setProjectionData] = useState<any[]>([]);
  const [manualAdjustments, setManualAdjustments] = useState<any[]>([]);
  const [projectionLoading, setProjectionLoading] = useState(false);
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(() => {
    const d = new Date();
    const day = d.getDay();
    // Default to today if Mon-Fri, else Monday (1)
    return (day >= 1 && day <= 5) ? day : 1;
  });

  // Estado para menú de exportar (Restored)
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState<'excel' | 'pdf' | 'image' | null>(null);
  const [isGeneratingExport, setIsGeneratingExport] = useState(false);
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string | null>(null);
  const [exportPreviewFilename, setExportPreviewFilename] = useState<string | null>(null);
  const [exportBlob, setExportBlob] = useState<Blob | null>(null);
  const reportContainerRef = useRef<HTMLDivElement>(null);

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

  const calendarDateData = useMemo(() => {
    const counts: Record<string, number> = {};
    (allPeriodRecords || []).forEach(r => {
      if (r.estado === 'recibio') {
        counts[r.fecha] = (counts[r.fecha] || 0) + 1;
      }
    });
    return counts;
  }, [allPeriodRecords]);

  const calendarHighlightedDates = useMemo(() => {
    return Object.keys(calendarDateData);
  }, [calendarDateData]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle URL parameters for tab selection
  useEffect(() => {
    if (isMounted) {
      const tab = searchParams.get('tab');
      if (tab === 'proyeccion') {
        setViewMode('proyeccion');
      } else if (tab === 'historico') {
        setViewMode('historico');
      }
    }
  }, [isMounted, searchParams]);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/');
        return;
      }

      // Determine if we need to auto-assign the "acudiente" role for new external users
      let userRole = session.user.user_metadata?.rol;
      const userEmail = session.user.email || '';
      
      if (!userRole) {
          userRole = userEmail.endsWith('@barroblanco.edu.co') ? 'estudiante' : 'acudiente';
          
          // Persist this default role back to Auth metadata so it survives re-logins
          await supabase.auth.updateUser({
              data: { rol: userRole }
          });
      }

      setUsuario({
        email: userEmail,
        nombre: session.user.user_metadata?.nombre || 'Usuario',
        rol: userRole,
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
          'primaria': 'Sede Primaria',
          'maria-inmaculada': 'Sede Maria Inmaculada'
        };

        let query = supabase
          .from('estudiantes')
          .select('grupo');

        if (sedeFilter === 'primaria-principal') {
          query = query.in('sede', ['Principal', 'Sede Primaria']);
        } else if (sedeFilter !== 'todas') {
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
    if (viewMode === 'proyeccion') {
      fetchProjections();
    }
  }, [viewMode, selectedDate, selectedDayOffset]);

  const fetchProjections = async () => {
    setProjectionLoading(true);
    try {
      // Logic to determine specific date from Week Selector + Day Offset
      const d = new Date(selectedDate + 'T12:00:00');
      const currentDay = d.getDay(); // 0=Sun, 1=Mon...
      const diffToMon = d.getDate() - currentDay + (currentDay === 0 ? -6 : 1);

      const monDate = new Date(d);
      monDate.setDate(diffToMon);

      const targetDateObj = new Date(monDate);
      targetDateObj.setDate(monDate.getDate() + (selectedDayOffset - 1));

      const targetDateStr = targetDateObj.toISOString().split('T')[0];

      // Parallel Fetch: Projection Stats + Manual Adjustments
      const [statsRes, adjustmentsRes] = await Promise.all([
        supabase.rpc('get_daily_projection_stats', { p_date: targetDateStr }),
        supabase.from('novedades_cupos').select('*').eq('fecha_novedad', targetDateStr)
      ]);

      if (statsRes.error) throw statsRes.error;
      if (adjustmentsRes.error) throw adjustmentsRes.error;

      setProjectionData(statsRes.data || []);
      setManualAdjustments(adjustmentsRes.data || []);

    } catch (error) {
      console.error("Error fetching projections:", error);
    } finally {
      setProjectionLoading(false);
    }
  };

  const getRationDistribution = (item: any) => {
    // Reglas de Negocio:
    // 1. Refrigerio: TODOS (AM o PM según grupo/jornada)
    // 2. Almuerzo: SOLO Primaria (1-5) y Sordos. NO Bachillerato (6-11) ni Preescolar.
    // 3. SEDE: Si la sede es "Sede Primaria", asumimos que es primaria (excepto preescolar).

    const gradoNorm = item.grado?.toLowerCase().trim() || '';
    const grupoNorm = item.grupo?.toLowerCase().trim() || '';
    const sedeNorm = item.sede?.toLowerCase().trim() || '';

    // Safeguard: Check if it's explicitly high school to prevent false positives like '704' matching '4'
    const isBachillerato = ['6', '7', '8', '9', '10', '11', 'sexto', 'septimo', 'octavo', 'noveno', 'decimo', 'undecimo', 'once'].some(g => gradoNorm.includes(g) || grupoNorm.includes(g));

    // Detect if grade/group implies Primary (1-5), ensuring it's not Bachillerato
    const isGradoPrimaria = !isBachillerato && ['1', '2', '3', '4', '5', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'aceleracion', 'brujula'].some(g => gradoNorm.includes(g) || grupoNorm.includes(g));

    // Detect if Sede implies Primary or Maria Inmaculada (Both get Lunch)
    const isSedePrimaria = sedeNorm.includes('primaria');
    const isSedeMariaInmaculada = sedeNorm.includes('maria') || sedeNorm.includes('inmaculada');
    const isSedePrincipal = sedeNorm.includes('principal');

    const isPrimaria = isGradoPrimaria || isSedePrimaria || isSedeMariaInmaculada;
    const isSordos = gradoNorm.includes('sordos') || grupoNorm.includes('sordos') || grupoNorm.includes('0400') || grupoNorm.includes('liliana') || gradoNorm.includes('liliana');
    const isPreescolar = gradoNorm.includes('preescolar') || gradoNorm.includes('transicion') || gradoNorm === '0' || grupoNorm.includes('preescolar') || grupoNorm.includes('transicion') || grupoNorm === 'ts0100';

    // Almuerzo: Primaria/Sordos (No Preescolar), EXCEPTO Maria Inmaculada donde TODOS almuerzan (incluido Preescolar)
    const recibeAlmuerzo = (isPrimaria || isSordos) && (!isPreescolar || isSedeMariaInmaculada);

    // Lógica para AM/PM: 
    // - En Sede Principal NO hay CAJT, todos son CAJM.
    // - Sordos siempre es CAJM.
    // - Otros dependen de si el grupo dice "pm" o "tarde".
    const isTarde = !isSedePrincipal && !isSordos && (grupoNorm.includes('pm') || grupoNorm.includes('tarde'));

    return {
      ri_am: !isTarde ? item.total_activos : 0,
      ri_pm: isTarde ? item.total_activos : 0,
      almuerzo: recibeAlmuerzo ? item.total_activos : 0
    };
  };

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
        const refDate = new Date(selectedDate + 'T12:00:00'); // Usar selectedDate como referencia

        if (periodo === 'semana') {
          const day = refDate.getDay();
          const first = refDate.getDate() - (day === 0 ? 6 : day - 1);
          const firstDay = new Date(new Date(refDate).setDate(first));
          startDate = firstDay.toISOString().split('T')[0];

          const lastDay = new Date(firstDay);
          lastDay.setDate(firstDay.getDate() + 6);
          endDate = lastDay.toISOString().split('T')[0];
        } else if (periodo === 'mes') {
          const firstDay = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
          startDate = new Date(firstDay.getTime() - firstDay.getTimezoneOffset() * 60000).toISOString().split('T')[0];

          const lastDay = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
          endDate = new Date(lastDay.getTime() - lastDay.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        } else if (periodo === 'fecha') {
          startDate = selectedDate;
          endDate = selectedDate;
          isSpecificDate = true;
        } else {
          // Hoy
          const today = new Date();
          const tOffset = today.getTimezoneOffset() * 60000;
          startDate = new Date(today.getTime() - tOffset).toISOString().split('T')[0];
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
          .not('grupo', 'ilike', '%2025%')
          .in('estado', ['activo', 'active']);

        if (sedeFilter === 'primaria-principal') {
          queryEstudiantes = queryEstudiantes.in('sede', ['Principal', 'Sede Primaria']);
        } else if (sedeFilter !== 'todas') {
          queryEstudiantes = queryEstudiantes.eq('sede', sedeMap[sedeFilter] || 'Principal');
        }

        if (grupoFilter !== 'todos') {
          queryEstudiantes = queryEstudiantes.eq('grupo', grupoFilter);
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
          .lte('fecha', endDate)
          .order('created_at', { ascending: false });

        if (sedeFilter === 'primaria-principal') {
          queryAsistencia = queryAsistencia.in('estudiantes.sede', ['Principal', 'Sede Primaria']);
        } else if (sedeFilter !== 'todas') {
          queryAsistencia = queryAsistencia.eq('estudiantes.sede', sedeMap[sedeFilter] || 'Principal');
        }

        if (grupoFilter !== 'todos') {
          queryAsistencia = queryAsistencia.eq('estudiantes.grupo', grupoFilter);
        }

        const { data: asistenciaData, error: errorAsist } = await queryAsistencia;
        if (errorAsist) throw errorAsist;

        // 3. Consultar Inactivos y Datos de Grupos
        let queryEst = supabase.from('estudiantes').select('id, nombre, grupo, estado').not('grupo', 'ilike', '%2025%');
        if (sedeFilter === 'primaria-principal') {
          queryEst = queryEst.in('sede', ['Principal', 'Sede Primaria']);
        } else if (sedeFilter !== 'todas') {
          queryEst = queryEst.eq('sede', sedeMap[sedeFilter] || 'Principal');
        }

        if (grupoFilter !== 'todos') {
          queryEst = queryEst.eq('grupo', grupoFilter);
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

        // Calculate unique registered days per group
        const registeredDaysByGroup: Record<string, Set<string>> = {};
        const overallRegisteredDaysSet = new Set<string>();

        asistenciaData?.forEach((a: any) => {
          const g = a.estudiantes.grupo;
          if (g) {
            if (!registeredDaysByGroup[g]) {
              registeredDaysByGroup[g] = new Set<string>();
            }
            registeredDaysByGroup[g].add(a.fecha);
          }
          overallRegisteredDaysSet.add(a.fecha);
        });

        // Calculate totales por grupo para porcentajes
        const totalByGroup: Record<string, number> = {};
        ests.filter(e => e.estado === 'activo').forEach(e => {
          if (e.grupo) totalByGroup[e.grupo] = (totalByGroup[e.grupo] || 0) + 1;
        });

        // Calculate Business Days in Range (Fallback)
        let businessDays = 0;
        let d = new Date(startDate);
        const dEnd = new Date(endDate);
        while (d <= dEnd) {
          const day = d.getDay();
          if (day !== 0 && day !== 6) businessDays++;
          d.setDate(d.getDate() + 1);
        }
        if (businessDays === 0) businessDays = 1;

        const mapDetails = (agg: Record<string, number>) => {
          return Object.entries(agg).map(([grupo, count]) => {
            const registeredDays = registeredDaysByGroup[grupo]?.size || 0;
            const daysToUse = registeredDays > 0 ? registeredDays : businessDays;
            const total = (totalByGroup[grupo] || 0) * daysToUse;

            const percentage = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
            return { grupo, count, total, percentage };

          }).sort((a, b) => b.count - a.count);
        };

        // Calculate Pending Groups
        const uniqueActiveGroups = new Set<string>();
        ests.forEach(e => {
          if (e.grupo && (e.estado === 'activo' || e.estado === 'active')) uniqueActiveGroups.add(e.grupo);
        });

        const uniqueReportedGroups = new Set<string>();
        asistenciaData?.forEach((a: any) => {
          if (a.estudiantes && a.estudiantes.grupo) uniqueReportedGroups.add(a.estudiantes.grupo);
        });

        const pendingGroupsList = Array.from(uniqueActiveGroups)
          .filter(g => !uniqueReportedGroups.has(g))
          .map(g => {
            const count = ests.filter(e => e.grupo === g && (e.estado === 'activo' || e.estado === 'active')).length;
            return { grupo: g, count, total: count, percentage: '0' };
          })
          .sort((a, b) => a.grupo.localeCompare(b.grupo));

        // Formula: Sum of (Activos en grupo * Dias Registrados en ese grupo)
        let totalPotentialRations = 0;
        if (grupoFilter !== 'todos') {
           const days = registeredDaysByGroup[grupoFilter]?.size || businessDays;
           totalPotentialRations = (totalCount || 0) * days;
        } else {
            for (const g of Array.from(uniqueActiveGroups)) {
              const actives = totalByGroup[g] || 0;
              const days = registeredDaysByGroup[g]?.size || (overallRegisteredDaysSet.size > 0 ? overallRegisteredDaysSet.size : businessDays);
              totalPotentialRations += actives * days;
           }
        }

        setStats({
          totalEstudiantes: totalCount || 0,
          recibieron: recibieronCount,
          noRecibieron: noRecibieronCount,
          ausentes: ausentesCount,
          inactivos: inactivosCount,
          diasRegistrados: overallRegisteredDaysSet.size > 0 ? overallRegisteredDaysSet.size : businessDays,
          racionesEsperadas: totalPotentialRations,
          porcentajeAsistencia: totalPotentialRations > 0 ? ((recibieronCount / totalPotentialRations) * 100).toFixed(1) : '0',
          groupDetails: {
            recibieron: mapDetails(groupAgg.recibieron),
            noRecibieron: mapDetails(groupAgg.noRecibieron),
            ausentes: mapDetails(groupAgg.ausentes),
            inactivos: mapDetails(groupAgg.inactivos),
            pendientes: pendingGroupsList
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

  const updateUrl = (params: Record<string, string | null>, method: 'push' | 'replace' = 'replace') => {
    const searchParams = new URLSearchParams(window.location.search);
    Object.entries(params).forEach(([key, value]) => {
      if (value === null) searchParams.delete(key);
      else searchParams.set(key, value);
    });
    router[method](`?${searchParams.toString()}`);
  };

  const handleMoveWeek = (offset: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + (offset * 7));
    const newDate = d.toISOString().split('T')[0];
    setSelectedDate(newDate);
  };

  const handleMoveMonth = (offset: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setMonth(d.getMonth() + offset);
    const newDate = d.toISOString().split('T')[0];
    setSelectedDate(newDate);
  };

  const getWeekRangeLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);

    const mon = new Date(new Date(d).setDate(diff));
    const sun = new Date(new Date(mon).setDate(mon.getDate() + 6));

    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${mon.toLocaleDateString('es-CO', opts)} - ${sun.toLocaleDateString('es-CO', opts)}`.toUpperCase().replace(/\./g, '');
  };

  const getMonthLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  const handlePrepareExcel = async () => {
    setIsGeneratingExport(true);
    try {
      // Dynamic import for XLSX
      const XLSX = await import('xlsx');

      // Determine period label and date range
      let periodoLabel = '';
      let reportDate = selectedDate; // Default to selected date

      const today = new Date();

      if (periodo === 'hoy') {
        periodoLabel = 'Hoy';
        const offset = today.getTimezoneOffset() * 60000;
        reportDate = new Date(today.getTime() - offset).toISOString().split('T')[0];
      } else if (periodo === 'semana') {
        periodoLabel = `Semana del ${getWeekRangeLabel(selectedDate)}`;
        reportDate = selectedDate;
      } else if (periodo === 'mes') {
        periodoLabel = getMonthLabel(selectedDate);
        reportDate = selectedDate;
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

      let queryAllStudents = supabase.from('estudiantes').select('id, nombre, grupo, sede, estado');

      if (sedeFilter === 'primaria-principal') {
        queryAllStudents = queryAllStudents.in('sede', ['Principal', 'Primaria', 'Sede Primaria']);
      } else if (sedeFilter !== 'todas') {
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

      // Calculate business dates for period (Monday to Friday)
      const businessDates: string[] = [];
      const businessDateHeaders: string[] = [];

      // Fetch holidays to mark (Festivo) in headers and cells
      const { data: festivosData } = await supabase.from('festivos_colombia').select('fecha');
      const festivosSet = new Set((festivosData || []).map(f => f.fecha));

      let curDate = new Date(startDate + 'T00:00:00');
      const endDateObj = new Date(endDate + 'T00:00:00');
      while (curDate <= endDateObj) {
        const dayOfWeek = curDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          const dateStr = new Date(curDate.getTime() - curDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];
          businessDates.push(dateStr);

          const dayName = curDate.toLocaleDateString('es-CO', { weekday: 'short' });
          const isFestivo = festivosSet.has(dateStr);
          businessDateHeaders.push(`${dayName} ${curDate.getDate()}${isFestivo ? ' (Festivo)' : ''}`);
        }
        curDate.setDate(curDate.getDate() + 1);
      }

      // Total school business days in period (excluding holidays)
      const totalSchoolBusinessDays = businessDates.filter(d => !festivosSet.has(d)).length;

      // Calculate statistics per grupo with daily received counts
      const grupoStats: any[] = [];
      for (const [grupoKey, students] of Object.entries(studentsByGrupo)) {
        const [grupo, sede] = grupoKey.split('-');
        const activos = students.filter(s => s.estado === 'activo' || s.estado === 'active').length;
        const inactivos = students.filter(s => s.estado === 'inactivo' || s.estado === 'inactive').length;

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
        const dailyRecibio: Record<string, number> = {};

        (attendanceData || []).forEach(a => {
          if (a.estado === 'recibio') {
            recibieron++;
            dailyRecibio[a.fecha] = (dailyRecibio[a.fecha] || 0) + 1;
          } else if (a.estado === 'no_recibio') {
            noRecibieron++;
          } else if (a.estado === 'ausente') {
            ausentes++;
          }
          registeredDaysSet.add(a.fecha);
        });

        const totalRegisteredDays = registeredDaysSet.size;

        // 1. Teórico (Oficial / Calendario)
        const racionesProgramadas = activos * totalSchoolBusinessDays;
        const porcentajeCobertura = racionesProgramadas > 0 ? ((recibieron / racionesProgramadas) * 100) : 0;

        // 2. Operativo (Real en App)
        const racionesEsperadas = activos * totalRegisteredDays;
        const porcentajeEfectivo = racionesEsperadas > 0 ? ((recibieron / racionesEsperadas) * 100) : 0;

        let estado = 'Crítico';
        if (porcentajeEfectivo >= 90) {
          estado = 'Excelente';
        } else if (porcentajeEfectivo >= 70) {
          estado = 'Bueno';
        } else if (porcentajeEfectivo >= 50) {
          estado = 'Regular';
        }

        grupoStats.push({
          grupo,
          sede,
          total: activos,
          inactivos,
          recibieron,
          noRecibieron,
          ausentes,
          diasRegistrados: totalRegisteredDays,
          racionesProgramadas,
          porcentajeCobertura: porcentajeCobertura.toFixed(1),
          racionesEsperadas,
          porcentajeEfectivo: porcentajeEfectivo.toFixed(1),
          estado,
          dailyRecibio
        });
      }

      // Sort grupo stats
      grupoStats.sort((a, b) => {
        if (a.sede !== b.sede) return a.sede.localeCompare(b.sede);
        return a.grupo.localeCompare(b.grupo);
      });

      // Calculate statistics per sede by aggregating group stats (avoids Supabase 1000 row truncation)
      const sedeStats: any[] = [];
      for (const sede of allSedes) {
        const groupsInSede = grupoStats.filter(g => g.sede === sede);
        const activos = groupsInSede.reduce((acc, g) => acc + g.total, 0);
        const inactivos = groupsInSede.reduce((acc, g) => acc + g.inactivos, 0);
        const recibieron = groupsInSede.reduce((acc, g) => acc + g.recibieron, 0);
        const noRecibieron = groupsInSede.reduce((acc, g) => acc + g.noRecibieron, 0);
        const ausentes = groupsInSede.reduce((acc, g) => acc + g.ausentes, 0);
        const racionesProgramadas = groupsInSede.reduce((acc, g) => acc + g.racionesProgramadas, 0);
        const racionesEsperadas = groupsInSede.reduce((acc, g) => acc + g.racionesEsperadas, 0);

        const porcentajeCobertura = racionesProgramadas > 0 ? ((recibieron / racionesProgramadas) * 100).toFixed(1) : '0.0';
        const porcentajeEfectivo = racionesEsperadas > 0 ? ((recibieron / racionesEsperadas) * 100).toFixed(1) : '0.0';

        sedeStats.push({
          sede,
          total: activos,
          inactivos,
          recibieron,
          noRecibieron,
          ausentes,
          porcentajeCobertura,
          porcentajeEfectivo
        });
      }

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
        ['', '', '', '', '🌴 Festivo'],
        ['', '', '', '', '- Sin registro'],
        ['GLOSARIO DE MÉTRICAS Y FÓRMULAS DEL REPORTE:'],
        ['📌 Raciones Programadas (Teóricas):', 'Estudiantes Activos × Días Hábiles Lectivos del Mes (Mide la cobertura según calendario oficial).'],
        ['📌 % Cobertura PAE (Teórica):', '(Total Recibidas / Raciones Programadas) × 100 (Porcentaje de aprovechamiento frente al contrato mensual).'],
        ['📌 Raciones Operativas (Reales):', 'Estudiantes Activos × Días con Registro Real en App (Capacidad esperada en días que operó el comedor).'],
        ['📌 % Asistencia Efectiva:', '(Total Recibidas / Raciones Operativas) × 100 (Porcentaje de asistencia en días efectivamente prestados).'],
        ['📌 Estado del Grupo:', 'Excelente (≥90%) | Bueno (≥70%) | Regular (≥50%) | Crítico (<50%).'],
        [''],
        ['RESUMEN POR SEDE (Consolidado Período)'],
        ['Sede', 'Total Estudiantes (Activos)', 'Estudiantes Inactivos', 'Total Raciones Recibidas', 'Total No Recibieron', 'Total Ausentes', '% Cobertura PAE (Teórica)', '% Asistencia Efectiva']
      ];

      // Add sede statistics (always show all 3 sedes)
      sedeStats.forEach(stat => {
        excelData.push([
          `Sede ${stat.sede}`,
          stat.total.toString(),
          stat.inactivos.toString(),
          stat.recibieron.toString(),
          stat.noRecibieron.toString(),
          stat.ausentes.toString(),
          `${stat.porcentajeCobertura}%`,
          `${stat.porcentajeEfectivo}%`
        ]);
      });

      // Detalle Por Grupo with daily breakdown columns
      const hasDailyCols = (periodo === 'semana' || periodo === 'mes') && grupoFilter === 'todos';
      const groupHeaders = [
        'Grupo',
        'Sede',
        'Estudiantes Activos',
        'Estudiantes Inactivos',
        'Días Hábiles Mes',
        'Raciones Programadas (Teóricas)',
        '% Cobertura PAE (Teórica)',
        ...(hasDailyCols ? businessDateHeaders : []),
        'Recibieron (Total)',
        'No Recibieron',
        'No Asistieron',
        'Días Registrados',
        'Raciones Operativas (Reales)',
        '% Asistencia Efectiva',
        'Estado'
      ];

      excelData.push(
        [''],
        ['DETALLE POR GRUPO (Consolidado Período)'],
        groupHeaders
      );

      // Add grupo statistics
      grupoStats.forEach(stat => {
        const row: any[] = [
          stat.grupo,
          stat.sede,
          stat.total.toString(),
          stat.inactivos.toString(),
          totalSchoolBusinessDays.toString(),
          stat.racionesProgramadas.toString(),
          `${stat.porcentajeCobertura}%`
        ];

        if (hasDailyCols) {
          businessDates.forEach(d => {
            if (festivosSet.has(d)) {
              row.push('-');
            } else {
              const count = stat.dailyRecibio[d];
              row.push(count && count > 0 ? count.toString() : '-');
            }
          });
        }

        row.push(
          stat.recibieron.toString(),
          stat.noRecibieron.toString(),
          stat.ausentes.toString(),
          stat.diasRegistrados.toString(),
          stat.racionesEsperadas.toString(),
          `${stat.porcentajeEfectivo}%`,
          stat.estado
        );

        excelData.push(row);
      });

      // Total row at bottom of group table
      if (grupoStats.length > 0) {
        const totalActivos = grupoStats.reduce((acc, g) => acc + g.total, 0);
        const totalInactivos = grupoStats.reduce((acc, g) => acc + g.inactivos, 0);
        const totalRecibieron = grupoStats.reduce((acc, g) => acc + g.recibieron, 0);
        const totalNoRecibieron = grupoStats.reduce((acc, g) => acc + g.noRecibieron, 0);
        const totalAusentes = grupoStats.reduce((acc, g) => acc + g.ausentes, 0);
        const maxDiasRegistrados = Math.max(...grupoStats.map(g => g.diasRegistrados), 0);
        const totalRacionesProgramadas = grupoStats.reduce((acc, g) => acc + g.racionesProgramadas, 0);
        const totalRacionesEsperadas = grupoStats.reduce((acc, g) => acc + g.racionesEsperadas, 0);

        const totalPorcentajeCobertura = totalRacionesProgramadas > 0 ? ((totalRecibieron / totalRacionesProgramadas) * 100).toFixed(1) : '0.0';
        const totalPorcentajeEfectivo = totalRacionesEsperadas > 0 ? ((totalRecibieron / totalRacionesEsperadas) * 100).toFixed(1) : '0.0';

        let totalEstado = 'Crítico';
        const pctNum = parseFloat(totalPorcentajeEfectivo);
        if (pctNum >= 90) totalEstado = 'Excelente';
        else if (pctNum >= 70) totalEstado = 'Bueno';
        else if (pctNum >= 50) totalEstado = 'Regular';

        const totalRow: any[] = [
          'Total',
          '',
          totalActivos.toString(),
          totalInactivos.toString(),
          totalSchoolBusinessDays.toString(),
          totalRacionesProgramadas.toString(),
          `${totalPorcentajeCobertura}%`
        ];

        if (hasDailyCols) {
          businessDates.forEach(d => {
            if (festivosSet.has(d)) {
              totalRow.push('-');
            } else {
              const daySum = grupoStats.reduce((acc, g) => acc + (g.dailyRecibio[d] || 0), 0);
              totalRow.push(daySum > 0 ? daySum.toString() : '-');
            }
          });
        }

        totalRow.push(
          totalRecibieron.toString(),
          totalNoRecibieron.toString(),
          totalAusentes.toString(),
          maxDiasRegistrados.toString(),
          totalRacionesEsperadas.toString(),
          `${totalPorcentajeEfectivo}%`,
          totalEstado
        );

        excelData.push(totalRow);
      }

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
              const isFestivo = festivosSet.has(d);
              return `${dayName} ${dateObj.getDate()}${isFestivo ? ' (Festivo)' : ''}`;
            }), 'Días Registrados', 'Total Recibido', '% Asistencia', 'Estado']
          );

          const studentMatrix: Record<string, Record<string, string>> = {};
          (rangeAttendance || []).forEach(record => {
            if (!studentMatrix[record.estudiante_id]) studentMatrix[record.estudiante_id] = {};
            studentMatrix[record.estudiante_id][record.fecha] = record.estado;
          });

          // Sort students by name
          const sortedStudents = [...studentsInGroup].sort((a, b) => a.nombre.localeCompare(b.nombre));

          const totalGroupRegisteredDays = registeredDaysSetForGroup.size;
          let groupSumRecibio = 0;
          const dailySumsForGroup: Record<string, number> = {};

          sortedStudents.forEach(student => {
            const row: any[] = [student.nombre];
            let totalRecibio = 0;

            dates.forEach(d => {
              if (festivosSet.has(d)) {
                row.push('🌴');
              } else {
                const estado = studentMatrix[student.id]?.[d];
                if (estado === 'recibio') {
                  row.push('✅');
                  totalRecibio++;
                  dailySumsForGroup[d] = (dailySumsForGroup[d] || 0) + 1;
                } else if (estado === 'no_recibio') {
                  row.push('❌');
                } else if (estado === 'ausente') {
                  row.push('⚪');
                } else {
                  row.push('-');
                }
              }
            });

            groupSumRecibio += totalRecibio;

            row.push(totalGroupRegisteredDays);
            row.push(totalRecibio);

            // Calculate individual percentage based ONLY on registered days for the group
            const percentage = totalGroupRegisteredDays > 0 ? (totalRecibio / totalGroupRegisteredDays) * 100 : 0;
            row.push(`${percentage.toFixed(1)}%`);

            let studentEstado = 'Crítico';
            if (percentage >= 90) studentEstado = 'Excelente';
            else if (percentage >= 70) studentEstado = 'Bueno';
            else if (percentage >= 50) studentEstado = 'Regular';
            row.push(studentEstado);

            excelData.push(row);
          });

          // Total row at bottom of student matrix
          if (sortedStudents.length > 0) {
            const totalMatrixRow: any[] = ['Total'];

            dates.forEach(d => {
              if (festivosSet.has(d)) {
                totalMatrixRow.push('🌴');
              } else {
                const dayCount = dailySumsForGroup[d];
                totalMatrixRow.push(dayCount && dayCount > 0 ? dayCount : '-');
              }
            });

            totalMatrixRow.push(totalGroupRegisteredDays);
            totalMatrixRow.push(groupSumRecibio);

            const activeStudentsInGroup = sortedStudents.filter(s => s.estado === 'activo' || s.estado === 'active').length || sortedStudents.length;
            const expectedGroupRaciones = activeStudentsInGroup * totalGroupRegisteredDays;
            const groupOverallPct = expectedGroupRaciones > 0 ? (groupSumRecibio / expectedGroupRaciones) * 100 : 0;

            totalMatrixRow.push(`${groupOverallPct.toFixed(1)}%`);

            let groupOverallEstado = 'Crítico';
            if (groupOverallPct >= 90) groupOverallEstado = 'Excelente';
            else if (groupOverallPct >= 70) groupOverallEstado = 'Bueno';
            else if (groupOverallPct >= 50) groupOverallEstado = 'Regular';
            totalMatrixRow.push(groupOverallEstado);

            excelData.push(totalMatrixRow);
          }
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

      // Prepare Blob and trigger preview
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      setExportBlob(blob);
      setExportPreviewFilename(filename);
      setExportPreviewUrl(null); // No visual preview for excel
      
      setExportPreviewOpen(true);
    } catch (error) {
      console.error('Error generating Excel report:', error);
      alert('Error al generar el reporte Excel. Por favor, intenta de nuevo.');
    } finally {
      setIsGeneratingExport(false);
    }
  };

  const getExportData = async () => {
    let reportDate = selectedDate;
    const today = new Date();
    if (periodo === 'hoy') {
      const offset = today.getTimezoneOffset() * 60000;
      reportDate = new Date(today.getTime() - offset).toISOString().split('T')[0];
    }

    const [pYear, pMonth, pDay] = reportDate.split('-').map(Number);
    const analysisDate = new Date(pYear, pMonth - 1, pDay);

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

    const sedeMap: Record<string, string> = {
      'principal': 'Principal',
      'primaria': 'Sede Primaria',
      'maria-inmaculada': 'Maria Inmaculada'
    };

    let queryEst = supabase.from('estudiantes').select('id, nombre, grupo, sede, estado').not('grupo', 'ilike', '%2025%');
    if (sedeFilter === 'primaria-principal') {
      queryEst = queryEst.in('sede', ['Principal', 'Primaria', 'Sede Primaria']);
    } else if (sedeFilter !== 'todas') {
      queryEst = queryEst.eq('sede', sedeMap[sedeFilter] || 'Principal');
    }
    if (grupoFilter !== 'todos') {
      queryEst = queryEst.eq('grupo', grupoFilter);
    }
    const { data: allStudentsData } = await queryEst;
    const students = allStudentsData || [];

    let queryAsist = supabase.from('asistencia_pae').select(`
      id, estado, fecha, created_at,
      estudiantes!inner (id, nombre, grupo, sede)
    `)
    .gte('fecha', startDate)
    .lte('fecha', endDate);

    if (sedeFilter === 'primaria-principal') {
      queryAsist = queryAsist.in('estudiantes.sede', ['Principal', 'Primaria', 'Sede Primaria']);
    } else if (sedeFilter !== 'todas') {
      queryAsist = queryAsist.eq('estudiantes.sede', sedeMap[sedeFilter] || 'Principal');
    }
    if (grupoFilter !== 'todos') {
      queryAsist = queryAsist.eq('estudiantes.grupo', grupoFilter);
    }

    const { data: attendanceData } = await queryAsist;
    const records = (attendanceData || []) as any[];

    const recibieronCount = records.filter(r => r.estado === 'recibio').length;
    const noRecibieronCount = records.filter(r => r.estado === 'no_recibio').length;
    const ausentesCount = records.filter(r => r.estado === 'ausente').length;
    
    let businessDays = 0;
    let dTrack = new Date(startDate + 'T00:00:00');
    const dEnd = new Date(endDate + 'T00:00:00');
    while (dTrack <= dEnd) {
      if (dTrack.getDay() !== 0 && dTrack.getDay() !== 6) businessDays++;
      dTrack.setDate(dTrack.getDate() + 1);
    }
    if (businessDays === 0) businessDays = 1;

    const totalActiveEst = students.filter(s => s.estado === 'activo' || s.estado === 'active').length;
    const inactivosCount = students.filter(s => s.estado === 'inactivo' || s.estado === 'inactive').length;
    
    // Calcular diasRegistrados globalmente para este export
    const registeredDaysSet = new Set(records.map(r => r.fecha));
    const diasRegistrados = registeredDaysSet.size > 0 ? registeredDaysSet.size : businessDays;

    // Calcular potential sumando por grupo para ser exactos como en la UI
    let totalPotential = 0;
    if (grupoFilter !== 'todos') {
       totalPotential = totalActiveEst * diasRegistrados;
    } else {
       const activeStudentsByGroup: Record<string, number> = {};
       students.filter(s => s.estado === 'activo' || s.estado === 'active').forEach(s => {
          activeStudentsByGroup[s.grupo] = (activeStudentsByGroup[s.grupo] || 0) + 1;
       });
       
       for (const g of Object.keys(activeStudentsByGroup)) {
           const groupRecords = records.filter(r => {
               const e = Array.isArray(r.estudiantes) ? r.estudiantes[0] : r.estudiantes;
               return e?.grupo === g;
           });
           const groupDays = new Set(groupRecords.map(r => r.fecha)).size || diasRegistrados;
           totalPotential += activeStudentsByGroup[g] * groupDays;
       }
    }

    const asistenciaPerc = totalPotential > 0 ? ((recibieronCount / totalPotential) * 100).toFixed(1) : '0.0';
    const racionesEsperadas = totalPotential;
    
    let estado = 'Crítico';
    const perc = parseFloat(asistenciaPerc);
    if (perc >= 90) estado = 'Excelente';
    else if (perc >= 70) estado = 'Bueno';
    else if (perc >= 50) estado = 'Regular';

    const statsToPass = {
      totalActivos: totalActiveEst,
      inactivos: inactivosCount,
      recibieron: recibieronCount,
      noRecibieron: noRecibieronCount,
      ausentes: ausentesCount,
      diasRegistrados,
      racionesEsperadas,
      estado,
      porcentajeAsistencia: asistenciaPerc
    };

    let sedeStats: any[] = [];
    let grupoStats: any[] = [];

    const allSedes = ['Principal', 'Primaria', 'Sede Primaria', 'Maria Inmaculada'];
    for (const sName of allSedes) {
      const sStus = students.filter(s => s.sede === sName);
      const sActivos = sStus.filter(s => s.estado === 'activo' || s.estado === 'active').length;
      const sInactivos = sStus.filter(s => s.estado === 'inactivo' || s.estado === 'inactive').length;
      
      const sRecs = records.filter(r => {
        const e = Array.isArray(r.estudiantes) ? r.estudiantes[0] : r.estudiantes;
        return e?.sede === sName;
      });
      const sRegDays = new Set(sRecs.map(r => r.fecha)).size || 1;
      const sRecibió = sRecs.filter(r => r.estado === 'recibio').length;
      const sPot = sActivos * sRegDays;
      
      if (sStus.length > 0) {
        sedeStats.push({
          sede: sName,
          total: sActivos,
          inactivos: sInactivos,
          recibieron: sRecibió,
          noRecibieron: sRecs.filter(r => r.estado === 'no_recibio').length,
          ausentes: sRecs.filter(r => r.estado === 'ausente').length,
          porcentaje: sPot > 0 ? ((sRecibió / sPot) * 100).toFixed(1) : '0.0'
        });
      }
    }

    const groups = Array.from(new Set(students.map(s => `${s.grupo}|${s.sede}`)));
    groups.forEach(gKey => {
      const [gName, gSede] = gKey.split('|');
      const gStus = students.filter(s => s.grupo === gName && s.sede === gSede);
      const gActivos = gStus.filter(s => s.estado === 'activo' || s.estado === 'active').length;
      const gInactivos = gStus.filter(s => s.estado === 'inactivo' || s.estado === 'inactive').length;

      const gRecs = records.filter(r => {
        const e = Array.isArray(r.estudiantes) ? r.estudiantes[0] : r.estudiantes;
        return e?.grupo === gName && e?.sede === gSede;
      });
      const gRegDays = new Set(gRecs.map(r => r.fecha)).size || 1;
      const gRecibió = gRecs.filter(r => r.estado === 'recibio').length;
      const gPot = gActivos * gRegDays;
      const gPerc = gPot > 0 ? (gRecibió / gPot) * 100 : 0;

      grupoStats.push({
        grupo: gName, sede: gSede, total: gActivos, inactivos: gInactivos,
        recibieron: gRecibió, ausentes: gRecs.filter(r => r.estado === 'ausente').length,
        diasRegistrados: gRegDays, racionesEsperadas: gPot,
        porcentaje: gPerc.toFixed(1),
        estado: gPerc >= 90 ? 'Excelente' : gPerc >= 70 ? 'Bueno' : gPerc >= 50 ? 'Regular' : 'Crítico'
      });
    });
    grupoStats.sort((a,b) => a.sede.localeCompare(b.sede) || a.grupo.localeCompare(b.grupo));

    let studentStats: any[] = [];
    if (grupoFilter !== 'todos') {
      const gRegDays = new Set(records.map(r => r.fecha)).size || 1;
      
      students.forEach(student => {
        const sRecs = records.filter(r => {
          const e = Array.isArray(r.estudiantes) ? r.estudiantes[0] : r.estudiantes;
          return e?.id === student.id;
        });
        const recibio = sRecs.filter(r => r.estado === 'recibio').length;
        const ausentes = sRecs.filter(r => r.estado === 'ausente').length;
        const sPot = gRegDays;
        const porcentaje = sPot > 0 ? (recibio / sPot) * 100 : 0;
        
        let estado = 'Crítico';
        if (porcentaje >= 90) estado = 'Excelente';
        else if (porcentaje >= 70) estado = 'Bueno';
        else if (porcentaje >= 50) estado = 'Regular';

        studentStats.push({
          nombre: student.nombre,
          recibio,
          ausentes,
          diasRegistrados: gRegDays,
          porcentaje: porcentaje.toFixed(1),
          estado
        });
      });
      studentStats.sort((a,b) => a.nombre.localeCompare(b.nombre));
    }

    return { records, students, statsToPass, sedeStats, grupoStats, studentStats, startDate, endDate };
  };

  const handlePreparePDF = async () => {
    setIsGeneratingExport(true);
    try {
      const data = await getExportData();
      const { records, students, statsToPass, sedeStats, grupoStats, studentStats, startDate, endDate } = data;

      const { generateDetailedReportPDF } = await import('@/lib/pdf-generator');
      const result = generateDetailedReportPDF({
        allPeriodRecords: records,
        allStudents: students,
        stats: statsToPass,
        filters: {
          periodo,
          sede: sedeFilter,
          grupo: grupoFilter,
          startDate,
          endDate
        },
        sedeStats,
        grupoStats,
        studentStats,
        returnBlob: true
      });
      if (result && result.blob) {
        const url = URL.createObjectURL(result.blob);
        setExportPreviewUrl(url);
        setExportPreviewFilename(result.filename);
        setExportBlob(result.blob);
        setExportPreviewOpen(true);
      }
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      alert('Error al generar el archivo PDF.');
    } finally {
      setIsGeneratingExport(false);
    }
  };

  const handlePrepareImage = async () => {
    setIsGeneratingExport(true);
    try {
      const data = await getExportData();
      const { grupoStats, studentStats, startDate, endDate } = data;
      
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;background:#ffffff;padding:40px;font-family:system-ui, -apple-system, sans-serif;color:#000;border-radius:16px;';
      
      const dateLabel = periodo === 'fecha' ? selectedDate : periodo === 'hoy' ? 'Hoy' : periodo === 'semana' ? 'Esta Semana' : 'Este Mes';
      const sedeLabel = sedeFilter === 'todas' ? 'Todas las sedes' : `Sede ${sedeFilter}`;
      const grupoLabel = grupoFilter === 'todos' ? 'Todos los grupos' : `Grupo ${grupoFilter}`;

      let tableHTML = '';

      if (grupoFilter !== 'todos' && studentStats.length > 0) {
        const g = grupoStats[0];
        const summaryTableHTML = g ? `
          <h3 style="font-size:16px;color:#334155;margin:0 0 12px;font-weight:700;text-transform:uppercase;">Resumen del Grupo</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:32px;background:#f8fafc;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
            <thead>
              <tr style="background:#0f172a;color:#ffffff;">
                <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Grupo</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Sede</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Total Est.</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Est. Inactivos</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Recibieron</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Ausentes</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Días Reg.</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Rac. Esp.</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">% Asist.</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#0f172a;">${g.grupo}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;">${g.sede}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;text-align:center;">${g.total}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#ef4444;text-align:center;">${g.inactivos}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#059669;text-align:center;font-weight:600;">${g.recibieron}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#ca8a04;text-align:center;">${g.ausentes}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;text-align:center;">${g.diasRegistrados}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;text-align:center;">${g.racionesEsperadas}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;text-align:center;font-weight:700;">${g.porcentaje}%</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:700;text-align:center;color:${g.estado === 'Excelente' ? '#16a34a' : g.estado === 'Bueno' ? '#2563eb' : g.estado === 'Regular' ? '#d97706' : '#dc2626'};">${g.estado}</td>
              </tr>
            </tbody>
          </table>
        ` : '';

        const rows = studentStats.map(s => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#0f172a;">${s.nombre}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#059669;text-align:center;font-weight:600;">${s.recibio}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#ca8a04;text-align:center;">${s.ausentes}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;text-align:center;">${s.diasRegistrados}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;text-align:center;font-weight:700;">${s.porcentaje}%</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:700;text-align:center;color:${s.estado === 'Excelente' ? '#16a34a' : s.estado === 'Bueno' ? '#2563eb' : s.estado === 'Regular' ? '#d97706' : '#dc2626'};">${s.estado}</td>
          </tr>
        `).join('');

        tableHTML = `
          ${summaryTableHTML}
          <h3 style="font-size:16px;color:#334155;margin:0 0 12px;font-weight:700;text-transform:uppercase;">Detalle de Estudiantes</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#f8fafc;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
            <thead>
              <tr style="background:#0891b2;color:#ffffff;">
                <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Estudiante</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Recibió</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Ausente</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Días Reg.</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">% Asist.</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Estado</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        `;
      } else {
        const rows = grupoStats.map(g => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#0f172a;">${g.grupo}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;">${g.sede}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;text-align:center;">${g.total}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#059669;text-align:center;font-weight:600;">${g.recibieron}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#ca8a04;text-align:center;">${g.ausentes}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;text-align:center;">${g.diasRegistrados}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;text-align:center;">${g.racionesEsperadas}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;text-align:center;font-weight:700;">${g.porcentaje}%</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:700;text-align:center;color:${g.estado === 'Excelente' ? '#16a34a' : g.estado === 'Bueno' ? '#2563eb' : g.estado === 'Regular' ? '#d97706' : '#dc2626'};">${g.estado}</td>
          </tr>
        `).join('');

        tableHTML = `
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#f8fafc;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
            <thead>
              <tr style="background:#0891b2;color:#ffffff;">
                <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Grupo</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Sede</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Total Est.</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Recibieron</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Ausentes</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Días Reg.</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Rac. Esp.</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">% Asist.</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Estado</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        `;
      }

      el.innerHTML = `
        <div style="text-align:center;margin-bottom:24px;border-bottom:2px solid #e5e7eb;padding-bottom:16px;">
            <h1 style="font-size:24px;color:#0891b2;margin:0 0 6px;font-weight:900;text-transform:uppercase;">Institución Educativa Barroblanco</h1>
            <h2 style="font-size:18px;color:#334155;margin:0 0 6px;font-weight:700;">Consolidado de Asistencia PAE</h2>
            <p style="font-size:14px;color:#64748b;margin:0;">${sedeLabel} | ${grupoLabel}</p>
            <p style="font-size:14px;color:#64748b;margin:4px 0 0;font-weight:600;">Período: ${startDate} al ${endDate}</p>
        </div>
        
        ${tableHTML}
        
        <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid #f1f5f9;">
            <p style="font-size:12px;color:#94a3b8;margin:0;">Generado por el Sistema PAE - ${new Date().toLocaleString()}</p>
        </div>
      `;
      
      document.body.appendChild(el);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 800 });
      const filename = `Consolidado_PAE_${sedeFilter}_${grupoFilter}_${selectedDate}.png`;
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setExportPreviewUrl(url);
        setExportPreviewFilename(filename);
        setExportBlob(blob);
        setExportPreviewOpen(true);
      }, 'image/png');
      
      document.body.removeChild(el);
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Error al generar la imagen del reporte.');
    } finally {
      setIsGeneratingExport(false);
    }
  };

  const handleExecuteExport = async (action: 'download' | 'share') => {
    if (!exportBlob || !exportPreviewFilename) return;
    
    if (action === 'download') {
      const url = URL.createObjectURL(exportBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportPreviewFilename;
      a.click();
      URL.revokeObjectURL(url);
    } else if (action === 'share') {
      const file = new File([exportBlob], exportPreviewFilename, { type: exportBlob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Reporte PAE - ${exportPreviewFilename}`, text: 'Adjunto el reporte generado.' });
        } catch (error) {
          console.error("Error al compartir:", error);
          // Opcional: Fallback a descargar si falla o el usuario cancela (puede ser molesto si cancelan)
        }
      } else {
        alert('Compartir no está soportado en este dispositivo o navegador. Se procederá a descargar automáticamente.');
        const url = URL.createObjectURL(exportBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportPreviewFilename;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
    
    // Clean up
    if (exportPreviewUrl) URL.revokeObjectURL(exportPreviewUrl);
    setExportPreviewOpen(false);
    setExportPreviewUrl(null);
    setExportBlob(null);
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
    } else if (category === 'pendientes') {
      title = "Grupos Pendientes";
      data = stats.groupDetails.pendientes || [];
      color = "text-orange-500 bg-orange-50";
      Icon = Clock;
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
          fecha: a.fecha, // Keep original date for reports as it's relevant
          estado: state === 'recibio' ? 'Recibió' : state === 'no_recibio' ? 'No Recibió' : 'Ausente',
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
    <div ref={reportContainerRef} className="min-h-screen bg-gray-50 pb-24 dark:bg-gray-900 transition-colors">
      <DateSelectionModal
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
        selectedDate={selectedDate}
        onSelectDate={(date) => {
          setSelectedDate(date);
          setPeriodo('fecha');
        }}
        title={grupoFilter !== 'todos' ? `Calendario Grupo ${grupoFilter}` : sedeFilter !== 'todas' ? `Calendario Sede ${sedeFilter}` : 'Seleccionar Fecha Reporte'}
        highlightedDates={calendarHighlightedDates}
        dateData={calendarDateData}
        mode={calendarHighlightedDates.length > 0 ? 'attendance' : 'manual'}
        showCounters={calendarHighlightedDates.length > 0}
      />

      {/* Modal de Detalle por Grupo */}
      <StatsDetailModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setDeepDetailOpen(false);
        }}
        category={modalCategory}
        data={modalData}
        deepDetailOpen={deepDetailOpen}
        deepDetailTitle={deepDetailTitle}
        deepDetailData={deepDetailData}
        onGroupSelect={openDeepDetail}
        onBackToSummary={() => setDeepDetailOpen(false)}
        summaryStats={
          modalCategory?.id === 'recibieron' ? {
            diasRegistrados: stats.diasRegistrados || 0,
            estudiantesActivos: stats.totalEstudiantes || 0, // Wait, it's called totalEstudiantes in stats state still
            racionesEsperadas: stats.racionesEsperadas || 0
          } : undefined
        }
      />

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
              {/* Export Button Premium (Simplified) */}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="p-2 md:p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 shadow-lg border border-white/10"
                  title="Exportar Reporte"
                >
                  <FileDown className="w-5 h-5 md:w-6 md:h-6" />
                </button>

                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute right-0 mt-3 w-56 bg-white/95 dark:bg-gray-800 backdrop-blur-md rounded-3xl shadow-2xl border border-cyan-100 dark:border-gray-700 z-[70] py-3 p-2 animate-in fade-in zoom-in-95 duration-200">
                      <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-4 mb-2">Formato de salida</p>
                      <button
                        onClick={() => { setSelectedExportFormat('excel'); setShowExportMenu(false); handlePrepareExcel(); }}
                        className="w-full text-left px-4 py-3 hover:bg-cyan-50 rounded-2xl flex items-center gap-3 transition-colors group/item"
                      >
                        <div className="bg-emerald-100 p-2 rounded-xl group-hover/item:bg-emerald-500 group-hover/item:text-white transition-colors">
                          <span className="font-black text-[10px]">XLS</span>
                        </div>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Exportar Excel</span>
                      </button>
                      <button
                        onClick={() => { setSelectedExportFormat('pdf'); setShowExportMenu(false); handlePreparePDF(); }}
                        className="w-full text-left px-4 py-3 hover:bg-cyan-50 rounded-2xl flex items-center gap-3 transition-colors border-t border-gray-50 mt-2 group/item"
                      >
                        <div className="bg-rose-100 p-2 rounded-xl group-hover/item:bg-rose-500 group-hover/item:text-white transition-colors">
                          <span className="font-black text-[10px]">PDF</span>
                        </div>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Exportar PDF</span>
                      </button>
                      <button
                        onClick={() => { setSelectedExportFormat('image'); setShowExportMenu(false); handlePrepareImage(); }}
                        className="w-full text-left px-4 py-3 hover:bg-cyan-50 rounded-2xl flex items-center gap-3 transition-colors border-t border-gray-50 mt-2 group/item"
                      >
                        <div className="bg-purple-100 p-2 rounded-xl group-hover/item:bg-purple-500 group-hover/item:text-white transition-colors">
                          <span className="font-black text-[10px]">IMG</span>
                        </div>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Exportar Imagen</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Date Picker Premium */}
              <div className="relative">
                <button
                  onClick={() => setShowCalendar(true)}
                  className={`p-2 md:p-3 rounded-2xl transition-all shadow-lg border active:scale-95 ${periodo === 'fecha' ? 'bg-white text-cyan-700 border-white' : 'bg-white/10 hover:bg-white/20 text-white border-white/10'}`}
                >
                  <Calendar className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-8">

        {/* View Toggles (Main Content) */}
        {/* View Toggles & Sync */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
          <div className="flex p-1 bg-gray-200/50 dark:bg-gray-800/50 rounded-2xl backdrop-blur-sm border border-gray-100 dark:border-gray-700 shadow-inner">
            <button
              onClick={() => setViewMode('historico')}
              className={`px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all ${viewMode === 'historico' ? 'bg-white text-cyan-700 shadow-lg ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500'}`}
            >
              Histórico
            </button>
            <button
              onClick={() => setViewMode('proyeccion')}
              className={`px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${viewMode === 'proyeccion' ? 'bg-white text-cyan-700 shadow-lg ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500'}`}
            >
              <School className="w-4 h-4" />
              Proyección
            </button>
          </div>

          {(usuario?.rol === 'admin' || usuario?.rol === 'coordinador_pae') && (
            <button
              onClick={async () => {
                const dayNames = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES'];
                const selectedDayName = dayNames[selectedDayOffset - 1] || 'este día';
                const confirmSync = window.confirm(`¿Deseas sincronizar los datos del ${selectedDayName} seleccionado con la Hoja Maestra de Google?`);
                if (!confirmSync) return;

                // Show loading toast or state
                const btn = document.getElementById('sync-btn');
                if (btn) (btn as HTMLButtonElement).disabled = true;
                if (btn) (btn as HTMLButtonElement).innerText = 'Sincronizando...';

                try {
                  const res = await fetch('/api/sync-sheets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sheetId: '1NIp7IaTps7E-QqkBc5Yt0rx36HGc-k5d4EiKmtOLFeE',
                      weekStart: (() => {
                        const d = new Date(selectedDate + 'T12:00:00'); // FIX ZONA HORARIA
                        const day = d.getDay();
                        const currMonday = new Date(d);
                        currMonday.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
                        const targetDate = new Date(currMonday);
                        targetDate.setDate(currMonday.getDate() + (selectedDayOffset - 1));
                        return new Date(targetDate.getTime() - targetDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];
                      })()
                    })
                  });

                  const data = await res.json();

                  if (res.ok) {
                    if (data.updated > 0) {
                      alert(`✅ Sincronización Exitosa!\nFilas actualizadas en Google Sheets: ${data.updated}\nHoja utilizada: ${data.sheetUsed}`);
                    } else {
                      const debugInfo = data.debug ?
                        `\n\n🔍 Debug Info:\n- Grupos DB: ${data.debug.studentGroupsFoundInDB.join(', ')}\n- Filas Excel Leídas (Muestra): ${data.debug.sampleRowsFromSheet.slice(0, 10).join(', ')}`
                        : '';
                      alert(`⚠️ Sincronización completada pero NO se actualizaron filas.\nHoja utilizada: ${data.sheetUsed}${debugInfo}\n\nPosible causa: Los nombres de grupos en Base de Datos no coinciden con la Columna A del Excel.`);
                    }
                  } else {
                    throw new Error(data.error || 'Error desconocido');
                  }
                } catch (err: any) {
                  alert('❌ Error al sincronizar: ' + err.message);
                } finally {
                  if (btn) (btn as HTMLButtonElement).disabled = false;
                  if (btn) (btn as HTMLButtonElement).innerText = 'Sincronizar Reporte';
                }
              }}
              id="sync-btn"
              className="flex items-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-200 dark:shadow-none active:scale-95 text-[10px] md:text-xs uppercase tracking-wide"
            >
              <School className="w-4 h-4" />
              <span>Sincronizar <span className="hidden md:inline">Reporte</span></span>
            </button>
          )}

          {usuario?.rol === 'admin' && (
            <button
              id="test-anim-btn"
              onClick={() => setShowTestAnimation(true)}
              className="flex items-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-amber-200 dark:shadow-none active:scale-95 text-[10px] md:text-xs uppercase tracking-wide"
              title="Probar animación de estrellas sin modificar puntos"
            >
              <Sparkles className="w-4 h-4 fill-current text-amber-200" />
              <span>Probar <span className="hidden md:inline">Animación</span></span>
            </button>
          )}
        </div>

        {viewMode === 'proyeccion' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Projection Controls (Week & Filters) */}
            <div className="flex flex-col items-center gap-4">

              <div className="flex flex-col md:flex-row items-center justify-between gap-3 w-full px-1 lg:px-0">
                {/* Week Navigator (Mobile Optimized) */}
                <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 p-0.5 lg:p-1 rounded-[2rem] flex items-center shadow-lg shadow-cyan-100 border border-cyan-500/30 shrink-0 w-full md:w-auto justify-between md:justify-start">
                  <button
                    onClick={() => handleMoveWeek(-1)}
                    className="p-2 md:p-3 hover:bg-white/10 rounded-full text-white transition-colors active:scale-90"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="px-4 text-center">
                    <span className="block text-[8px] md:text-[9px] text-cyan-200 font-bold uppercase tracking-widest">
                      Semana
                    </span>
                    <span className="text-xs md:text-sm font-black text-white tracking-wide uppercase whitespace-nowrap">
                      {getWeekRangeLabel(selectedDate)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleMoveWeek(1)}
                    className="p-2 md:p-3 hover:bg-white/10 rounded-full text-white transition-colors active:scale-90"
                  >
                    <ChevronLeft className="w-5 h-5 rotate-180" />
                  </button>
                </div>

                {/* Day Selector (Mobile Optimized from Horario) */}
                <div className="bg-white dark:bg-gray-800 p-0.5 lg:p-1 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-1 w-full md:w-auto justify-between md:justify-start overflow-x-auto no-scrollbar">
                  {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE'].map((dayLabel, index) => {
                    const dayOffset = index + 1; // 1=Mon, 5=Fri
                    const isSelected = selectedDayOffset === dayOffset;

                    return (
                      <button
                        key={dayLabel}
                        onClick={() => setSelectedDayOffset(dayOffset)}
                        className={`
                                    flex-1 md:flex-none px-2 lg:px-4 py-2 rounded-2xl text-[10px] lg:text-[11px] font-black transition-all uppercase tracking-tight
                                    ${isSelected
                            ? 'bg-gradient-to-br from-cyan-600 to-cyan-700 text-white shadow-lg shadow-cyan-200/50 scale-105 z-10'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:text-gray-500 dark:hover:bg-gray-700'}
                                 `}
                      >
                        {dayLabel}
                      </button>
                    )
                  })}
                </div>
              </div>



              {/* Filters (Sede & Grupo) */}
              <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                {/* Sede Selector */}
                <div className="relative group min-w-[140px]">
                  <button
                    onClick={() => setShowSedeDropdown(!showSedeDropdown)}
                    className="w-full bg-white dark:bg-gray-800 px-4 py-3 rounded-2xl text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2"
                  >
                    <span>
                      {sedeFilter === 'todas' ? 'Todas las Sedes' :
                       sedeFilter === 'primaria-principal' ? 'PRINC. + PRIM.' :
                       sedeFilter}
                    </span>
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  </button>

                  {showSedeDropdown && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowSedeDropdown(false)} />
                      <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 z-40 overflow-hidden text-[10px] font-black uppercase tracking-widest">
                        {['todas', 'primaria-principal', 'principal', 'primaria', 'maria-inmaculada'].map((s) => (
                          <button
                            key={s}
                            onClick={() => { setSedeFilter(s); setShowSedeDropdown(false); }}
                            className="w-full text-left px-4 py-3 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                          >
                            {s === 'todas' ? 'Todas' : s === 'primaria-principal' ? 'PRINC. + PRIM.' : s}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Grupo Selector */}
                <div className="relative group min-w-[140px]">
                  <button
                    onClick={() => setGrupoDropdownOpen(!grupoDropdownOpen)}
                    className="w-full bg-white dark:bg-gray-800 px-4 py-3 rounded-2xl text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2"
                  >
                    <span>{grupoFilter === 'todos' ? 'Todos los Grupos' : grupoFilter}</span>
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  </button>
                  {grupoDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setGrupoDropdownOpen(false)} />
                      <div className="absolute top-full mt-2 w-full max-h-60 overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 z-40 text-[10px] font-black uppercase tracking-widest custom-scrollbar">
                        <button
                          onClick={() => { setGrupoFilter('todos'); setGrupoDropdownOpen(false); }}
                          className="w-full text-left px-4 py-3 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors sticky top-0 bg-white dark:bg-gray-800"
                        >
                          Todos
                        </button>
                        {gruposDisponibles.map((g) => (
                          <button
                            key={g}
                            onClick={() => { setGrupoFilter(g); setGrupoDropdownOpen(false); }}
                            className="w-full text-left px-4 py-3 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Projection Summary Card (New Feature) */}
            <div 
              className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-xl shadow-cyan-900/5 border border-gray-100 dark:border-gray-700 relative overflow-hidden animate-card-mix"
              style={{ animationDelay: '0.1s' }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-50 dark:bg-cyan-900/20 rounded-bl-[100%] -mr-10 -mt-10 z-0"></div>

              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 relative z-10">Resumen de Proyección Diaria</h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                {(() => {
                  // Helper function to filter projection data
                  const getFilteredProjectionData = () => {
                    return projectionData.filter(row => {
                      let matchSede = true;
                      if (sedeFilter === 'primaria-principal') {
                        const s = (row.sede || '').toLowerCase();
                        matchSede = s.includes('principal') || s.includes('primaria');
                      } else if (sedeFilter !== 'todas') {
                        const s = (row.sede || '').toLowerCase();
                        if (sedeFilter === 'principal') matchSede = s.includes('principal');
                        else if (sedeFilter === 'primaria') matchSede = s.includes('primaria');
                        else if (sedeFilter === 'maria-inmaculada') matchSede = s.includes('maria') || s.includes('inmaculada');
                        else matchSede = false;
                      }
                      const matchGrupo = grupoFilter === 'todos' || row.grupo === grupoFilter;
                      return matchSede && matchGrupo;
                    });
                  };

                  const filteredProj = getFilteredProjectionData();
                  const ausentesProj = filteredProj.filter(r => r.novedad_horario);

                  // Helper for manual adjustments
                  const getFilteredAdjustments = () => {
                    return manualAdjustments.filter(a => {
                      let matchSede = true;
                      if (sedeFilter === 'primaria-principal') {
                        const s = (a.sede || '').toLowerCase();
                        matchSede = s.includes('principal') || s.includes('primaria');
                      } else if (sedeFilter !== 'todas') {
                        const s = (a.sede || '').toLowerCase();
                        if (sedeFilter === 'principal') matchSede = s.includes('principal');
                        else if (sedeFilter === 'primaria') matchSede = s.includes('primaria');
                        else if (sedeFilter === 'maria-inmaculada') matchSede = s.includes('maria') || s.includes('inmaculada');
                        else matchSede = false;
                      }
                      // We don't filter adjustments tightly by group unless we know the adjustment is group-specific.
                      // Adjustments might apply to the whole sede. We will match if the adjustment's group matches OR is null/all.
                      const matchGrupo = grupoFilter === 'todos' || !a.grupo || a.grupo === 'todos' || a.grupo === grupoFilter;
                      return matchSede && matchGrupo;
                    });
                  };

                  const filteredAdj = getFilteredAdjustments();
                  const totalAdj = filteredAdj.reduce((acc, curr) => {
                    if (['reduccion_cupos', 'no_asiste_grupo'].includes(curr.tipo)) return acc - Math.abs(curr.cupos_afectados);
                    if (['aumento_cupos'].includes(curr.tipo)) return acc + Math.abs(curr.cupos_afectados);
                    return acc;
                  }, 0);

                  return (
                    <>
                      <div className="space-y-1">
                        <div className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Matrícula Base</div>
                        <div className="text-2xl font-black text-blue-600 flex items-center gap-2">
                          {loading || projectionLoading ? <Skeleton className="w-12 h-6" /> : (
                            <AnimatedNumber value={filteredProj.reduce((acc, curr) => acc + (curr.total_estudiantes - curr.total_inactivos), 0)} />
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Ausentes (Horario)</div>
                        <div className="text-2xl font-black text-rose-500 flex items-center gap-2">
                          {loading || projectionLoading ? <Skeleton className="w-12 h-6" /> : (
                            <AnimatedNumber value={ausentesProj.reduce((acc, curr) => acc + curr.total_activos, 0)} />
                          )}
                          <span className="text-[10px] text-rose-300 font-bold bg-rose-50 px-1.5 py-0.5 rounded-md">
                            {ausentesProj.length} GRUPOS
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[10px] font-black text-amber-400 uppercase tracking-wider">Ajustes Manuales</div>
                        <div className="text-2xl font-black text-amber-500 flex items-center gap-2">
                          {loading || projectionLoading ? <Skeleton className="w-12 h-6" /> : (
                            <AnimatedNumber value={totalAdj} />
                          )}
                        </div>
                      </div>

                      <div className="space-y-1 pl-4 border-l border-gray-100 dark:border-gray-700">
                        <div className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Total a Preparar</div>
                        <div className="flex flex-col">
                          <div className="text-3xl font-black text-emerald-600">
                            {loading || projectionLoading ? <Skeleton className="w-16 h-8" /> :
                              (() => {
                                const rowsWithoutAbsence = filteredProj.filter(r => !r.novedad_horario);

                                const baseCAJM = rowsWithoutAbsence.reduce((acc, curr) => acc + getRationDistribution(curr).ri_am + getRationDistribution(curr).ri_pm, 0);
                                const baseLunch = rowsWithoutAbsence.reduce((acc, curr) => acc + getRationDistribution(curr).almuerzo, 0);

                                const finalCAJM = Math.max(0, baseCAJM + totalAdj);
                                const finalLunch = baseLunch;

                                return (
                                  <div className="flex flex-col">
                                    <span className="text-3xl font-black text-emerald-600">
                                      <AnimatedNumber value={finalCAJM + finalLunch} />
                                    </span>
                                    {!loading && !projectionLoading && (
                                      <div className="text-[9px] font-bold text-gray-400 tracking-tight flex gap-2 mt-1">
                                        <span>CAJM/T: {finalCAJM}</span>
                                        <span>•</span>
                                        <span>ALM: {finalLunch}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
              <div className="p-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                <div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <School className="w-6 h-6 text-cyan-600" />
                    Detalle por Grupos
                  </h2>
                  <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
                    Pestaña: <span className="font-bold text-cyan-600 uppercase">
                      {['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES'][selectedDayOffset - 1]}
                    </span>
                  </p>
                </div>
              </div>

              {projectionLoading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-sm text-gray-400 font-bold">Calculando proyecciones diarias...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                        <th className="px-2 py-2 md:px-6 md:py-4 text-left font-black text-gray-500 uppercase tracking-widest text-[10px] md:text-xs dark:text-gray-400">Grupo</th>
                        <th className="px-2 py-2 md:px-6 md:py-4 text-center font-black text-blue-600 uppercase tracking-widest text-[10px] md:text-xs border-l border-r border-gray-100 dark:border-gray-700 dark:text-blue-400">CAJM</th>
                        <th className="px-2 py-2 md:px-6 md:py-4 text-center font-black text-purple-600 uppercase tracking-widest text-[10px] md:text-xs border-r border-gray-100 dark:border-gray-700 dark:text-purple-400">CAJT</th>
                        <th className="px-2 py-2 md:px-6 md:py-4 text-center font-black text-orange-600 uppercase tracking-widest text-[10px] md:text-xs border-r border-gray-100 dark:border-gray-700 dark:text-orange-400">ALM</th>
                        <th className="px-2 py-2 md:px-6 md:py-4 text-center font-black text-gray-400 uppercase tracking-widest text-[10px] md:text-xs">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {(() => {
                        let currentSede = '';
                        const rows: React.ReactNode[] = [];

                        projectionData
                          .filter(row => {
                            let matchSede = true;
                            if (sedeFilter === 'primaria-principal') {
                              const s = (row.sede || '').toLowerCase();
                              matchSede = s.includes('principal') || s.includes('primaria');
                            } else if (sedeFilter !== 'todas') {
                              const s = (row.sede || '').toLowerCase();
                              if (sedeFilter === 'principal') matchSede = s.includes('principal');
                              else if (sedeFilter === 'primaria') matchSede = s.includes('primaria');
                              else if (sedeFilter === 'maria-inmaculada') matchSede = s.includes('maria') || s.includes('inmaculada');
                              else matchSede = false;
                            }

                            const matchGrupo = grupoFilter === 'todos' || row.grupo === grupoFilter;
                            return matchSede && matchGrupo;
                          })
                          .sort((a, b) => {
                            // 1. Sede Priority
                            const sedeOrder = ['Principal', 'Sede Primaria', 'Sede Maria Inmaculada', 'María Inmaculada'];
                            const sedeA = sedeOrder.indexOf(a.sede) === -1 ? 99 : sedeOrder.indexOf(a.sede);
                            const sedeB = sedeOrder.indexOf(b.sede) === -1 ? 99 : sedeOrder.indexOf(b.sede);
                            if (sedeA !== sedeB) return sedeA - sedeB;

                            // 2. Natural Sort (Numeric aware) for Group
                            return a.grupo.localeCompare(b.grupo, undefined, { numeric: true, sensitivity: 'base' });
                          })
                          .forEach((row, idx) => {
                            if (row.sede !== currentSede) {
                              currentSede = row.sede;
                              rows.push(
                                <tr key={`sede-header-${currentSede}-${idx}`} className="bg-cyan-50/80 dark:bg-cyan-900/40 border-y-2 border-cyan-100 dark:border-cyan-800">
                                  <td colSpan={5} className="px-2 py-3 md:px-6 md:py-4 font-black text-cyan-800 dark:text-cyan-300 uppercase tracking-widest text-xs md:text-sm shadow-sm flex items-center gap-2">
                                    <School className="w-4 h-4" />
                                    SEDE: {currentSede || 'NO ESPECIFICADA'}
                                  </td>
                                </tr>
                              );
                            }

                            const dist = getRationDistribution(row);
                            const isCancelled = row.novedad_horario;

                            // Smart Label Logic
                            const gradoStr = (row.grado || '').toString().toLowerCase().trim();
                            const grupoStr = (row.grupo || '').toString().toLowerCase().trim();
                            const isRedundant = grupoStr.includes(gradoStr) || grupoStr.startsWith(gradoStr);
                            const displayLabel = isRedundant ? row.grupo : `${row.grado} - ${row.grupo}`;

                            rows.push(
                              <tr key={`row-${row.grupo}-${idx}`} className={`transition-colors ${isCancelled ? 'bg-rose-50/50 dark:bg-rose-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                                <td className="px-2 py-2 md:px-6 md:py-4 font-bold text-gray-900 dark:text-white capitalize">
                                  <div className="flex items-center gap-2">
                                    <span className="uppercase text-[10px] md:text-sm">{displayLabel}</span>
                                    {isCancelled && (
                                      <span className="bg-rose-100 text-rose-600 text-[8px] md:text-[9px] px-1 md:px-2 py-0.5 rounded-full uppercase tracking-widest font-black border border-rose-200">
                                        NO
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[9px] md:text-[10px] text-gray-400 font-normal uppercase hidden md:inline">({row.sede})</span>
                                </td>

                                <td className={`px-2 py-2 md:px-6 md:py-4 text-center font-mono font-bold text-xs md:text-sm border-l border-r border-gray-100 dark:border-gray-700 ${isCancelled ? 'text-gray-300 line-through' : 'text-gray-600 dark:text-gray-300'}`}>
                                  {isCancelled ? '0' : (dist.ri_am > 0 ? dist.ri_am : '-')}
                                </td>
                                <td className={`px-2 py-2 md:px-6 md:py-4 text-center font-mono font-bold text-xs md:text-sm border-r border-gray-100 dark:border-gray-700 ${isCancelled ? 'text-gray-300 line-through' : 'text-gray-600 dark:text-gray-300'}`}>
                                  {isCancelled ? '0' : (dist.ri_pm > 0 ? dist.ri_pm : '-')}
                                </td>
                                <td className={`px-2 py-2 md:px-6 md:py-4 text-center font-mono font-bold text-xs md:text-sm border-r border-gray-100 dark:border-gray-700 ${isCancelled ? 'text-rose-300 line-through decoration-2' : 'text-gray-600 dark:text-gray-300'}`}>
                                  {isCancelled ? '0' : (dist.almuerzo > 0 ? dist.almuerzo : '-')}
                                </td>
                                <td className={`px-2 py-2 md:px-6 md:py-4 text-center font-black text-xs md:text-sm ${isCancelled ? 'text-gray-300 line-through' : 'text-gray-900 dark:text-white'}`}>
                                  {isCancelled ? '0' : (dist.ri_am + dist.ri_pm + dist.almuerzo)}
                                </td>
                              </tr>
                            );
                          });

                        return rows;
                      })()}
                      {/* Totals Row (Calculated on visible data) */}
                      <tr className="bg-cyan-50 dark:bg-cyan-900/20 font-black text-cyan-900 dark:text-cyan-100">
                        <td className="px-2 py-2 md:px-6 md:py-4 text-right uppercase tracking-widest text-[9px] md:text-xs">Total Global</td>
                        {(() => {
                          const activeRows = projectionData.filter(row => {
                            if (row.novedad_horario) return false;
                            
                            let matchSede = true;
                            if (sedeFilter === 'primaria-principal') {
                              const s = (row.sede || '').toLowerCase();
                              matchSede = s.includes('principal') || s.includes('primaria');
                            } else if (sedeFilter !== 'todas') {
                              const s = (row.sede || '').toLowerCase();
                              if (sedeFilter === 'principal') matchSede = s.includes('principal');
                              else if (sedeFilter === 'primaria') matchSede = s.includes('primaria');
                              else if (sedeFilter === 'maria-inmaculada') matchSede = s.includes('maria') || s.includes('inmaculada');
                              else matchSede = false;
                            }
                            
                            const matchGrupo = grupoFilter === 'todos' || row.grupo === grupoFilter;
                            return matchSede && matchGrupo;
                          });

                          const baseCAJM = activeRows.reduce((acc, curr) => acc + getRationDistribution(curr).ri_am, 0);
                          const totalCAJT = activeRows.reduce((acc, curr) => acc + getRationDistribution(curr).ri_pm, 0);
                          const totalALM = activeRows.reduce((acc, curr) => acc + getRationDistribution(curr).almuerzo, 0);

                          // Calculate Manual Adjustments to apply to CAJM
                          let filteredAdj = manualAdjustments;
                          if (sedeFilter === 'primaria-principal') {
                            filteredAdj = filteredAdj.filter(a => {
                              const s = (a.sede || '').toLowerCase();
                              return s.includes('principal') || s.includes('primaria');
                            });
                          } else if (sedeFilter !== 'todas') {
                            filteredAdj = filteredAdj.filter(a => {
                              const s = (a.sede || '').toLowerCase();
                              if (sedeFilter === 'principal') return s.includes('principal');
                              if (sedeFilter === 'primaria') return s.includes('primaria');
                              if (sedeFilter === 'maria-inmaculada') return s.includes('maria') || s.includes('inmaculada');
                              return false;
                            });
                          }
                          const matchGrupo = (a: any) => grupoFilter === 'todos' || !a.grupo || a.grupo === 'todos' || a.grupo === grupoFilter;
                          filteredAdj = filteredAdj.filter(matchGrupo);

                          const totalAdj = filteredAdj.reduce((acc, curr) => {
                            if (['reduccion_cupos', 'no_asiste_grupo'].includes(curr.tipo)) return acc - Math.abs(curr.cupos_afectados);
                            if (['aumento_cupos'].includes(curr.tipo)) return acc + Math.abs(curr.cupos_afectados);
                            return acc;
                          }, 0);

                          const finalCAJM = Math.max(0, baseCAJM + totalAdj);
                          const grandTotal = finalCAJM + totalCAJT + totalALM;

                          return (
                            <>
                              <td className="px-2 py-2 md:px-6 md:py-4 text-center text-sm md:text-lg text-blue-600 font-bold">{finalCAJM}</td>
                              <td className="px-2 py-2 md:px-6 md:py-4 text-center text-xs md:text-base font-bold">{totalCAJT > 0 ? totalCAJT : '-'}</td>
                              <td className="px-2 py-2 md:px-6 md:py-4 text-center text-sm md:text-lg font-bold">{totalALM > 0 ? totalALM : '-'}</td>
                              <td className="px-2 py-2 md:px-6 md:py-4 text-center text-sm md:text-lg font-black">{grandTotal}</td>
                            </>
                          );
                        })()}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-8">
            {/* Filtros de período (Estilo Tabs Gestión) */}
            <div className="bg-gray-100/80 dark:bg-gray-800 p-0.5 rounded-2xl flex items-center shrink-0 relative w-full mb-4">
              {(['hoy', 'semana', 'mes'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  className={`flex-1 md:px-6 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${periodo === p ? 'text-white' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
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

            {/* Navegación de Período Dinámica (Solo Semana y Mes) */}
            {(periodo === 'semana' || periodo === 'mes') && (
              <div className="flex justify-center mb-4 transition-all animate-in slide-in-from-top-2">
                <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 p-0.5 rounded-[2rem] flex items-center shadow-lg shadow-cyan-100 border border-cyan-500/30">
                  <button
                    onClick={() => periodo === 'semana' ? handleMoveWeek(-1) : handleMoveMonth(-1)}
                    className="p-2 hover:bg-white/10 rounded-full text-white transition-colors active:scale-90"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="px-6 text-center min-w-[180px]">
                    <p className="text-[10px] font-black text-white tracking-widest uppercase mb-0.5 opacity-80">
                      {periodo === 'semana' ? 'Viendo Semana' : 'Viendo Mes'}
                    </p>
                    <div className="text-[13px] font-black text-white tracking-tight flex flex-col items-center">
                      <span>{periodo === 'semana' ? getWeekRangeLabel(selectedDate) : getMonthLabel(selectedDate)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => periodo === 'semana' ? handleMoveWeek(1) : handleMoveMonth(1)}
                    className="p-2 hover:bg-white/10 rounded-full text-white transition-colors active:scale-90"
                  >
                    <ChevronLeft className="w-5 h-5 rotate-180" />
                  </button>
                </div>
              </div>
            )}

            {/* Filters Container (Estilo Card Gestión) */}
            <div className="bg-white p-3 rounded-[2rem] shadow-xl shadow-cyan-900/5 border border-gray-100 mb-8 space-y-3 dark:bg-gray-800 dark:border-gray-700">
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {/* Sede Filter */}
                <div className="relative z-20" ref={dropdownRef}>
                  <button
                    onClick={() => setShowSedeDropdown(!showSedeDropdown)}
                    className="w-full pl-3 pr-3 md:pl-5 md:pr-5 py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-cyan-700 bg-cyan-50/50 border border-cyan-100/50 rounded-2xl flex items-center justify-between focus:outline-none focus:ring-4 focus:ring-cyan-500/10 hover:bg-white hover:border-cyan-300 transition-all shadow-sm cursor-pointer dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800/30 dark:hover:bg-cyan-900/40"
                  >
                    <span className="truncate mr-2">
                      {sedeFilter === 'todas' ? 'SEDES' : 
                       sedeFilter === 'primaria-principal' ? 'PRINC. + PRIM.' :
                       sedes.find(s => s.id === sedeFilter)?.nombre.toUpperCase()}
                    </span>
                    <ChevronDown className={`w-3 h-3 text-cyan-400 transition-transform duration-300 ${showSedeDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showSedeDropdown && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setShowSedeDropdown(false)}></div>
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 dark:bg-gray-800 backdrop-blur-xl border border-cyan-100/50 dark:border-gray-700 rounded-2xl shadow-xl shadow-cyan-100/50 dark:shadow-black/20 overflow-hidden transition-all duration-300 origin-top z-[70] animate-in fade-in zoom-in-95 duration-200">
                        <div className="max-h-48 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                          <button
                            onClick={() => { setSedeFilter('todas'); setShowSedeDropdown(false); }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-between ${sedeFilter === 'todas' ? 'bg-cyan-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-cyan-50 hover:text-cyan-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-cyan-900/30 dark:hover:text-cyan-400'}`}
                          >
                            TODAS LAS SEDES
                            {sedeFilter === 'todas' && <CheckCircle className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => { setSedeFilter('primaria-principal'); setShowSedeDropdown(false); }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-between ${sedeFilter === 'primaria-principal' ? 'bg-cyan-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-cyan-50 hover:text-cyan-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-cyan-900/30 dark:hover:text-cyan-400'}`}
                          >
                            PRINC. + PRIM.
                            {sedeFilter === 'primaria-principal' && <CheckCircle className="w-3.5 h-3.5" />}
                          </button>
                          {sedes.map((sede) => (
                            <button
                              key={sede.id}
                              onClick={() => { setSedeFilter(sede.id); setShowSedeDropdown(false); }}
                              className={`w-full text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-between ${sedeFilter === sede.id ? 'bg-cyan-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-cyan-50 hover:text-cyan-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-cyan-900/30 dark:hover:text-cyan-400'}`}
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
                    className="w-full pl-3 pr-3 md:pl-5 md:pr-5 py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-cyan-700 bg-cyan-50/50 border border-cyan-100/50 rounded-2xl flex items-center justify-between focus:outline-none focus:ring-4 focus:ring-cyan-500/10 hover:bg-white hover:border-cyan-300 transition-all shadow-sm cursor-pointer dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800/30 dark:hover:bg-cyan-900/40"
                  >
                    <span className="truncate">{grupoFilter === 'todos' ? 'GRUPOS' : `${grupoFilter}`}</span>
                    <ChevronDown className={`w-3 h-3 text-cyan-400 transition-transform duration-300 ${grupoDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {grupoDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setGrupoDropdownOpen(false)}></div>
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 dark:bg-gray-800 backdrop-blur-xl border border-cyan-100/50 dark:border-gray-700 rounded-3xl shadow-xl shadow-cyan-100/50 dark:shadow-black/20 max-h-72 overflow-y-auto p-4 animate-in fade-in zoom-in-95 duration-200 z-[70]">
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => { setGrupoFilter('todos'); setGrupoDropdownOpen(false); }}
                            className={`px-2 py-2.5 rounded-xl text-[10px] font-black transition-all ${grupoFilter === 'todos' ? 'bg-cyan-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-cyan-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-cyan-900/30'}`}
                          >
                            TODOS
                          </button>
                          {gruposDisponibles.map(grupo => (
                            <button
                              key={grupo}
                              onClick={() => { setGrupoFilter(grupo); setGrupoDropdownOpen(false); }}
                              className={`px-2 py-2.5 rounded-xl text-[10px] font-black transition-all ${grupoFilter === grupo ? 'bg-cyan-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-cyan-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-cyan-900/30'}`}
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
            <div key={viewMode} className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
              {/* Pending Groups - New Card */}

              {/* Total Estudiantes */}
              <div 
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group dark:bg-gray-800 dark:border-gray-700 animate-card-mix"
                style={{ animationDelay: '0.1s' }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-2xl md:text-3xl font-black text-blue-600 tracking-tighter">
                      {loading ? (
                        <Skeleton className="h-8 w-16 mb-1" />
                      ) : (
                        <AnimatedNumber value={stats.totalEstudiantes} />
                      )}
                    </div>
                    <div className="text-gray-400 text-[10px] font-black uppercase tracking-wider">TOTAL</div>
                  </div>
                  <div className="bg-blue-50 p-2 rounded-xl dark:bg-blue-900/20">
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
                className="bg-white rounded-[2.25rem] p-5 shadow-xl shadow-cyan-900/5 border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group hover:shadow-2xl hover:scale-[1.02] transition-all text-left dark:bg-gray-800 dark:border-gray-700 animate-card-mix"
                style={{ animationDelay: '0.35s' }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-3xl font-black text-emerald-500 tracking-tighter">
                      {loading ? (
                        <Skeleton className="h-8 w-16 mb-1" />
                      ) : (
                        <AnimatedNumber value={stats.recibieron} />
                      )}
                    </div>
                    <div className="text-gray-400 text-[9px] font-black uppercase tracking-widest">RECIBIERON</div>
                  </div>
                  <div className="bg-emerald-50 p-2.5 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 shadow-inner dark:bg-emerald-900/20">
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
                className="bg-white rounded-[2.25rem] p-5 shadow-xl shadow-cyan-900/5 border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group hover:shadow-2xl hover:scale-[1.02] transition-all text-left dark:bg-gray-800 dark:border-gray-700 animate-card-mix"
                style={{ animationDelay: '0.6s' }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-3xl font-black text-amber-500 tracking-tighter">
                      {loading ? (
                        <Skeleton className="h-8 w-16 mb-1" />
                      ) : (
                        <AnimatedNumber value={stats.noRecibieron} />
                      )}
                    </div>
                    <div className="text-gray-400 text-[9px] font-black uppercase tracking-widest">NO RECIBIERON</div>
                  </div>
                  <div className="bg-amber-50 p-2.5 rounded-2xl group-hover:bg-amber-500 group-hover:text-white transition-all duration-300 shadow-inner dark:bg-amber-900/20">
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
                className="bg-white rounded-[2.25rem] p-5 shadow-xl shadow-cyan-900/5 border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group hover:shadow-2xl hover:scale-[1.02] transition-all text-left dark:bg-gray-800 dark:border-gray-700 animate-card-mix"
                style={{ animationDelay: '0.85s' }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-3xl font-black text-rose-500 tracking-tighter">
                      {loading ? (
                        <Skeleton className="h-8 w-16 mb-1" />
                      ) : (
                        <AnimatedNumber value={stats.ausentes} />
                      )}
                    </div>
                    <div className="text-gray-400 text-[9px] font-black uppercase tracking-widest">NO ASISTIERON</div>
                  </div>
                  <div className="bg-rose-50 p-2.5 rounded-2xl group-hover:bg-rose-500 group-hover:text-white transition-all duration-300 shadow-inner dark:bg-rose-900/20">
                    <UserX className="w-5 h-5 text-rose-500 group-hover:text-white transition-colors" />
                  </div>
                </div>
                <div className="text-[9px] text-rose-500 font-black uppercase tracking-widest flex items-center gap-1 mt-2">
                  VER GRUPOS <Info className="w-3 h-3 ml-0.5" />
                </div>
              </button>

              {/* Tarjeta Grupos Pendientes */}
              <button
                onClick={() => openGroupModal('pendientes')}
                className="bg-white rounded-[2.25rem] p-5 shadow-xl shadow-cyan-900/5 border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group hover:shadow-2xl hover:scale-[1.02] transition-all text-left dark:bg-gray-800 dark:border-gray-700 animate-card-mix"
                style={{ animationDelay: '1.1s' }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-3xl font-black text-orange-500 tracking-tighter">
                      {loading ? <Skeleton className="h-8 w-16" /> : <AnimatedNumber value={stats.pendingGroupsCount} />}
                    </div>
                    <div className="text-orange-300 text-[9px] font-black uppercase tracking-widest">GRUPOS PENDIENTES</div>
                  </div>
                  <div className="bg-orange-50 p-2.5 rounded-2xl group-hover:bg-orange-500 group-hover:text-white transition-all duration-300 shadow-inner dark:bg-orange-900/20">
                    <Clock className="w-5 h-5 text-orange-400 group-hover:text-white transition-colors" />
                  </div>
                </div>
                <div className="text-[10px] text-orange-400/80 font-bold">
                  {stats.totalActiveGroups > 0 ? ((stats.pendingGroupsCount / stats.totalActiveGroups) * 100).toFixed(0) : 0}% sin reportar
                </div>
              </button>

              {/* Inactivos (Renunciaron) */}
              <button
                onClick={() => openGroupModal('inactivos')}
                disabled={stats.inactivos === 0}
                className="bg-white rounded-[2.25rem] p-5 shadow-xl shadow-cyan-900/5 border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group hover:shadow-2xl hover:scale-[1.02] transition-all text-left dark:bg-gray-800 dark:border-gray-700 animate-card-mix"
                style={{ animationDelay: '1.35s' }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-3xl font-black text-gray-700 tracking-tighter dark:text-gray-300">
                      {loading ? (
                        <Skeleton className="h-8 w-16 mb-1" />
                      ) : (
                        <AnimatedNumber value={stats.inactivos} />
                      )}
                    </div>
                    <div className="text-gray-400 text-[9px] font-black uppercase tracking-widest">INACTIVOS</div>
                  </div>
                  <div className="bg-gray-100 p-2.5 rounded-2xl group-hover:bg-cyan-600 group-hover:text-white transition-all duration-300 shadow-inner dark:bg-gray-700">
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
              <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-cyan-900/5 border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-8 px-1">Distribución Operativa</h3>
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
              <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-cyan-900/5 border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-8 px-1">
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
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-gray-50/50 dark:bg-gray-700/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-600">
                      <Calendar className="w-12 h-12 mb-4 text-cyan-200 dark:text-cyan-800" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Amplía el periodo para ver tendencias</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Registros recientes */}
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-cyan-900/5 border border-gray-100 overflow-hidden mb-8 dark:bg-gray-800 dark:border-gray-700">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800 flex items-center justify-between">
                <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] dark:text-gray-400">Registros Recientes</h2>
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
                    <thead className="bg-gray-50/80 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">Estudiante</th>
                        <th className="px-6 py-4 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">Estado</th>
                        <th className="px-6 py-4 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">Instante</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100 dark:bg-gray-800 dark:divide-gray-700">
                      {registros.map((registro: any) => {
                        const fecha = new Date(registro.created_at);
                        const hora = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const fechaStr = fecha.toLocaleDateString();

                        return (
                          <tr key={registro.id} className="hover:bg-cyan-50/30 dark:hover:bg-gray-700/30 transition-colors group">
                            <td className="px-6 py-5">
                              <div className="text-xs font-black text-gray-800 uppercase leading-tight group-hover:text-cyan-600 transition-colors dark:text-gray-200">{registro.estudiantes?.nombre}</div>
                              <div className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-tight">{registro.estudiantes?.grupo}</div>
                            </td>
                            <td className="px-6 py-5 text-center">
                              <span className={`px-4 py-1.5 inline-flex text-[9px] font-black uppercase tracking-widest rounded-full shadow-sm border ${registro.estado === 'recibio' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                                registro.estado === 'no_recibio' ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800' :
                                  'bg-gray-50 text-gray-500 border-gray-100 dark:bg-gray-700/50 dark:text-gray-400 dark:border-gray-600'
                                }`}>
                                {registro.estado === 'recibio' ? 'Recibió' :
                                  registro.estado === 'no_recibio' ? 'No recibió' : 'Ausente'}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-right">
                              <div className="text-[10px] font-black text-gray-700 dark:text-gray-300">{hora}</div>
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
        )}
      </div>

      {exportPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setExportPreviewOpen(false)}></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl p-6 overflow-hidden flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
             <button onClick={() => setExportPreviewOpen(false)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-50 dark:bg-gray-700 rounded-full transition-colors z-10">
               <X className="w-5 h-5" />
             </button>
             
             {isGeneratingExport ? (
               <div className="py-20 flex flex-col items-center justify-center gap-4">
                 <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-600/20 border-t-cyan-600"></div>
                 <p className="font-bold text-sm text-gray-500 dark:text-gray-400 animate-pulse">Generando vista previa...</p>
               </div>
             ) : (
               <>
                 <div className="flex items-center gap-3 w-full mb-4 px-2">
                   <div className={`p-3 rounded-2xl shadow-inner ${selectedExportFormat === 'excel' ? 'bg-emerald-100 text-emerald-600' : selectedExportFormat === 'pdf' ? 'bg-rose-100 text-rose-600' : 'bg-purple-100 text-purple-600'}`}>
                     <FileDown className="w-6 h-6" />
                   </div>
                   <div className="text-left flex-1">
                     <h3 className="text-lg font-black text-gray-800 dark:text-white leading-tight">Vista Previa</h3>
                     <p className="text-[10px] text-gray-400 uppercase tracking-wider">{exportPreviewFilename || `Reporte en ${selectedExportFormat}`}</p>
                   </div>
                 </div>

                 <div className="w-full bg-gray-100 dark:bg-gray-900 rounded-2xl mb-6 overflow-hidden relative flex-1 min-h-[200px] flex items-center justify-center border border-gray-200 dark:border-gray-700">
                   {selectedExportFormat === 'excel' ? (
                     <div className="text-center p-8">
                       <FileText className="w-16 h-16 text-emerald-400 mx-auto mb-4 opacity-50" />
                       <p className="text-sm font-bold text-gray-500 dark:text-gray-400">El formato Excel no permite vista previa visual aquí.</p>
                     </div>
                   ) : selectedExportFormat === 'pdf' && exportPreviewUrl ? (
                      <div className="w-full h-full flex flex-col items-center justify-center p-2">
                        <iframe src={`${exportPreviewUrl}#toolbar=0`} className="hidden md:block w-full h-[50vh] border-0 rounded-xl" title="PDF Preview" />
                        <div className="block md:hidden text-center p-6 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-900/50 w-full">
                          <FileText className="w-12 h-12 text-rose-500 mx-auto mb-3" />
                          <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">Documento PDF Listo</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-4">Los visores de teléfono requieren abrir el PDF directamente en pantalla completa.</p>
                          <a
                            href={exportPreviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] uppercase tracking-wider rounded-xl shadow-lg shadow-rose-200 dark:shadow-none transition-all active:scale-95 w-full"
                          >
                            👁️ Abrir PDF en Pantalla Completa
                          </a>
                        </div>
                      </div>
                   ) : selectedExportFormat === 'image' && exportPreviewUrl ? (
                     <div className="overflow-auto max-h-[50vh] p-2">
                       <img src={exportPreviewUrl} alt="Vista Previa" className="max-w-full h-auto object-contain rounded-xl shadow-sm" />
                     </div>
                   ) : null}
                 </div>

                 <div className="flex gap-3 w-full shrink-0">
                    <button
                      onClick={() => handleExecuteExport('share')}
                      className="flex-1 py-3.5 bg-white dark:bg-gray-800 text-cyan-700 dark:text-cyan-400 border border-cyan-100 dark:border-gray-600 hover:border-cyan-300 hover:bg-cyan-50 dark:hover:bg-gray-700 font-black text-[11px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                    >
                      Compartir
                    </button>
                    <button
                      onClick={() => handleExecuteExport('download')}
                      className="flex-1 py-3.5 bg-cyan-600 hover:bg-cyan-700 text-white font-black text-[11px] uppercase tracking-widest rounded-xl shadow-lg shadow-cyan-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      Descargar
                    </button>
                 </div>
               </>
             )}
          </div>
        </div>
      )}

      {showTestAnimation && (
        <PointsBurstAnimation
          points={5}
          targetSelector="[data-points-capsule]"
          originSelector="#test-anim-btn"
          onComplete={() => setShowTestAnimation(false)}
        />
      )}
    </div>
  );
}

export default function ReportesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Cargando reportes...</div>}>
      <ReportesContent />
    </Suspense>
  );
}
