const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('date', '2026-01-21')
        .single();

    console.log(JSON.stringify({ data, error }, null, 2));
}

check();
