import { supabase, SUPABASE_URL } from './supabaseClient.js';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const SUPABASE_PAGE_SIZE = 1000;
const CACHE_PREFIX = 'bnc_job_cache_v5';
const inflightRequests = new Map();
const cache = {
  jobs: { data: null, timestamp: 0 },
  candidates: { data: null, timestamp: 0 },
  databaseCandidates: { data: null, timestamp: 0 },
  shortlisted: { data: null, timestamp: 0 },
  clients: { data: null, timestamp: 0 },
  clientJobs: { data: null, timestamp: 0 },
  hrs: { data: null, timestamp: 0 },
  dashboardSummary: { data: null, timestamp: 0 },
  dashboardAnalytics: { data: null, timestamp: 0 }
};

const APPLICANT_LIST_COLUMNS = [
  'id',
  'applicant_code',
  'source',
  'full_name',
  'email',
  'mobile_number',
  'current_location',
  'current_company',
  'current_position',
  'total_experience',
  'education',
  'skills',
  'job_applied_for',
  'job_id',
  'resume_link',
  'uploaded_by',
  'created_on',
  'status',
  'ai_score',
  'shortlist_decision',
  'shortlist_reason',
  'certification',
  'relevant_experience',
  'current_ctc',
  'expected_pay',
  'notice_period',
  'process_knowledge',
  'reason_for_change',
  'work_authorization',
  'recruiter_comments',
  'last_viewed_by',
  'screening'
].join(',');

const APPLICANT_DETAIL_COLUMNS = [
  APPLICANT_LIST_COLUMNS,
  'cv_summary',
  'ai_analysis',
  'aadhar_number',
  'nationality',
  'language_details',
  'technical_rating',
  'communication_rating',
  'professionalism_rating',
  'overall_rating'
].join(',');

function canUseStorage() {
  return typeof window !== 'undefined' && !!window.sessionStorage;
}

function readCacheEntry(key) {
  const memoryEntry = cache[key];
  if (memoryEntry?.data && Date.now() - memoryEntry.timestamp < CACHE_DURATION) {
    return memoryEntry.data;
  }

  if (!canUseStorage()) return null;

  try {
    const raw = window.sessionStorage.getItem(`${CACHE_PREFIX}:${key}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.timestamp || Date.now() - parsed.timestamp >= CACHE_DURATION) {
      window.sessionStorage.removeItem(`${CACHE_PREFIX}:${key}`);
      return null;
    }

    if (memoryEntry) {
      cache[key] = parsed;
    }
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

function writeCacheEntry(key, data) {
  const entry = { data, timestamp: Date.now() };
  if (cache[key]) {
    cache[key] = entry;
  }

  if (!canUseStorage()) return;

  try {
    window.sessionStorage.setItem(`${CACHE_PREFIX}:${key}`, JSON.stringify(entry));
  } catch {
    // Ignore storage quota errors and keep using in-memory cache.
  }
}

function removeCacheEntry(key) {
  if (cache[key]) {
    cache[key] = { data: null, timestamp: 0 };
  }
  inflightRequests.delete(key);

  if (!canUseStorage()) return;

  try {
    window.sessionStorage.removeItem(`${CACHE_PREFIX}:${key}`);
  } catch {
    // Ignore storage cleanup errors.
  }
}

async function withCache(key, loader) {
  const cached = readCacheEntry(key);
  if (cached) return cached;

  if (inflightRequests.has(key)) {
    return inflightRequests.get(key);
  }

  const request = (async () => {
    try {
      const data = await loader();
      writeCacheEntry(key, data);
      return data;
    } finally {
      inflightRequests.delete(key);
    }
  })();

  inflightRequests.set(key, request);
  return request;
}

function mapApplicantRow(r) {
  return {
    applicantId: r.applicant_code || '',
    _uuid: r.id,
    source: r.source || '',
    name: r.full_name || '',
    email: r.email || '',
    contactNumber: r.mobile_number || '',
    currentLocation: r.current_location || '',
    currentCompany: r.current_company || '',
    currentPosition: r.current_position || '',
    totalExperience: r.total_experience || '',
    education: r.education || '',
    skills: r.skills || '',
    summary: r.cv_summary || '',
    jobAppliedFor: r.job_applied_for || '',
    jobId: r.job_id || '',
    resumeLink: r.resume_link || '',
    uploadedBy: r.uploaded_by || '',
    createdOn: r.created_on || '',
    aiScore: r.ai_score,
    aiAnalysis: r.ai_analysis || '',
    shortlistDecision: r.shortlist_decision || '',
    shortlistReason: r.shortlist_reason || '',
    status: r.status || 'Applied',
    certification: r.certification || '',
    relevantExperience: r.relevant_experience || '',
    currentCTC: r.current_ctc || '',
    expectedPay: r.expected_pay || '',
    noticePeriod: r.notice_period || '',
    processKnowledge: r.process_knowledge || '',
    reasonForChange: r.reason_for_change || '',
    workAuthorization: r.work_authorization || '',
    recruiterComments: r.recruiter_comments || '',
    aadharNumber: r.aadhar_number || '',
    nationality: r.nationality || '',
    language: r.language_details || '',
    technicalRating: r.technical_rating ?? '',
    communicationRating: r.communication_rating ?? '',
    professionalismRating: r.professionalism_rating ?? '',
    overallRating: r.overall_rating ?? '',
    lastViewedBy: r.last_viewed_by || '',
    screening: Array.isArray(r.screening)
      ? r.screening
      : (typeof r.screening === 'string'
        ? (() => { try { return JSON.parse(r.screening); } catch { return []; } })()
        : [])
  };
}

function sanitizeSearchTerm(value) {
  return (value || '').replace(/[%()]/g, ' ').trim();
}

function buildIlikeOrFilter(columns, value) {
  const term = sanitizeSearchTerm(value);
  if (!term) return '';
  return columns.map(column => `${column}.ilike.%${term}%`).join(',');
}

const APPLICANT_SORT_MAP = {
  applicantId: 'applicant_code',
  name: 'full_name',
  contactNumber: 'mobile_number',
  currentPosition: 'current_position',
  source: 'source',
  uploadedBy: 'uploaded_by',
  totalExperience: 'total_experience',
  status: 'status',
  createdOn: 'created_on'
};

function applyApplicantFilters(query, options = {}) {
  const {
    search = '',
    searchHr = '',
    searchDate = '',
    filterSource = '',
    filterStatus = '',
    filterAI = '',
    filterExp = '',
    filterDateFrom = '',
    filterDateTo = '',
    filterJobTitle = '',
    filterSkills = ''
  } = options;

  if (search && search.trim()) {
    const searchTokens = search.split(',').map(t => sanitizeSearchTerm(t)).filter(Boolean);
    const searchCols = [
      'full_name', 'email', 'mobile_number', 'skills',
      'current_position', 'job_applied_for', 'current_company',
      'applicant_code', 'uploaded_by'
    ];
    searchTokens.forEach(token => {
      const orClause = searchCols.map(col => `${col}.ilike.%${token}%`).join(',');
      query = query.or(orClause);
    });
  }

  if (searchHr) query = query.ilike('uploaded_by', `%${sanitizeSearchTerm(searchHr)}%`);
  if (searchDate) query = query.gte('created_on', `${searchDate}T00:00:00`).lt('created_on', `${searchDate}T23:59:59.999`);
  if (filterSource) query = query.ilike('source', `${sanitizeSearchTerm(filterSource)}%`);
  if (filterStatus) query = query.eq('status', filterStatus);
  if (filterAI) query = query.eq('shortlist_decision', filterAI);
  if (filterExp) query = query.eq('total_experience', filterExp);
  if (filterDateFrom) query = query.gte('created_on', `${filterDateFrom}T00:00:00`);
  if (filterDateTo) query = query.lte('created_on', `${filterDateTo}T23:59:59.999`);
  if (filterJobTitle && filterJobTitle.trim()) {
    const jobTokens = filterJobTitle.split(',').map(t => sanitizeSearchTerm(t)).filter(Boolean);
    jobTokens.forEach(token => {
      const jobTitleFilter = ['job_applied_for', 'current_position'].map(col => `${col}.ilike.%${token}%`).join(',');
      query = query.or(jobTitleFilter);
    });
  }

  if (filterSkills && filterSkills.trim()) {
    const skillTerms = filterSkills
      .split(',')
      .map(term => sanitizeSearchTerm(term))
      .filter(Boolean);

    skillTerms.forEach((term) => {
      query = query.ilike('skills', `%${term}%`);
    });
  }

  return query;
}

function mapShortlistRow(s) {
  return {
    applicantId: s.applicant_code || '',
    name: s.name || '',
    jobRole: s.job_role || '',
    company: s.company || '',
    shortlistedBy: s.shortlisted_by || '',
    date: s.created_at || null,
    jobCode: s.job_code || '',
    currentStage: s.current_stage || 'Pipeline',
    managerSubmittedAt: s.manager_submitted_at || null,
    clientSubmittedAt: s.client_submitted_at || null,
    feedbackReceivedAt: s.feedback_received_at || null,
    shortlistedOn: s.created_at || null,
    id: s.id
  };
}

function mapClientRow(c) {
  return {
    clientId: c.client_id || '',
    clientName: c.client_name || '',
    website: c.website || '',
    industry: c.industry || '',
    status: c.status || '',
    primaryOwner: c.managed_by || '',
    businessUnit: c.business_unit || '',
    displayOnJobPosting: c.display_on_job_posting || '',
    reportingContacts: (c.client_reporting_contact || []).map((rc) => ({
      id: rc.id,
      name: rc.contact_name,
      email: rc.email,
      contact: rc.phone,
      department: rc.department || ''
    })),
    reportingContactsCount: Array.isArray(c.client_reporting_contact)
      ? c.client_reporting_contact.length
      : (c.reporting_contacts_count || 0),
    createdBy: c.created_by || '',
    createdOn: c.created_on || '',
    modifiedOn: c.modified_on || '',
    modifiedBy: c.modified_by || '',
  };
}

function mapClientJobRow(j) {
  return {
    jobCode: j.job_code || '',
    jobTitle: j.job_title || '',
    jobType: j.job_type || '',
    jobMode: j.job_mode || '',
    businessUnit: j.business_unit || '',
    clientName: j.client_name || '',
    clientId: j.client_id || '',
    location: j.location || '',
    state: j.state || '',
    country: j.country || '',
    payRate: j.pay_rate || '',
    experience: j.experience || '',
    jobDescription: j.job_description || '',
    createdBy: j.created_by || '',
    createdOn: j.created_on || '',
    recruitmentManager: j.recruitment_manager || '',
    status: j.status || '',
    modifiedOn: j.modified_on || '',
    modifiedBy: j.modified_by || '',
    priority: j.priority || 'Medium',
    assignedTo: j.assigned_to || '',
    reportingClientName: j.reporting_client_name || '',
    reportingClientEmail: j.reporting_client_email || '',
    reportingClientContact: j.reporting_client_contact || '',
  };
}

function resolveTaggedDateRange({ dateFrom = '', dateTo = '', periodYear = '', periodMonth = '' } = {}) {
  let start = dateFrom ? `${dateFrom}T00:00:00` : '';
  let end = dateTo ? `${dateTo}T23:59:59.999` : '';

  if (periodYear) {
    start = `${periodYear}-01-01T00:00:00`;
    end = `${periodYear}-12-31T23:59:59.999`;
  }

  if (periodMonth) {
    const [year, month] = periodMonth.split('-').map((value) => parseInt(value, 10));
    const lastDay = new Date(year, month, 0).getDate();
    start = `${periodMonth}-01T00:00:00`;
    end = `${periodMonth}-${String(lastDay).padStart(2, '0')}T23:59:59.999`;
  }

  return { start, end };
}

async function fetchAllLightweightRows(table, columns) {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, to);

    if (error) throw error;
    if (!data?.length) break;

    rows.push(...data);

    if (data.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
  }

  return rows;
}

async function fetchJobContactsByCodes(jobCodes = []) {
  const uniqueCodes = Array.from(new Set((jobCodes || []).filter(Boolean)));
  if (!uniqueCodes.length) return new Map();

  const { data, error } = await supabase
    .from('client_jobs')
    .select('job_code, reporting_client_name')
    .in('job_code', uniqueCodes);

  if (error) throw error;

  return new Map((data || []).map((job) => [job.job_code || '', job.reporting_client_name || '']));
}

export const jobService = {
  clearCache(key) {
    if (key && cache[key]) {
      removeCacheEntry(key);
    } else {
      Object.keys(cache).forEach(removeCacheEntry);
    }
  },

  // ─────────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────────
  async adminLogin(loginId, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginId.toLowerCase().trim(),
        password: password,
      });
      if (error) return { error: error.message };

      // Fetch admin profile
      const { data: admin, error: adminError } = await supabase
        .from('admin_users')
        .select('hr_name, email, role, designation')
        .eq('auth_id', data.user.id)
        .eq('is_active', true)
        .single();

      if (adminError || !admin) {
        await supabase.auth.signOut();
        return { error: 'Account not authorized. Contact your administrator.' };
      }

      return {
        success: true,
        loginId: admin.email,
        hrName: admin.hr_name,
        role: admin.role,
        designation: admin.designation,
      };
    } catch (error) {
      return { error: error.toString() };
    }
  },

  async adminLogout() {
    await supabase.auth.signOut();
    this.clearCache();
  },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  // ─────────────────────────────────────────────
  // JOBS (Public Job Listings)
  // ─────────────────────────────────────────────
  async fetchJobs() {
    try {
      return await withCache('jobs', async () => {
        const { data, error } = await supabase
          .from('jobs')
          .select('id, job_id, title, location, job_type, experience, salary, education, vacancy, gender, description, created_at, updated_at')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(j => ({
          id: j.job_id, title: j.title, location: j.location,
          type: j.job_type, experience: j.experience, salary: j.salary,
          education: j.education, vacancy: j.vacancy, gender: j.gender,
          description: j.description, company: 'BnC Global',
          _uuid: j.id,
          created_at: j.created_at,
          updated_at: j.updated_at
        }));
      });
    } catch (error) {
      console.error('Error fetching jobs:', error);
      return [];
    }
  },

  async fetchJobById(jobId) {
    if (cache.jobs.data && Date.now() - cache.jobs.timestamp < CACHE_DURATION) {
      const job = cache.jobs.data.find(j => j.id.toString() === jobId.toString());
      if (job) return job;
    }
    try {
      const { data, error } = await supabase.from('jobs').select('*').eq('job_id', jobId).single();
      if (error || !data) return null;
      return {
        id: data.job_id, title: data.title, location: data.location,
        type: data.job_type, experience: data.experience, salary: data.salary,
        education: data.education, vacancy: data.vacancy, gender: data.gender,
        description: data.description, company: 'BnC Global', _uuid: data.id,
        created_at: data.created_at,
        updated_at: data.updated_at,
        responsibilities: [
          'Analyze business processes and recommend improvements',
          'Collaborate with stakeholders to gather requirements',
          'Create detailed documentation and reports',
          'Support project management activities'
        ],
        requirements: [
          data.education || "Bachelor's degree required",
          (data.experience || 'Experience') + ' required',
          'Strong analytical and problem-solving skills',
          'Excellent communication abilities'
        ]
      };
    } catch (error) {
      console.error('Error fetching job:', error);
      return null;
    }
  },

  async addJob(jobData) {
    try {
      const { data, error } = await supabase.from('jobs').insert({
        title: jobData.title || '', location: jobData.location || '',
        job_type: jobData.type || '', experience: jobData.experience || '',
        salary: jobData.salary || '', education: jobData.education || '',
        vacancy: jobData.vacancy || '', gender: jobData.gender || '',
        description: jobData.description || '',
      }).select('job_id').single();

      if (error) return { error: error.message };
      this.clearCache('jobs');
      return { success: true, jobId: data.job_id, message: 'Job posted successfully' };
    } catch (error) {
      return { error: error.toString() };
    }
  },

  async updateJob(jobData) {
    try {
      const { error } = await supabase.from('jobs').update({
        title: jobData.title, location: jobData.location,
        job_type: jobData.type, experience: jobData.experience,
        salary: jobData.salary, education: jobData.education,
        vacancy: jobData.vacancy, gender: jobData.gender,
        description: jobData.description,
      }).eq('job_id', jobData.id);

      if (error) return { error: error.message };
      this.clearCache('jobs');
      return { success: true, message: 'Job updated successfully' };
    } catch (error) {
      return { error: error.toString() };
    }
  },

  async deleteJob(jobId) {
    try {
      const { error } = await supabase.from('jobs').update({ is_active: false }).eq('job_id', jobId);
      if (error) return { error: error.message };
      this.clearCache('jobs');
      return { success: true, message: 'Job deleted successfully' };
    } catch (error) {
      return { error: error.toString() };
    }
  },

  // ─────────────────────────────────────────────
  // RESUME UPLOAD (Supabase Storage)
  // ─────────────────────────────────────────────
  async uploadResume(base64Data, fileName, candidateName, overrideStorageName = null) {
    try {
      let cleanBase64 = base64Data;
      if (base64Data && base64Data.includes(',')) {
        cleanBase64 = base64Data.split(',')[1];
      }
      if (!cleanBase64) throw new Error('No base64 data provided for resume upload.');

      const binaryStr = atob(cleanBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      // Sanitize: keep only alphanumeric, underscores, hyphens, dots — strip everything else
      const ext = fileName.toLowerCase().endsWith('.pdf') ? '.pdf'
        : fileName.toLowerCase().endsWith('.docx') ? '.docx' : '.doc';

      // Use the override name if provided (e.g. after we know the applicant ID)
      const safeBase = overrideStorageName
        ? overrideStorageName.replace(/[^a-zA-Z0-9_\-]/g, '_')
        : `${(candidateName || 'Resume').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;

      const filePath = `resumes/${safeBase}${ext}`;

      const { error } = await supabase.storage.from('resumes').upload(filePath, bytes.buffer, {
        contentType: ext === '.pdf' ? 'application/pdf' : 'application/octet-stream',
        upsert: true,
      });

      if (error) throw new Error(`Resume storage failed: ${error.message}`);

      const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (error) {
      // Re-throw so callers can skip DB insert
      throw new Error(`Resume upload failed: ${error.message}`);
    }
  },


  // ─────────────────────────────────────────────
  // JOB APPLICATION (Public — uses RPC)
  // ─────────────────────────────────────────────
  async submitApplication(applicationData) {
    try {
      // Upload resume first
      let resumeUrl = 'No resume uploaded';
      if (applicationData.resumeData && applicationData.resumeFileName && applicationData.candidateName) {
        resumeUrl = await this.uploadResume(
          applicationData.resumeData, applicationData.resumeFileName, applicationData.candidateName
        );
      }

      // Call RPC function
      const { data, error } = await supabase.rpc('submit_job_application', {
        p_name: applicationData.candidateName || null,
        p_email: applicationData.email || null,
        p_contact_number: applicationData.contactNumber || null,
        p_current_location: applicationData.currentLocation || null,
        p_recent_education: applicationData.recentEducation || null,
        p_total_experience: applicationData.totalExperience || null,
        p_current_company: applicationData.currentCompany || null,
        p_current_position: applicationData.currentPosition || null,
        p_current_ctc: applicationData.currentCTC || null,
        p_expected_ctc: applicationData.expectedCTC || null,
        p_notice_period: applicationData.noticePeriod || null,
        p_job_title: applicationData.jobTitle || null,
        p_job_id: applicationData.jobId || null,
        p_resume_link: resumeUrl !== 'No resume uploaded' ? resumeUrl : null,
      });

      if (error) return { error: error.message };

      // Send confirmation email (fire-and-forget)
      if (applicationData.email && applicationData.candidateName && applicationData.jobTitle) {
        this._sendEmail(applicationData.email, applicationData.candidateName,
          applicationData.jobTitle, applicationData.jobId).catch(() => {});
      }

      this.clearCache('candidates');
      this.clearCache('databaseCandidates');
      return { success: true, message: 'Application submitted successfully' };
    } catch (error) {
      return { error: error.toString() };
    }
  },

  async _sendEmail(to, candidateName, jobTitle, jobId) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          to, 
          candidateName, 
          jobTitle, 
          jobId,
          templateType: 'candidate_confirmation'
        }),
      });
    } catch (e) {
      console.error('Email send failed:', e);
    }
  },

  async sendDirectEmail(to, subject, html) {
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { to, subject, html }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('sendDirectEmail error:', error);
      return { error: error.toString() };
    }
  },

  // ─────────────────────────────────────────────
  // CANDIDATES (from Candidate detail sheet equivalent)
  // ─────────────────────────────────────────────
  async fetchCandidates() {
    try {
      return await withCache('candidates', async () => {
        const { data, error } = await supabase
          .from('candidates')
          .select('timestamp, name, email, contact_number, current_location, recent_education, total_experience, current_company, current_position, current_ctc, expected_ctc, notice_period, job_applied, resume_link, email_status, status, ai_score, ai_analysis, shortlist_decision, shortlist_reason')
          .order('timestamp', { ascending: false });

        if (error) throw error;
        return (data || []).map(c => ({
          timestamp: c.timestamp || '', name: c.name || '', email: c.email || '',
          contactNumber: c.contact_number || '', currentLocation: c.current_location || '',
          recentEducation: c.recent_education || '', totalExperience: c.total_experience || '',
          currentCompany: c.current_company || '', currentPosition: c.current_position || '',
          currentCTC: c.current_ctc || '', expectedCTC: c.expected_ctc || '',
          noticePeriod: c.notice_period || '', jobApplied: c.job_applied || '',
          resumeLink: c.resume_link || '', emailStatus: c.email_status || '',
          status: c.status || 'Applied',
          aiScore: c.ai_score, aiAnalysis: c.ai_analysis || '',
          shortlistDecision: c.shortlist_decision || '', shortlistReason: c.shortlist_reason || '',
        }));
      });
    } catch (error) {
      console.error('Error fetching candidates:', error);
      return [];
    }
  },

  // ─────────────────────────────────────────────
  // CV UPLOAD TO DATABASE (HR Upload)
  // ─────────────────────────────────────────────
  async uploadCVToDatabase(cvData) {
    const cleanEmail = (cvData.email || '').trim().toLowerCase();
    const cleanPhone = (cvData.contactNumber || '').replace(/[^0-9]/g, '').trim();

    // ── Check for duplicate first ──────────────────────────────────────
    let existing = null;
    if (cleanEmail || cleanPhone) {
      let query = supabase.from('applicants').select('id, applicant_code, created_on');
      if (cleanEmail && cleanPhone) {
        query = query.or(`email.ilike.${cleanEmail},mobile_number.eq.${cleanPhone}`);
      } else if (cleanEmail) {
        query = query.ilike('email', cleanEmail);
      } else {
        query = query.eq('mobile_number', cleanPhone);
      }
      const { data } = await query.limit(1).maybeSingle();
      existing = data;
    }

    const applicantCode = existing ? existing.applicant_code : null;

    // ── EXISTING RECORD → UPDATE ───────────────────────────────────────
    if (existing) {
      // Upload PDF named CandidateName_ExistingID.pdf — THROW on failure
      let resumeUrl = null;
      if (cvData.resumeData && cvData.resumeFileName) {
        const safeName = (cvData.candidateName || 'Resume').replace(/[^a-zA-Z0-9]/g, '_');
        const storageName = `${applicantCode}_${safeName}`;
        resumeUrl = await this.uploadResume(cvData.resumeData, cvData.resumeFileName, cvData.candidateName, storageName);
        // uploadResume throws on failure — so if we reach here, it succeeded
      }

      const updateData = {
        full_name: cvData.candidateName || undefined,
        email: cleanEmail || undefined,
        mobile_number: cleanPhone || undefined,
        current_location: cvData.currentLocation || undefined,
        current_company: cvData.currentCompany || undefined,
        current_position: cvData.currentPosition || undefined,
        total_experience: cvData.totalExperience || undefined,
        education: cvData.education || undefined,
        skills: cvData.skills || undefined,
        cv_summary: cvData.summary || undefined,
        certification: cvData.certifications || undefined,
        source: cvData.source || undefined,
        uploaded_by: cvData.uploadedBy || undefined,
        updated_on: new Date().toISOString(),
        ai_score: null, ai_analysis: null,
        shortlist_decision: null, shortlist_reason: null,
      };
      if (resumeUrl) updateData.resume_link = resumeUrl;

      // Remove undefined values
      Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

      const { error } = await supabase.from('applicants').update(updateData).eq('id', existing.id);
      if (error) return { error: error.message };

      this.clearCache('databaseCandidates');
      return {
        success: true, isUpdate: true, applicantId: applicantCode,
        message: 'Duplicate found — existing record updated successfully'
      };
    }

    // ── NEW RECORD → INSERT first to get the ID ────────────────────────
    const { data: inserted, error: insertError } = await supabase.from('applicants').insert({
      source: cvData.source || 'HR Upload',
      full_name: cvData.candidateName || '',
      email: cleanEmail,
      mobile_number: cleanPhone,
      current_location: cvData.currentLocation || '',
      current_company: cvData.currentCompany || '',
      current_position: cvData.currentPosition || '',
      total_experience: cvData.totalExperience || '',
      education: cvData.education || '',
      skills: cvData.skills || '',
      cv_summary: cvData.summary || '',
      certification: cvData.certifications || '',
      resume_link: '',           // placeholder — will be updated after upload
      uploaded_by: cvData.uploadedBy || 'Admin',
      status: 'In Database',
    }).select('id, applicant_code').single();

    if (insertError) return { error: insertError.message };

    const newId = inserted.applicant_code;
    const rowId = inserted.id;

    // ── Upload PDF now that we have the applicant ID ───────────────────
    if (cvData.resumeData && cvData.resumeFileName) {
      try {
        const safeName = (cvData.candidateName || 'Resume').replace(/[^a-zA-Z0-9]/g, '_');
        const storageName = `${newId}_${safeName}`;
        const resumeUrl = await this.uploadResume(cvData.resumeData, cvData.resumeFileName, cvData.candidateName, storageName);

        // Update the record with the real resume URL
        await supabase.from('applicants').update({ resume_link: resumeUrl }).eq('id', rowId);
      } catch (uploadErr) {
        // PDF upload failed — ROLLBACK the inserted row so no half-record stays
        await supabase.from('applicants').delete().eq('id', rowId);
        return { error: `PDF upload failed — candidate NOT saved. Reason: ${uploadErr.message}` };
      }
    }

    this.clearCache('databaseCandidates');
    return {
      success: true, isUpdate: false, applicantId: newId,
      message: 'CV uploaded and saved to database successfully'
    };
  },


  // ─────────────────────────────────────────────
  // DATABASE CANDIDATES (Applicants — centralised)
  // ─────────────────────────────────────────────
  async getDatabaseCandidates() {
    try {
      return await withCache('databaseCandidates', async () => {
        const rows = [];
        let from = 0;

        while (true) {
          const to = from + SUPABASE_PAGE_SIZE - 1;
          const { data, error } = await supabase
            .from('applicants')
            .select(APPLICANT_LIST_COLUMNS)
            .order('created_on', { ascending: false })
            .range(from, to);

          if (error) throw error;
          if (!data?.length) break;

          rows.push(...data);

          if (data.length < SUPABASE_PAGE_SIZE) break;
          from += SUPABASE_PAGE_SIZE;
        }

        return rows.map(mapApplicantRow);
      });
    } catch (error) {
      console.error('Error fetching database candidates:', error);
      return [];
    }
  },

  async fetchApplicantsPage(options = {}) {
    const {
      page = 1,
      pageSize = 25,
      sortKey = 'createdOn',
      sortDirection = 'desc'
    } = options;

    try {
      let query = applyApplicantFilters(
        supabase.from('applicants').select(APPLICANT_LIST_COLUMNS),
        options
      );
      const sortColumn = APPLICANT_SORT_MAP[sortKey] || 'created_on';
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await query
        .order(sortColumn, { ascending: sortDirection === 'asc' })
        .range(from, to);

      if (error) throw error;

      return {
        data: (data || []).map(mapApplicantRow),
        total: null
      };
    } catch (error) {
      console.error('Error fetching paginated applicants:', error);
      return { data: [], total: 0 };
    }
  },

  async fetchApplicantsCount(options = {}) {
    try {
      const query = applyApplicantFilters(
        supabase.from('applicants').select('id', { count: 'exact', head: true }),
        options
      );
      const { error, count } = await query;

      if (error) throw error;
      return { total: count || 0 };
    } catch (error) {
      console.error('Error fetching applicants count:', error);
      return { total: 0 };
    }
  },

  async fetchApplicantsByIds(applicantIds = []) {
    const ids = Array.from(new Set((applicantIds || []).filter(Boolean)));
    if (ids.length === 0) return [];

    try {
      const { data, error } = await supabase
        .from('applicants')
        .select(APPLICANT_LIST_COLUMNS)
        .in('applicant_code', ids);

      if (error) throw error;
      return (data || []).map(mapApplicantRow);
    } catch (error) {
      console.error('Error fetching applicants by ids:', error);
      return [];
    }
  },

  async getDatabaseCandidateById(applicantId) {
    try {
      const cachedList = readCacheEntry('databaseCandidates');
      const cachedCandidate = cachedList?.find(c => c.applicantId.toString() === applicantId.toString());
      if (cachedCandidate?.summary && cachedCandidate?.aiAnalysis) {
        return cachedCandidate;
      }

      const { data, error } = await supabase
        .from('applicants')
        .select(APPLICANT_DETAIL_COLUMNS)
        .eq('applicant_code', applicantId)
        .maybeSingle();

      if (error || !data) return null;

      const candidate = mapApplicantRow(data);
      if (cachedList) {
        const idx = cachedList.findIndex(c => c.applicantId.toString() === applicantId.toString());
        if (idx !== -1) {
          cachedList[idx] = { ...cachedList[idx], ...candidate };
          writeCacheEntry('databaseCandidates', cachedList);
        }
      }
      return candidate;
    } catch (error) {
      return null;
    }
  },

  async updateDatabaseCandidate(updateData) {
    try {
      const applicantCode = updateData.applicantId;
      if (!applicantCode) return { error: 'Applicant ID is required' };

      const dbUpdate = {};
      if (updateData.name !== undefined) dbUpdate.full_name = updateData.name;
      if (updateData.email !== undefined) dbUpdate.email = updateData.email;
      if (updateData.contactNumber !== undefined) dbUpdate.mobile_number = updateData.contactNumber;
      if (updateData.currentLocation !== undefined) dbUpdate.current_location = updateData.currentLocation;
      if (updateData.currentCompany !== undefined) dbUpdate.current_company = updateData.currentCompany;
      if (updateData.currentPosition !== undefined) dbUpdate.current_position = updateData.currentPosition;
      if (updateData.totalExperience !== undefined) dbUpdate.total_experience = updateData.totalExperience;
      if (updateData.education !== undefined) dbUpdate.education = updateData.education;
      if (updateData.skills !== undefined) dbUpdate.skills = updateData.skills;
      if (updateData.summary !== undefined) dbUpdate.cv_summary = updateData.summary;
      if (updateData.jobAppliedFor !== undefined) dbUpdate.job_applied_for = updateData.jobAppliedFor;
      if (updateData.jobId !== undefined) dbUpdate.job_id = updateData.jobId;
      if (updateData.aiScore !== undefined) dbUpdate.ai_score = updateData.aiScore;
      if (updateData.aiAnalysis !== undefined) dbUpdate.ai_analysis = updateData.aiAnalysis;
      if (updateData.shortlistDecision !== undefined) dbUpdate.shortlist_decision = updateData.shortlistDecision;
      if (updateData.shortlistReason !== undefined) dbUpdate.shortlist_reason = updateData.shortlistReason;
      if (updateData.status !== undefined) dbUpdate.status = updateData.status;
      if (updateData.certification !== undefined) dbUpdate.certification = updateData.certification;
      if (updateData.relevantExperience !== undefined) dbUpdate.relevant_experience = updateData.relevantExperience;
      if (updateData.currentCTC !== undefined) dbUpdate.current_ctc = updateData.currentCTC;
      if (updateData.expectedPay !== undefined) dbUpdate.expected_pay = updateData.expectedPay;
      if (updateData.noticePeriod !== undefined) dbUpdate.notice_period = updateData.noticePeriod;
      if (updateData.processKnowledge !== undefined) dbUpdate.process_knowledge = updateData.processKnowledge;
      if (updateData.reasonForChange !== undefined) dbUpdate.reason_for_change = updateData.reasonForChange;
      if (updateData.workAuthorization !== undefined) dbUpdate.work_authorization = updateData.workAuthorization;
      if (updateData.recruiterComments !== undefined) dbUpdate.recruiter_comments = updateData.recruiterComments;
      if (updateData.aadharNumber !== undefined) dbUpdate.aadhar_number = updateData.aadharNumber;
      if (updateData.nationality !== undefined) dbUpdate.nationality = updateData.nationality;
      if (updateData.language !== undefined) dbUpdate.language_details = updateData.language;
      if (updateData.screening !== undefined) dbUpdate.screening = updateData.screening;
      if (updateData.technicalRating !== undefined) dbUpdate.technical_rating = updateData.technicalRating || null;
      if (updateData.communicationRating !== undefined) dbUpdate.communication_rating = updateData.communicationRating || null;
      if (updateData.professionalismRating !== undefined) dbUpdate.professionalism_rating = updateData.professionalismRating || null;
      if (updateData.overallRating !== undefined) dbUpdate.overall_rating = updateData.overallRating || null;

      dbUpdate.updated_on = new Date().toISOString();

      const { error } = await supabase.from('applicants').update(dbUpdate).eq('applicant_code', applicantCode);
      if (error) return { error: error.message };

      // Optimistic cache update
      if (cache.databaseCandidates.data) {
        const idx = cache.databaseCandidates.data.findIndex(c => c.applicantId === applicantCode);
        if (idx !== -1) {
          cache.databaseCandidates.data[idx] = { ...cache.databaseCandidates.data[idx], ...updateData };
        }
      }
      if (updateData.status) this.clearCache('shortlisted');
      return { success: true, message: 'Candidate updated successfully', applicantId: applicantCode };
    } catch (error) {
      return { error: error.toString() };
    }
  },

  async toggleCandidateScreening(applicantCode, hrName) {
    try {
      if (!applicantCode) return { success: false, error: 'Applicant ID is required' };
      const cleanHrName = (hrName || 'HR Admin').trim();

      const { data, error: fetchErr } = await supabase
        .from('applicants')
        .select('screening')
        .eq('applicant_code', applicantCode)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      let currentScreening = [];
      if (data && Array.isArray(data.screening)) {
        currentScreening = [...data.screening];
      } else if (data && typeof data.screening === 'string') {
        try {
          currentScreening = JSON.parse(data.screening);
        } catch {
          currentScreening = [];
        }
      }

      const existingIdx = currentScreening.findIndex(
        s => s.hr_name?.toLowerCase() === cleanHrName.toLowerCase()
      );

      let updatedScreening;
      let isScreenedNow = false;

      if (existingIdx !== -1) {
        updatedScreening = currentScreening.filter((_, idx) => idx !== existingIdx);
        isScreenedNow = false;
      } else {
        updatedScreening = [
          ...currentScreening,
          {
            hr_name: cleanHrName,
            screened_at: new Date().toISOString()
          }
        ];
        isScreenedNow = true;
      }

      const { error: updateErr } = await supabase
        .from('applicants')
        .update({
          screening: updatedScreening,
          updated_on: new Date().toISOString()
        })
        .eq('applicant_code', applicantCode);

      if (updateErr) throw updateErr;

      if (cache.databaseCandidates?.data) {
        const idx = cache.databaseCandidates.data.findIndex(c => c.applicantId === applicantCode);
        if (idx !== -1) {
          cache.databaseCandidates.data[idx].screening = updatedScreening;
        }
      }

      return {
        success: true,
        screening: updatedScreening,
        isScreened: isScreenedNow
      };
    } catch (error) {
      console.error('Error toggling screening:', error);
      return { success: false, error: error.message || error.toString() };
    }
  },

  async fetchAllFilteredApplicants(options = {}) {
    try {
      let query = applyApplicantFilters(
        supabase.from('applicants').select(APPLICANT_DETAIL_COLUMNS),
        options
      );
      const sortColumn = APPLICANT_SORT_MAP[options.sortKey] || 'created_on';
      const { data, error } = await query.order(sortColumn, { ascending: options.sortDirection === 'asc' });
      if (error) throw error;
      return (data || []).map(mapApplicantRow);
    } catch (error) {
      console.error('Error fetching all filtered applicants for export:', error);
      return [];
    }
  },

  // ─────────────────────────────────────────────
  // COMMUNICATION LOGS
  // ─────────────────────────────────────────────
  async getCommunicationLogs(applicantCode) {
    try {
      const { data, error } = await supabase
        .from('communication_logs')
        .select('*')
        .eq('applicant_code', applicantCode)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching communication logs:', error);
      return { success: false, error: error.toString(), data: [] };
    }
  },

  async addCommunicationLog(logData) {
    try {
      const { error } = await supabase
        .from('communication_logs')
        .insert({
          applicant_code: logData.applicantCode,
          hr_name: logData.hrName,
          communication_type: logData.communicationType || 'Call',
          notes: logData.notes
        });

      if (error) throw error;
      return { success: true, message: 'Log added successfully' };
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  },

  // ─────────────────────────────────────────────
  // AI ANALYSIS
  // ─────────────────────────────────────────────
  async saveAiResults(email, jobApplied, aiData) {
    try {
      const cleanEmail = email.trim().toLowerCase();

      // Update applicants table
      const { error: appErr } = await supabase.from('applicants').update({
        ai_score: aiData.score ?? null,
        ai_analysis: aiData.analysis ?? '',
        shortlist_decision: aiData.decision ?? '',
        shortlist_reason: aiData.reason ?? '',
      }).ilike('email', cleanEmail);

      // Update candidates table
      await supabase.from('candidates').update({
        ai_score: aiData.score ?? null,
        ai_analysis: aiData.analysis ?? '',
        shortlist_decision: aiData.decision ?? '',
        shortlist_reason: aiData.reason ?? '',
      }).ilike('email', cleanEmail);

      if (appErr) return { error: appErr.message };
      this.clearCache('databaseCandidates');
      this.clearCache('candidates');
      return { success: true };
    } catch (error) {
      return { error: error.toString() };
    }
  },

  // ─────────────────────────────────────────────
  // SHORTLISTING
  // ─────────────────────────────────────────────
  async shortlistCandidate(data) {
    try {
      // Get the applicant UUID from code
      const { data: app } = await supabase
        .from('applicants').select('id').eq('applicant_code', data.applicantId).single();

      const jobCodeStr = (data.jobCode || '').toString().trim();

      // Check for duplicate tag
      const { data: existingTag } = await supabase
        .from('tagged_candidates')
        .select('id')
        .eq('applicant_code', data.applicantId)
        .eq('job_code', jobCodeStr)
        .single();
        
      if (existingTag) {
        return { error: 'Candidate is already tagged for this specific job opening.' };
      }

      const { error } = await supabase.from('tagged_candidates').insert({
        applicant_id: app?.id || null,
        applicant_code: data.applicantId || '',
        name: data.name || '',
        job_role: data.jobRole || '',
        company: data.company || '',
        shortlisted_by: data.shortlistedBy || 'Admin',
        job_code: jobCodeStr,
      });

      if (error) return { error: error.message };

      // Update applicant status
      if (app?.id) {
        await supabase.from('applicants').update({ status: 'Tagged' }).eq('id', app.id);
      }

      if (cache.databaseCandidates.data) {
        const idx = cache.databaseCandidates.data.findIndex(c => c.applicantId === data.applicantId);
        if (idx !== -1) cache.databaseCandidates.data[idx].status = 'Tagged';
      }
      this.clearCache('shortlisted');
      return { success: true };
    } catch (error) {
      return { error: error.toString() };
    }
  },

  async removeShortlist(params) {
    try {
      let query = supabase.from('tagged_candidates').delete()
        .eq('applicant_code', params.applicantId);
      if (params.jobCode) query = query.eq('job_code', params.jobCode);

      const { error } = await query;
      if (error) return { error: error.message };

      // Check if still has other shortlists
      const { data: remaining } = await supabase.from('tagged_candidates')
        .select('id').eq('applicant_code', params.applicantId).limit(1);

      const hasOtherShortlists = remaining && remaining.length > 0;

      if (!hasOtherShortlists) {
        await supabase.from('applicants').update({ status: 'In Database' })
          .eq('applicant_code', params.applicantId);
        if (cache.databaseCandidates.data) {
          const idx = cache.databaseCandidates.data.findIndex(c => c.applicantId === params.applicantId);
          if (idx !== -1) cache.databaseCandidates.data[idx].status = 'In Database';
        }
      }

      this.clearCache('shortlisted');
      return { success: true, hasOtherShortlists };
    } catch (error) {
      return { error: error.toString() };
    }
  },

  async getShortlistedCandidates() {
    try {
      return await withCache('shortlisted', async () => {
        const { data, error } = await supabase.from('tagged_candidates')
          .select('id, applicant_code, name, job_role, company, shortlisted_by, created_at, job_code, current_stage, manager_submitted_at, client_submitted_at, feedback_received_at')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapShortlistRow);
      });
    } catch (error) {
      console.error('Error fetching shortlisted:', error);
      return [];
    }
  },

  async fetchTaggedCandidatesPage(options = {}) {
    const {
      page = 1,
      pageSize = 25,
      search = '',
      dateFrom = '',
      dateTo = '',
      periodYear = '',
      periodMonth = '',
      taggedBy = '',
      targetCompany = '',
      targetContact = ''
    } = options;

    try {
      let contactJobCodes = null;
      if (targetContact) {
        const { data: matchedJobs, error: matchedJobsError } = await supabase
          .from('client_jobs')
          .select('job_code')
          .ilike('reporting_client_name', `%${sanitizeSearchTerm(targetContact)}%`);

        if (matchedJobsError) throw matchedJobsError;
        contactJobCodes = (matchedJobs || []).map((job) => job.job_code).filter(Boolean);
        if (!contactJobCodes.length) {
          return { data: [], total: 0 };
        }
      }

      let query = supabase
        .from('tagged_candidates')
        .select('id, applicant_code, name, job_role, company, shortlisted_by, created_at, job_code, current_stage, manager_submitted_at, client_submitted_at, feedback_received_at', { count: 'exact' });

      const searchFilter = buildIlikeOrFilter(
        ['name', 'job_role', 'company', 'shortlisted_by', 'job_code', 'applicant_code'],
        search
      );
      if (searchFilter) query = query.or(searchFilter);
      if (taggedBy) query = query.ilike('shortlisted_by', `%${sanitizeSearchTerm(taggedBy)}%`);
      if (targetCompany) query = query.ilike('company', `%${sanitizeSearchTerm(targetCompany)}%`);
      if (contactJobCodes?.length) query = query.in('job_code', contactJobCodes);

      const { start, end } = resolveTaggedDateRange({ dateFrom, dateTo, periodYear, periodMonth });
      if (start) query = query.gte('created_at', start);
      if (end) query = query.lte('created_at', end);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const jobContacts = await fetchJobContactsByCodes((data || []).map((item) => item.job_code));

      return {
        data: (data || []).map((item) => ({
          ...mapShortlistRow(item),
          contactName: jobContacts.get(item.job_code || '') || ''
        })),
        total: count || 0
      };
    } catch (error) {
      console.error('Error fetching paginated shortlisted candidates:', error);
      return { data: [], total: 0 };
    }
  },

  async exportTaggedCandidates(options = {}) {
    const {
      search = '',
      dateFrom = '',
      dateTo = '',
      periodYear = '',
      periodMonth = '',
      taggedBy = '',
      targetCompany = '',
      targetContact = ''
    } = options;

    try {
      let contactJobCodes = null;
      if (targetContact) {
        const { data: matchedJobs, error: matchedJobsError } = await supabase
          .from('client_jobs')
          .select('job_code')
          .ilike('reporting_client_name', `%${sanitizeSearchTerm(targetContact)}%`);

        if (matchedJobsError) throw matchedJobsError;
        contactJobCodes = (matchedJobs || []).map((job) => job.job_code).filter(Boolean);
        if (!contactJobCodes.length) return [];
      }

      const rows = [];
      let from = 0;

      while (true) {
        let query = supabase
          .from('tagged_candidates')
          .select('id, applicant_code, name, job_role, company, shortlisted_by, created_at, job_code, current_stage, manager_submitted_at, client_submitted_at, feedback_received_at')
          .order('created_at', { ascending: false })
          .range(from, from + SUPABASE_PAGE_SIZE - 1);

        const searchFilter = buildIlikeOrFilter(
          ['name', 'job_role', 'company', 'shortlisted_by', 'job_code', 'applicant_code'],
          search
        );
        if (searchFilter) query = query.or(searchFilter);
        if (taggedBy) query = query.ilike('shortlisted_by', `%${sanitizeSearchTerm(taggedBy)}%`);
        if (targetCompany) query = query.ilike('company', `%${sanitizeSearchTerm(targetCompany)}%`);
        if (contactJobCodes?.length) query = query.in('job_code', contactJobCodes);

        const { start, end } = resolveTaggedDateRange({ dateFrom, dateTo, periodYear, periodMonth });
        if (start) query = query.gte('created_at', start);
        if (end) query = query.lte('created_at', end);

        const { data, error } = await query;
        if (error) throw error;
        if (!data?.length) break;

        rows.push(...data);
        if (data.length < SUPABASE_PAGE_SIZE) break;
        from += SUPABASE_PAGE_SIZE;
      }

      const jobContacts = await fetchJobContactsByCodes(rows.map((item) => item.job_code));
      return rows.map((item) => ({
        ...mapShortlistRow(item),
        contactName: jobContacts.get(item.job_code || '') || ''
      }));
    } catch (error) {
      console.error('Error exporting tagged candidates:', error);
      return [];
    }
  },

  async fetchShortlistedCandidatesByJob(jobCode) {
    if (!jobCode) return [];

    try {
      const { data, error } = await supabase
        .from('tagged_candidates')
        .select('id, applicant_code, name, job_role, company, shortlisted_by, created_at, job_code, current_stage, manager_submitted_at, client_submitted_at, feedback_received_at')
        .eq('job_code', jobCode)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const jobContacts = await fetchJobContactsByCodes([jobCode]);
      return (data || []).map((item) => ({
        ...mapShortlistRow(item),
        contactName: jobContacts.get(item.job_code || '') || ''
      }));
    } catch (error) {
      console.error('Error fetching shortlisted candidates by job:', error);
      return [];
    }
  },

  async updateShortlistStage(applicantId, jobCode, stage) {
    try {
      const updateData = { current_stage: stage };
      const now = new Date().toISOString();
      if (stage === 'Manager Submit') updateData.manager_submitted_at = now;
      if (stage === 'Client Submission') updateData.client_submitted_at = now;
      if (stage === 'Feedback') updateData.feedback_received_at = now;

      const { error } = await supabase.from('tagged_candidates')
        .update(updateData)
        .eq('applicant_code', applicantId)
        .eq('job_code', jobCode);
      
      if (error) throw error;
      this.clearCache('shortlisted');
      return { success: true };
    } catch (error) {
      return { error: error.toString() };
    }
  },

  // ─────────────────────────────────────────────
  // CLIENTS
  // ─────────────────────────────────────────────
  async fetchClients() {
    try {
      return await withCache('clients', async () => {
        const { data, error } = await supabase.from('clients')
          .select('client_id, client_name, website, industry, status, managed_by, business_unit, display_on_job_posting, created_by, created_on, modified_on, modified_by, client_reporting_contact(id, contact_name, email, phone, department)')
          .order('created_on', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapClientRow);
      });
    } catch (error) {
      console.error('Error fetching clients:', error);
      return [];
    }
  },

  async fetchClientsPage(options = {}) {
    const {
      page = 1,
      pageSize = 25,
      search = ''
    } = options;

    try {
      let query = supabase
        .from('clients')
        .select('client_id, client_name, website, industry, status, managed_by, business_unit, display_on_job_posting, created_by, created_on, modified_on, modified_by, client_reporting_contact(id)', { count: 'exact' });

      const searchFilter = buildIlikeOrFilter(
        ['client_id', 'client_name', 'industry', 'managed_by', 'business_unit'],
        search
      );
      if (searchFilter) query = query.or(searchFilter);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('created_on', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        data: (data || []).map(mapClientRow),
        total: count || 0
      };
    } catch (error) {
      console.error('Error fetching paginated clients:', error);
      return { data: [], total: 0 };
    }
  },

  async fetchClientById(clientId) {
    if (!clientId) return null;

    try {
      const cachedClients = readCacheEntry('clients');
      const cachedClient = cachedClients?.find((client) => client.clientId === clientId);
      if (cachedClient?.reportingContacts?.length) {
        return cachedClient;
      }

      const { data, error } = await supabase
        .from('clients')
        .select('client_id, client_name, website, industry, status, managed_by, business_unit, display_on_job_posting, created_by, created_on, modified_on, modified_by, client_reporting_contact(id, contact_name, email, phone, department)')
        .eq('client_id', clientId)
        .maybeSingle();

      if (error || !data) return null;
      return mapClientRow(data);
    } catch (error) {
      console.error('Error fetching client by id:', error);
      return null;
    }
  },

  async addClient(clientData) {
    try {
      const insertObj = {
        client_name: clientData.clientName || '',
        website: clientData.website || '',
        industry: clientData.industry || '',
        status: clientData.status || 'Active',
        managed_by: clientData.primaryOwner || '',
        business_unit: clientData.businessUnit || '',
        display_on_job_posting: clientData.displayOnJobPosting || 'No',
        created_by: clientData.createdBy || 'Admin',
      };
      if (clientData.clientId) insertObj.client_id = clientData.clientId;

      const { data, error } = await supabase.from('clients').insert(insertObj).select('client_id').single();
      if (error) return { error: error.message };

      const contactsToInsert = (clientData.reportingContacts || []).map(rc => ({
          client_id: data.client_id,
          contact_name: rc.name,
          email: rc.email,
          phone: rc.contact,
          department: rc.department || ''
      }));
      if (contactsToInsert.length > 0) {
         const { error: contactError } = await supabase.from('client_reporting_contact').insert(contactsToInsert);
         if (contactError) return { error: 'Failed to save contacts: ' + contactError.message };
      }

      this.clearCache('clients');
      return { success: true, clientId: data.client_id, message: 'Client added successfully' };
    } catch (error) {
      return { error: error.toString() };
    }
  },

  async updateClient(clientData) {
    try {
      const { error } = await supabase.from('clients').update({
        client_name: clientData.clientName,
        website: clientData.website,
        industry: clientData.industry, status: clientData.status,
        managed_by: clientData.primaryOwner,
        business_unit: clientData.businessUnit,
        display_on_job_posting: clientData.displayOnJobPosting,
        modified_on: new Date().toISOString(),
        modified_by: clientData.modifiedBy || 'Admin',
      }).eq('client_id', clientData.clientId);

      if (error) return { error: error.message };

      // Update contacts: drop old, insert new
      await supabase.from('client_reporting_contact').delete().eq('client_id', clientData.clientId);
      const contactsToInsert = (clientData.reportingContacts || []).map(rc => ({
          client_id: clientData.clientId,
          contact_name: rc.name,
          email: rc.email,
          phone: rc.contact,
          department: rc.department || ''
      }));
      if (contactsToInsert.length > 0) {
         const { error: contactError } = await supabase.from('client_reporting_contact').insert(contactsToInsert);
         if (contactError) return { error: 'Failed to update contacts: ' + contactError.message };
      }

      this.clearCache('clients');
      return { success: true, message: 'Client updated successfully' };
    } catch (error) {
      return { error: error.toString() };
    }
  },

  async deleteClient(clientId) {
    try {
      const { error } = await supabase.from('clients').delete().eq('client_id', clientId);
      if (error) return { error: error.message };
      this.clearCache('clients');
      return { success: true, message: 'Client deleted successfully' };
    } catch (error) {
      return { error: error.toString() };
    }
  },

  // ─────────────────────────────────────────────
  // HRs (Admin Users)
  // ─────────────────────────────────────────────
  async fetchHRs() {
    try {
      return await withCache('hrs', async () => {
        const { data, error } = await supabase.from('admin_users')
          .select('hr_name, email').eq('is_active', true);

        if (error) throw error;
        return (data || []).map(h => ({ hrName: h.hr_name, email: h.email }));
      });
    } catch (error) {
      console.error('Error fetching HRs:', error);
      return [];
    }
  },

  // ─────────────────────────────────────────────
  // CLIENT JOBS
  // ─────────────────────────────────────────────
  async fetchClientJobs() {
    try {
      return await withCache('clientJobs', async () => {
        const { data, error } = await supabase.from('client_jobs')
          .select('job_code, job_title, job_type, job_mode, business_unit, client_name, client_id, location, state, country, pay_rate, experience, job_description, created_by, created_on, recruitment_manager, status, modified_on, modified_by, priority, assigned_to, reporting_client_name, reporting_client_email, reporting_client_contact')
          .order('created_on', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapClientJobRow);
      });
    } catch (error) {
      console.error('Error fetching client jobs:', error);
      return [];
    }
  },

  async fetchClientJobsPage(options = {}) {
    const {
      page = 1,
      pageSize = 25,
      search = ''
    } = options;

    try {
      let query = supabase
        .from('client_jobs')
        .select('job_code, job_title, job_type, job_mode, business_unit, client_name, client_id, location, state, country, pay_rate, experience, created_by, created_on, recruitment_manager, status, modified_on, modified_by, priority, assigned_to, reporting_client_name, reporting_client_email, reporting_client_contact', { count: 'exact' });

      const searchFilter = buildIlikeOrFilter(
        ['job_code', 'job_title', 'job_type', 'job_mode', 'client_name', 'recruitment_manager', 'location', 'state', 'country'],
        search
      );
      if (searchFilter) query = query.or(searchFilter);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('created_on', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        data: (data || []).map(mapClientJobRow),
        total: count || 0
      };
    } catch (error) {
      console.error('Error fetching paginated client jobs:', error);
      return { data: [], total: 0 };
    }
  },

  async fetchClientJobByCode(jobCode) {
    if (!jobCode) return null;

    try {
      const cachedJobs = readCacheEntry('clientJobs');
      const cachedJob = cachedJobs?.find((job) => job.jobCode === jobCode);
      if (cachedJob?.jobDescription) {
        return cachedJob;
      }

      const { data, error } = await supabase
        .from('client_jobs')
        .select('job_code, job_title, job_type, job_mode, business_unit, client_name, client_id, location, state, country, pay_rate, experience, job_description, created_by, created_on, recruitment_manager, status, modified_on, modified_by, priority, assigned_to, reporting_client_name, reporting_client_email, reporting_client_contact')
        .eq('job_code', jobCode)
        .maybeSingle();

      if (error || !data) return null;
      return mapClientJobRow(data);
    } catch (error) {
      console.error('Error fetching client job by code:', error);
      return null;
    }
  },

  async fetchNextClientJobCode() {
    try {
      const { data, error } = await supabase
        .from('client_jobs')
        .select('job_code')
        .order('created_on', { ascending: false })
        .limit(200);

      if (error) throw error;

      const nextNumber = (data || [])
        .map((job) => {
          const match = job.job_code?.match(/JPC-(\d+)/i);
          return match ? parseInt(match[1], 10) : 0;
        })
        .reduce((max, value) => Math.max(max, value), 0) + 1;

      return `JPC-${String(nextNumber).padStart(3, '0')}`;
    } catch (error) {
      console.error('Error fetching next client job code:', error);
      return 'JPC-001';
    }
  },

  async fetchRecentCandidates(limit = 5) {
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('timestamp, name, email, current_location, total_experience, job_applied, status')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(c => ({
        timestamp: c.timestamp || '',
        name: c.name || '',
        email: c.email || '',
        currentLocation: c.current_location || '',
        totalExperience: c.total_experience || '',
        jobApplied: c.job_applied || '',
        status: c.status || 'Applied'
      }));
    } catch (error) {
      console.error('Error fetching recent candidates:', error);
      return [];
    }
  },

  async fetchActiveClientJobsPreview(limit = 6) {
    try {
      const { data, error } = await supabase
        .from('client_jobs')
        .select('job_code, job_title, client_name, created_by, status')
        .eq('status', 'Active')
        .order('created_on', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(j => ({
        jobCode: j.job_code || '',
        jobTitle: j.job_title || '',
        clientName: j.client_name || '',
        createdBy: j.created_by || '',
        status: j.status || 'Active'
      }));
    } catch (error) {
      console.error('Error fetching active client job preview:', error);
      return [];
    }
  },

  async fetchDashboardSummary() {
    try {
      return await withCache('dashboardSummary', async () => {
        const now = new Date();
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const [
          jobsCountRes,
          candidatesCountRes,
          applicationsTodayRes,
          aiShortlistedRes,
          applicantsCountRes,
          monthCvUploadRes,
          shortlistedCountRes,
          clientsCountRes,
          activeClientJobsCountRes,
          recentCandidates,
          activeClientJobs
        ] = await Promise.all([
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('candidates').select('*', { count: 'exact', head: true }),
          supabase.from('candidates').select('*', { count: 'exact', head: true }).gte('timestamp', dayStart),
          supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('shortlist_decision', 'Shortlisted'),
          supabase.from('applicants').select('*', { count: 'exact', head: true }),
          supabase.from('applicants').select('*', { count: 'exact', head: true }).gte('created_on', monthStart),
          supabase.from('tagged_candidates').select('*', { count: 'exact', head: true }),
          supabase.from('clients').select('*', { count: 'exact', head: true }),
          supabase.from('client_jobs').select('*', { count: 'exact', head: true }).eq('status', 'Active'),
          this.fetchRecentCandidates(5),
          this.fetchActiveClientJobsPreview(6)
        ]);

        return {
          stats: {
            activeJobs: jobsCountRes.count || 0,
            totalCandidates: candidatesCountRes.count || 0,
            applicationsToday: applicationsTodayRes.count || 0,
            aiShortlisted: aiShortlistedRes.count || 0,
            totalApplicants: applicantsCountRes.count || 0,
            taggedCandidates: shortlistedCountRes.count || 0,
            monthCvUpload: monthCvUploadRes.count || 0,
            totalClients: clientsCountRes.count || 0,
            activeClientJobs: activeClientJobsCountRes.count || 0
          },
          recentCandidates,
          activeClientJobs
        };
      });
    } catch (error) {
      console.error('Error fetching dashboard summary:', error);
      return {
        stats: {
          activeJobs: 0,
          totalCandidates: 0,
          applicationsToday: 0,
          aiShortlisted: 0,
          totalApplicants: 0,
          taggedCandidates: 0,
          monthCvUpload: 0,
          totalClients: 0,
          activeClientJobs: 0
        },
        recentCandidates: [],
        activeClientJobs: []
      };
    }
  },

  async fetchDashboardAnalytics() {
    try {
      return await withCache('dashboardAnalytics', async () => {
        const [hrStatsRes, sourceStatsRes, taggedJobsData] = await Promise.all([
          supabase
            .from('dashboard_hr_daily_stats')
            .select('stat_date, hr_name, uploaded_count, tagged_count, calls_count')
            .order('stat_date', { ascending: false }),
          supabase
            .from('dashboard_source_stats')
            .select('source, candidate_count')
            .order('candidate_count', { ascending: false }),
          fetchAllLightweightRows('tagged_candidates', 'job_code')
        ]);

        if (hrStatsRes.error) throw hrStatsRes.error;
        if (sourceStatsRes.error) throw sourceStatsRes.error;

        return {
          hrDailyStats: (hrStatsRes.data || []).map(row => ({
            date: row.stat_date || '',
            hr: row.hr_name || 'Portal / Unknown',
            uploaded: row.uploaded_count || 0,
            tagged: row.tagged_count || 0,
            calls: row.calls_count || 0
          })),
          sourceStats: (sourceStatsRes.data || []).map(row => ({
            name: row.source || 'Portal / Unknown',
            value: row.candidate_count || 0
          })),
          shortlisted: (taggedJobsData || []).map(item => ({
            jobCode: item.job_code || ''
          })),
          clientJobs: [],
          commLogs: []
        };
      });
    } catch (error) {
      console.error('Error fetching dashboard analytics:', error);
      return {
        hrDailyStats: [],
        sourceStats: [],
        shortlisted: [],
        clientJobs: [],
        commLogs: []
      };
    }
  },

  async addClientJob(jobData) {
    try {
      const { data, error } = await supabase.from('client_jobs').insert({
        job_code: jobData.jobCode || '',
        job_title: jobData.jobTitle || '',
        job_type: jobData.jobType || '',
        job_mode: jobData.jobMode || '',
        business_unit: jobData.businessUnit || '',
        client_name: jobData.clientName || '',
        client_id: jobData.clientId || '',
        location: jobData.location || '',
        state: jobData.state || '',
        country: jobData.country || 'India',
        pay_rate: jobData.payRate || '',
        experience: jobData.experience || '',
        job_description: jobData.jobDescription || '',
        created_by: jobData.createdBy || 'Admin',
        recruitment_manager: jobData.recruitmentManager || '',
        status: jobData.status || 'Active',
        priority: jobData.priority || 'Medium',
        assigned_to: jobData.assignedTo || '',
        reporting_client_name: jobData.reportingClientName || '',
        reporting_client_email: jobData.reportingClientEmail || '',
        reporting_client_contact: jobData.reportingClientContact || '',
      }).select('job_code').single();

      if (error) return { error: error.message };
      this.clearCache('clientJobs');
      return { success: true, jobCode: data.job_code, message: 'Client Job added successfully' };
    } catch (error) {
      return { error: error.toString() };
    }
  },

  async updateClientJob(jobData) {
    try {
      const { error } = await supabase.from('client_jobs').update({
        job_title: jobData.jobTitle, job_type: jobData.jobType,
        job_mode: jobData.jobMode, business_unit: jobData.businessUnit,
        client_name: jobData.clientName, client_id: jobData.clientId,
        location: jobData.location, state: jobData.state,
        country: jobData.country, pay_rate: jobData.payRate,
        experience: jobData.experience, job_description: jobData.jobDescription,
        recruitment_manager: jobData.recruitmentManager,
        status: jobData.status, modified_on: new Date().toISOString(),
        modified_by: jobData.modifiedBy || 'Admin',
        priority: jobData.priority, assigned_to: jobData.assignedTo,
        reporting_client_name: jobData.reportingClientName,
        reporting_client_email: jobData.reportingClientEmail,
        reporting_client_contact: jobData.reportingClientContact,
      }).eq('job_code', jobData.jobCode);

      if (error) return { error: error.message };
      if (cache.clientJobs.data) {
        const idx = cache.clientJobs.data.findIndex(c => c.jobCode === jobData.jobCode);
        if (idx !== -1) cache.clientJobs.data[idx] = { ...cache.clientJobs.data[idx], ...jobData };
      }
      return { success: true, message: 'Client Job updated successfully' };
    } catch (error) {
      return { error: error.toString() };
    }
  },

  // ─────────────────────────────────────────────
  // LAST VIEWED BY
  // ─────────────────────────────────────────────
  async updateLastViewedBy(applicantId, viewedBy) {
    try {
      const { error } = await supabase.from('applicants')
        .update({ last_viewed_by: viewedBy })
        .eq('applicant_code', applicantId);

      if (error) return { error: error.message };
      if (cache.databaseCandidates.data) {
        const idx = cache.databaseCandidates.data.findIndex(c => c.applicantId === applicantId);
        if (idx !== -1) cache.databaseCandidates.data[idx].lastViewedBy = viewedBy;
      }
      return { success: true };
    } catch (error) {
      return { error: error.toString() };
    }
  },

  // ─────────────────────────────────────────────
  // ADMIN MANAGEMENT
  // ─────────────────────────────────────────────
  async fetchAllAdmins() {
    try {
      const { data, error } = await supabase.from('admin_users')
        .select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching admins:', error);
      return [];
    }
  },

  async createAdmin(adminData) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          email: adminData.email,
          password: adminData.password,
          hr_name: adminData.hrName,
          phone: adminData.phone,
          department: adminData.department,
          designation: adminData.designation,
          role: adminData.role || 'hr',
        }),
      });
      const data = await res.json();
      if (data.error) return { error: data.error };
      this.clearCache('hrs');
      return { success: true };
    } catch (error) {
      return { error: error.toString() };
    }
  },

  async toggleAdminStatus(adminId, activate) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: activate ? 'reactivate' : 'deactivate',
          admin_id: adminId,
        }),
      });
      const data = await res.json();
      if (data.error) return { error: data.error };
      this.clearCache('hrs');
      return { success: true };
    } catch (error) {
      return { error: error.toString() };
    }
  },

  async getHRReportCandidates() {
    try {
      const rows = [];
      let from = 0;
      while (true) {
        const to = from + SUPABASE_PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('applicants')
          .select('uploaded_by, created_on, source')
          .range(from, to);

        if (error) throw error;
        if (!data?.length) break;

        rows.push(...data);
        if (data.length < SUPABASE_PAGE_SIZE) break;
        from += SUPABASE_PAGE_SIZE;
      }
      return rows.map(r => ({
        uploadedBy: r.uploaded_by || '',
        createdOn: r.created_on || '',
        source: r.source || 'Others'
      }));
    } catch (error) {
      console.error('Error fetching HR report candidates:', error);
      return [];
    }
  },

  async getHRReportShortlisted() {
    try {
      const rows = [];
      let from = 0;
      while (true) {
        const to = from + SUPABASE_PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('tagged_candidates')
          .select('shortlisted_by, created_at')
          .range(from, to);

        if (error) throw error;
        if (!data?.length) break;

        rows.push(...data);
        if (data.length < SUPABASE_PAGE_SIZE) break;
        from += SUPABASE_PAGE_SIZE;
      }
      return rows.map(r => ({
        shortlistedBy: r.shortlisted_by || '',
        shortlistedOn: r.created_at || '',
        createdOn: r.created_at || ''
      }));
    } catch (error) {
      console.error('Error fetching HR report shortlisted:', error);
      return [];
    }
  },

  async getHRReportLogs() {
    try {
      const rows = [];
      let from = 0;
      while (true) {
        const to = from + SUPABASE_PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('communication_logs')
          .select('hr_name, created_at')
          .range(from, to);

        if (error) throw error;
        if (!data?.length) break;

        rows.push(...data);
        if (data.length < SUPABASE_PAGE_SIZE) break;
        from += SUPABASE_PAGE_SIZE;
      }
      return rows;
    } catch (error) {
      console.error('Error fetching HR report logs:', error);
      return [];
    }
  },

  // ─────────────────────────────────────────────
  // EMPLOYER REQUIREMENTS ("For Employers" Form)
  // ─────────────────────────────────────────────
  async submitEmployerRequirement(formData) {
    const payload = {
      company_name: formData.companyName || formData.company_name || '',
      contact_person: formData.contactPerson || formData.contact_person || '',
      email: formData.email || '',
      phone: formData.phone || '',
      requirement: formData.requirement || '',
      positions: formData.positions ? String(formData.positions) : '1',
      details: formData.details || '',
      status: 'New'
    };

    try {
      const { data, error } = await supabase
        .from('employer_requirements')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        console.warn('Supabase insert employer_requirements notice:', error.message);
      }
      
      this._saveLocalSubmission('ciedeck_employer_requirements_fallback', {
        id: data?.id || `local_${Date.now()}`,
        ...payload,
        created_at: data?.created_at || new Date().toISOString()
      });

      return { success: true, data: data || payload };
    } catch (err) {
      console.error('Error submitting employer requirement:', err);
      this._saveLocalSubmission('ciedeck_employer_requirements_fallback', {
        id: `local_${Date.now()}`,
        ...payload,
        created_at: new Date().toISOString()
      });
      return { success: true, data: payload };
    }
  },

  async fetchEmployerRequirements() {
    try {
      const { data, error } = await supabase
        .from('employer_requirements')
        .select('*')
        .order('created_at', { ascending: false });

      const localList = this._getLocalSubmissions('ciedeck_employer_requirements_fallback');
      if (error) {
        console.warn('fetchEmployerRequirements fallback:', error.message);
        return localList;
      }

      const dbIds = new Set((data || []).map(d => d.id));
      const merged = [...(data || [])];
      for (const loc of localList) {
        if (!dbIds.has(loc.id)) {
          merged.push(loc);
        }
      }
      return merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } catch (err) {
      console.error('Error fetching employer requirements:', err);
      return this._getLocalSubmissions('ciedeck_employer_requirements_fallback');
    }
  },

  async updateEmployerRequirementStatus(id, status) {
    try {
      if (!id.toString().startsWith('local_')) {
        await supabase
          .from('employer_requirements')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', id);
      }
      this._updateLocalSubmissionStatus('ciedeck_employer_requirements_fallback', id, status);
      return { success: true };
    } catch (err) {
      console.error('Error updating employer requirement status:', err);
      return { error: err.message };
    }
  },

  async deleteEmployerRequirement(id) {
    try {
      if (!id.toString().startsWith('local_')) {
        await supabase
          .from('employer_requirements')
          .delete()
          .eq('id', id);
      }
      this._deleteLocalSubmission('ciedeck_employer_requirements_fallback', id);
      return { success: true };
    } catch (err) {
      console.error('Error deleting employer requirement:', err);
      return { error: err.message };
    }
  },

  // ─────────────────────────────────────────────
  // CONTACT MESSAGES ("Contact Us" Form)
  // ─────────────────────────────────────────────
  async submitContactMessage(formData) {
    const payload = {
      full_name: formData.fullName || formData.full_name || '',
      email: formData.email || '',
      phone: formData.phone || '',
      subject: formData.subject || '',
      message: formData.message || '',
      status: 'Unread'
    };

    try {
      const { data, error } = await supabase
        .from('contact_messages')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        console.warn('Supabase insert contact_messages notice:', error.message);
      }

      this._saveLocalSubmission('ciedeck_contact_messages_fallback', {
        id: data?.id || `local_${Date.now()}`,
        ...payload,
        created_at: data?.created_at || new Date().toISOString()
      });

      return { success: true, data: data || payload };
    } catch (err) {
      console.error('Error submitting contact message:', err);
      this._saveLocalSubmission('ciedeck_contact_messages_fallback', {
        id: `local_${Date.now()}`,
        ...payload,
        created_at: new Date().toISOString()
      });
      return { success: true, data: payload };
    }
  },

  async fetchContactMessages() {
    try {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

      const localList = this._getLocalSubmissions('ciedeck_contact_messages_fallback');
      if (error) {
        console.warn('fetchContactMessages fallback:', error.message);
        return localList;
      }

      const dbIds = new Set((data || []).map(d => d.id));
      const merged = [...(data || [])];
      for (const loc of localList) {
        if (!dbIds.has(loc.id)) {
          merged.push(loc);
        }
      }
      return merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } catch (err) {
      console.error('Error fetching contact messages:', err);
      return this._getLocalSubmissions('ciedeck_contact_messages_fallback');
    }
  },

  async updateContactMessageStatus(id, status) {
    try {
      if (!id.toString().startsWith('local_')) {
        await supabase
          .from('contact_messages')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', id);
      }
      this._updateLocalSubmissionStatus('ciedeck_contact_messages_fallback', id, status);
      return { success: true };
    } catch (err) {
      console.error('Error updating contact message status:', err);
      return { error: err.message };
    }
  },

  async deleteContactMessage(id) {
    try {
      if (!id.toString().startsWith('local_')) {
        await supabase
          .from('contact_messages')
          .delete()
          .eq('id', id);
      }
      this._deleteLocalSubmission('ciedeck_contact_messages_fallback', id);
      return { success: true };
    } catch (err) {
      console.error('Error deleting contact message:', err);
      return { error: err.message };
    }
  },

  // Helpers for local submission persistence
  _saveLocalSubmission(key, item) {
    try {
      const items = this._getLocalSubmissions(key);
      items.unshift(item);
      localStorage.setItem(key, JSON.stringify(items.slice(0, 500)));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
  },

  _getLocalSubmissions(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  _updateLocalSubmissionStatus(key, id, status) {
    try {
      const items = this._getLocalSubmissions(key).map(item => 
        item.id === id ? { ...item, status, updated_at: new Date().toISOString() } : item
      );
      localStorage.setItem(key, JSON.stringify(items));
    } catch {}
  },

  _deleteLocalSubmission(key, id) {
    try {
      const items = this._getLocalSubmissions(key).filter(item => item.id !== id);
      localStorage.setItem(key, JSON.stringify(items));
    } catch {}
  },
};
