
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load envs
// Note: In this environment I cannot easily read the .env.local file directly via require if it's not standard
// so I will rely on the process.env if available, or I will read the file manually.
// For now, I'll attempt to construct the client assuming the tool context has access to the envs or I will define them manually if I can view them (Security rule: I cannot view them).
// I will try to read the file content first to get the tokens safely or ask the user.
// WAIT, I can read the file using read_resource if it was a resource or view_file.
// But I should try to run a script that uses the existing node_modules logic if possible.
// Better: I will create a script that hardcodes the URL and Key if I can find them in the code or environment (I can't see them).
// Alternative: I will create a test script that the user can run, but I have run_command.

// Let's try to just use the existing client if I can import it? No, it's typescript.
// I will creating a simple JS script that tries to read the .env.local and query.

const fs = require('fs');
const path = require('path');

try {
    const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} catch (e) {
    console.log('Could not read .env.local', e.message);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase keys');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log('Testing connection to:', supabaseUrl);

    // 1. Test Auth (Public)
    console.log('1. Testing Auth (User)...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
        console.log('Auth check failed (Expected if not logged in):', authError.message);
    } else {
        console.log('Auth check success, User:', user ? user.id : 'No active session');
    }

    // 2. Test Fetching Schedules (Anonymous/Public access?)
    console.log('2. Testing Fetch Schedules...');
    // The error 406 often comes from Header issues or RLS.
    // "Not Acceptable" suggests the server cannot produce a response matching the list of acceptable values defined in the request's proactive negotiation header.
    // In PostgREST (Supabase), 406 usually means the `Accept` header doesn't match `application/json` or `text/csv` etc,
    // OR it could be an issue with the `schedules` table schema not matching what is requested (e.g. `select=items`).

    const { data, error } = await supabase
        .from('schedules')
        .select('items')
        .limit(1);

    if (error) {
        console.error('Error fetching schedules:', error);
    } else {
        console.log('Success fetching schedules:', data);
    }
}

testConnection();
