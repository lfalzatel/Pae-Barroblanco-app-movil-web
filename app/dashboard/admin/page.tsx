'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
    ArrowLeft,
    Settings,
    Users,
    Edit3,
    ArrowRightLeft,
    ShieldAlert,
    Search,
    School,
    CheckCircle,
    UserX
} from 'lucide-react';
import Link from 'next/link';

interface Estudiante {
    id: string;
    nombre: string;
    matricula: string;
    grado: string;
    grupo: string;
    sede: string;
    estado?: string;
}

export default function AdminPage() {
    const router = useRouter();
    const [usuario, setUsuario] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
    const [targetGrupo, setTargetGrupo] = useState('');
    const [allGrupos, setAllGrupos] = useState<string[]>([]);
    const [renamingGrupo, setRenamingGrupo] = useState({ oldName: '', newName: '' });
    const [activeTab, setActiveTab] = useState<'move' | 'rename' | 'status'>('move');

    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session || session.user.user_metadata?.rol !== 'admin') {
                router.push('/dashboard');
                return;
            }
            setUsuario(session.user);
            fetchData();
        };
        checkAdmin();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('estudiantes')
                .select('*')
                .order('nombre');

            if (error) throw error;
            setEstudiantes(data || []);

            const grupos = Array.from(new Set((data || []).map(e => e.grupo))).sort();
            setAllGrupos(grupos as string[]);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMoveStudents = async () => {
        if (selectedStudents.length === 0 || !targetGrupo) return;

        if (!confirm(`¿Mover ${selectedStudents.length} estudiantes al grupo ${targetGrupo}?`)) return;

        try {
            const { error } = await supabase
                .from('estudiantes')
                .update({ grupo: targetGrupo })
                .in('id', selectedStudents);

            if (error) throw error;

            alert('Estudiantes movidos con éxito');
            setSelectedStudents([]);
            fetchData();
        } catch (error) {
            console.error('Error moving students:', error);
            alert('Error al mover estudiantes');
        }
    };

    const handleRenameGroup = async () => {
        if (!renamingGrupo.oldName || !renamingGrupo.newName) return;

        if (!confirm(`¿Renombrar el grupo "${renamingGrupo.oldName}" a "${renamingGrupo.newName}" para TODOS los estudiantes?`)) return;

        try {
            const { error } = await supabase
                .from('estudiantes')
                .update({ grupo: renamingGrupo.newName })
                .eq('grupo', renamingGrupo.oldName);

            if (error) throw error;

            alert('Grupo renombrado con éxito');
            setRenamingGrupo({ oldName: '', newName: '' });
            fetchData();
        } catch (error) {
            console.error('Error renaming group:', error);
            alert('Error al renombrar el grupo');
        }
    };

    const handleToggleStatus = async (status: 'activo' | 'inactivo') => {
        if (selectedStudents.length === 0) return;

        if (!confirm(`¿Cambiar el estado a ${status} para los ${selectedStudents.length} estudiantes seleccionados?`)) return;

        try {
            const { error } = await supabase
                .from('estudiantes')
                .update({ estado: status })
                .in('id', selectedStudents);

            if (error) throw error;

            alert('Estado actualizado con éxito');
            setSelectedStudents([]);
            fetchData();
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Error al actualizar el estado');
        }
    };

    const filteredEstudiantes = estudiantes.filter(e =>
        e.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.matricula.includes(searchQuery) ||
        e.grupo.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleSelect = (id: string) => {
        setSelectedStudents(prev =>
            prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
        );
    };

    if (!usuario) return null;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </Link>
                        <h1 className="text-xl font-bold text-gray-900">Panel de Administración</h1>
                    </div>
                    <ShieldAlert className="w-6 h-6 text-red-500" />
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                {/* Tabs de Herramientas */}
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200">
                    <button
                        onClick={() => setActiveTab('move')}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${activeTab === 'move' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        Mover Masa
                    </button>
                    <button
                        onClick={() => setActiveTab('rename')}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${activeTab === 'rename' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        Renombrar Grupos
                    </button>
                    <button
                        onClick={() => setActiveTab('status')}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${activeTab === 'status' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        Gestión de Estados
                    </button>
                </div>

                {/* Herramientas de Administración */}
                <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg overflow-hidden relative min-h-[160px]">
                    <div className="relative z-10">
                        {activeTab === 'move' && (
                            <>
                                <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
                                    <ArrowRightLeft className="w-5 h-5" />
                                    Mover Estudiantes en Masa
                                </h2>
                                <p className="text-blue-100 text-sm mb-6">Selecciona estudiantes de la lista de abajo y elige el grupo de destino.</p>

                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold uppercase mb-2 opacity-80">Seleccione Grupo de Destino</label>
                                        <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-40 p-1 bg-blue-700/30 rounded-xl">
                                            {allGrupos.map(g => (
                                                <button
                                                    key={g}
                                                    onClick={() => setTargetGrupo(g)}
                                                    className={`py-2 px-1 rounded-lg text-[10px] font-bold transition-all border ${targetGrupo === g
                                                        ? 'bg-white text-blue-600 border-white shadow-md'
                                                        : 'bg-blue-700/50 text-blue-100 border-blue-500/30 hover:bg-blue-600'
                                                        }`}
                                                >
                                                    {g}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleMoveStudents}
                                        disabled={selectedStudents.length === 0 || !targetGrupo}
                                        className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-blue-50 transition-colors"
                                    >
                                        Mover Seleccionados ({selectedStudents.length})
                                    </button>
                                </div>
                            </>
                        )}

                        {activeTab === 'rename' && (
                            <>
                                <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
                                    <Edit3 className="w-5 h-5" />
                                    Renombrar Grupo Globalmente
                                </h2>
                                <p className="text-blue-100 text-sm mb-6">Este cambio afectará a TODOS los estudiantes del grupo seleccionado.</p>

                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold uppercase mb-2 opacity-80">Seleccione Grupo Original</label>
                                        <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-40 p-1 bg-blue-700/30 rounded-xl">
                                            {allGrupos.map(g => (
                                                <button
                                                    key={g}
                                                    onClick={() => setRenamingGrupo({ ...renamingGrupo, oldName: g })}
                                                    className={`py-2 px-1 rounded-lg text-[10px] font-bold transition-all border ${renamingGrupo.oldName === g
                                                        ? 'bg-white text-blue-600 border-white shadow-md'
                                                        : 'bg-blue-700/50 text-blue-100 border-blue-500/30 hover:bg-blue-600'
                                                        }`}
                                                >
                                                    {g}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold uppercase mb-1 opacity-80">Nuevo Nombre</label>
                                        <input
                                            type="text"
                                            placeholder="Escriba el nuevo nombre..."
                                            value={renamingGrupo.newName}
                                            onChange={(e) => setRenamingGrupo({ ...renamingGrupo, newName: e.target.value })}
                                            className="w-full bg-blue-700 border-none rounded-xl px-4 py-3 text-white placeholder-blue-300 focus:ring-2 focus:ring-white"
                                        />
                                    </div>
                                    <button
                                        onClick={handleRenameGroup}
                                        disabled={!renamingGrupo.oldName || !renamingGrupo.newName}
                                        className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-blue-50 transition-colors"
                                    >
                                        Confirmar Cambio
                                    </button>
                                </div>
                            </>
                        )}

                        {activeTab === 'status' && (
                            <>
                                <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
                                    <ShieldAlert className="w-5 h-5" />
                                    Gestión de Estados (Activo/Inactivo)
                                </h2>
                                <p className="text-blue-100 text-sm mb-6">Cambia el estado de los estudiantes seleccionados rápidamente.</p>

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => handleToggleStatus('activo')}
                                        disabled={selectedStudents.length === 0}
                                        className="flex-1 bg-green-500 hover:bg-green-400 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-lg"
                                    >
                                        <CheckCircle className="w-5 h-5" />
                                        Marcar ACTIVOS ({selectedStudents.length})
                                    </button>
                                    <button
                                        onClick={() => handleToggleStatus('inactivo')}
                                        disabled={selectedStudents.length === 0}
                                        className="flex-1 bg-red-500 hover:bg-red-400 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-lg"
                                    >
                                        <UserX className="w-5 h-5" />
                                        Marcar INACTIVOS ({selectedStudents.length})
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                    <Settings className="absolute -bottom-4 -right-4 w-32 h-32 text-white/10" />
                </div>

                {/* Buscador */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, matrícula o grupo..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
                    />
                </div>

                {/* Lista de estudiantes */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-3 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedStudents(filteredEstudiantes.map(e => e.id));
                                                else setSelectedStudents([]);
                                            }}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                        />
                                    </th>
                                    <th className="px-2 py-3 text-[10px] font-bold text-gray-500 uppercase">Estudiante</th>
                                    <th className="px-2 py-3 text-[10px] font-bold text-gray-500 uppercase text-right">Información</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredEstudiantes.map(est => (
                                    <tr
                                        key={est.id}
                                        className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${selectedStudents.includes(est.id) ? 'bg-blue-50' : ''}`}
                                        onClick={() => toggleSelect(est.id)}
                                    >
                                        <td className="px-3 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedStudents.includes(est.id)}
                                                onChange={() => { }} // Se maneja en el onClick de la fila
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                            />
                                        </td>
                                        <td className="px-2 py-3 min-w-0">
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                <div className={`font-bold text-xs ${est.estado === 'inactivo' ? 'text-gray-400' : 'text-gray-900'} truncate`}>{est.nombre}</div>
                                                {est.estado === 'inactivo' && (
                                                    <span className="bg-gray-100 text-gray-500 text-[7px] font-black px-1 py-0.5 rounded leading-none">INACTIVO</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-gray-500">{est.matricula}</div>
                                        </td>
                                        <td className="px-2 py-3 text-right">
                                            <div className={`text-[10px] font-bold ${est.estado === 'inactivo' ? 'text-gray-300' : 'text-blue-600'}`}>{est.grupo}</div>
                                            <div className={`text-[9px] ${est.estado === 'inactivo' ? 'text-gray-300' : 'text-gray-500'}`}>{est.sede}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
