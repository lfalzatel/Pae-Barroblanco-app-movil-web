'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useModalBack } from '@/hooks/useModalBack';
import { User, Star, X, Calendar, Clock, Users, ChevronLeft, ChevronRight } from 'lucide-react';

interface DocenteActivityModalProps {
  docente: {
    id: string;
    nombre: string;
    avatar_url?: string | null;
    puntos_gestor_pae?: number;
  } | null;
  onClose: () => void;
}

export default function DocenteActivityModal({ docente, onClose }: DocenteActivityModalProps) {
  const [docenteHistory, setDocenteHistory] = useState<any[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDateActivity, setSelectedDateActivity] = useState<any | null>(null);
  const [monthlyStars, setMonthlyStars] = useState<number | null>(null);

  useModalBack(!!docente, onClose, 'teacher-activity-modal');
  useModalBack(!!selectedDateActivity, () => setSelectedDateActivity(null), 'teacher-activity-detail-modal');

  // Cargar puntos de estrellas dinámicamente según el mes seleccionado en el calendario
  useEffect(() => {
    const fetchMonthlyStars = async () => {
      if (!docente) return;

      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();

      const startOfMonth = new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0];
      const endOfMonth = new Date(Date.UTC(year, month + 1, 0)).toISOString().split('T')[0];

      try {
        const { data, error } = await supabase
          .from('puntos_pae_historial')
          .select('puntos')
          .eq('usuario_id', docente.id)
          .gte('fecha', startOfMonth)
          .lte('fecha', endOfMonth);

        if (!error && data) {
          const total = data.reduce((sum, p) => sum + (p.puntos || 0), 0);
          setMonthlyStars(total);
        } else {
          setMonthlyStars(docente.puntos_gestor_pae || 0);
        }
      } catch (err) {
        console.error('Error fetching monthly stars:', err);
        setMonthlyStars(docente.puntos_gestor_pae || 0);
      }
    };

    fetchMonthlyStars();
  }, [docente, currentMonth]);

  useEffect(() => {
    const fetchDocenteHistory = async () => {
      if (!docente) return;
      setCurrentMonth(new Date());

      try {
        const { data, error } = await supabase
          .from('asistencia_pae')
          .select(`
            fecha,
            created_at,
            estudiantes!inner(grupo, grado)
          `)
          .eq('registrado_por', docente.id)
          .order('fecha', { ascending: false });

        if (error) throw error;

        const dailyActivity: Record<string, {
          grupos: Map<string, { name: string, badge: string, count: number, timestamp: string }>,
          total: number
        }> = {};

        data?.forEach((a: any) => {
          if (!dailyActivity[a.fecha]) {
            dailyActivity[a.fecha] = {
              grupos: new Map(),
              total: 0
            };
          }
          
          const rawGrupo = (a.estudiantes?.grupo || 'Sin grupo').trim().toUpperCase();
          const gradoBadge = (a.estudiantes?.grado && a.estudiantes.grado.length <= 3) 
            ? a.estudiantes.grado 
            : rawGrupo.replace(/[^0-9]/g, '') || rawGrupo.slice(0, 2);

          const groupKey = rawGrupo;
          const currentData = dailyActivity[a.fecha].grupos.get(groupKey) || { 
            name: rawGrupo,
            badge: gradoBadge,
            count: 0, 
            timestamp: a.created_at 
          };

          const olderTimestamp = new Date(currentData.timestamp) < new Date(a.created_at) ? currentData.timestamp : a.created_at;

          dailyActivity[a.fecha].grupos.set(groupKey, {
            name: rawGrupo,
            badge: gradoBadge,
            count: currentData.count + 1,
            timestamp: olderTimestamp
          });
          dailyActivity[a.fecha].total += 1;
        });

        const historyArray = Object.entries(dailyActivity).map(([fecha, activity]) => {
          return {
            fecha,
            grupos: Array.from(activity.grupos.values())
              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
            total: activity.total
          };
        });

        setDocenteHistory(historyArray);
      } catch (error) {
        console.error('Error fetching teacher history:', error);
        setDocenteHistory([]);
      }
    };

    fetchDocenteHistory();
  }, [docente]);

  if (!docente) return null;

  const currentStarsDisplay = monthlyStars !== null ? monthlyStars : (docente.puntos_gestor_pae || 0);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[10000] animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white rounded-[2.5rem] max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 md:p-8 bg-gradient-to-br from-cyan-600 to-cyan-700 text-white relative shrink-0">
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-start gap-4 flex-1">
              {docente.avatar_url ? (
                <img src={docente.avatar_url} referrerPolicy="no-referrer" className="w-16 h-16 rounded-2xl border-2 border-white/30 shadow-xl object-cover shrink-0" alt={docente.nombre} />
              ) : (
                <div className="bg-white/20 p-4 rounded-2xl border border-white/10 shadow-inner flex items-center justify-center min-w-[64px] min-h-[64px] shrink-0">
                  <User className="w-8 h-8" />
                </div>
              )}
              <div className="flex-1 flex flex-col justify-center min-h-[64px]">
                <div className="flex items-start gap-3 flex-wrap">
                  <h3 className="font-black text-xl md:text-2xl tracking-tight leading-none uppercase break-words">{docente.nombre}</h3>
                  <span className="flex items-center gap-1 bg-amber-400 text-amber-950 text-xs font-black px-2.5 py-1 rounded-full shadow-sm shrink-0">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {currentStarsDisplay}
                  </span>
                </div>
                <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] opacity-80 mt-1.5 text-cyan-50">Registro de Actividad Administrativa</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-8 bg-white custom-scrollbar-premium dark:bg-gray-800">
          {/* Vista de Calendario (Mapa de Productividad) */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-600" />
                Mapa de Productividad
              </h4>
              <div className="flex items-center gap-3">
                <button 
                   onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                   className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg hover:bg-white transition-colors dark:bg-gray-700 dark:border-gray-600"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                </button>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest min-w-[100px] text-center dark:text-gray-300">
                  {currentMonth.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                </span>
                <button 
                   onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                   className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg hover:bg-white transition-colors dark:bg-gray-700 dark:border-gray-600"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                </button>
              </div>
            </div>

            <div className="bg-gray-50/50 p-5 rounded-[2rem] border border-gray-100/50 shadow-inner dark:bg-gray-900/50 dark:border-gray-700/50">
              {/* Encabezados de días */}
              <div className="grid grid-cols-7 gap-1.5 mb-3">
                {['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'].map(day => (
                  <div key={day} className="text-center text-[9px] font-black text-gray-300 tracking-tighter">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {(() => {
                  const year = currentMonth.getFullYear();
                  const month = currentMonth.getMonth();
                  const firstDay = new Date(year, month, 1);
                  const lastDay = new Date(year, month + 1, 0);
                  
                  const days = [];
                  let startDayOfWeek = firstDay.getDay(); 
                  let leadingEmpty = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

                  for (let i = 0; i < leadingEmpty; i++) {
                    days.push(null);
                  }
                  for (let i = 1; i <= lastDay.getDate(); i++) {
                    days.push(new Date(year, month, i));
                  }

                  return days.map((d, i) => {
                    if (!d) return <div key={`doc-empty-${i}`} className="aspect-square"></div>;

                    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    const todayStr = new Date().toISOString().split('T')[0];
                    const record = docenteHistory.find(r => r.fecha === dateStr);
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const isFuture = dateStr > todayStr;

                    return (
                      <button
                        key={dateStr}
                        onClick={() => record && setSelectedDateActivity(record)}
                        disabled={!record}
                        title={dateStr + (record ? ` - ${record.total} registros` : '')}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center border transition-all duration-300
                    ${isFuture ? 'opacity-10 bg-gray-100 border-transparent cursor-default dark:bg-gray-700' :
                            record
                              ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-100 active:scale-95 cursor-pointer'
                              : isWeekend
                                ? 'bg-gray-100 border-transparent text-gray-300 dark:bg-gray-700/50 dark:text-gray-500'
                                : 'bg-white border-gray-100 text-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-500'
                          }
                      `}
                      >
                        <span className={`text-[10px] font-black ${record ? 'text-white' : ''}`}>
                          {d.getDate()}
                        </span>
                        {record && (
                          <span className="text-[8px] font-black opacity-70 mt-0.5 leading-none">
                            {record.total}
                          </span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Sesiones de Registro */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Sesiones de Registro</h4>
            <div className="space-y-3">
              {docenteHistory.map((h, i) => (
                <div key={i} className="p-5 bg-gradient-to-br from-white to-gray-50/30 border border-gray-100 rounded-[2rem] shadow-sm hover:shadow-md hover:border-cyan-100 transition-all group dark:from-gray-800 dark:to-gray-900 dark:border-gray-700">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-cyan-50 p-2 rounded-xl group-hover:bg-cyan-100 transition-colors dark:bg-cyan-900/20">
                        <Calendar className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <span className="text-sm font-black text-gray-700 capitalize dark:text-gray-200">{new Date(h.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}</span>
                    </div>
                    <span className="text-[10px] font-black bg-white border border-gray-100 text-cyan-600 px-3 py-1 rounded-full uppercase tracking-widest dark:bg-gray-700 dark:border-gray-600 dark:text-cyan-400">{h.grupos.length} {h.grupos.length === 1 ? 'Grupo' : 'Grupos'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {h.grupos.map((g: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-xs dark:bg-gray-700 dark:border-gray-600">
                        <span className="text-[10px] font-black text-gray-900 dark:text-gray-200">{g.name}</span>
                        <div className="w-px h-2 bg-gray-200 dark:bg-gray-600"></div>
                        <span className="text-[9px] font-bold text-cyan-500 uppercase dark:text-cyan-400">{g.count} REG</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {docenteHistory.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm italic">No se encontraron registros de actividad para este docente</div>
              )}
            </div>
          </div>
        </div>

        {/* Modal de Segundo Nivel: Bitácora de Sesión del Día */}
        {selectedDateActivity && (
          <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedDateActivity(null)}>
            <div
              className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300 custom-scrollbar-premium dark:bg-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 bg-gradient-to-br from-cyan-600 to-cyan-700 text-white flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-white/50 uppercase tracking-widest leading-none mb-1.5">Bitácora de Sesión</p>
                  <h3 className="text-lg font-black capitalize leading-none tracking-tight">
                    {new Date((selectedDateActivity?.fecha || '') + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDateActivity(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="p-8 space-y-8 bg-white dark:bg-gray-800">
                <div>
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2 px-1">
                    <Users className="w-4 h-4 text-cyan-500" />
                    Grupos Atendidos en esta Fecha
                  </h4>
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar-premium">
                    {selectedDateActivity?.grupos.map((g: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-2xl group transition-all duration-300 hover:bg-white hover:border-cyan-100 dark:bg-gray-700/30 dark:border-gray-600/30 dark:hover:bg-gray-700">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-cyan-600 text-xs text-transform uppercase border border-cyan-50 group-hover:bg-cyan-600 group-hover:text-white transition-colors duration-300 dark:bg-gray-700 dark:border-gray-600 dark:text-cyan-400">
                            {g.badge || g.name}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-gray-700 text-sm leading-none mb-1.5 uppercase tracking-tighter dark:text-gray-200">Grupo {g.name}</span>
                            <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1.5 uppercase">
                              <Clock className="w-3 h-3 text-cyan-400" />
                              {new Date(g.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-black text-gray-900 leading-none mb-1 dark:text-white">
                            {g.count}
                          </span>
                          <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest dark:text-gray-500">REG</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
