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
    Check,
    Trash2,
    RefreshCcw
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

interface AppUser {
    id: string;
    email: string;
    created_at: string;
    user_metadata: { nombre?: string; rol?: string; };
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
    const [appUsers, setAppUsers] = useState<AppUser[]>([]);
    const [usersSearch, setUsersSearch] = useState('');

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
    const [activeTab, setActiveTab] = useState<'move' | 'rename' | 'status' | 'backup' | 'sede' | 'cleanup' | 'usuarios'>('move');
    const [uploading, setUploading] = useState(false);
    const [inactivateAll, setInactivateAll] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importLog, setImportLog] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const OFFICIAL_GROUPS = [
        '010100', '010201', '010400', '020100', '020201', '020400', '024000',
        '030100', '030201', '030400', '040100', '040201', '040300', '044000',
        '050100', '050201', '050300', '050400', '060100', '060200', '060300',
        '060400', '064000', '070100', '070200', '070300', '070400', '080100',
        '080200', '080400', '090100', '090200', '090400', '100100', '100200',
        '110100', '110200', '110400', 'TS0100', 'TS0201', 'TS0400'
    ];

    // Incluir versiones cortas (ej: 601) para proteger grupos existentes
    const VALID_GROUPS = [
        ...OFFICIAL_GROUPS,
        ...OFFICIAL_GROUPS.map(g => {
            const num = parseInt(g);
            return isNaN(num) ? g : num.toString();
        })
    ];

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
            
            let userRole = session?.user.user_metadata?.rol;
            const userEmail = session?.user.email || '';

            if (session && !userRole) {
                // Logic: institutional email -> estudiante, otherwise -> acudiente
                userRole = userEmail.endsWith('@barroblanco.edu.co') ? 'estudiante' : 'acudiente';
                
                await supabase.auth.updateUser({
                    data: { rol: userRole }
                });
            }

            if (!session || userRole !== 'admin') {
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

    const [fetchingUsers, setFetchingUsers] = useState(false);

    const fetchUsers = async () => {
        setFetchingUsers(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch('/api/admin/list-users', {
                headers: { Authorization: `Bearer ${session.access_token}` },
                cache: 'no-store'
            });
            if (res.ok) {
                const json = await res.json();
                setAppUsers(json.users || []);
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setFetchingUsers(false);
        }
    };

    // Refetch users every time the tab becomes active
    useEffect(() => {
        if (activeTab === 'usuarios') {
            fetchUsers();
        }
    }, [activeTab]);

    const handleDeleteUser = (userId: string, userEmail: string) => {
        requestConfirm(
            'Eliminar Usuario',
            `¿Eliminar permanentemente la cuenta de "${userEmail}"? Esta acción no se puede deshacer.`,
            async () => {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) throw new Error('No session');
                    const res = await fetch('/api/admin/delete-user', {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({ userId })
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || 'Error al eliminar');
                    showToast(`Usuario "${userEmail}" eliminado`, 'success');
                    fetchUsers();
                } catch (err: any) {
                    showToast(err.message || 'Error al eliminar usuario', 'error');
                }
            },
            'danger'
        );
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

    const handleCleanupOrphans = () => {
        const obsoleteGroups = Array.from(new Set(estudiantes.map(e => e.grupo)))
            .filter(g => !VALID_GROUPS.includes(g));

        if (obsoleteGroups.length === 0) {
            showToast('No se encontraron grupos obsoletos', 'info');
            return;
        }

        requestConfirm(
            'Purga de Grupos Obsoletos',
            `Se han detectado estudiantes en ${obsoleteGroups.length} grupos que no están en la lista oficial (ej: ${obsoleteGroups.slice(0, 3).join(', ')}...). ¿Deseas ELIMINAR permanentemente a estos estudiantes?`,
            async () => {
                try {
                    setLoading(true);
                    const { error } = await supabase
                        .from('estudiantes')
                        .delete()
                        .in('grupo', obsoleteGroups);

                    if (error) throw error;

                    showToast('¡Limpieza exitosa!', 'success');
                    fetchData();
                } catch (error) {
                    console.error('Error in cleanup:', error);
                    showToast('Error al procesar la limpieza', 'error');
                } finally {
                    setLoading(false);
                }
            },
            'danger'
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
        <div className="min-h-screen bg-gray-50 pb-32 dark:bg-gray-900 transition-colors">
            <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 shadow-xl shadow-cyan-900/10 sticky top-16 md:top-0 z-40">
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
                                <h1 className="text-lg md:text-2xl font-black text-white leading-none tracking-tight">Panel de Administración</h1>
                                <div className="flex items-center gap-2 mt-1 opacity-90">
                                    <p className="text-[9px] md:text-[11px] font-bold text-cyan-50 uppercase tracking-[0.2em]">
                                        CONTROL TOTAL
                                    </p>
                                    <span className="w-1 h-1 rounded-full bg-cyan-200/50"></span>
                                    <p className="text-[9px] md:text-[10px] font-black text-cyan-100/60 uppercase tracking-widest">ADMIN V2.0</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="bg-white/10 p-2 md:p-3 rounded-2xl border border-white/10 animate-pulse shadow-inner">
                                <ShieldAlert className="w-5 h-5 md:w-6 md:h-6 text-cyan-50" />
                            </div>
                        </div>
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
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl p-4 flex items-center justify-between active:bg-gray-50 dark:active:bg-gray-700 transition-all active:scale-[0.99]"
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
                                {activeTab === 'cleanup' && <Settings className="w-6 h-6" />}
                            </div>
                            <div className="text-left">
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-0.5">Herramienta Activa</p>
                                <p className="text-lg font-black text-gray-900 dark:text-white leading-none">
                                    {activeTab === 'move' && 'Mover Masa'}
                                    {activeTab === 'rename' && 'Renombrar Grupos'}
                                    {activeTab === 'sede' && 'Cambiar Sede'}
                                    {activeTab === 'status' && 'Gestión de Estados'}
                                    {activeTab === 'backup' && 'Respaldos'}
                                    {activeTab === 'cleanup' && 'Limpieza'}
                                    {activeTab === 'usuarios' && 'Usuarios'}
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
                            <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-gray-800 rounded-2xl shadow-xl ring-1 ring-black/5 z-50 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700 animate-in fade-in slide-in-from-top-4 duration-200">
                                {[
                                    { id: 'move', label: 'Mover Masa', icon: ArrowRightLeft, color: 'text-blue-600', bg: 'bg-blue-50' },
                                    { id: 'rename', label: 'Renombrar Grupos', icon: Edit3, color: 'text-purple-600', bg: 'bg-purple-50' },
                                    { id: 'sede', label: 'Cambiar Sede', icon: MapPin, color: 'text-orange-600', bg: 'bg-orange-50' },
                                    { id: 'status', label: 'Gestión de Estados', icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50' },
                                    { id: 'backup', label: 'Respaldos', icon: Database, color: 'text-green-600', bg: 'bg-green-50' },
                                    { id: 'cleanup', label: 'Limpieza', icon: Settings, color: 'text-amber-600', bg: 'bg-amber-50' },
                                    { id: 'usuarios', label: 'Usuarios', icon: Users, color: 'text-rose-600', bg: 'bg-rose-50' },
                                ].map((tool) => (
                                    <button
                                        key={tool.id}
                                        onClick={() => {
                                            setActiveTab(tool.id as any);
                                            if (tool.id === 'usuarios') fetchUsers();
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className={`w-full p-4 flex items-center justify-between transition-colors ${activeTab === tool.id ? 'bg-gray-50 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${tool.bg} ${tool.color}`}>
                                                <tool.icon className="w-5 h-5" />
                                            </div>
                                            <span className={`font-bold ${activeTab === tool.id ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
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
                <div className="hidden md:flex bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar gap-2">
                    <button
                        onClick={() => setActiveTab('move')}
                        className={`flex-shrink-0 flex items-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'move' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        <ArrowRightLeft className="w-4 h-4" />
                        Mover Masa
                    </button>
                    <button
                        onClick={() => setActiveTab('rename')}
                        className={`flex-shrink-0 flex items-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'rename' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        <Edit3 className="w-4 h-4" />
                        Renombrar Grupos
                    </button>
                    <button
                        onClick={() => setActiveTab('sede')}
                        className={`flex-shrink-0 flex items-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'sede' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        <MapPin className="w-4 h-4" />
                        Cambiar Sede
                    </button>
                    <button
                        onClick={() => setActiveTab('status')}
                        className={`flex-shrink-0 flex items-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'status' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        <ShieldAlert className="w-4 h-4" />
                        Gestión de Estados
                    </button>
                    <button
                        onClick={() => setActiveTab('backup')}
                        className={`flex-shrink-0 flex items-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'backup' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        <Database className="w-4 h-4" />
                        Respaldo
                    </button>
                    <button
                        onClick={() => setActiveTab('cleanup')}
                        className={`flex-shrink-0 flex items-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'cleanup' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        <Settings className="w-4 h-4" />
                        Limpieza
                    </button>
                    <button
                        onClick={() => { setActiveTab('usuarios'); fetchUsers(); }}
                        className={`flex-shrink-0 flex items-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'usuarios' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        <Users className="w-4 h-4" />
                        Usuarios
                    </button>
                </div>

                {/* Herramientas de Administración */}
                <div className="bg-cyan-600 rounded-2xl p-6 text-white shadow-lg overflow-hidden relative min-h-[160px]">
                    <div className="relative z-10">
                        {activeTab === 'move' && (
                            <>
                                <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
                                    <ArrowRightLeft className="w-5 h-5" />
                                    Mover Estudiantes en Masa
                                </h2>
                                <p className="text-cyan-100 text-sm mb-6">Selecciona estudiantes de la lista de abajo y elige el grupo de destino.</p>

                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold uppercase mb-2 opacity-80">1. Filtrar por Sede</label>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {['Principal', 'Primaria', 'Maria Inmaculada'].map(sede => (
                                                <button
                                                    key={sede}
                                                    onClick={() => setMoveSedeFilter(sede)}
                                                    className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${moveSedeFilter === sede
                                                        ? 'bg-cyan-800 text-white border-cyan-400'
                                                        : 'bg-cyan-700/50 text-cyan-200 border-transparent hover:bg-cyan-700'
                                                        }`}
                                                >
                                                    {sede}
                                                </button>
                                            ))}
                                        </div>

                                        <label className="block text-xs font-bold uppercase mb-2 opacity-80">2. Seleccione Grupo de Destino</label>
                                        <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-40 p-1 bg-cyan-700/30 rounded-xl">
                                            {allGrupos.filter(g => {
                                                // Filter groups by selected Sede
                                                return estudiantes.some(e => e.grupo === g && e.sede === moveSedeFilter);
                                            }).map(g => (
                                                <button
                                                    key={g}
                                                    onClick={() => setTargetGrupo(g)}
                                                    className={`py-2 px-1 rounded-lg text-[10px] font-bold transition-all border ${targetGrupo === g
                                                        ? 'bg-white text-cyan-600 border-white shadow-md'
                                                        : 'bg-cyan-700/50 text-cyan-100 border-cyan-500/30 hover:bg-cyan-600'
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
                                        className="bg-white text-cyan-600 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-cyan-50 transition-colors"
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
                                <p className="text-cyan-100 text-sm mb-6">Este cambio afectará a TODOS los estudiantes del grupo seleccionado.</p>

                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold uppercase mb-2 opacity-80">1. Filtrar por Sede</label>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {['Principal', 'Primaria', 'Maria Inmaculada'].map(sede => (
                                                <button
                                                    key={sede}
                                                    onClick={() => setRenameSedeFilter(sede)}
                                                    className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${renameSedeFilter === sede
                                                        ? 'bg-cyan-800 text-white border-cyan-400'
                                                        : 'bg-cyan-700/50 text-cyan-200 border-transparent hover:bg-cyan-700'
                                                        }`}
                                                >
                                                    {sede}
                                                </button>
                                            ))}
                                        </div>

                                        <label className="block text-xs font-bold uppercase mb-2 opacity-80">2. Seleccione Grupo Original</label>
                                        <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-40 p-1 bg-cyan-700/30 rounded-xl">
                                            {allGrupos.filter(g => {
                                                // Filter groups by selected Sede
                                                return estudiantes.some(e => e.grupo === g && e.sede === renameSedeFilter);
                                            }).map(g => (
                                                <button
                                                    key={g}
                                                    onClick={() => setRenamingGrupo({ ...renamingGrupo, oldName: g })}
                                                    className={`py-2 px-1 rounded-lg text-[10px] font-bold transition-all border ${renamingGrupo.oldName === g
                                                        ? 'bg-white text-cyan-600 border-white shadow-md'
                                                        : 'bg-cyan-700/50 text-cyan-100 border-cyan-500/30 hover:bg-cyan-600'
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
                                            className="w-full bg-cyan-700 border-none rounded-xl px-4 py-3 text-white placeholder-cyan-300 focus:ring-2 focus:ring-white"
                                        />
                                    </div>
                                    <button
                                        onClick={handleRenameGroup}
                                        disabled={!renamingGrupo.oldName || !renamingGrupo.newName}
                                        className="bg-white text-cyan-600 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-cyan-50 transition-colors"
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
                                    <p className="text-cyan-100 text-xs opacity-80">Actualiza el estado de los {selectedStudents.length} estudiantes seleccionados.</p>
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
                                <p className="text-cyan-100 text-sm mb-6">Actualiza la sede de TODOS los estudiantes del grupo seleccionado.</p>

                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold uppercase mb-2 opacity-80">1. Filtrar por Sede Actual</label>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {['Todas', 'Principal', 'Primaria', 'Maria Inmaculada'].map(sede => (
                                                <button
                                                    key={sede}
                                                    onClick={() => setSourceSedeFilter(sede)}
                                                    className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${sourceSedeFilter === sede
                                                        ? 'bg-cyan-800 text-white border-cyan-400'
                                                        : 'bg-cyan-700/50 text-cyan-200 border-transparent hover:bg-cyan-700'
                                                        }`}
                                                >
                                                    {sede}
                                                </button>
                                            ))}
                                        </div>

                                        <label className="block text-xs font-bold uppercase mb-2 opacity-80">2. Seleccione Grupo ({sourceSedeFilter === 'Todas' ? 'Todos' : sourceSedeFilter})</label>
                                        <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-40 p-1 bg-cyan-700/30 rounded-xl">
                                            {allGrupos.filter(g => {
                                                if (sourceSedeFilter === 'Todas') return true;
                                                // Check if group belongs to selected sede (has at least one student in that sede)
                                                return estudiantes.some(e => e.grupo === g && e.sede === sourceSedeFilter);
                                            }).map(g => (
                                                <button
                                                    key={g}
                                                    onClick={() => setChangingSede(prev => ({ ...prev, grupo: g }))}
                                                    className={`py-2 px-1 rounded-lg text-[10px] font-bold transition-all border ${changingSede.grupo === g
                                                        ? 'bg-white text-cyan-600 border-white shadow-md'
                                                        : 'bg-cyan-700/50 text-cyan-100 border-cyan-500/30 hover:bg-cyan-600'
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
                                                        ? 'bg-white text-cyan-600 border-white shadow-md'
                                                        : 'bg-cyan-700/50 text-cyan-100 border-cyan-500/30 hover:bg-cyan-600'
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
                                        className="bg-white text-cyan-600 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-cyan-50 transition-colors"
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
                                <p className="text-cyan-100 text-sm mb-6">Descarga todos los datos del sistema en formato Excel para respaldo seguro.</p>

                                <div className="flex gap-4">
                                    <button
                                        onClick={handleBackup}
                                        className="w-full bg-white text-cyan-600 hover:bg-cyan-50 px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-colors shadow-lg"
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

                        {activeTab === 'cleanup' && (
                            <>
                                <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
                                    <Settings className="w-5 h-5" />
                                    Limpieza de Datos Obsoletos
                                </h2>
                                <p className="text-cyan-100 text-sm mb-6">Esta herramienta elimina estudiantes que pertenecen a grupos que NO están en la lista oficial del 30 de enero de 2026.</p>

                                <div className="bg-red-500/20 border border-red-500/30 p-4 rounded-xl mb-6">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="w-6 h-6 text-red-100 mt-1 shrink-0" />
                                        <div>
                                            <p className="font-bold text-red-50">¡Advertencia!</p>
                                            <p className="text-xs text-red-100/80">
                                                Se eliminarán permanentemente los estudiantes de grupos no válidos (Ej. grupos del 2025 o duplicados con nombres incorrectos).
                                                Asegúrate de haber generado un respaldo primero.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4">
                                    <div className="bg-cyan-700/30 p-4 rounded-xl">
                                        <p className="text-xs font-bold uppercase mb-2 opacity-80 underline decoration-cyan-400">Grupos que se conservarán (41):</p>
                                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar">
                                            {VALID_GROUPS.map(g => (
                                                <span key={g} className="text-[9px] bg-cyan-700/50 px-2 py-0.5 rounded-full font-mono">{g}</span>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleCleanupOrphans}
                                        className="w-full bg-red-600 hover:bg-red-500 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-red-900/40 active:scale-95"
                                    >
                                        <AlertTriangle className="w-6 h-6" />
                                        <div className="text-left">
                                            <div className="text-sm uppercase tracking-tight">Iniciar Purga de Grupos Obsoletos</div>
                                            <div className="text-[10px] opacity-70 font-normal">Identifica y elimina estudiantes fuera de lista</div>
                                        </div>
                                    </button>
                                </div>
                            </>
                        )}

                        {activeTab === 'usuarios' && (
                            <>
                                <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
                                    <Users className="w-5 h-5" />
                                    Gestión de Usuarios Registrados
                                </h2>
                                <p className="text-cyan-100 text-sm">Elimina cuentas de usuarios que no pertenecen a la institución o que se registraron con un correo incorrecto.</p>
                            </>
                        )}
                    </div>
                    <Settings className="absolute -bottom-4 -right-4 w-32 h-32 text-white/10" />
                </div>

                {/* Usuarios list (solo tab usuarios) */}
                {activeTab === 'usuarios' && (
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                                    <Search className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre, correo o rol..."
                                    value={usersSearch}
                                    onChange={(e) => setUsersSearch(e.target.value)}
                                    className="block w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-800 border-none rounded-full text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 placeholder:font-bold focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 shadow-xl transition-all duration-300"
                                />
                            </div>
                            <button
                                onClick={fetchUsers}
                                disabled={fetchingUsers}
                                className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-gray-800 rounded-full shadow-xl font-bold text-sm text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50 border border-gray-100 dark:border-gray-700"
                                title="Actualizar lista"
                            >
                                <RefreshCcw className={`w-4 h-4 ${fetchingUsers ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">Actualizar</span>
                            </button>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-rose-50/80 dark:bg-rose-900/30 border-b border-rose-100 dark:border-rose-800/30">
                                            <th className="px-4 py-4 text-xs font-black text-rose-800 dark:text-rose-300 uppercase tracking-wider">Usuario</th>
                                            <th className="px-4 py-4 text-xs font-black text-rose-800 dark:text-rose-300 uppercase tracking-wider text-center">Rol</th>
                                            <th className="px-4 py-4 text-xs font-black text-rose-800 dark:text-rose-300 uppercase tracking-wider text-right">Registrado</th>
                                            <th className="px-4 py-4 text-xs font-black text-rose-800 dark:text-rose-300 uppercase tracking-wider text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                        {appUsers
                                            .filter(u =>
                                                (u.email || '').toLowerCase().includes(usersSearch.toLowerCase()) ||
                                                (u.user_metadata?.nombre || '').toLowerCase().includes(usersSearch.toLowerCase()) ||
                                                (u.user_metadata?.rol || '').toLowerCase().includes(usersSearch.toLowerCase())
                                            )
                                            .map(u => (
                                                <tr key={u.id} className="group hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors">
                                                    <td className="px-4 py-4">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{u.user_metadata?.nombre || '—'}</span>
                                                            <span className="text-xs text-gray-400 font-mono">{u.email}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${u.user_metadata?.rol === 'admin' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' :
                                                            u.user_metadata?.rol === 'docente' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                                                                u.user_metadata?.rol === 'estudiante_pae' || u.user_metadata?.rol === 'estudiante' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                                                                    'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                                            }`}>{u.user_metadata?.rol || 'sin rol'}</span>
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <span className="text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString('es-CO')}</span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <button
                                                            onClick={() => handleDeleteUser(u.id, u.email || '')}
                                                            className="p-2 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all active:scale-95"
                                                            title="Eliminar usuario"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        {appUsers.length === 0 && (
                                            <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-400 text-sm">No hay usuarios cargados. Haz clic en &quot;Usuarios&quot; en la pestaña para cargar.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Buscador y lista de Estudiantes (oculto en tab usuarios) */}
                {activeTab !== 'usuarios' && (
                    <>
                        <div className="relative mb-8">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar por nombre, matrícula o grupo..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="block w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-800 border-none rounded-full text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 placeholder:font-bold focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 shadow-xl transition-all duration-300"
                            />
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-cyan-50/80 dark:bg-cyan-900/40 border-b border-cyan-100 dark:border-cyan-800/30">
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
                                            <th className="px-4 py-4 text-xs font-black text-cyan-800 dark:text-cyan-300 uppercase tracking-wider">Estudiante</th>
                                            <th className="px-4 py-4 text-xs font-black text-cyan-800 dark:text-cyan-300 uppercase tracking-wider text-right">Información Académica</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                        {filteredEstudiantes.map(est => (
                                            <tr
                                                key={est.id}
                                                className={`group transition-all duration-200 cursor-pointer ${selectedStudents.includes(est.id) ? 'bg-cyan-50/60 dark:bg-cyan-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
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
                                                        <div className={`font-bold text-sm ${est.estado === 'inactivo' ? 'text-gray-400 dark:text-gray-500 line-through decoration-2' : 'text-gray-900 dark:text-gray-100'}`}>
                                                            {est.nombre}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
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
                                                        <div className="bg-[#0891B2]/10 dark:bg-[#0891B2]/20 text-[#0891B2] dark:text-cyan-300 px-3 py-1 rounded-lg text-xs font-black inline-block">
                                                            {est.grupo}
                                                        </div>
                                                        <div className="text-[10px] font-bold text-cyan-600/80 dark:text-cyan-400/80 uppercase tracking-wide">
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
                    </>
                )}
            </div>

            {/* Modal de Carga Masiva (Año Nuevo) */}
            {
                activeTab === 'backup' && (
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border-none ring-1 ring-black/5 dark:ring-white/10 p-8">
                        <h2 className="text-2xl font-black text-[#0891B2] dark:text-cyan-400 mb-6 flex items-center gap-3">
                            <div className="p-2 bg-cyan-50 dark:bg-cyan-900/30 rounded-xl">
                                <UploadCloud className="w-6 h-6 text-[#0891B2]" />
                            </div>
                            Carga Masiva y Cambio de Año
                        </h2>

                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                            Sube el archivo de listas de estudiantes (Excel con múltiples hojas) para actualizar el sistema al nuevo año escolar.
                            El sistema usará la <strong>Matrícula</strong> para identificar a los estudiantes y preservar su historial.
                        </p>

                        <div className="space-y-6 max-w-xl">
                            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-100 dark:border-orange-800/30">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="mt-1 w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        checked={inactivateAll}
                                        onChange={e => setInactivateAll(e.target.checked)}
                                    />
                                    <div>
                                        <span className="font-bold text-gray-900 dark:text-white block text-sm">Inactivar a todos los estudiantes actuales</span>
                                        <span className="text-xs text-orange-800 dark:text-orange-300 mt-1 block">
                                            Recomendado para inicio de año. Todos los estudiantes pasarán a estado "Inactivo".
                                            Solo se reactivarán los que aparezcan en el nuevo archivo excel.
                                        </span>
                                    </div>
                                </label>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Seleccionar Archivo Excel (.xlsx)</label>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={handleBulkUpload}
                                    disabled={uploading}
                                    className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900 transition-all border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer"
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
                                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 max-h-40 overflow-y-auto text-xs font-mono space-y-1">
                                    {importLog.map((log, i) => (
                                        <div key={i} className={log.includes('Error') ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-600 dark:text-gray-400'}>
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200 border border-white/20 dark:border-gray-700">
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
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{confirmModal.title}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{confirmModal.message}</p>
                                </div>

                                <div className="flex gap-3 w-full mt-2">
                                    <button
                                        onClick={confirmModal.onCancel}
                                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
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
