'use client';


import { useEffect, useState } from 'react';
import ScheduleModal from '../../components/ScheduleModal';
import WeeklyScheduleModal from '../../components/WeeklyScheduleModal';
import StatsDetailModal from '../../components/StatsDetailModal';
import SecretariaDashboard from '../../components/dashboard/SecretariaDashboard';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { Usuario, calcularEstadisticasHoy } from '../data/demoData';
import {
  Users,
  CheckCircle,
  XCircle,
  UserX,
  UserMinus,
  LayoutGrid,
  Info,
  Calendar,
  X,
  ChevronDown,
  ChevronLeft,
  FileText,
  Clock,
  Sparkles,
  Rocket,
  Lock,
  AlertCircle
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import AnimatedNumber from '@/components/AnimatedNumber';
import * as XLSX from 'xlsx';
import { useHaptics } from '../../hooks/useHaptics';

export default function DashboardPage() {
  const router = useRouter();
  const { triggerLight, triggerMedium, triggerSuccess } = useHaptics();
  const [usuario, setUsuario] = useState<any | null>(null);
  const [notif, setNotif] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // Estados para Modal de Detalle
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<{ id: string, title: string, color: string, icon: any } | null>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [allAttendance, setAllAttendance] = useState<any[]>([]);

  // Estados para Detalle Premium (Segundo nivel)
  const [deepDetailOpen, setDeepDetailOpen] = useState(false);
  const [deepDetailTitle, setDeepDetailTitle] = useState("");
  const [deepDetailData, setDeepDetailData] = useState<any[]>([]);
  const [modalData, setModalData] = useState<{ grupo: string, count: number, total: number, percentage: string }[]>([]);

  // Estado para Modal de Horario
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [weeklyModalOpen, setWeeklyModalOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }

      // Fetch official profile from perfiles_publicos
      const { data: profile } = await supabase
        .from('perfiles_publicos')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        setUsuario(profile);
        
        // Redirección Automática para roles específicos
        if (profile.rol === 'secretaria_educacion' || profile.rol === 'operador') {
          return; // Their own dashboard handles data fetching
        }
      } else {
        // Determine if we need to auto-assign the "acudiente" role for new external users
        let userRole = session.user.user_metadata?.rol;
        const userEmail = session.user.email || '';
        
        // If the user has no defined role and does not belong to the institution
        if (!userRole && !userEmail.endsWith('@barroblanco.edu.co')) {
            userRole = 'acudiente';
            
            // Persist this default role back to Auth metadata so it survives re-logins
            await supabase.auth.updateUser({
                data: { rol: 'acudiente' }
            });
        }

        const newUser = {
          email: userEmail,
          nombre: session.user.user_metadata?.nombre || 'Usuario',
          rol: userRole || 'acudiente',
        };
        setUsuario(newUser);

        // Redirección Automática para la sesión actual (metadata)
        if (newUser.rol === 'secretaria_educacion' || newUser.rol === 'operador') {
          return; // Their own dashboard handles data fetching
        }
      }

      fetchStats();
    };

    checkUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const [loading, setLoading] = useState(true);

  const fetchStats = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      const today = new Date(now.getTime() - offset).toISOString().split('T')[0];

      // 1. Obtener todos los estudiantes para agrupar
      const { data: todosEstudiantes, error: errEst } = await supabase
        .from('estudiantes')
        .select('id, nombre, grupo, estado');

      if (errEst) throw errEst;

      // 2. Asistencias de Hoy
      const { data: asistencias, error: errAsist } = await supabase
        .from('asistencia_pae')
        .select('estudiante_id, estado')
        .eq('fecha', today);

      if (errAsist) throw errAsist;

      const estudiantes = (todosEstudiantes || []).filter(e => !e.grupo || !e.grupo.includes('2025')); // Filter out 2025
      const asistenciasHoy = asistencias || [];

      const asistMap: Record<string, string> = {};
      const groupsReportedToday = new Set<string>();
      const activeGroupsSet = new Set<string>();
      const reportedGroupsSet = new Set<string>();

      asistenciasHoy.forEach(a => {
        asistMap[a.estudiante_id] = a.estado;
        const student = estudiantes.find(e => e.id === a.estudiante_id);
        if (student && student.grupo) {
          reportedGroupsSet.add(student.grupo);
        }
      });

      // Let's optimize: map student id to group first
      const studentGroupMap: Record<string, string> = {};
      const activeGroups = new Set<string>();

      estudiantes.forEach(e => {
        if (e.grupo && (e.estado === 'activo' || e.estado === 'active')) {
          activeGroupsSet.add(e.grupo);
        }
      });


      // Guardar datos crudos para los modales
      setAllStudents(estudiantes);
      setAllAttendance(asistenciasHoy);

      // Cálculos globales
      const inactivos = estudiantes.filter(e => e.estado === 'inactivo');
      const activos = estudiantes.filter(e => e.estado === 'activo');

      const recibieron = asistenciasHoy.filter(a => a.estado === 'recibio').length;
      const noRecibieron = asistenciasHoy.filter(a => a.estado === 'no_recibio').length;

      // Ausentes: Activos que tienen record EXPLICITO como 'ausente'
      const ausentes = activos.filter(e => {
        const estadoAsist = asistMap[e.id];
        return estadoAsist === 'ausente';
      }).length;

      // Agregación por Grupos para Modales
      const groupAgg = {
        recibieron: {} as Record<string, number>,
        noRecibieron: {} as Record<string, number>,
        ausentes: {} as Record<string, number>,
        inactivos: {} as Record<string, number>
      };

      // Llenar inactivos por grupo
      inactivos.forEach(e => {
        groupAgg.inactivos[e.grupo] = (groupAgg.inactivos[e.grupo] || 0) + 1;
      });

      // Llenar recibieron por grupo
      asistenciasHoy.filter(a => a.estado === 'recibio').forEach(a => {
        const est = estudiantes.find(e => e.id === a.estudiante_id);
        if (est && est.grupo) groupAgg.recibieron[est.grupo] = (groupAgg.recibieron[est.grupo] || 0) + 1;
      });

      // Llenar no recibieron por grupo
      asistenciasHoy.filter(a => a.estado === 'no_recibio').forEach(a => {
        const est = estudiantes.find(e => e.id === a.estudiante_id);
        if (est && est.grupo) groupAgg.noRecibieron[est.grupo] = (groupAgg.noRecibieron[est.grupo] || 0) + 1;
      });

      // Llenar ausentes por grupo
      activos.forEach(e => {
        const estadoAsist = asistMap[e.id];
        if (estadoAsist === 'ausente') {
          groupAgg.ausentes[e.grupo] = (groupAgg.ausentes[e.grupo] || 0) + 1;
        }
      });

      // Calcular totales por grupo para porcentajes
      const totalByGroup: Record<string, number> = {};
      activos.forEach(e => {
        if (e.grupo) totalByGroup[e.grupo] = (totalByGroup[e.grupo] || 0) + 1;
      });

      const mapDetails = (agg: Record<string, number>) => {
        return Object.entries(agg).map(([grupo, count]) => {
          const total = totalByGroup[grupo] || 0;
          const percentage = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
          return { grupo, count, total, percentage };
        }).sort((a, b) => b.count - a.count);
      };

      // Calculate Pending Groups List
      const pendingGroupsList = Array.from(activeGroupsSet)
        .filter(g => !reportedGroupsSet.has(g))
        .map(g => {
          const count = estudiantes.filter(e => e.grupo === g).length;
          return { grupo: g, count, total: count, percentage: '0' };
        })
        .sort((a, b) => a.grupo.localeCompare(b.grupo));

      setStats({
        totalEstudiantes: estudiantes.length,
        activos: activos.length,
        inactivos: inactivos.length,
        recibieron,
        noRecibieron,
        ausentes,
        porcentajeAsistencia: activos.length > 0 ? ((recibieron / activos.length) * 100).toFixed(1) : '0',
        groupDetails: {
          recibieron: mapDetails(groupAgg.recibieron),
          noRecibieron: mapDetails(groupAgg.noRecibieron),
          ausentes: mapDetails(groupAgg.ausentes),
          inactivos: mapDetails(groupAgg.inactivos),
          pendientes: pendingGroupsList
        },
        pendingGroupsCount: activeGroupsSet.size - reportedGroupsSet.size,
        totalActiveGroups: activeGroupsSet.size
      });
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };



  useEffect(() => {
    // Escuchar cambios en tiempo real en la tabla de asistencia
    const channel = supabase
      .channel('attendance_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asistencia_pae'
        },
        () => {
          // Recargar estadísticas silenciosamente cuando hay cambios externos
          fetchStats(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const [stats, setStats] = useState<any>({
    totalEstudiantes: 0,
    activos: 0,
    inactivos: 0,
    recibieron: 0,
    noRecibieron: 0,
    ausentes: 0,
    porcentajeAsistencia: 0,

    groupDetails: { noRecibieron: [], ausentes: [], inactivos: [] },
    pendingGroupsCount: 0,
    totalActiveGroups: 0
  });

  const openGroupModal = (category: string) => {
    triggerLight(); // Haptic feedback on open
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
          nombre: e.nombre || 'Sin Nombre',
          estado: 'Inactivo',
          id: e.id,
          fecha: 'Estado Actual'
        }));
    } else if (category === 'recibieron') {
      records = allAttendance
        .filter(a => {
          const est = allStudents.find(e => e.id === a.estudiante_id);
          return est && est.grupo === grupo && a.estado === 'recibio';
        })
        .map(a => {
          const est = allStudents.find(e => e.id === a.estudiante_id);
          return {
            nombre: est?.nombre || 'Desconocido',
            estado: 'Recibió',
            id: a.estudiante_id,
            fecha: 'Hoy'
          };
        });
    } else if (category === 'noRecibieron') {
      records = allAttendance
        .filter(a => {
          const est = allStudents.find(e => e.id === a.estudiante_id);
          return est && est.grupo === grupo && a.estado === 'no_recibio';
        })
        .map(a => {
          const est = allStudents.find(e => e.id === a.estudiante_id);
          return {
            nombre: est?.nombre || 'Desconocido',
            estado: 'No Recibió',
            id: a.estudiante_id,
            fecha: 'Hoy'
          };
        });
    } else if (category === 'ausentes') {
      // Reconstruir el mapa de asistencia para filtrar
      const asistMap: Record<string, string> = {};
      allAttendance.forEach(a => asistMap[a.estudiante_id] = a.estado);

      records = allStudents
        .filter(e => e.grupo === grupo && e.estado === 'activo')
        .filter(e => {
          const estadoAsist = asistMap[e.id];
          return estadoAsist === 'ausente' || !estadoAsist;
        })
        .map(e => ({
          nombre: e.nombre,
          estado: asistMap[e.id] === 'ausente' ? 'Marcado Ausente' : 'Sin Registro',
          id: e.id,
          fecha: 'Hoy'
        }));
    }

    // Ordenar alfabéticamente
    records.sort((a, b) => a.nombre.localeCompare(b.nombre));

    setDeepDetailTitle(title);
    setDeepDetailData(records);
    setDeepDetailOpen(true);
  };

  if (!usuario) return null;

  // Render Secretaria/Operador Dashboard
  if (usuario.rol === 'secretaria_educacion' || usuario.rol === 'operador') {
    return <SecretariaDashboard usuario={usuario} />;
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
      <ScheduleModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
      />
      <WeeklyScheduleModal
        isOpen={weeklyModalOpen}
        onClose={() => setWeeklyModalOpen(false)}
      />
      <StatsDetailModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setDeepDetailOpen(false); // Reset deep detail on close to be safe
        }}
        category={modalCategory}
        data={modalData}
        deepDetailOpen={deepDetailOpen}
        deepDetailTitle={deepDetailTitle}
        deepDetailData={deepDetailData}
        onGroupSelect={openDeepDetail}
        onBackToSummary={() => setDeepDetailOpen(false)}
      />

      {/* Dynamic Notification */}
      {notif && (
        <div className={`mb-4 p-4 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-300 ${notif.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300' : 'bg-red-50 border border-red-100 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300'
          }`}>
          <div className="flex items-center gap-3">
            {notif.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">{notif.msg}</span>
          </div>
          <button onClick={() => setNotif(null)} className="opacity-50 hover:opacity-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Alerta de actualización de estudiantes - Solo para Admin */}
      {usuario?.rol === 'admin' && (() => {
        const lastUpdateStr = localStorage.getItem('lastStudentListUpdate');
        const lastUpdate = lastUpdateStr ? new Date(lastUpdateStr) : null;
        const now = new Date();
        const daysSinceUpdate = lastUpdate ? Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)) : null;
        const shouldShowAlert = !lastUpdate || daysSinceUpdate === null || daysSinceUpdate >= 14;

        if (shouldShowAlert) {
          return (
            <div className="mb-4 p-4 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-300 bg-orange-50 border border-orange-200 text-orange-800 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-300">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-sm font-medium">
                    Recuerda actualizar la lista de estudiantes. Última actualización: {lastUpdate ? lastUpdate.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Nunca'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => router.push('/dashboard/gestion')}
                className="ml-4 px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold transition-colors active:scale-95"
              >
                Ir a Gestión
              </button>
            </div>
          );
        }
        return null;
      })()}

      {/* Header Image */}
      <div className="mb-4 -mx-4 lg:mx-0">
        <div className="h-40 md:h-64 relative overflow-hidden lg:rounded-2xl shadow-md border border-white/20">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: 'url("/hero-cafeteria.jpg")' }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
          </div>
          <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
            <span className="text-[10px] font-black text-white tracking-widest uppercase">Versión v1.5</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 text-white pb-6">
            <h1 className="text-2xl md:text-4xl font-black leading-tight mb-2 tracking-tight">
              Sistema PAE Barroblanco
            </h1>
            <p className="text-xs md:text-lg text-gray-200 opacity-95 max-w-2xl leading-relaxed font-medium">
              Gestión integral y seguimiento del Programa de Alimentación Escolar en tiempo real.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => { triggerMedium(); setScheduleModalOpen(true); }}
          className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 px-4 flex flex-row items-center justify-center gap-3 font-bold shadow-lg shadow-orange-200 transition-all active:scale-95 group"
        >
          <div className="bg-white/20 p-1.5 rounded-lg group-hover:rotate-12 transition-transform">
            <Calendar className="w-5 h-5" />
          </div>
          <span className="text-sm md:text-base leading-none">Horario Restaurante</span>
        </button>

        <button
          onClick={() => { triggerMedium(); setWeeklyModalOpen(true); }}
          className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl py-3 px-4 flex flex-row items-center justify-center gap-3 font-bold shadow-lg shadow-cyan-200 transition-all active:scale-95 group"
        >
          <div className="bg-white/20 p-1.5 rounded-lg group-hover:rotate-12 transition-transform">
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-sm md:text-base leading-none">Horario Semanal</span>
        </button>
      </div>


      {/* Statistics */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Estadísticas de Hoy</h3>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            ACTUALIZADO EN VIVO
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Total Estudiantes */}
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-white/10 relative overflow-hidden flex flex-col justify-between h-full group animate-card-mix"
            style={{ animationDelay: '0.1s' }}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-2xl md:text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1 dark:bg-gray-700" />
                  ) : (
                    <AnimatedNumber value={stats.totalEstudiantes} />
                  )}
                </div>
                <div className="text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-wider">TOTAL</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-xl">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="text-[10px] text-blue-400 dark:text-blue-300 font-bold">
              {stats.activos} Activos
            </div>
          </div>

          {/* Recibieron */}
          <button
            onClick={() => openGroupModal('recibieron')}
            disabled={stats.recibieron === 0}
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-white/10 relative overflow-hidden flex flex-col justify-between h-full group hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-50 dark:hover:shadow-emerald-900/10 transition-all text-left animate-card-mix"
            style={{ animationDelay: '0.35s' }}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-2xl md:text-3xl font-black text-emerald-500 dark:text-emerald-400 tracking-tighter">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1 dark:bg-gray-700" />
                  ) : (
                    <AnimatedNumber value={stats.recibieron} />
                  )}
                </div>
                <div className="text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-wider">RECIBIERON</div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                <CheckCircle className="w-5 h-5 text-emerald-500 dark:text-emerald-400 group-hover:text-white transition-colors" />
              </div>
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              {stats.porcentajeAsistencia}% - Ver detalle <Info className="w-3 h-3" />
            </div>
          </button>

          {/* No Recibieron */}
          <button
            onClick={() => openGroupModal('noRecibieron')}
            disabled={stats.noRecibieron === 0}
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-white/10 relative overflow-hidden flex flex-col justify-between h-full group hover:border-amber-400 dark:hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-50 dark:hover:shadow-amber-900/10 transition-all text-left animate-card-mix"
            style={{ animationDelay: '0.6s' }}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-2xl md:text-3xl font-black text-amber-500 dark:text-amber-400 tracking-tighter">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1 dark:bg-gray-700" />
                  ) : (
                    <AnimatedNumber value={stats.noRecibieron} />
                  )}
                </div>
                <div className="text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-wider">NO RECIBIERON</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded-xl group-hover:bg-amber-500 group-hover:text-white transition-colors duration-300">
                <XCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 group-hover:text-white transition-colors" />
              </div>
            </div>
            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
              Ver grupos <Info className="w-3 h-3" />
            </div>
          </button>

          {/* No Asistieron (Ausentes) */}
          <button
            onClick={() => openGroupModal('ausentes')}
            disabled={stats.ausentes === 0}
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-white/10 relative overflow-hidden flex flex-col justify-between h-full group hover:border-rose-400 dark:hover:border-rose-500/50 hover:shadow-lg hover:shadow-rose-50 dark:hover:shadow-rose-900/10 transition-all text-left animate-card-mix"
            style={{ animationDelay: '0.85s' }}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-2xl md:text-3xl font-black text-rose-500 dark:text-rose-400 tracking-tighter">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1 dark:bg-gray-700" />
                  ) : (
                    <AnimatedNumber value={stats.ausentes} />
                  )}
                </div>
                <div className="text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-wider">NO ASISTIERON</div>
              </div>
              <div className="bg-rose-50 dark:bg-rose-900/20 p-2 rounded-xl group-hover:bg-rose-500 group-hover:text-white transition-colors duration-300">
                <UserX className="w-5 h-5 text-rose-500 dark:text-rose-400 group-hover:text-white transition-colors" />
              </div>
            </div>
            <div className="text-[10px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
              Ver grupos <Info className="w-3 h-3" />
            </div>
          </button>

          {/* Tarjeta Grupos Pendientes */}
          <button
            onClick={() => openGroupModal('pendientes')}
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-white/10 relative overflow-hidden flex flex-col justify-between h-full group hover:border-orange-400 dark:hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-50 dark:hover:shadow-orange-900/10 transition-all text-left animate-card-mix"
            style={{ animationDelay: '1.1s' }}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-2xl md:text-3xl font-black text-orange-500 dark:text-orange-400 tracking-tighter">
                   {loading ? <Skeleton className="h-8 w-16 dark:bg-gray-700" /> : <AnimatedNumber value={stats.pendingGroupsCount} />}
                </div>
                <div className="text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-wider">GRUPOS PENDIENTES</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded-xl group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
                <Clock className="w-5 h-5 text-orange-500 dark:text-orange-400 group-hover:text-white transition-colors" />
              </div>
            </div>
            <div className="text-[10px] text-orange-400 dark:text-orange-300 font-bold">
              {stats.totalActiveGroups > 0 ? ((stats.pendingGroupsCount / stats.totalActiveGroups) * 100).toFixed(0) : 0}% sin reportar
            </div>
          </button>

          {/* Inactivos (Renunciaron) */}
          <button
            onClick={() => openGroupModal('inactivos')}
            disabled={stats.inactivos === 0}
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-white/10 relative overflow-hidden flex flex-col justify-between h-full group hover:border-blue-400 dark:hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-50 dark:hover:shadow-blue-900/10 transition-all text-left animate-card-mix"
            style={{ animationDelay: '1.35s' }}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-2xl md:text-3xl font-black text-gray-700 dark:text-gray-200 tracking-tighter">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1 dark:bg-gray-700" />
                  ) : (
                    <AnimatedNumber value={stats.inactivos} />
                  )}
                </div>
                <div className="text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-wider">INACTIVOS</div>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                <UserMinus className="w-5 h-5 text-gray-400 dark:text-gray-400 group-hover:text-white transition-colors" />
              </div>
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-bold flex items-center gap-1">
              Ver detalles <Info className="w-3 h-3" />
            </div>
          </button>


        </div>
      </div>

      {/* Roadmap / Updates Section */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Improved Features (Public) */}
        <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-900/30 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 dark:bg-indigo-900/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Funciones Mejoradas</h3>
            </div>

            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500"></div>
                <div>
                  <span className="font-bold text-gray-900 dark:text-white">Detección de Cruces:</span> Alertas inteligentes en Novedades y Horario si el bloque coincide con la semana pasada.
                </div>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500"></div>
                <div>
                  <span className="font-bold text-gray-900 dark:text-white">Optimización PWA:</span> Soporte completo para instalación en móviles y persistencia de sesión.
                </div>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500"></div>
                <div>
                  <span className="font-bold text-gray-900 dark:text-white">Footer Institucional:</span> Información de contacto y address integrada en PDF y vistas.
                </div>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500"></div>
                <div>
                  <span className="font-bold text-gray-900 dark:text-white">Modo Oscuro Pro:</span> Consistencia visual y adaptativa en todas las vistas del sistema.
                </div>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500"></div>
                <div>
                  <span className="font-bold text-gray-900 dark:text-white">Reportes Premium:</span> Generación de reportes PDF y Excel con filtros avanzados por sede.
                </div>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500"></div>
                <div>
                  <span className="font-bold text-gray-900 dark:text-white">Centro de Novedades:</span> Gestión centralizada de eventos institucionales y faltas alimentarias.
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Card 2: Upcoming (Public) */}
        <div className="bg-gradient-to-br from-fuchsia-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 border border-fuchsia-100 dark:border-fuchsia-900/30 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-100 dark:bg-fuchsia-900/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-fuchsia-100 dark:bg-fuchsia-900/50 rounded-lg text-fuchsia-600 dark:text-fuchsia-400">
                <Rocket className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Próximas Actualizaciones</h3>
            </div>

            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse"></div>
                <div>
                  <span className="font-bold text-gray-900 dark:text-white">Biometría Real:</span> Login directo con huella dactilar y FaceID nativo.
                </div>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                <div>
                  <span className="font-bold text-gray-900 dark:text-white">Pasarela de Pagos:</span> Módulo para gestión de recaudos y pagos en línea.
                </div>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                <div>
                  <span className="font-bold text-gray-900 dark:text-white">Multi-Sede:</span> Arquitectura para soportar múltiples instituciones educativas.
                </div>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                <div>
                  <span className="font-bold text-gray-900 dark:text-white">Mensajería Push:</span> Notificaciones en tiempo real y chat institucional.
                </div>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                <div>
                  <span className="font-bold text-gray-900 dark:text-white">Perfil & Configuración:</span> Gestión avanzada de cuenta, eliminación y personalización de la app.
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer / Credits */}
      <div className="mt-8 text-center">
        <button
          onClick={() => setCreditsOpen(true)}
          className="text-[10px] text-blue-400 font-bold uppercase tracking-widest hover:text-cyan-600 transition-colors"
        >
          © 2026 PAE Barroblanco - Versión Académica SENA
        </button>
      </div>

      {/* Credits Modal */}
      {creditsOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setCreditsOpen(false)}></div>
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-8 max-w-md relative animate-in zoom-in-95 duration-200 shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-500 to-blue-600"></div>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-cyan-50 dark:bg-cyan-900/30 rounded-2xl mx-auto flex items-center justify-center mb-4 text-cyan-600 dark:text-cyan-400">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Créditos y Autoría</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Información Legal</p>
            </div>

            <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-white/5">
              <p>
                <span className="font-bold text-gray-900 dark:text-white">Autor:</span> Luis Fernando Alzate Lopez
              </p>
              <p className="text-justify text-xs">
                "El presente desarrollo de software, denominado Sistema PAE Barroblanco, es una obra original de Luis Fernando Alzate Lopez. Si bien los derechos patrimoniales se rigen por el reglamento del SENA/Secretaría de Educación, el autor se reserva de forma permanente e irrenunciable los derechos morales sobre la obra (Art. 30, Ley 23 de 1982)."
              </p>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-[10px] uppercase font-bold text-gray-400">Nota sobre Propiedad Intelectual</p>
                <p className="text-[10px] mt-1 text-justify">
                  Cualquier versión posterior, mejora incremental o software derivado desarrollado fuera del marco institucional, constituirá una propiedad intelectual distinta y autónoma.
                </p>
                <p className="text-[10px] uppercase font-bold text-gray-400">Exclusividad de la Evolución Tecnológica:</p>
                <p className="text-[10px] mt-1 text-justify">
                  Se hace constar que el código fuente base, la lógica de negocio y la arquitectura del sistema son propiedad del autor. Cualquier evolución, producto derivado o versión comercial que sea desarrollada por Luis Fernando Alzate Lopez fuera de este contrato, es 100% de su propiedad intelectual independiente y autónoma.
<br />No se autoriza el uso de este código base por terceros fuera de la institución asignada.
                </p>
                
              </div>
            </div>

            <button
              onClick={() => setCreditsOpen(false)}
              className="mt-6 w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black dark:hover:bg-gray-200 transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>

  );
}
