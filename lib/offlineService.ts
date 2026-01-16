export interface PendingAttendance {
    estudiante_id: string;
    fecha: string;
    estado: string;
    registrado_por: string;
    novedad_tipo?: string | null;
    novedad_descripcion?: string | null;
}

const STORAGE_KEY = 'pae_pending_attendance';

export const OfflineService = {
    savePending: (records: PendingAttendance[]) => {
        const existing = OfflineService.getPending();
        // Utilizar un Map para evitar duplicados por combinación de estudiante y fecha
        const map = new Map();

        // Importante: Los nuevos registros sobrescriben a los viejos pendientes si coinciden
        [...existing, ...records].forEach(r => {
            const key = `${r.estudiante_id}_${r.fecha}`;
            map.set(key, r);
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(map.values())));
    },

    getPending: (): PendingAttendance[] => {
        if (typeof window === 'undefined') return [];
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },

    clearPending: () => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(STORAGE_KEY);
    },

    removeSynced: (syncedRecords: PendingAttendance[]) => {
        const pending = OfflineService.getPending();
        const syncedKeys = new Set(syncedRecords.map(r => `${r.estudiante_id}_${r.fecha}`));
        const remaining = pending.filter(r => !syncedKeys.has(`${r.estudiante_id}_${r.fecha}`));

        if (remaining.length === 0) {
            OfflineService.clearPending();
        } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
        }
    },

    isOnline: () => {
        return typeof window !== 'undefined' ? window.navigator.onLine : true;
    }
};
