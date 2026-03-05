const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoles() {
    console.log('Fetching perfiles_publicos...');
    const { data, error } = await supabase.from('perfiles_publicos').select('*');
    if (error) {
        console.error('Error:', error.message);
        return;
    }

    const admin = data.find(user => user.email === 'lfalzatel@gmail.com');
    console.log('User lfalzatel@gmail.com:');
    console.log(admin);

}

checkRoles();
