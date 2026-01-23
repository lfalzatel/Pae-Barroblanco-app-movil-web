require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGrade11() {
    const { data: allStudents, error: err1 } = await supabase
        .from('estudiantes')
        .select('grado, estado');

    if (err1) {
        fs.writeFileSync('grade_check.txt', 'Error fetching students: ' + err1.message);
        return;
    }

    const gradeCounts = {};
    allStudents.forEach(s => {
        const g = String(s.grado || 'Sin Grado').trim();
        if (!gradeCounts[g]) gradeCounts[g] = { total: 0, active: 0, inactive: 0 };
        gradeCounts[g].total++;
        const estado = (s.estado || '').toLowerCase();
        if (estado === 'inactivo') gradeCounts[g].inactive++;
        else gradeCounts[g].active++;
    });

    let output = '--- RESUMEN_GRADOS ---\n';
    for (const [grado, counts] of Object.entries(gradeCounts)) {
        output += `GRADO: "${grado}" => ACTIVOS: ${counts.active}, INACTIVOS: ${counts.inactive}\n`;
    }

    fs.writeFileSync('grade_check.txt', output);
}

checkGrade11();
