import { createClient } from '@supabase/supabase-client';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function check() {
    const { data, error } = await supabase
        .from('estudiantes')
        .select('id, nombre, grupo, sede, estado')
        .ilike('sede', '%Principal%')
        .or('grupo.ilike.%Preescolar%,grupo.ilike.%Transic%,grupo.eq.TS0100');

    if (error) {
        console.error(error);
        return;
    }

    console.log('--- REPORTE DE PREESCOLAR (PRINCIPAL) ---');
    console.log('Total encotrados:', data.length);
    
    const byStatus = data.reduce((acc: any, s: any) => {
        const k = s.estado || 'NULL';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
    }, {});
    console.log('Por Estado:', byStatus);

    data.forEach((s: any) => {
        if (s.estado !== 'activo') {
            console.log(`- [${s.estado}] ${s.nombre} (Grupo: ${s.grupo})`);
        }
    });
}
check();
