'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface MiniCalendarProps {
    selectedDate: string;
    onSelectDate: (date: string) => void;
    className?: string;
}

export function MiniCalendar({ selectedDate, onSelectDate, className = '' }: MiniCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date()); // For month view navigation
    const [assignedDates, setAssignedDates] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAssignedDates();
    }, [currentDate.getMonth(), currentDate.getFullYear()]);

    const fetchAssignedDates = async () => {
        setLoading(true);
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();

            const toLocalISO = (d: Date) => {
                const offset = d.getTimezoneOffset() * 60000;
                return new Date(d.getTime() - offset).toISOString().split('T')[0];
            };

            const startStr = toLocalISO(new Date(year, month, 1));
            const endStr = toLocalISO(new Date(year, month + 1, 0));

            const { data } = await supabase
                .from('schedules')
                .select('date')
                .gte('date', startStr)
                .lte('date', endStr);

            if (data) {
                setAssignedDates(data.map(d => d.date));
            }
        } catch (error) {
            console.error('Error fetching dates:', error);
        } finally {
            setLoading(false);
        }
    };

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
    const firstDay = getFirstDayOfMonth(year, month); // 0 = Sunday

    // Adjust for Monday start if desired, but sticking to standard Sunday=0 for simplicity usually, 
    // but maybe user prefers Monday. Let's stick to standard 0-6.

    const days = [];
    // Padding
    for (let i = 0; i < firstDay; i++) {
        days.push(null);
    }
    // Days
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }

    const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const generateIsoDate = (day: number) => {
        return `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-full max-w-[320px] ${className}`}>
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

            <div className="grid grid-cols-7 gap-1 justify-items-center">
                {days.map((day, idx) => {
                    if (!day) return <div key={idx} className="w-8 h-8" />;

                    const dateStr = generateIsoDate(day);
                    const isSelected = selectedDate === dateStr;
                    const hasSchedule = assignedDates.includes(dateStr);
                    const isToday = dateStr === new Date().toISOString().split('T')[0];

                    return (
                        <button
                            key={idx}
                            onClick={() => onSelectDate(dateStr)}
                            className={`
                                relative w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200
                                ${isSelected
                                    ? 'bg-blue-600 text-white shadow-md scale-105'
                                    : hasSchedule
                                        ? 'bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100'
                                        : 'text-gray-700 hover:bg-gray-100'}
                                ${isToday && !isSelected ? 'ring-1 ring-blue-600 text-blue-600 font-bold' : ''}
                            `}
                        >
                            {day}
                            {hasSchedule && !isSelected && (
                                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500"></div>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-gray-400 border-t border-gray-100 pt-3">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <span>Con Horario</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full ring-1 ring-blue-600"></div>
                    <span>Hoy</span>
                </div>
            </div>
        </div>
    );
}
