const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumnExistence() {
    console.log('Querying estudiantes table for email column...');
    const { data, error } = await supabase.from('estudiantes').select('email').limit(1);

    if (error) {
        console.error('Supabase Error:', error.code, error.message);
        if (error.code === 'PGRST200' || error.message.includes("Could not find the 'email' column")) {
            console.log('\n--- RESULT ---');
            console.log('The column "email" DOES NOT exist in the "estudiantes" table.');
            console.log('--------------\n');
        }
    } else {
        console.log('\n--- RESULT ---');
        console.log('The column "email" EXISTS in the "estudiantes" table.');
        console.log('--------------\n');
    }
}

checkColumnExistence();
