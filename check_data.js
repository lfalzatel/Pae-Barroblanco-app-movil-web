
import { createClient } from '@supabase/supabase-client';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAttendance() {
    const { data, error, count } = await supabase
        .from('asistencia_pae')
        .select('fecha, estudiantes!inner(sede, grupo)', { count: 'exact' })
        .gte('fecha', '2026-01-18')
        .lte('fecha', '2026-01-21');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Total rows found:', count);
    const dates = new Set(data.map(d => d.fecha));
    console.log('Unique dates:', Array.from(dates));

    const sedes = new Set(data.map(d => d.estudiantes.sede));
    console.log('Unique sedes with data:', Array.from(sedes));

    const sampleGroups = data.slice(0, 10).map(d => d.estudiantes.grupo);
    console.log('Sample groups:', sampleGroups);
}

checkAttendance();
