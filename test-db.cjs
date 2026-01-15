const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    // Fallback for debugging if dotenv fails to find file in CWD
    console.log('Current directory:', process.cwd());
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFetch() {
    console.log('Fetching orders...');
    const { data, error } = await supabase
        .from('orders')
        .select('*');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Orders found:', data?.length);
        console.log(data);
    }
}

testFetch();
