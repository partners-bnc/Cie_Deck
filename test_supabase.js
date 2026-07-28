import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load env
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function run() {
  console.log('Calling rpc refresh_dashboard_aggregates...');
  const { data: rpcData, error: rpcError } = await supabase.rpc('refresh_dashboard_aggregates');
  console.log('RPC result:', rpcData);
  console.log('RPC error:', rpcError);

  const { data: statsData, error: statsError } = await supabase.from('dashboard_hr_daily_stats').select('*');
  console.log('Stats count:', statsData?.length);
  console.log('Stats sample:', statsData?.slice(0, 5));
}
run();
