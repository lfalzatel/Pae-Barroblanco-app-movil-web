'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface MiniCalendarProps {
    selectedDate: string;
    onSelectDate: (date: string) => void;
    className?: string;
    highlightedDates?: string[]; // Optional: provide dates to highlight externally
    mode?: 'schedules' | 'attendance' | 'manual'; // Default is schedules
    onMonthChange?: (year: number, month: number) => void;
}

const toLocalISO = (d: Date) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

export function MiniCalendar({
    selectedDate,
    onSelectDate,
    className = '',
    highlightedDates: externalDates,
    mode = 'schedules',
    onMonthChange
}: MiniCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date(selectedDate));
    const [internalDates, setInternalDates] = useState<string[]>([]);
    const [loading, setLoading] = useState(mode === 'schedules');

    useEffect(() => {
        if (onMonthChange) {
            onMonthChange(currentDate.getFullYear(), currentDate.getMonth());
        }
    }, [currentDate.getMonth(), currentDate.getFullYear()]);

    useEffect(() => {
        if (mode === 'schedules') {
            fetchSchedules();
        } else {
            setLoading(false);
        }
    }, [currentDate.getMonth(), currentDate.getFullYear(), mode]);

    const fetchSchedules = async () => {
        setLoading(true);
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();

            const startStr = toLocalISO(new Date(year, month, 1));
            const endStr = toLocalISO(new Date(year, month + 1, 0));

            const { data } = await supabase
                .from('schedules')
                .select('date')
                .gte('date', startStr)
                .lte('date', endStr);

            if (data) {
                setInternalDates(data.map(d => d.date));
            }
        } catch (error) {
            console.error('Error fetching dates:', error);
        } finally {
            setLoading(false);
        }
    };

    const activeDates = mode === 'manual' || mode === 'attendance' ? (externalDates || []) : internalDates;

    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year: number, month: number) => {
        return new Date(year, month, 1).getDay();
    };

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const generateIsoDate = (day: number) => {
        return `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    };

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const highlightColor = mode === 'attendance' ? 'emerald' : mode === 'schedules' ? 'emerald' : 'blue';

    return (
        <div className={`bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-full ${className}`}>
            <div className="flex items-center justify-between mb-4 px-2">
                <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="font-bold text-gray-900 capitalize text-sm">
                    {monthNames[month]} {year}
                </div>
                <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
                {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(d => (
                    <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase">
                        {d}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-2 justify-items-center relative">
                {loading && (
                    <div className="absolute inset-0 z-20 bg-white/50 backdrop-blur-[1px] flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                )}
                {days.map((day, idx) => {
                    if (!day) return <div key={idx} className="w-full aspect-square" />;

                    const dateStr = generateIsoDate(day);
                    const isSelected = selectedDate === dateStr;
                    const hasData = activeDates.includes(dateStr);
                    const isToday = dateStr === toLocalISO(new Date());

                    return (
                        <button
                            key={idx}
                            onClick={() => onSelectDate(dateStr)}
                            className={`
                                relative w-full aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-bold transition-all duration-200
                                ${isSelected
                                    ? 'bg-blue-600 text-white shadow-md scale-105 z-10'
                                    : hasData
                                        ? `bg-${highlightColor}-50 text-${highlightColor}-700 hover:bg-${highlightColor}-100 border border-${highlightColor}-100`
                                        : 'text-gray-700 hover:bg-gray-50 border border-transparent hover:border-gray-100'}
                                ${isToday && !isSelected ? 'ring-2 ring-blue-600 border-transparent text-blue-600' : ''}
                            `}
                        >
                            <span className={isSelected || hasData ? 'text-lg' : 'text-base'}>{day}</span>
                            {hasData && !isSelected && (
                                <div className={`absolute bottom-1 w-1.5 h-1.5 rounded-full bg-${highlightColor}-500`}></div>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-gray-400 border-t border-gray-100 pt-3">
                <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full bg-${highlightColor}-500`}></div>
                    <span>{mode === 'attendance' ? 'Con Asistencia' : mode === 'schedules' ? 'Con Horario' : 'Registrado'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full ring-1 ring-blue-600"></div>
                    <span>Hoy</span>
                </div>
            </div>
        </div>
    );
}
