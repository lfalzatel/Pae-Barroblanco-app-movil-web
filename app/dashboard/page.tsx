'use client';


import { useEffect, useState } from 'react';
import ScheduleModal from '../../components/ScheduleModal';
import WeeklyScheduleModal from '../../components/WeeklyScheduleModal';
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
  Clock
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import * as XLSX from 'xlsx';

export default function DashboardPage() {
  const router = useRouter();
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

      setStats({
        totalEstudiantes: estudiantes.length,
        activos: activos.length,
        inactivos: inactivos.length,
        recibieron,
        noRecibieron,
        ausentes,
        porcentajeAsistencia: activos.length > 0 ? (((activos.length - ausentes) / activos.length) * 100).toFixed(1) : '0',
        groupDetails: {
          recibieron: mapDetails(groupAgg.recibieron),
          noRecibieron: mapDetails(groupAgg.noRecibieron),
          ausentes: mapDetails(groupAgg.ausentes),
          inactivos: mapDetails(groupAgg.inactivos)
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

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
      {/* Modal de Detalle por Grupo (Nivel 1) */}
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

      <ScheduleModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
      />

      {/* Modal de Horario Semanal */}
      <WeeklyScheduleModal
        isOpen={weeklyModalOpen}
        onClose={() => setWeeklyModalOpen(false)}
      />

      {/* Modal Premium de Detalle Estudiante (Nivel 2) */}
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
                <h3 className="font-black text-gray-900 leading-tight truncate max-w-[200px]">{deepDetailTitle}</h3>
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
                      <p className="text-xs text-gray-500 mt-1">{item.estado}</p>
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

      {/* Dynamic Notification */}
      {notif && (
        <div className={`mb-4 p-4 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-300 ${notif.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' : 'bg-red-50 border border-red-100 text-red-800'
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
          onClick={() => setScheduleModalOpen(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 px-4 flex flex-row items-center justify-center gap-3 font-bold shadow-lg shadow-orange-200 transition-all active:scale-95 group"
        >
          <div className="bg-white/20 p-1.5 rounded-lg group-hover:rotate-12 transition-transform">
            <Calendar className="w-5 h-5" />
          </div>
          <span className="text-sm md:text-base leading-none">Horario Restaurante</span>
        </button>

        <button
          onClick={() => setWeeklyModalOpen(true)}
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
          <h3 className="text-xl font-black text-gray-900 tracking-tight">Estadísticas de Hoy</h3>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-1 rounded-md flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            ACTUALIZADO EN VIVO
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Total Estudiantes */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group">
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
              {stats.activos} Activos
            </div>
          </div>

          {/* Recibieron */}
          {/* Recibieron */}
          <button
            onClick={() => openGroupModal('recibieron')}
            disabled={stats.recibieron === 0}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-50 transition-all text-left"
          >
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
              <div className="bg-emerald-50 p-2 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                <CheckCircle className="w-5 h-5 text-emerald-500 group-hover:text-white transition-colors" />
              </div>
            </div>
            <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
              {stats.porcentajeAsistencia}% - Ver detalle <Info className="w-3 h-3" />
            </div>
          </button>

          {/* No Recibieron */}
          <button
            onClick={() => openGroupModal('noRecibieron')}
            disabled={stats.noRecibieron === 0}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group hover:border-amber-400 hover:shadow-lg hover:shadow-amber-50 transition-all text-left"
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
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group hover:border-rose-400 hover:shadow-lg hover:shadow-rose-50 transition-all text-left"
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
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group hover:border-blue-400 hover:shadow-lg hover:shadow-blue-50 transition-all text-left"
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


          {/* Pending Groups - New Card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-full group">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-2xl md:text-3xl font-black text-orange-500 tracking-tighter">
                  {loading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    stats.pendingGroupsCount
                  )}
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
        </div>
      </div>
    </div>
  );
}
