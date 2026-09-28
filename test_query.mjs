import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bvvqyjqokvnttbgyjkrt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2dnF5anFva3ZudHRiZ3lqa3J0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTEwNjgsImV4cCI6MjA5MDI2NzA2OH0._86TJOSSngKZdVz4NqT3ONzQCUA9RjjUySew6qYhJJw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Testing Supabase Queries...');

  // 1. Test client_jobs query
  const { data: jobs, error: jobsErr } = await supabase
    .from('client_jobs')
    .select('job_code, job_title, client_name, business_unit, recruitment_manager, created_on, status')
    .ilike('status', '%active%');

  console.log('Active client_jobs count:', jobs?.length, 'Error:', jobsErr);
  if (jobs && jobs.length > 0) {
    console.log('Sample Active JPC:', jobs[0]);
  }

  // 2. Test tagged_candidates query
  const { data: tagged, error: tagErr } = await supabase
    .from('tagged_candidates')
    .select('id, applicant_code, name, job_code, shortlisted_by, created_at, current_stage')
    .limit(5);

  console.log('Tagged candidates count:', tagged?.length, 'Error:', tagErr);
  if (tagged && tagged.length > 0) {
    console.log('Sample Tagged:', tagged[0]);
  }

  // 3. Test applicants with screening
  const { data: applicants, error: appErr } = await supabase
    .from('applicants')
    .select('applicant_code, screening')
    .not('screening', 'is', null);

  console.log('Applicants with screening count:', applicants?.length, 'Error:', appErr);
  if (applicants) {
    const screenedOnly = applicants.filter(a => a.screening && (Array.isArray(a.screening) ? a.screening.length > 0 : a.screening !== '[]'));
    console.log('Non-empty screening count:', screenedOnly.length);
    console.log('Sample screening data:', JSON.stringify(screenedOnly.slice(0, 3), null, 2));
  }
}

test();
