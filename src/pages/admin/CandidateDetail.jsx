import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jobService } from '../../services/jobService.js';
import {
  FiArrowLeft, FiUser, FiMail, FiPhone, FiMapPin, FiBriefcase,
  FiBookOpen, FiTag, FiAlignLeft, FiCalendar, FiExternalLink,
  FiEdit3, FiSave, FiX, FiAward, FiClock, FiCheckCircle,
  FiLoader, FiDatabase, FiFileText, FiActivity, FiClipboard, FiPhoneCall, FiMessageSquare
} from 'react-icons/fi';

// ── Helpers ──
function cvAge(d) {
  if (!d) return '—';
  const now = new Date(), then = new Date(d);
  if (isNaN(then.getTime())) return '—';
  
  now.setHours(0, 0, 0, 0);
  then.setHours(0, 0, 0, 0);
  const days = Math.round((now - then) / 864e5);
  
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
}
function fmtDate(d) {
  if (!d) return 'N/A';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? 'N/A' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

const TABS = [
  { key: 'snapshot', label: 'Snapshot', icon: <FiClipboard size={14} /> },
  { key: 'personal', label: 'Personal Details', icon: <FiUser size={14} /> },
  { key: 'professional', label: 'Profession Details', icon: <FiBriefcase size={14} /> },
  { key: 'employer', label: 'Employer Details', icon: <FiDatabase size={14} /> },
  { key: 'test', label: 'Employment Test Results', icon: <FiFileText size={14} /> },
  { key: 'activity', label: 'Activities', icon: <FiActivity size={14} /> },
  { key: 'communication', label: 'Comm. History', icon: <FiPhoneCall size={14} /> },
];

const STATUS_OPTIONS = ['Applied', 'In Database', 'Tagged', 'Rejected', 'Interview Scheduled', 'Hired', 'On Hold'];
const SOURCE_OPTIONS = [
  'BNC Indeed',
  'BNC Linkedin',
  'BNC IIM',
  'BNC Job Hai',
  'BNC Others',
  'Linkedin',
  'Indeed',
  'IIM',
  'Others',
  'Ciedeck',
  'Job Application',
  'HR Upload',
  'LinkedIn',
  'Naukri',
  'Referral',
  'Walk-in',
  'Company Website',
  'Other'
];
const EXP_OPTIONS = ['0', '1', '2', '3', '4', '5', '6-10', '10+'];
const NOTICE_OPTIONS = ['Immediate', '15 Days', '1 Month', '2 Months', '3 Months'];
const WORK_AUTH_OPTIONS = ['Citizen', 'Permanent Resident', 'Work Visa', 'Student Visa', 'Requires Sponsorship', 'Not Authorized', 'Other'];
const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Mandarin', 'Arabic', 'Bengali', 'Russian', 'Portuguese', 'Japanese', 'Other'];
const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo, Democratic Republic of the", "Congo, Republic of the", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

// ── Reusable edit field ──
function EditField({ label, value, onChange, type = 'text', options, multiline, disabled, placeholder, colSpan }) {
  const base = {
    width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0',
    borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'inherit',
    background: disabled ? '#f8fafc' : '#fff', color: '#1e293b', boxSizing: 'border-box',
    transition: 'border-color 0.2s'
  };
  return (
    <div style={{ gridColumn: colSpan ? `span ${colSpan}` : undefined }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '5px', letterSpacing: '0.3px' }}>
        {label}
      </label>
      {options ? (
        <select value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled} style={{ ...base, cursor: disabled ? 'not-allowed' : 'pointer' }}>
          <option value="">Select</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : multiline ? (
        <textarea rows={3} value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder={placeholder}
          style={{ ...base, resize: 'vertical', cursor: disabled ? 'not-allowed' : 'text' }} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder={placeholder}
          style={{ ...base, cursor: disabled ? 'not-allowed' : 'text' }}
          onFocus={e => { if (!disabled) e.target.style.borderColor = '#0B2F5B'; }}
          onBlur={e => { e.target.style.borderColor = '#e2e8f0'; }}
        />
      )}
    </div>
  );
}

// ── Right sidebar detail row ──
function DetailRow({ label, value }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '13px', color: '#1e293b', wordBreak: 'break-word', lineHeight: 1.5 }}>{value || 'N/A'}</div>
    </div>
  );
}

// ══════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════
export default function CandidateDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('snapshot');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [form, setForm] = useState({});
  const [showShortlistModal, setShowShortlistModal] = useState(false);
  const [clientJobs, setClientJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [newLogNotes, setNewLogNotes] = useState('');
  const [newLogType, setNewLogType] = useState('Call');
  const [addingLog, setAddingLog] = useState(false);

  const [rightTab, setRightTab] = useState('Applicant');
  const [ratings, setRatings] = useState({
    technical: 0,
    communication: 0,
    professionalism: 0,
    overall: 0
  });

  const [tempLang, setTempLang] = useState('');
  const [tempRead, setTempRead] = useState(true);
  const [tempSpeak, setTempSpeak] = useState(true);
  const [tempWrite, setTempWrite] = useState(true);

  const handleAddLanguage = () => {
    if (!tempLang) return;
    const skills = [];
    if (tempRead) skills.push('Read');
    if (tempSpeak) skills.push('Speak');
    if (tempWrite) skills.push('Write');
    
    const newLangEntry = skills.length > 0 ? `${tempLang} (${skills.join(', ')})` : tempLang;
    const current = form.language ? form.language.trim() : '';
    const updated = current ? `${current}, ${newLangEntry}` : newLangEntry;
    
    upd('language', updated);
    
    setTempLang('');
    setTempRead(true); setTempSpeak(true); setTempWrite(true);
  };

  const loadLogs = async (applicantId) => {
    setLoadingLogs(true);
    try {
      const res = await jobService.getCommunicationLogs(applicantId);
      if (res.success) {
        setLogs(res.data || []);
      } else {
        setLogs([]);
      }
    } catch(e) {
      setLogs([]);
    }
    setLoadingLogs(false);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [c, jobs] = await Promise.all([
        jobService.getDatabaseCandidateById(id),
        jobService.fetchClientJobs()
      ]);
      if (c) { 
        setCandidate(c); 
        setForm({ ...c }); 
        setRatings({
          technical: c.technicalRating ? parseInt(c.technicalRating) : 0,
          communication: c.communicationRating ? parseInt(c.communicationRating) : 0,
          professionalism: c.professionalismRating ? parseInt(c.professionalismRating) : 0,
          overall: c.overallRating ? parseInt(c.overallRating) : 0
        });
        const viewer = sessionStorage.getItem('bnc_admin_name') || sessionStorage.getItem('bnc_admin_id') || sessionStorage.getItem('loginId') || 'Recruiter/Admin';
        jobService.updateLastViewedBy(id, viewer);
        loadLogs(c.applicantId);
      } else {
        setError('Applicant not found.');
      }
      setClientJobs(jobs || []);
      setLoading(false);
    })();
  }, [id]);

  const upd = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    const result = await jobService.updateDatabaseCandidate({
      applicantId: candidate.applicantId,
      name: form.name,
      email: form.email,
      contactNumber: form.contactNumber,
      currentLocation: form.currentLocation,
      currentCompany: form.currentCompany,
      currentPosition: form.currentPosition,
      totalExperience: form.totalExperience,
      education: form.education,
      skills: form.skills,
      summary: form.summary,
      jobAppliedFor: form.jobAppliedFor,
      jobId: form.jobId,
      status: form.status,
      // extended fields
      noticePeriod: form.noticePeriod || '',
      expectedPay: form.expectedPay || '',
      currentCTC: form.currentCTC || '',
      workAuthorization: form.workAuthorization || '',
      qualification: form.qualification || '',
      recruiterComments: form.recruiterComments || '',
      aadharNumber: form.aadharNumber || '',
      nationality: form.nationality || '',
      preferredLocation: form.preferredLocation || '',
      reasonForChange: form.reasonForChange || '',
      processKnowledge: form.processKnowledge || '',
      profile: form.profile || '',
      callStatus: form.callStatus || '',
      relevantExperience: form.relevantExperience || '',
      referredBy: form.referredBy || '',
      certification: form.certification || '',
      language: form.language || '',
      technicalRating: ratings.technical || 0,
      communicationRating: ratings.communication || 0,
      professionalismRating: ratings.professionalism || 0,
      overallRating: ratings.overall || 0,
    });
    if (result.success) {
      setCandidate({ ...form });
      setEditing(false);
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } else {
      setSaveMsg('Error: ' + (result.error || 'Save failed'));
    }
    setSaving(false);
  };

  const handleShortlistSubmit = async (role, company, jobCode) => {
    setSaving(true);
    setSaveMsg('Saving...');
    const hrName = sessionStorage.getItem('bnc_admin_name') || sessionStorage.getItem('bnc_admin_id') || 'Admin';
    const result = await jobService.shortlistCandidate({
      applicantId: candidate.applicantId,
      name: candidate.name,
      jobRole: role,
      company: company,
      jobCode: jobCode,
      shortlistedBy: hrName
    });
    if (result.success) {
      setCandidate(prev => ({ ...prev, status: 'Tagged' }));
      setForm(prev => ({ ...prev, status: 'Tagged' }));
      setShowShortlistModal(false);
      setSaveMsg('Candidate Tagged!');
      setTimeout(() => setSaveMsg(''), 4000);
    } else {
      setSaveMsg('Error: ' + (result.error || 'Failed to shortlist'));
      setTimeout(() => setSaveMsg(''), 4000);
    }
    setSaving(false);
  };

  const handleCancel = () => { setForm({ ...candidate }); setEditing(false); };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', color: '#94a3b8' }}>
        <FiLoader size={28} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }
  if (error || !candidate) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <p style={{ fontSize: '16px', color: '#dc2626' }}>{error || 'Not found'}</p>
        <button onClick={() => nav('/admin/applicants')} style={{ marginTop: '12px', padding: '10px 24px', background: '#0B2F5B', color: '#fff', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
          ← Back to Applicants
        </button>
      </div>
    );
  }

  // ── Right sidebar current details ──
  const SidePanel = () => (
    <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px 22px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
      <h4 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 800, color: '#0B2F5B', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
        Applicant Details
      </h4>
      <DetailRow label="Ownership" value={candidate.uploadedBy} />
      <DetailRow label="Applicant Status" value={candidate.status} />
      <DetailRow label="Source" value={candidate.source} />
      <DetailRow label="Work Authorization" value={candidate.workAuthorization || 'N/A'} />
      <DetailRow label="Skills" value={candidate.skills} />
      <DetailRow label="Experience" value={candidate.totalExperience ? `${candidate.totalExperience} Year(s)` : 'N/A'} />
      <DetailRow label="Expected Pay" value={candidate.expectedPay || 'N/A'} />
      <DetailRow label="Current CTC" value={candidate.currentCTC || 'N/A'} />
      <DetailRow label="Notice Period" value={candidate.noticePeriod || 'N/A'} />

      <h4 style={{ margin: '24px 0 16px', fontSize: '13px', fontWeight: 800, color: '#0B2F5B', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
        Personal Details
      </h4>
      <DetailRow label="Relevant Experience" value={candidate.relevantExperience || 'N/A'} />
      <DetailRow label="Process Knowledge" value={candidate.processKnowledge || 'N/A'} />
      <DetailRow label="Reason for Change" value={candidate.reasonForChange || 'N/A'} />
      <DetailRow label="Recruiter's Comments" value={candidate.recruiterComments || 'N/A'} />
      <DetailRow label="Qualification" value={candidate.qualification || candidate.education || 'N/A'} />
      <DetailRow label="Nationality" value={candidate.nationality || 'N/A'} />
      <DetailRow label="Preferred Location" value={candidate.preferredLocation || 'N/A'} />
      <DetailRow label="Referred By" value={candidate.referredBy || 'N/A'} />
    </div>
  );

  const HeaderCard = () => (
    <div style={{
      background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0',
      padding: '22px 24px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '16px'
    }}>
      <div style={{
        width: '54px', height: '54px', borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #0B2F5B, #1a4a8a)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '20px', fontWeight: 800, color: '#fff'
      }}>{(candidate.name || 'A').charAt(0).toUpperCase()}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', lineHeight: '24px' }}>
          {candidate.applicantId} - {candidate.name}
        </div>
        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{candidate.currentPosition || 'Position N/A'}</div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {candidate.currentLocation && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FiMapPin size={11} /> {candidate.currentLocation}</span>}
          
          {candidate.contactNumber && <a href={`tel:${candidate.contactNumber}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#6CB1F9', fontWeight: 600, textDecoration: 'none' }}><FiPhone size={11} /> {candidate.contactNumber}</a>}
          
          {candidate.contactNumber && candidate.email && <span style={{ color: '#e2e8f0' }}>|</span>}
          
          {candidate.email && <a href={`mailto:${candidate.email}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#6CB1F9', fontWeight: 600, textDecoration: 'none' }}><FiMail size={11} /> {candidate.email}</a>}
        </div>
        <div style={{ fontSize: '11px', color: '#1e293b', marginTop: '8px', fontWeight: 600 }}>
          Last Viewed By: <strong>{candidate.lastViewedBy || 'Just Now'}</strong>
        </div>
        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
          Created By & On - <strong>{candidate.uploadedBy || 'N/A'}</strong> & {fmtDate(candidate.createdOn)}
        </div>
        {/* Action buttons */}
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => { setEditing(true); setTab('personal'); }} className="action-btn" style={{
            padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: '6px',
            background: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#475569'
          }}>Edit Applicant</button>
          
          <button onClick={() => setShowShortlistModal(true)} className="action-btn" style={{
            padding: '6px 14px', border: candidate.status === 'Tagged' ? '1px solid #0B2F5B' : '1px solid #334155', borderRadius: '6px',
            background: candidate.status === 'Tagged' ? '#eff6ff' : '#f8fafc', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: candidate.status === 'Tagged' ? '#1e40af' : '#334155',
            display: 'inline-flex', alignItems: 'center', gap: '4px'
          }}><FiTag size={11} /> {candidate.status === 'Tagged' ? '+ Tag Another Job' : 'Add Tag'}</button>

          {candidate.resumeLink && candidate.resumeLink !== 'No resume uploaded' && (
            <a href={candidate.resumeLink} target="_blank" rel="noopener noreferrer" className="action-btn" style={{
              padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: '6px',
              background: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#475569',
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px'
            }}>View Resume <FiExternalLink size={11} /></a>
          )}

          <button onClick={() => setShowLogModal(true)} className="action-btn" style={{
            padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: '6px',
            background: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#000',
            display: 'inline-flex', alignItems: 'center', gap: '6px'
          }}>
            <FiPhoneCall size={11} color="#000" /> Log Comm.
            {logs && logs.length > 0 && (
              <span style={{
                background: '#f1f5f9', color: '#000', fontSize: '10px', fontWeight: 800,
                padding: '2px 6px', borderRadius: '12px'
              }}>
                {logs.length}
              </span>
            )}
          </button>
        </div>
      </div>
      {/* Rating / AI Box */}
      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '16px', marginTop: '4px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px', minWidth: '220px' }}>
          {/* Stars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
            {[
              { key: 'technical', label: 'Technical Skills' },
              { key: 'communication', label: 'Communication Skills' },
              { key: 'professionalism', label: 'Professionalism' },
              { key: 'overall', label: 'Overall Rating' }
            ].map(item => (
              <div key={item.key} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>{item.label} : </span>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <span
                      key={star}
                      onClick={() => {
                        setRatings(prev => ({ ...prev, [item.key]: star }));
                        // Auto-save the specific rating
                        jobService.updateDatabaseCandidate({
                          applicantId: candidate.applicantId,
                          [`${item.key}Rating`]: star
                        });
                      }}
                      style={{
                        cursor: 'pointer',
                        color: star <= (ratings[item.key] || 0) ? '#fbbf24' : '#e2e8f0',
                        fontSize: '16px',
                        lineHeight: '1',
                        transition: 'color 0.2s'
                      }}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
          {candidate.aiScore !== null && candidate.aiScore !== undefined && candidate.aiScore !== '' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '3px' }}>AI Score</div>
              <span style={{
                fontSize: '16px', fontWeight: 800,
                color: parseFloat(candidate.aiScore) >= 7 ? '#059669' : parseFloat(candidate.aiScore) >= 5 ? '#f59e0b' : '#dc3545'
              }}>{candidate.aiScore}/10</span>
            </div>
          )}
          {candidate.shortlistDecision && (
            <span style={{
              padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
              background: candidate.shortlistDecision === 'Shortlisted' ? '#f0fdf4' : '#fef2f2',
              color: candidate.shortlistDecision === 'Shortlisted' ? '#166534' : '#dc2626',
            }}>{candidate.shortlistDecision}</span>
          )}
        </div>
      </div>
    </div>
  );

  // ── Snapshot Tab ──
  const SnapshotContent = () => (
    <div>

      {/* Notes / AI Analysis */}
      {candidate.aiAnalysis && (
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px 22px', marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>AI Analysis</h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.7 }}>{candidate.aiAnalysis}</p>
          {candidate.shortlistReason && (
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#64748b' }}><strong>Reason:</strong> {candidate.shortlistReason}</p>
          )}
        </div>
      )}

      {/* Summary */}
      {candidate.summary && (
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px 22px', marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Professional Summary</h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.7 }}>{candidate.summary}</p>
        </div>
      )}

      {/* Skills */}
      {candidate.skills && (
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px 22px' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Skills</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {candidate.skills.split(',').map((s, i) => s.trim() && (
              <span key={i} style={{
                padding: '4px 12px', background: '#eff6ff', color: '#1e40af',
                borderRadius: '20px', fontSize: '12px', fontWeight: 600, border: '1px solid #bfdbfe'
              }}>{s.trim()}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Personal Details Tab ──
  const PersonalContent = () => (
    <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '22px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>Personal Details</h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <EditField label="Full Name *" value={form.name} onChange={v => upd('name', v)} disabled={!editing} />
        <EditField label="Email Address *" value={form.email} onChange={v => upd('email', v)} disabled={!editing} type="email" />
        <EditField label="Mobile Number *" value={form.contactNumber} onChange={v => upd('contactNumber', v)} disabled={!editing} type="tel" />
        <EditField label="Source *" value={form.source} onChange={v => upd('source', v)} disabled={!editing} options={SOURCE_OPTIONS} />
        <EditField label="Current Company" value={form.currentCompany} onChange={v => upd('currentCompany', v)} disabled={!editing} />
        <EditField label="Current Location" value={form.currentLocation} onChange={v => upd('currentLocation', v)} disabled={!editing} />
        <EditField label="Experience (Years)" value={form.totalExperience} onChange={v => upd('totalExperience', v)} disabled={!editing} options={EXP_OPTIONS} />
        <EditField label="Relevant Experience" value={form.relevantExperience} onChange={v => upd('relevantExperience', v)} disabled={!editing} />
        <EditField label="Current CTC" value={form.currentCTC} onChange={v => upd('currentCTC', v)} disabled={!editing} />
        <EditField label="Expected Pay" value={form.expectedPay} onChange={v => upd('expectedPay', v)} disabled={!editing} />
        <EditField label="Notice Period" value={form.noticePeriod} onChange={v => upd('noticePeriod', v)} disabled={!editing} options={NOTICE_OPTIONS} />
        <EditField label="Job Title / Position" value={form.currentPosition} onChange={v => upd('currentPosition', v)} disabled={!editing} />
        <EditField label="Process Knowledge" value={form.processKnowledge} onChange={v => upd('processKnowledge', v)} disabled={!editing} />
        <EditField label="Reason for Change" value={form.reasonForChange} onChange={v => upd('reasonForChange', v)} disabled={!editing} />
        <EditField label="Work Authorization" value={form.workAuthorization} onChange={v => upd('workAuthorization', v)} disabled={!editing} options={WORK_AUTH_OPTIONS} />
        <EditField label="Ownership / Uploaded By" value={form.uploadedBy} onChange={() => {}} disabled />
        <EditField label="Aadhar Number" value={form.aadharNumber} onChange={v => upd('aadharNumber', v)} disabled={!editing} />
        <EditField label="Nationality" value={form.nationality} onChange={v => upd('nationality', v)} disabled={!editing} options={COUNTRIES} />
        <EditField label="Recruiter's Comments" value={form.recruiterComments} onChange={v => upd('recruiterComments', v)} disabled={!editing} colSpan={3} multiline />
        <EditField label="Profile Summary" value={form.summary} onChange={v => upd('summary', v)} disabled={!editing} colSpan={3} multiline />
        <EditField label="Skills" value={form.skills} onChange={v => upd('skills', v)} disabled={!editing} colSpan={3} />
      </div>
    </div>
  );

  // ── Professional Details Tab ──
  const ProfessionalContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Education Details */}
      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>Education Details</h3>
          {editing && <button className="simple-btn" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>+ Add</button>}
        </div>
        <div style={{ padding: '24px' }}>
          <EditField label="Education / Qualification" value={form.education} onChange={v => upd('education', v)} disabled={!editing} multiline />
        </div>
      </div>

      {/* Certifications */}
      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>Certifications</h3>
          {editing && <button className="simple-btn" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>+ Add</button>}
        </div>
        <div style={{ padding: '24px' }}>
          <EditField label="Certification" value={form.certification} onChange={v => upd('certification', v)} disabled={!editing} multiline />
        </div>
      </div>


      {/* Add Language Details */}
      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>Add Language Details</h3>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.3px' }}>Saved Languages</label>
            <div style={{ fontSize: '13px', color: '#1e293b', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '42px', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
              {form.language || 'No languages added yet.'}
            </div>
          </div>
          
          {editing && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start', padding: '16px', border: '1px dashed #cbd5e1', borderRadius: '8px', background: '#f8fafc' }}>
              <div>
                <EditField label="Select Language" value={tempLang} onChange={setTempLang} disabled={false} options={LANGUAGE_OPTIONS} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '10px', letterSpacing: '0.3px' }}>
                  Proficiency Checklist
                </label>
                <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                  <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#1e293b' }}>
                    <input type="checkbox" checked={tempRead} onChange={e => setTempRead(e.target.checked)} style={{ cursor: 'pointer' }} /> Read
                  </label>
                  <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#1e293b' }}>
                    <input type="checkbox" checked={tempSpeak} onChange={e => setTempSpeak(e.target.checked)} style={{ cursor: 'pointer' }} /> Speak
                  </label>
                  <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#1e293b' }}>
                    <input type="checkbox" checked={tempWrite} onChange={e => setTempWrite(e.target.checked)} style={{ cursor: 'pointer' }} /> Write
                  </label>
                </div>
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', marginTop: '4px' }}>
                <button onClick={handleAddLanguage} className="simple-btn" style={{ padding: '8px 16px' }}>Add Selected Language into Data</button>
                <button onClick={() => upd('language', '')} className="simple-btn" style={{ padding: '8px 16px' }}>Clear All Selected Languages</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );

  // ── Employer Details Tab ──
  const EmployerContent = () => (
    <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '22px 24px' }}>
      <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>Employer Details</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <EditField label="Current Company" value={form.currentCompany} onChange={v => upd('currentCompany', v)} disabled={!editing} />
        <EditField label="Current Position" value={form.currentPosition} onChange={v => upd('currentPosition', v)} disabled={!editing} />
        <EditField label="Total Experience" value={form.totalExperience} onChange={v => upd('totalExperience', v)} disabled={!editing} options={EXP_OPTIONS} />
        <EditField label="Current CTC" value={form.currentCTC} onChange={v => upd('currentCTC', v)} disabled={!editing} />
        <EditField label="Notice Period" value={form.noticePeriod} onChange={v => upd('noticePeriod', v)} disabled={!editing} options={NOTICE_OPTIONS} />
        <EditField label="Relevant Profile Experience" value={form.relevantExperience} onChange={v => upd('relevantExperience', v)} disabled={!editing} />
      </div>
    </div>
  );

  // ── Test Results Tab ──
  const TestResultsContent = () => (
    <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '22px 24px' }}>
      <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>Employment Test Results</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '5px' }}>AI Score</label>
          <div style={{
            padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0',
            fontSize: '18px', fontWeight: 800,
            color: candidate.aiScore ? (parseFloat(candidate.aiScore) >= 7 ? '#059669' : parseFloat(candidate.aiScore) >= 5 ? '#f59e0b' : '#dc3545') : '#cbd5e1'
          }}>{candidate.aiScore ? `${candidate.aiScore}/10` : 'N/A'}</div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '5px' }}>Shortlisting Decision</label>
          <div style={{
            padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0',
            fontSize: '13px', fontWeight: 700,
            color: candidate.shortlistDecision === 'Shortlisted' ? '#059669' : candidate.shortlistDecision === 'Not Shortlisted' ? '#dc3545' : '#64748b'
          }}>{candidate.shortlistDecision || 'N/A'}</div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '5px' }}>CV Age</label>
          <div style={{
            padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0',
            fontSize: '13px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px'
          }}><FiClock size={13} /> {cvAge(candidate.createdOn)}</div>
        </div>
        <div style={{ gridColumn: 'span 3' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '5px' }}>AI Analysis</label>
          <div style={{
            padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0',
            fontSize: '13px', color: '#475569', lineHeight: 1.7, minHeight: '60px'
          }}>{candidate.aiAnalysis || 'No AI analysis available yet.'}</div>
        </div>
        <div style={{ gridColumn: 'span 3' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '5px' }}>Shortlisting Reason</label>
          <div style={{
            padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0',
            fontSize: '13px', color: '#475569', lineHeight: 1.7, minHeight: '40px'
          }}>{candidate.shortlistReason || 'N/A'}</div>
        </div>
      </div>
    </div>
  );

  // ── Activities Tab ──
  const ActivitiesContent = () => (
    <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '22px 24px' }}>
      <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>Activities & Timeline</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {/* Timeline items */}
        {[
          { icon: <FiDatabase size={14} />, title: 'Record Created', subtitle: `By ${candidate.uploadedBy || 'System'}`, ts: fmtDate(candidate.createdOn), color: '#0B2F5B' },
          { icon: <FiFileText size={14} />, title: `Source: ${candidate.source || 'N/A'}`, subtitle: candidate.jobAppliedFor ? `Applied for: ${candidate.jobAppliedFor}` : 'HR Upload', ts: fmtDate(candidate.timestamp || candidate.createdOn), color: '#3b82f6' },
          candidate.aiScore ? { icon: <FiAward size={14} />, title: `AI Score: ${candidate.aiScore}/10`, subtitle: `Decision: ${candidate.shortlistDecision || 'Pending'}`, ts: 'Auto', color: '#059669' } : null,
          candidate.status !== 'Applied' && candidate.status !== 'In Database' ? { icon: <FiCheckCircle size={14} />, title: `Status changed to: ${candidate.status}`, subtitle: '', ts: '', color: '#7c3aed' } : null,
        ].filter(Boolean).map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: '14px', position: 'relative' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                background: item.color, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1
              }}>{item.icon}</div>
              {i < 3 && <div style={{ width: '2px', flex: 1, background: '#e2e8f0', minHeight: '20px' }} />}
            </div>
            <div style={{ paddingBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{item.title}</div>
              {item.subtitle && <div style={{ fontSize: '12px', color: '#64748b' }}>{item.subtitle}</div>}
              {item.ts && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{item.ts}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const handleAddLog = async () => {
    if (!newLogNotes.trim()) return;
    setAddingLog(true);
    const hrName = sessionStorage.getItem('bnc_admin_name') || sessionStorage.getItem('bnc_admin_id') || 'Admin';
    const logData = {
      applicantCode: candidate.applicantId,
      hrName: hrName,
      communicationType: newLogType,
      notes: newLogNotes
    };
    const res = await jobService.addCommunicationLog(logData);
    if (res.success) {
      setNewLogNotes('');
      setNewLogType('Call');
      setShowLogModal(false);
      loadLogs(candidate.applicantId);
    } else {
      alert(res.error || 'Failed to add log');
    }
    setAddingLog(false);
  };

  // ── Communication History Tab ──
  const CommunicationContent = () => {
    return (
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '22px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>Communication History</h3>
          <button onClick={() => setShowLogModal(true)} style={{
            padding: '8px 16px', background: '#0B2F5B', color: '#fff', border: 'none', borderRadius: '8px', 
            fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <FiPhoneCall size={12} /> Log New Comm.
          </button>
        </div>

        {/* Timeline */}
        {loadingLogs ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px', color: '#94a3b8' }}><FiLoader size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
        ) : (logs || []).length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
            <FiMessageSquare size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <div>No communication logged yet.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {(logs || []).map((log, i) => (
              <div key={log.id} style={{ display: 'flex', gap: '14px', position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: log.communication_type === 'Call' ? '#059669' : log.communication_type === 'Email' ? '#3b82f6' : '#8b5cf6', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1
                  }}>
                    {log.communication_type === 'Call' ? <FiPhoneCall size={14} /> : log.communication_type === 'Email' ? <FiMail size={14} /> : <FiMessageSquare size={14} />}
                  </div>
                  {i < logs.length - 1 && <div style={{ width: '2px', flex: 1, background: '#e2e8f0', minHeight: '20px' }} />}
                </div>
                <div style={{ paddingBottom: '20px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{log.hr_name} <span style={{ color: '#94a3b8', fontWeight: 500 }}>via {log.communication_type}</span></div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{fmtDate(log.created_at)} ({cvAge(log.created_at)})</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                    {log.notes}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const tabContent = {
    snapshot: SnapshotContent,
    personal: PersonalContent,
    professional: ProfessionalContent,
    employer: EmployerContent,
    test: TestResultsContent,
    activity: ActivitiesContent,
    communication: CommunicationContent,
  };

  const ActiveTabComponent = tabContent[tab];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .action-btn { transition: all 0.15s; }
        .action-btn:active { transform: scale(0.95); }
        .simple-btn { background: #fff; border: 1px solid #cbd5e1; color: #334155; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
        .simple-btn:active { transform: scale(0.95); }
      `}</style>

      {/* ── Top Tab Bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #e2e8f0', background: '#fff', padding: '0 24px', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', overflowX: 'auto', flex: 1, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          <button onClick={() => nav('/admin/applicants')} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '12px 10px 12px 0px', background: 'none', border: 'none',
            cursor: 'pointer', color: '#64748b', fontSize: '12px', fontWeight: 600,
            borderRight: '1px solid #e2e8f0', marginRight: '4px'
          }}>
            <FiArrowLeft size={14} />
          </button>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '12px 10px', background: 'none', border: 'none',
                borderBottom: tab === t.key ? '2px solid #0B2F5B' : '2px solid transparent',
                color: tab === t.key ? '#0B2F5B' : '#94a3b8',
                fontSize: '11px', fontWeight: tab === t.key ? 700 : 500,
                cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px', flexShrink: 0 }}>
          {saveMsg && (
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px',
              background: saveMsg.startsWith('Error') ? '#fef2f2' : '#f0fdf4',
              color: saveMsg.startsWith('Error') ? '#dc2626' : '#059669',
              animation: 'fadeIn 0.3s ease'
            }}>{saveMsg}</span>
          )}
          {editing ? (
            <>
              <button onClick={handleSave} disabled={saving} style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '5px 12px', background: '#0B2F5B', color: '#fff',
                border: 'none', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '11px', fontWeight: 700
              }}>
                {saving ? <FiLoader size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <FiSave size={11} />}
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={handleCancel} style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '5px 12px', background: '#fff', color: '#64748b',
                border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer',
                fontSize: '11px', fontWeight: 700
              }}>
                <FiX size={11} /> Cancel
              </button>
            </>
          ) : (
            <>
            <button onClick={() => setEditing(true)} className="action-btn" style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '5px 10px', background: '#fff', color: '#0B2F5B',
              border: '1px solid #0B2F5B40', borderRadius: '6px', cursor: 'pointer',
              fontSize: '10px', fontWeight: 600
            }}>
              <FiEdit3 size={11} /> Edit Applicant
            </button>
            </>
          )}
        </div>
      </div>

      {/* ── Body: Left Content + Right Sidebar ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', background: '#f7f9fc' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
          <HeaderCard />
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {ActiveTabComponent()}
          </div>
        </div>
        <div style={{ width: '310px', flexShrink: 0, padding: '22px 24px 22px 0', overflowY: 'auto' }}>
          {SidePanel()}
        </div>
      </div>

      {/* ── Shortlist Modal ── */}
      {showShortlistModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }} onClick={() => setShowShortlistModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '460px', overflow: 'hidden',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)', animation: 'fadeIn 0.2s ease'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiCheckCircle size={20} style={{ color: '#059669' }} /> Finalize Tagging
              </h3>
              <button onClick={() => setShowShortlistModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><FiX size={20} /></button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Candidate Details</label>
                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                  {candidate.name} <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>(ID: #{candidate.applicantId})</span>
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Select Opening (Target Role) *</label>
                <select 
                  id="shortlist-job" 
                  onChange={(e) => {
                    const job = clientJobs.find(j => j.jobCode === e.target.value);
                    setSelectedJob(job || null);
                  }}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                >
                  <option value="">Select Opening (By Code or Title)</option>
                  {clientJobs.map(j => (
                    <option key={j.jobCode} value={j.jobCode}>
                      {j.jobCode} - {j.jobTitle} - {j.clientName}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Target Job Code</label>
                  <input readOnly value={selectedJob ? selectedJob.jobCode : '—'} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', background: '#f8fafc', color: '#1e293b', outline: 'none', boxSizing: 'border-box', fontWeight: 700 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Tagged for Company</label>
                  <input 
                    id="shortlist-company" 
                    readOnly
                    placeholder="Auto-fills from job" 
                    value={selectedJob ? selectedJob.clientName : ''} 
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', background: '#f8fafc', color: '#475569', fontWeight: 600 }} 
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Action By (HR)</label>
                  <input readOnly value={sessionStorage.getItem('bnc_admin_name') || sessionStorage.getItem('bnc_admin_id') || 'Admin'} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', background: '#f8fafc', color: '#475569', outline: 'none', boxSizing: 'border-box', fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Date</label>
                  <input type="text" readOnly value={new Date().toLocaleDateString('en-IN')} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', background: '#f8fafc', color: '#475569', outline: 'none', boxSizing: 'border-box', fontWeight: 600 }} />
                </div>
              </div>
              <button disabled={saving || !selectedJob} onClick={() => {
                handleShortlistSubmit(selectedJob.jobTitle, selectedJob.clientName, selectedJob.jobCode);
              }} style={{
                width: '100%', padding: '14px', background: !selectedJob ? '#94a3b8' : 'linear-gradient(135deg, #059669, #047857)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: (saving || !selectedJob) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}>
                {saving ? <FiLoader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <FiCheckCircle size={16} />}
                {saving ? 'Processing...' : 'Confirm Tagging'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Log Communication Modal ── */}
      {showLogModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }} onClick={() => setShowLogModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '460px', overflow: 'hidden',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)', animation: 'fadeIn 0.2s ease'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiPhoneCall size={20} style={{ color: '#0B2F5B' }} /> Log Communication
              </h3>
              <button onClick={() => setShowLogModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><FiX size={20} /></button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Communication Type</label>
                <select value={newLogType} onChange={e => setNewLogType(e.target.value)} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none' }}>
                  <option value="Call">Call</option>
                  <option value="Email">Email</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Notes</label>
                <textarea 
                  rows="4"
                  placeholder="Enter communication notes... (e.g. Talked about notice period)" 
                  value={newLogNotes} 
                  onChange={e => setNewLogNotes(e.target.value)} 
                  style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} 
                />
              </div>
              <button disabled={addingLog || !newLogNotes.trim()} onClick={handleAddLog} style={{
                width: '100%', padding: '14px', background: addingLog || !newLogNotes.trim() ? '#94a3b8' : '#0B2F5B', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: addingLog || !newLogNotes.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}>
                {addingLog ? <FiLoader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <FiCheckCircle size={16} />}
                {addingLog ? 'Saving...' : 'Save Log'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
