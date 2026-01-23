require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGrade11() {
    const { data: allStudents, error: err1 } = await supabase
        .from('estudiantes')
        .select('grado, estado');

    if (err1) {
        console.error('Error fetching students:', err1);
        return;
    }

    const gradeCounts = {};
    allStudents.forEach(s => {
        const g = String(s.grado || 'Sin Grado').trim();
        if (!gradeCounts[g]) gradeCounts[g] = { total: 0, active: 0, inactive: 0 };
        gradeCounts[g].total++;
        // Normalize optional status
        const estado = (s.estado || '').toLowerCase();
        if (estado === 'inactivo') gradeCounts[g].inactive++;
        else gradeCounts[g].active++;
    });

    console.log('--- RESUMEN_GRADOS ---');
    for (const [grado, counts] of Object.entries(gradeCounts)) {
        if (grado.includes('11') || grado === '11') {
            console.log(`GRADO_11_MATCH: "${grado}" => ACTIVOS: ${counts.active}, INACTIVOS: ${counts.inactive}`);
        }
        console.log(`GRADO: "${grado}" => ACTIVOS: ${counts.active}, INACTIVOS: ${counts.inactive}`);
    }
}

checkGrade11();
