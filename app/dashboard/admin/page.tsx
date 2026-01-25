'use client';


import { useEffect, useState, useRef, ReactNode } from 'react';
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
    UserX,
    Database,
    UploadCloud,
    MapPin,
    X,
    AlertTriangle,
    Info,
    ChevronDown,
    Check
} from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

interface Estudiante {
    id: string;
    nombre: string;
    matricula: string;
    grado: string;
    grupo: string;
    sede: string;
    estado?: string;
}

interface ToastMessage {
    id: number;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
}

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'info' | 'warning';
}

export default function AdminPage() {
    const router = useRouter();
    const [usuario, setUsuario] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

    useEffect(() => {
        const checkAccess = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.user_metadata?.rol !== 'admin') {
                router.push('/dashboard');
            }
        };
        checkAccess();
    }, [router]);

    // UI State
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [confirmModal, setConfirmModal] = useState<ConfirmationModalProps>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        onCancel: () => { }
    });

    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    const closeConfirmModal = () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
    };

    const requestConfirm = (
        title: string,
        message: string,
        onConfirm: () => void,
        type: 'danger' | 'info' | 'warning' = 'info'
    ) => {
        setConfirmModal({
            isOpen: true,
            title,
            message,
            onConfirm: () => {
                onConfirm();
                closeConfirmModal();
            },
            onCancel: closeConfirmModal,
            confirmText: 'Confirmar',
            cancelText: 'Cancelar',
            type
        });
    };
    const [targetGrupo, setTargetGrupo] = useState('');
    const [allGrupos, setAllGrupos] = useState<string[]>([]);
    const [renamingGrupo, setRenamingGrupo] = useState({ oldName: '', newName: '' });
    const [changingSede, setChangingSede] = useState({ grupo: '', newSede: '' });
    const [sourceSedeFilter, setSourceSedeFilter] = useState('Todas');
    const [renameSedeFilter, setRenameSedeFilter] = useState('Principal');
    const [moveSedeFilter, setMoveSedeFilter] = useState('Principal');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'move' | 'rename' | 'status' | 'backup' | 'sede'>('move');
    const [uploading, setUploading] = useState(false);
    const [inactivateAll, setInactivateAll] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importLog, setImportLog] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        requestConfirm(
            'Confirmar Carga Masiva',
            `¿Estás seguro de iniciar la carga? ${inactivateAll ? 'Se INACTIVARÁN todos los estudiantes actuales primero.' : ''}`,
            () => processBulkUpload(file),
            'warning'
        );
    };

    const processBulkUpload = async (file: File) => {
        setUploading(true);
        setImportProgress(0);
        setImportLog([]);
        const log = (msg: string) => setImportLog(prev => [msg, ...prev]);

        try {
            // Paso 1: Inactivación Masiva (Opcional)
            if (inactivateAll) {
                log('Iniciando inactivación masiva...');
                const { error: inactError } = await supabase
                    .from('estudiantes')
                    .update({ estado: 'inactivo' })
                    .neq('estado', 'inactivo');

                if (inactError) throw new Error('Error al inactivar estudiantes: ' + inactError.message);
                log('Todos los estudiantes marcados como inactivos.');
            }

            // Paso 2: Leer el Excel
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const bstr = evt.target?.result;
                    const workbook = XLSX.read(bstr, { type: 'binary' });
                    const sheetNames = workbook.SheetNames;
                    log(`Archivo leído. ${sheetNames.length} hojas encontradas.`);

                    let totalProcessed = 0;
                    let totalErrors = 0;
                    let allStudentsToUpsert: any[] = [];

                    // Paso 3: Procesar cada hoja
                    for (const sheetName of sheetNames) {
                        const worksheet = workbook.Sheets[sheetName];
                        // Leer primeras 20 filas para detectar encabezados
                        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0, defval: '' }) as any[][];

                        let headerRowIndex = -1;
                        for (let i = 0; i < Math.min(rawData.length, 25); i++) {
                            const rowStr = JSON.stringify(rawData[i]).toLowerCase();
                            // Buscamos palabras clave
                            if ((rowStr.includes('matricula') || rowStr.includes('matrícula')) &&
                                (rowStr.includes('nombre') || rowStr.includes('estudiante'))) {
                                headerRowIndex = i;
                                break;
                            }
                        }

                        if (headerRowIndex === -1) {
                            log(`⚠️ Hoja "${sheetName}": No se detectaron encabezados válidos en las primeras 25 filas. Saltando.`);
                            continue;
                        }

                        // Parsear datos reales usando la fila de encabezados detectada
                        const sheetData = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex });
                        log(`Hoja "${sheetName}": Procesando ${sheetData.length} filas (Encabezados en fila ${headerRowIndex + 1})...`);

                        // Mapear Columnas
                        const mappedStudents = sheetData.map((row: any) => {
                            const findVal = (keys: string[]) => {
                                for (const key of Object.keys(row)) {
                                    const cleanKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                    if (keys.some(k => cleanKey.includes(k))) return row[key];
                                }
                                return '';
                            };

                            const matricula = String(findVal(['matricula', 'codigo']) || '').trim();
                            // Buscar columnas de nombre
                            let nombre = String(findVal(['nombre', 'estudiante', 'alumno']) || '').trim();
                            const apellidos = String(findVal(['apellido']) || '').trim();

                            // Si hay apellidos separados, concatenar
                            if (apellidos && nombre) {
                                nombre = `${apellidos} ${nombre}`;
                            }

                            if (!matricula || !nombre || matricula.length < 3) return null; // Saltar filas inválidas

                            const grado = String(findVal(['grado']) || '').trim();
                            // Usar nombre de hoja como grupo si no hay columna grupo, o viceversa
                            let grupo = String(findVal(['grupo']) || sheetName).trim();
                            const sede = String(findVal(['sede']) || 'Principal').trim();

                            return {
                                matricula,
                                nombre: nombre.toUpperCase(),
                                grado,
                                grupo,
                                sede: sede.charAt(0).toUpperCase() + sede.slice(1).toLowerCase(),
                                estado: 'activo' // Reactivar si estaba inactivo
                            };
                        }).filter(Boolean); // Eliminar nulos

                        allStudentsToUpsert = [...allStudentsToUpsert, ...mappedStudents];
                    }

                    if (allStudentsToUpsert.length === 0) {
                        throw new Error('No se encontraron estudiantes válidos en el archivo.');
                    }

                    log(`Preparando actualización de ${allStudentsToUpsert.length} estudiantes...`);

                    // Paso 4: Batch Upsert (lotes de 100)
                    const batchSize = 100;
                    const totalBatches = Math.ceil(allStudentsToUpsert.length / batchSize);

                    for (let i = 0; i < allStudentsToUpsert.length; i += batchSize) {
                        const batch = allStudentsToUpsert.slice(i, i + batchSize);
                        const { error } = await supabase.from('estudiantes').upsert(batch, { onConflict: 'matricula' });

                        if (error) {
                            console.error('Error en lote:', error);
                            totalErrors += batch.length;
                            log(`❌ Error al procesar lote ${Math.ceil(i / batchSize) + 1}/${totalBatches}`);
                        } else {
                            totalProcessed += batch.length;
                        }

                        // Actualizar progreso
                        setImportProgress(Math.round(((i + batch.length) / allStudentsToUpsert.length) * 100));
                    }

                    log(`✅ Proceso finalizado. Procesados: ${totalProcessed}. Errores: ${totalErrors}.`);
                    if (totalProcessed > 0) {
                        alert(`Carga masiva completada.\nProcesados: ${totalProcessed}\nErrores: ${totalErrors}`);
                        fetchData(); // Refrescar lista
                    }

                } catch (parseError: any) {
                    console.error(parseError);
                    log(`❌ Error crítico al procesar archivo: ${parseError.message}`);
                    alert('Error al procesar el archivo Excel.');
                } finally {
                    setUploading(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }
            };
            reader.readAsBinaryString(file);

        } catch (error: any) {
            console.error(error);
            log(`❌ Error general: ${error.message}`);
            setUploading(false);
        }
    };

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

            const grupos = Array.from(new Set((data || []).map(e => e.grupo))).filter(g => !g.includes('2025')).sort();
            setAllGrupos(grupos as string[]);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet);

                    if (jsonData.length === 0) throw new Error('El archivo está vacío');

                    // Validar columnas (Lógica Flexible)
                    const firstRow = jsonData[0];
                    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const keys = Object.keys(firstRow).map(k => normalize(k));

                    const hasMatricula = keys.some(k => k.includes('matricula') || k.includes('codigo'));
                    const hasNombre = keys.some(k => k.includes('nombre') || k.includes('estudiante') || k.includes('alumno') || k.includes('apellidos'));

                    if (!hasMatricula || !hasNombre) {
                        throw new Error('El archivo debe tener al menos una columna de "Matrícula" y "Nombre/Estudiante".');
                    }

                    const studentsToUpsert = jsonData.map((row: any) => {
                        const findVal = (possibleKeys: string[]) => {
                            const key = Object.keys(row).find(k => {
                                const normK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                return possibleKeys.some(pk => normK.includes(pk));
                            });
                            return key ? row[key] : '';
                        };

                        // Estrategia de Nombre: 
                        // 1. Buscar "Apellidos" y "Nombres" separados.
                        // 2. Si no, buscar columna genérica de nombre.
                        let nombreCompleto = '';
                        const rawApellidos = String(findVal(['apellidos'])).trim();
                        const rawNombres = String(findVal(['nombres'])).trim();

                        // Si existen ambas columnas DISTINTAS (heurística simple: valores diferentes o claves diferentes)
                        // Para simplificar, si encontramos valores en ambas búsquedas (y no son la misma columna capturada dos veces por coincidencia parcial), concatenamos.
                        // Pero mejor confiamos en una búsqueda priorizada.

                        // En el caso del usuario, es una sola columna. Busquemos la columna más probable.
                        // "Apellidos y Nombres" contiene "apellidos".

                        const valNombre = String(findVal(['nombre', 'estudiante', 'alumno', 'apellidos'])).trim();
                        nombreCompleto = valNombre;

                        const matricula = String(findVal(['matricula', 'codigo']) || '');
                        const grado = String(findVal(['grado']) || '');
                        const grupo = String(findVal(['grupo']) || '').trim();
                        let sede = String(findVal(['sede']) || '').trim();

                        if (!sede) sede = 'Principal'; // Default

                        return {
                            nombre: nombreCompleto.toUpperCase(),
                            matricula,
                            grado,
                            grupo,
                            sede: sede.charAt(0).toUpperCase() + sede.slice(1).toLowerCase(),
                            estado: 'activo'
                        };
                    }).filter(s => s.matricula && s.nombre && s.matricula.length > 2);

                    // Batch upsert
                    const batchSize = 100;
                    let errors = 0;
                    for (let i = 0; i < studentsToUpsert.length; i += batchSize) {
                        const batch = studentsToUpsert.slice(i, i + batchSize);
                        const { error: upsertError } = await supabase.from('estudiantes').upsert(batch, { onConflict: 'matricula' });
                        if (upsertError) errors++;
                    }

                    if (errors === 0) {
                        showToast(`¡Éxito! Se procesaron ${studentsToUpsert.length} estudiantes.`, 'success');
                        fetchData();
                    } else {
                        showToast('Se procesaron datos con algunos errores.', 'warning');
                    }
                } catch (err: any) {
                    showToast(err.message || 'Error al procesar el Excel', 'error');
                } finally {
                    setUploading(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }
            };
            reader.readAsArrayBuffer(file);
        } catch (error) {
            setUploading(false);
            showToast('Error al leer el archivo', 'error');
        }
    };

    const handleMoveStudents = () => {
        if (selectedStudents.length === 0 || !targetGrupo) return;

        requestConfirm(
            'Mover Estudiantes',
            `¿Mover ${selectedStudents.length} estudiantes al grupo ${targetGrupo}?`,
            async () => {
                try {
                    const { error } = await supabase
                        .from('estudiantes')
                        .update({ grupo: targetGrupo })
                        .in('id', selectedStudents);

                    if (error) throw error;

                    showToast('Estudiantes movidos con éxito', 'success');
                    setSelectedStudents([]);
                    fetchData();
                } catch (error) {
                    console.error('Error moving students:', error);
                    showToast('Error al mover estudiantes', 'error');
                }
            }
        );
    };

    const handleRenameGroup = () => {
        if (!renamingGrupo.oldName || !renamingGrupo.newName) return;

        requestConfirm(
            'Renombrar Grupo',
            `¿Renombrar el grupo "${renamingGrupo.oldName}" a "${renamingGrupo.newName}" para TODOS los estudiantes?`,
            async () => {
                try {
                    const { error } = await supabase
                        .from('estudiantes')
                        .update({ grupo: renamingGrupo.newName })
                        .eq('grupo', renamingGrupo.oldName);

                    if (error) throw error;

                    showToast('Grupo renombrado con éxito', 'success');
                    setRenamingGrupo({ oldName: '', newName: '' });
                    fetchData();
                } catch (error) {
                    console.error('Error renaming group:', error);
                    showToast('Error al renombrar el grupo', 'error');
                }
            },
            'warning'
        );
    };

    const handleChangeSede = () => {
        if (!changingSede.grupo || !changingSede.newSede) return;

        requestConfirm(
            'Cambiar Sede',
            `¿Cambiar la sede del grupo "${changingSede.grupo}" a "${changingSede.newSede}" para TODOS los estudiantes?`,
            async () => {
                try {
                    const { error } = await supabase
                        .from('estudiantes')
                        .update({ sede: changingSede.newSede })
                        .eq('grupo', changingSede.grupo);

                    if (error) throw error;

                    showToast('Sede actualizada con éxito', 'success');
                    setChangingSede({ grupo: '', newSede: '' });
                    fetchData();
                } catch (error) {
                    console.error('Error updating sede:', error);
                    showToast('Error al actualizar la sede', 'error');
                }
            },
            'warning'
        );
    };

    const handleToggleStatus = (status: 'activo' | 'inactivo') => {
        if (selectedStudents.length === 0) return;

        requestConfirm(
            'Cambiar Estado',
            `¿Cambiar el estado a ${status} para los ${selectedStudents.length} estudiantes seleccionados?`,
            async () => {
                try {
                    const { error } = await supabase
                        .from('estudiantes')
                        .update({ estado: status })
                        .in('id', selectedStudents);

                    if (error) throw error;

                    showToast('Estado actualizado con éxito', 'success');
                    setSelectedStudents([]);
                    fetchData();
                } catch (error) {
                    console.error('Error updating status:', error);
                    showToast('Error al actualizar el estado', 'error');
                }
            },
            status === 'inactivo' ? 'danger' : 'info'
        );
    };

    const handleBackup = () => {
        requestConfirm(
            'Generar Respaldo',
            '¿Generar y descargar una copia completa de la base de datos?',
            async () => {
                setLoading(true);
                try {
                    // Fetch Estudiantes
                    const { data: estData } = await supabase.from('estudiantes').select('*');
                    // Fetch Schedules
                    const { data: schedData } = await supabase.from('schedules').select('*');

                    // Create Workbook
                    const wb = XLSX.utils.book_new();

                    // Add Sheets
                    if (estData) {
                        const wsEst = XLSX.utils.json_to_sheet(estData);
                        XLSX.utils.book_append_sheet(wb, wsEst, "Estudiantes");
                    }
                    if (schedData) {
                        const wsSched = XLSX.utils.json_to_sheet(schedData.map(s => ({
                            ...s,
                            items: JSON.stringify(s.items)
                        })));
                        XLSX.utils.book_append_sheet(wb, wsSched, "Horarios");
                    }

                    // Export
                    XLSX.writeFile(wb, `Respaldo_PAE_${new Date().toISOString().split('T')[0]}.xlsx`);
                    showToast('Respaldo generado correctamente', 'success');
                } catch (e) {
                    console.error(e);
                    showToast('Error al generar respaldo', 'error');
                } finally {
                    setLoading(false);
                }
            }
        );
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
        <div className="min-h-screen bg-gray-50 pb-32">
            <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 shadow-xl shadow-cyan-900/10 sticky top-16 md:top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/10 shadow-lg">
                            <ArrowLeft className="w-6 h-6 text-white" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight leading-none text-shadow-sm">Panel de Administración</h1>
                            <p className="text-[10px] font-bold text-cyan-100/80 uppercase tracking-widest mt-0.5">Control Total</p>
                        </div>
                    </div>
                    <div className="bg-white/10 p-2 rounded-xl border border-white/10 animate-pulse shadow-inner">
                        <ShieldAlert className="w-6 h-6 text-cyan-50" />
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
                {/* Tabs de Herramientas */}
                {/* Tabs de Herramientas (Responsive) */}

                {/* Mobile: Selector Desplegable Premium */}
                {/* Mobile: Selector Desplegable Premium */}
                <div className="md:hidden relative z-30">
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="w-full bg-white border border-gray-200 shadow-sm rounded-xl p-4 flex items-center justify-between active:bg-gray-50 transition-all active:scale-[0.99]"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${activeTab === 'move' ? 'bg-blue-100 text-blue-600' :
                                activeTab === 'rename' ? 'bg-purple-100 text-purple-600' :
                                    activeTab === 'sede' ? 'bg-orange-100 text-orange-600' :
                                        activeTab === 'status' ? 'bg-red-100 text-red-600' :
                                            'bg-green-100 text-green-600'
                                }`}>
                                {activeTab === 'move' && <ArrowRightLeft className="w-6 h-6" />}
                                {activeTab === 'rename' && <Edit3 className="w-6 h-6" />}
                                {activeTab === 'sede' && <MapPin className="w-6 h-6" />}
                                {activeTab === 'status' && <ShieldAlert className="w-6 h-6" />}
                                {activeTab === 'backup' && <Database className="w-6 h-6" />}
                            </div>
                            <div className="text-left">
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-0.5">Herramienta Activa</p>
                                <p className="text-lg font-black text-gray-900 leading-none">
                                    {activeTab === 'move' && 'Mover Masa'}
                                    {activeTab === 'rename' && 'Renombrar Grupos'}
                                    {activeTab === 'sede' && 'Cambiar Sede'}
                                    {activeTab === 'status' && 'Gestión de Estados'}
                                    {activeTab === 'backup' && 'Respaldos'}
                                </p>
                            </div>
                        </div>
                        <div className={`bg-gray-50 p-2 rounded-lg transition-transform duration-200 ${isMobileMenuOpen ? 'rotate-180 bg-gray-100' : ''}`}>
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                        </div>
                    </button>

                    {/* Menú Desplegable */}
                    {isMobileMenuOpen && (
                        <>
                            <div className="fixed inset-0 bg-black/5 z-40" onClick={() => setIsMobileMenuOpen(false)} />
                            <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-xl ring-1 ring-black/5 z-50 overflow-hidden divide-y divide-gray-100 animate-in fade-in slide-in-from-top-4 duration-200">
                                {[
                                    { id: 'move', label: 'Mover Masa', icon: ArrowRightLeft, color: 'text-blue-600', bg: 'bg-blue-50' },
                                    { id: 'rename', label: 'Renombrar Grupos', icon: Edit3, color: 'text-purple-600', bg: 'bg-purple-50' },
                                    { id: 'sede', label: 'Cambiar Sede', icon: MapPin, color: 'text-orange-600', bg: 'bg-orange-50' },
                                    { id: 'status', label: 'Gestión de Estados', icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50' },
                                    { id: 'backup', label: 'Respaldos', icon: Database, color: 'text-green-600', bg: 'bg-green-50' },
                                ].map((tool) => (
                                    <button
                                        key={tool.id}
                                        onClick={() => {
                                            setActiveTab(tool.id as any);
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className={`w-full p-4 flex items-center justify-between transition-colors ${activeTab === tool.id ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${tool.bg} ${tool.color}`}>
                                                <tool.icon className="w-5 h-5" />
                                            </div>
                                            <span className={`font-bold ${activeTab === tool.id ? 'text-gray-900' : 'text-gray-600'}`}>
                                                {tool.label}
                                            </span>
                                        </div>
                                        {activeTab === tool.id && <Check className="w-5 h-5 text-blue-600" />}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Desktop: Tabs Horizontales */}
                <div className="hidden md:flex bg-white p-1 rounded-xl shadow-sm border border-gray-200 overflow-x-auto no-scrollbar gap-2">
                    <button
                        onClick={() => setActiveTab('move')}
                        className={`flex-shrink-0 flex items-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'move' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <ArrowRightLeft className="w-4 h-4" />
                        Mover Masa
                    </button>
                    <button
                        onClick={() => setActiveTab('rename')}
                        className={`flex-shrink-0 flex items-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'rename' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Edit3 className="w-4 h-4" />
                        Renombrar Grupos
                    </button>
                    <button
                        onClick={() => setActiveTab('sede')}
                        className={`flex-shrink-0 flex items-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'sede' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <MapPin className="w-4 h-4" />
                        Cambiar Sede
                    </button>
                    <button
                        onClick={() => setActiveTab('status')}
                        className={`flex-shrink-0 flex items-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'status' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <ShieldAlert className="w-4 h-4" />
                        Gestión de Estados
                    </button>
                    <button
                        onClick={() => setActiveTab('backup')}
                        className={`flex-shrink-0 flex items-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'backup' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Database className="w-4 h-4" />
                        Respaldo
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
                                        <label className="block text-xs font-bold uppercase mb-2 opacity-80">1. Filtrar por Sede</label>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {['Principal', 'Primaria', 'Maria Inmaculada'].map(sede => (
                                                <button
                                                    key={sede}
                                                    onClick={() => setMoveSedeFilter(sede)}
                                                    className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${moveSedeFilter === sede
                                                        ? 'bg-blue-800 text-white border-blue-400'
                                                        : 'bg-blue-700/50 text-blue-200 border-transparent hover:bg-blue-700'
                                                        }`}
                                                >
                                                    {sede}
                                                </button>
                                            ))}
                                        </div>

                                        <label className="block text-xs font-bold uppercase mb-2 opacity-80">2. Seleccione Grupo de Destino</label>
                                        <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-40 p-1 bg-blue-700/30 rounded-xl">
                                            {allGrupos.filter(g => {
                                                // Filter groups by selected Sede
                                                return estudiantes.some(e => e.grupo === g && e.sede === moveSedeFilter);
                                            }).map(g => (
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
                                        <label className="block text-xs font-bold uppercase mb-2 opacity-80">1. Filtrar por Sede</label>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {['Principal', 'Primaria', 'Maria Inmaculada'].map(sede => (
                                                <button
                                                    key={sede}
                                                    onClick={() => setRenameSedeFilter(sede)}
                                                    className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${renameSedeFilter === sede
                                                        ? 'bg-blue-800 text-white border-blue-400'
                                                        : 'bg-blue-700/50 text-blue-200 border-transparent hover:bg-blue-700'
                                                        }`}
                                                >
                                                    {sede}
                                                </button>
                                            ))}
                                        </div>

                                        <label className="block text-xs font-bold uppercase mb-2 opacity-80">2. Seleccione Grupo Original</label>
                                        <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-40 p-1 bg-blue-700/30 rounded-xl">
                                            {allGrupos.filter(g => {
                                                // Filter groups by selected Sede
                                                return estudiantes.some(e => e.grupo === g && e.sede === renameSedeFilter);
                                            }).map(g => (
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
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="text-left">
                                    <h2 className="text-lg font-bold flex items-center gap-2">
                                        <ShieldAlert className="w-5 h-5" />
                                        Gestión de Estados
                                    </h2>
                                    <p className="text-blue-100 text-xs opacity-80">Actualiza el estado de los {selectedStudents.length} estudiantes seleccionados.</p>
                                </div>

                                <div className="flex gap-2 w-full md:w-auto">
                                    <button
                                        onClick={() => handleToggleStatus('activo')}
                                        disabled={selectedStudents.length === 0}
                                        className="flex-1 md:flex-none bg-green-500 hover:bg-green-400 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        Marcar Activos
                                    </button>
                                    <button
                                        onClick={() => handleToggleStatus('inactivo')}
                                        disabled={selectedStudents.length === 0}
                                        className="flex-1 md:flex-none bg-red-500 hover:bg-red-400 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
                                    >
                                        <UserX className="w-4 h-4" />
                                        Marcar Inactivos
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'sede' && (
                            <>
                                <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
                                    <MapPin className="w-5 h-5" />
                                    Cambiar Sede Globalmente
                                </h2>
                                <p className="text-blue-100 text-sm mb-6">Actualiza la sede de TODOS los estudiantes del grupo seleccionado.</p>

                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold uppercase mb-2 opacity-80">1. Filtrar por Sede Actual</label>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {['Todas', 'Principal', 'Primaria', 'Maria Inmaculada'].map(sede => (
                                                <button
                                                    key={sede}
                                                    onClick={() => setSourceSedeFilter(sede)}
                                                    className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${sourceSedeFilter === sede
                                                        ? 'bg-blue-800 text-white border-blue-400'
                                                        : 'bg-blue-700/50 text-blue-200 border-transparent hover:bg-blue-700'
                                                        }`}
                                                >
                                                    {sede}
                                                </button>
                                            ))}
                                        </div>

                                        <label className="block text-xs font-bold uppercase mb-2 opacity-80">2. Seleccione Grupo ({sourceSedeFilter === 'Todas' ? 'Todos' : sourceSedeFilter})</label>
                                        <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-40 p-1 bg-blue-700/30 rounded-xl">
                                            {allGrupos.filter(g => {
                                                if (sourceSedeFilter === 'Todas') return true;
                                                // Check if group belongs to selected sede (has at least one student in that sede)
                                                return estudiantes.some(e => e.grupo === g && e.sede === sourceSedeFilter);
                                            }).map(g => (
                                                <button
                                                    key={g}
                                                    onClick={() => setChangingSede(prev => ({ ...prev, grupo: g }))}
                                                    className={`py-2 px-1 rounded-lg text-[10px] font-bold transition-all border ${changingSede.grupo === g
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
                                        <label className="block text-xs font-bold uppercase mb-2 opacity-80">3. Nueva Sede de Destino</label>
                                        <div className="flex flex-col gap-2">
                                            {['Principal', 'Primaria', 'Maria Inmaculada'].map(sede => (
                                                <button
                                                    key={sede}
                                                    onClick={() => setChangingSede(prev => ({ ...prev, newSede: sede }))}
                                                    className={`py-3 px-4 rounded-xl text-sm font-bold transition-all border text-left flex items-center justify-between ${changingSede.newSede === sede
                                                        ? 'bg-white text-blue-600 border-white shadow-md'
                                                        : 'bg-blue-700/50 text-blue-100 border-blue-500/30 hover:bg-blue-600'
                                                        }`}
                                                >
                                                    {sede}
                                                    {changingSede.newSede === sede && <CheckCircle className="w-4 h-4" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleChangeSede}
                                        disabled={!changingSede.grupo || !changingSede.newSede}
                                        className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-blue-50 transition-colors"
                                    >
                                        Confirmar Cambio
                                    </button>
                                </div>
                            </>
                        )}

                        {activeTab === 'backup' && (
                            <>
                                <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
                                    <Database className="w-5 h-5" />
                                    Copia de Seguridad y Exportación
                                </h2>
                                <p className="text-blue-100 text-sm mb-6">Descarga todos los datos del sistema en formato Excel para respaldo seguro.</p>

                                <div className="flex gap-4">
                                    <button
                                        onClick={handleBackup}
                                        className="w-full bg-white text-blue-600 hover:bg-blue-50 px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-colors shadow-lg"
                                    >
                                        <Database className="w-6 h-6" />
                                        <div className="text-left">
                                            <div className="text-sm">GENERAR RESPALDO COMPLETO</div>
                                            <div className="text-[10px] opacity-70 font-normal">Estudiantes, Grupos y Horarios (.xlsx)</div>
                                        </div>
                                    </button>

                                    {/* Importar Excel */}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleBulkUpload}
                                        accept=".xlsx, .xls"
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className={`w-full bg-white text-emerald-600 hover:bg-emerald-50 px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-colors shadow-lg ${uploading ? 'opacity-50 cursor-wait' : ''}`}
                                    >
                                        {uploading ? (
                                            <div className="w-6 h-6 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
                                        ) : (
                                            <UploadCloud className="w-6 h-6" />
                                        )}
                                        <div className="text-left">
                                            <div className="text-sm">{uploading ? 'PROCESANDO...' : 'CARGAR BASE DE DATOS'}</div>
                                            <div className="text-[10px] opacity-70 font-normal">Importar desde Excel (.xlsx)</div>
                                        </div>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                    <Settings className="absolute -bottom-4 -right-4 w-32 h-32 text-white/10" />
                </div>

                {/* Buscador Premium */}
                <div className="relative mb-8">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por nombre, matrícula o grupo..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-12 pr-4 py-4 bg-white border-none rounded-full text-gray-900 placeholder:text-gray-400 placeholder:font-bold focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 shadow-xl transition-all duration-300"
                    />
                </div>

                {/* Lista de estudiantes */}
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-cyan-50/80 border-b border-cyan-100">
                                    <th className="px-6 py-4 w-16 text-center">
                                        <input
                                            type="checkbox"
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedStudents(filteredEstudiantes.map(e => e.id));
                                                else setSelectedStudents([]);
                                            }}
                                            className="rounded-md border-gray-300 text-[#0891B2] focus:ring-[#0891B2] h-5 w-5 cursor-pointer transition-all"
                                        />
                                    </th>
                                    <th className="px-4 py-4 text-xs font-black text-cyan-800 uppercase tracking-wider">Estudiante</th>
                                    <th className="px-4 py-4 text-xs font-black text-cyan-800 uppercase tracking-wider text-right">Información Académica</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredEstudiantes.map(est => (
                                    <tr
                                        key={est.id}
                                        className={`group transition-all duration-200 cursor-pointer ${selectedStudents.includes(est.id) ? 'bg-cyan-50/60' : 'hover:bg-gray-50'}`}
                                        onClick={() => toggleSelect(est.id)}
                                    >
                                        <td className="px-6 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedStudents.includes(est.id)}
                                                onChange={() => { }}
                                                className="rounded-md border-gray-300 text-[#0891B2] focus:ring-[#0891B2] h-5 w-5 cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className={`font-bold text-sm ${est.estado === 'inactivo' ? 'text-gray-400 line-through decoration-2' : 'text-gray-900'}`}>
                                                    {est.nombre}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                                        {est.matricula}
                                                    </span>
                                                    {est.estado === 'inactivo' && (
                                                        <span className="bg-red-100 text-red-600 text-[9px] font-black px-2 py-0.5 rounded-full">INACTIVO</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="bg-[#0891B2]/10 text-[#0891B2] px-3 py-1 rounded-lg text-xs font-black inline-block">
                                                    {est.grupo}
                                                </div>
                                                <div className="text-[10px] font-bold text-cyan-600/80 uppercase tracking-wide">
                                                    {est.sede}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal de Carga Masiva (Año Nuevo) */}
            {
                activeTab === 'backup' && (
                    <div className="bg-white rounded-3xl shadow-xl border-none ring-1 ring-black/5 p-8">
                        <h2 className="text-2xl font-black text-[#0891B2] mb-6 flex items-center gap-3">
                            <div className="p-2 bg-cyan-50 rounded-xl">
                                <UploadCloud className="w-6 h-6 text-[#0891B2]" />
                            </div>
                            Carga Masiva y Cambio de Año
                        </h2>

                        <p className="text-sm text-gray-600 mb-6">
                            Sube el archivo de listas de estudiantes (Excel con múltiples hojas) para actualizar el sistema al nuevo año escolar.
                            El sistema usará la <strong>Matrícula</strong> para identificar a los estudiantes y preservar su historial.
                        </p>

                        <div className="space-y-6 max-w-xl">
                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="mt-1 w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        checked={inactivateAll}
                                        onChange={e => setInactivateAll(e.target.checked)}
                                    />
                                    <div>
                                        <span className="font-bold text-gray-900 block text-sm">Inactivar a todos los estudiantes actuales</span>
                                        <span className="text-xs text-orange-800 mt-1 block">
                                            Recomendado para inicio de año. Todos los estudiantes pasarán a estado "Inactivo".
                                            Solo se reactivarán los que aparezcan en el nuevo archivo excel.
                                        </span>
                                    </div>
                                </label>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700">Seleccionar Archivo Excel (.xlsx)</label>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={handleBulkUpload}
                                    disabled={uploading}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all border border-gray-200 rounded-xl cursor-pointer"
                                />
                            </div>

                            {uploading && (
                                <div className="space-y-2 animate-in fade-in duration-300">
                                    <div className="flex justify-between text-xs font-bold text-gray-500">
                                        <span>Procesando...</span>
                                        <span>{importProgress}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                                            style={{ width: `${importProgress}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-center text-gray-400 italic">No cierres esta ventana</p>
                                </div>
                            )}

                            {importLog.length > 0 && (
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 max-h-40 overflow-y-auto text-xs font-mono space-y-1">
                                    {importLog.map((log, i) => (
                                        <div key={i} className={log.includes('Error') ? 'text-red-600 font-bold' : 'text-gray-600'}>
                                            {log}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
            {/* Toasts Container */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto transform transition-all duration-300 ease-out flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-md border ${toast.type === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' :
                            toast.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' :
                                'bg-blue-600/90 border-blue-500 text-white'
                            }`}
                    >
                        {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
                        {toast.type === 'error' && <X className="w-5 h-5" />}
                        {toast.type === 'info' && <Info className="w-5 h-5" />}
                        <span className="text-sm font-medium">{toast.message}</span>
                    </div>
                ))}
            </div>

            {/* Confirmation Modal */}
            {
                confirmModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200 border border-white/20">
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className={`p-4 rounded-full ${confirmModal.type === 'danger' ? 'bg-red-100 text-red-600' :
                                    confirmModal.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                                        'bg-blue-100 text-blue-600'
                                    }`}>
                                    {confirmModal.type === 'danger' && <AlertTriangle className="w-8 h-8" />}
                                    {confirmModal.type === 'warning' && <AlertTriangle className="w-8 h-8" />}
                                    {confirmModal.type === 'info' && <Info className="w-8 h-8" />}
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmModal.title}</h3>
                                    <p className="text-sm text-gray-500">{confirmModal.message}</p>
                                </div>

                                <div className="flex gap-3 w-full mt-2">
                                    <button
                                        onClick={confirmModal.onCancel}
                                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                                    >
                                        {confirmModal.cancelText || 'Cancelar'}
                                    </button>
                                    <button
                                        onClick={confirmModal.onConfirm}
                                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all transform active:scale-95 ${confirmModal.type === 'danger' ? 'bg-red-600 hover:bg-red-500 shadow-red-500/30' :
                                            confirmModal.type === 'warning' ? 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/30' :
                                                'bg-blue-600 hover:bg-blue-500 shadow-blue-500/30'
                                            }`}
                                    >
                                        {confirmModal.confirmText || 'Confirmar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
