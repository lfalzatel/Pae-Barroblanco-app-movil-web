require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function countStudents() {
    const { count, error } = await supabase
        .from('estudiantes')
        .select('*', { count: 'exact', head: true });

    let result = '';
    if (error) {
        result = 'Error: ' + error.message;
    } else {
        result = 'Total Estudiantes: ' + count;
    }

    fs.writeFileSync('count_check.txt', result);
    console.log(result);
}

countStudents();
