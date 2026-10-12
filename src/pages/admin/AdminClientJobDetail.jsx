import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jobService } from '../../services/jobService.js';
import CandidateRecommendations from '../../components/admin/CandidateRecommendations.jsx';
import { matchingEnabled } from '../../services/candidateMatchingService.js';
import { FiArrowLeft, FiMapPin, FiBriefcase, FiUser, FiClock, FiSearch, FiRefreshCw, FiFileText, FiDownload } from 'react-icons/fi';

export default function AdminClientJobDetail() {
  const { jobCode } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [shortlistedForJob, setShortlistedForJob] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [candidateTab, setCandidateTab] = useState('tagged');

  const reloadTagged = async () => {
    const matches = await jobService.fetchShortlistedCandidatesByJob(jobCode);
    const applicants = await jobService.fetchApplicantsByIds(matches.map(item => item.applicantId));
    const applicantMap = new Map(applicants.map(applicant => [applicant.applicantId, applicant]));
    setShortlistedForJob(matches.map(match => ({ ...match, ...(applicantMap.get(match.applicantId) || {}) })));
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const foundJob = await jobService.fetchClientJobByCode(jobCode);
        setJob(foundJob || null);

        if (foundJob) {
          const matches = await jobService.fetchShortlistedCandidatesByJob(jobCode);
          const applicants = await jobService.fetchApplicantsByIds(matches.map((item) => item.applicantId));
          const applicantMap = new Map(applicants.map((applicant) => [applicant.applicantId, applicant]));
          const enriched = matches.map((match) => ({
            ...match,
            ...(applicantMap.get(match.applicantId) || {})
          }));

          setShortlistedForJob(enriched);
        } else {
          setShortlistedForJob([]);
        }
      } catch (err) {
        console.error('Failed to load job detail or submissions', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [jobCode]);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB') + ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const handleExport = () => {
    if (!job) return;

    const escapeXML = (val) => {
      if (val === null || val === undefined) return '';
      return String(val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const getStyleByStage = (stage) => {
      if (stage === 'Manager Submit') return 'StyleManagerSubmit';
      if (stage === 'Client Submission') return 'StyleClientSubmission';
      if (stage === 'Feedback') return 'StyleFeedback';
      return 'StylePipeline';
    };

    const rawSheetName = `${job.jobCode} ${job.jobTitle || ''}`.trim();
    const sanitizedSheetName = rawSheetName.replace(/[\\/?*:[\]]/g, ' ');
    const finalSheetName = sanitizedSheetName.length > 31 ? sanitizedSheetName.slice(0, 31) : sanitizedSheetName;

    const xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:CharSet="1" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="TableHeader">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#000000"/>
   <Interior ss:Color="#CCE0F5" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A6B9D0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A6B9D0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A6B9D0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A6B9D0"/>
   </Borders>
  </Style>
  <Style ss:ID="TableCell">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#333333"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="StylePipeline">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#475569"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="StyleManagerSubmit">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#C2410C"/>
   <Interior ss:Color="#FFF7ED" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDBA74"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDBA74"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDBA74"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDBA74"/>
   </Borders>
  </Style>
  <Style ss:ID="StyleClientSubmission">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1E40AF"/>
   <Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
   </Borders>
  </Style>
  <Style ss:ID="StyleFeedback">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#166534"/>
   <Interior ss:Color="#F0FDF4" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXML(finalSheetName)}">
  <Table>
   <Column ss:Width="50"/>
   <Column ss:Width="150"/>
   <Column ss:Width="200"/>
   <Column ss:Width="120"/>
   <Column ss:Width="150"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="200"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Row ss:Height="22">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">S.No</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Candidate Name</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Email</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Mobile Number</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Location</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Current CTC</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Expected CTC</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Education</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Current Status</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Tagged By</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Tagged On</Data></Cell>
   </Row>
   ${shortlistedForJob.map((c, idx) => {
     const firstColStyle = getStyleByStage(c.currentStage);
     return `
   <Row ss:Height="18">
    <Cell ss:StyleID="${firstColStyle}"><Data ss:Type="String">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.name || 'N/A')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.email || 'N/A')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.contactNumber || 'N/A')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.currentLocation || 'N/A')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.currentCTC || 'N/A')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.expectedPay || 'N/A')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.education || 'N/A')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.currentStage || 'Pipeline')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.shortlistedBy || 'N/A')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.shortlistedOn ? formatDate(c.shortlistedOn) : (c.date ? formatDate(c.date) : 'N/A'))}</Data></Cell>
   </Row>`;
   }).join('')}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${job.jobCode}_Snapshot_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        <FiRefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
        <h2>Loading Job Details...</h2>
      </div>
    );
  }

  if (!job) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#e11d48' }}>
        <h2>Job not found!</h2>
        <button onClick={() => navigate('/admin/client-jobs')} style={{ padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>Go Back</button>
      </div>
    );
  }

  const isBoxActive = job.status?.toLowerCase() === 'active';

  return (
    <div style={{ padding: '24px 32px', background: '#f8fafc', minHeight: '100vh' }}>

      {/* Top Banner Area */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>

        {/* Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => navigate('/admin/client-jobs')} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', display: 'flex' }}>
              <FiArrowLeft size={24} />
            </button>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiBriefcase color="#f59e0b" /> {job.jobCode} - {job.jobTitle}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => navigate('/admin/client-jobs', { state: { editJobCode: job.jobCode } })}
              style={{
                background: '#fff', border: '1px solid #e2e8f0', color: '#0f172a',
                padding: '6px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
              }}
            >
              Edit Job
            </button>
            <div style={{
              background: isBoxActive ? '#22c55e' : '#ef4444',
              color: '#fff', padding: '6px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 800
            }}>
              {job.status?.toUpperCase() || 'ACTIVE'}
            </div>
          </div>
        </div>

        {/* Sub Header (Client & Location) */}
        <div style={{ paddingLeft: '44px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
            <span style={{ color: '#3b82f6', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}><FiUser /> {job.clientName}</span>
            <span>|</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FiMapPin /> {job.location}{job.state ? `, ${job.state}` : ''}, {job.country}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Assigned To:</span>
            {job.assignedTo ? (
              job.assignedTo.split(',').map((hr, idx) => (
                <span key={idx} style={{
                  display: 'inline-block', background: '#ecfdf5', color: '#059669',
                  border: '1px solid #a7f3d0', padding: '3px 10px', borderRadius: '16px',
                  fontSize: '12px', fontWeight: 700
                }}>
                  {hr.trim()}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>N/A</span>
            )}
          </div>
          <div style={{ fontSize: '13px', color: '#3b82f6', marginTop: '8px', fontWeight: 600 }}>Tagged Applicants {shortlistedForJob.length}</div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '0 0 24px 0' }} />

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', alignItems: 'center', paddingLeft: '44px' }}>
          {/* Column 1: Client Reporting Contact (Moved Left First) */}
          <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: '16px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>Client Reporting Contact</div>
            {job.reportingClientName ? (
              <div>
                <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>{job.reportingClientName}</div>
                {job.reportingClientEmail && (
                  <a href={`mailto:${job.reportingClientEmail}`} style={{ fontSize: '12px', color: '#2563eb', textDecoration: 'none', display: 'block', marginTop: '3px' }}>
                    {job.reportingClientEmail}
                  </a>
                )}
                {job.reportingClientContact && (
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{job.reportingClientContact}</div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>Not assigned</div>
            )}
          </div>

          {/* Column 2: Pay Rate / Salary (Moved from Col 1) */}
          <div style={{ borderRight: '1px solid #e2e8f0', padding: '0 16px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>Pay Rate / Salary</div>
            <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>{job.payRate || 'N/A'}</div>
          </div>

          {/* Column 3: Recruitment Manager */}
          <div style={{ borderRight: '1px solid #e2e8f0', padding: '0 16px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>Recruitment Manager</div>
            <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>{job.recruitmentManager || '—'}</div>
          </div>

          {/* Column 4: Job Type / Mode */}
          <div style={{ borderRight: '1px solid #e2e8f0', padding: '0 16px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>Job Type / Mode</div>
            <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>{job.jobType || '-'}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{job.jobMode || '-'}</div>
          </div>

          {/* Column 5: Created By & On */}
          <div style={{ borderRight: '1px solid #e2e8f0', padding: '0 16px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>Created By & On</div>
            <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>{job.createdBy}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>On {formatDate(job.createdOn)}</div>
          </div>

          {/* Column 6: Business Unit */}
          <div style={{ paddingLeft: '16px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>Business Unit</div>
            <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>{job.businessUnit || 'Broccoli and Carrots Global Services'}</div>
          </div>
        </div>



        <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '24px 0' }} />

        {/* Job Description Box */}
        <div style={{ paddingLeft: '44px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>Job Description</h3>
          <div style={{
            fontSize: '14px', color: '#475569', lineHeight: '1.7',
            whiteSpace: 'pre-wrap', background: '#f8fafc', padding: '16px', borderRadius: '12px',
            maxHeight: isDescExpanded ? 'none' : '100px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {job.jobDescription || 'No description provided.'}
            {!isDescExpanded && (job.jobDescription?.length > 200) && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px', background: 'linear-gradient(transparent, #f8fafc)' }} />
            )}
          </div>
          {(job.jobDescription?.length > 200) && (
            <button
              onClick={() => setIsDescExpanded(!isDescExpanded)}
              style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginTop: '8px', padding: 0 }}
            >
              {isDescExpanded ? 'View Less' : 'View More'}
            </button>
          )}
        </div>
      </div>

      {/* ── Submissions Section with Pipeline Stepper ── */}
      {matchingEnabled && job._uuid && <>
        <div role="tablist" aria-label="Candidates" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {['tagged', 'recommended'].map(tab => <button key={tab} role="tab" aria-selected={candidateTab === tab}
            onClick={() => setCandidateTab(tab)} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #cbd5e1',
              background: candidateTab === tab ? '#2563eb' : '#fff', color: candidateTab === tab ? '#fff' : '#334155', cursor: 'pointer' }}>
            {tab === 'tagged' ? `Tagged candidates (${shortlistedForJob.length})` : 'Recommended candidates'}
          </button>)}
        </div>
        {candidateTab === 'recommended' && <CandidateRecommendations key={job._uuid} job={job} onTagged={reloadTagged} />}
      </>}
      {(!matchingEnabled || !job._uuid || candidateTab === 'tagged') && <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Submissions</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleExport}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 18px', borderRadius: '8px', border: '1px solid #cbd5e1',
                background: '#fff', color: '#334155', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <FiDownload size={14} /> Export Snapshot
            </button>
            <button
              onClick={() => navigate(`/admin/client-jobs/${jobCode}/email`)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 18px', borderRadius: '8px', border: 'none',
                background: '#3b82f6', color: '#fff', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
              onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
            >
              📧 Email Automation
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', boxSizing: 'border-box', fontSize: '13px' }}
            />
          </div>
          {[
            { label: 'Tagged', count: shortlistedForJob.filter(c => c.currentStage === 'Pipeline').length },
            { label: 'All', count: shortlistedForJob.length },
            { label: 'Manager Submit', count: shortlistedForJob.filter(c => c.currentStage === 'Manager Submit').length },
            { label: 'Client Submission', count: shortlistedForJob.filter(c => c.currentStage === 'Client Submission').length },
            { label: 'Feedback', count: shortlistedForJob.filter(c => c.currentStage === 'Feedback').length },
          ].map((filter) => {
            const isActive = activeFilter === filter.label;
            return (
              <div
                key={filter.label}
                onClick={() => setActiveFilter(filter.label)}
                style={{
                  padding: '7px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                  background: isActive ? '#3b82f6' : '#f1f5f9',
                  color: isActive ? '#fff' : '#64748b', cursor: 'pointer',
                  border: isActive ? 'none' : '1px solid #e2e8f0',
                  transition: 'all 0.2s'
                }}>
                {filter.label} {filter.count}
              </div>
            );
          })}
        </div>

        {/* Table Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 1.2fr 1.2fr 100px',
          padding: '12px 32px', background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: '8px 8px 0 0', gap: '24px'
        }}>
          {['NAME', 'TAGGED BY/ON', 'CONTACT/LOCATION', 'STATUS'].map(h => (
            <div key={h} style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px' }}>{h}</div>
          ))}
          <div />
        </div>

        {/* Candidate Cards with Pipeline */}
        {(() => {
          const filteredSubmissions = shortlistedForJob.filter(c => {
            const searchMatch = !searchTerm.trim() ||
              c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              c.contactNumber?.includes(searchTerm);

            let tabMatch = true;
            if (activeFilter !== 'All') {
              const stageFilter = activeFilter === 'Tagged' ? 'Pipeline' : activeFilter;
              tabMatch = c.currentStage === stageFilter;
            }

            return searchMatch && tabMatch;
          });

          if (filteredSubmissions.length === 0) {
            return (
              <div style={{ padding: '50px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', borderBottom: '1px solid #e2e8f0' }}>
                {searchTerm || activeFilter !== 'All' ? 'No candidates match your search or filter.' : 'No submissions yet. Navigate to the Applicant Database to shortlist candidates for this job.'}
              </div>
            );
          }

          return filteredSubmissions.map((c, idx) => {
            // Determine current pipeline step (1=Pipeline done, 2=Manager Submit done, etc.)
            const STAGE_ORDER = { 'Pipeline': 1, 'Manager Submit': 2, 'Client Submission': 3, 'Feedback': 4 };
            const pipelineStep = STAGE_ORDER[c.currentStage] || 1;

            // Stepper config matching the grid columns exactly
            const STEPS = [
              { label: 'Tagged', col: 1, date: c.date || c.createdOn },
              { label: 'Manager Submit', col: 2, date: c.managerSubmittedAt },
              { label: 'Client Submission', col: 3, date: c.clientSubmittedAt },
              { label: 'Feedback', col: 4, date: c.feedbackReceivedAt }
            ];

            return (
              <div key={idx} style={{ borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                {/* ── Data Row ── */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 1.2fr 1.2fr 100px',
                  padding: '12px 32px', alignItems: 'center', gap: '24px'
                }}>
                  {/* Name */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <div style={{ color: '#3b82f6', marginTop: '3px' }}>
                      <FiFileText size={16} />
                    </div>
                    <div>
                      <a
                        onClick={() => navigate(`/admin/applicants/${c.applicantId}`)}
                        style={{ color: '#2563eb', fontWeight: 700, fontSize: '13px', cursor: 'pointer', textDecoration: 'none' }}
                      >
                        {c.name}
                      </a>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>#{c.applicantId}</div>
                    </div>
                  </div>

                  {/* Submitted By / On */}
                  <div>
                    <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>{c.uploadedBy || 'N/A'}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{formatDate(c.shortlistedOn || c.createdOn)}</div>
                  </div>

                  {/* Contact / Location */}
                  <div>
                    <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>{c.contactNumber || 'N/A'}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{c.currentLocation || 'N/A'}</div>
                  </div>

                  {/* Status */}
                  <div>
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); navigate(`/admin/applicants/${c.applicantId}`); }}
                      style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                    >
                      Waiting for Evaluation ↗
                    </a>
                  </div>

                  {/* Empty div to maintain grid space for future buttons */}
                  <div />
                </div>

                {/* ── Pipeline Stepper ── */}
                <div style={{ padding: '0 32px 16px 32px' }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 1.2fr 1.2fr 100px',
                    alignItems: 'flex-start', gap: '24px'
                  }}>
                    {STEPS.map((step, si) => {
                      const isDone = si < pipelineStep;
                      // The line should be green if the *next* step is also done
                      const isLineGreen = si < pipelineStep - 1;
                      const hasNext = si < STEPS.length - 1;

                      const centerOffset = '36px'; // The anchor point for the center of the step's dot

                      return (
                        <div key={step.label} style={{ gridColumn: step.col, position: 'relative', height: '60px' }}>

                          {/* Starting line BEFORE Pipeline */}
                          {si === 0 && (
                            <div style={{
                              position: 'absolute', top: '8px', left: '0px',
                              width: centerOffset, height: '4px', // starts at 0 (not touching container edge), ends at centerOffset
                              background: isDone ? '#22c55e' : '#e2e8f0', zIndex: 0
                            }} />
                          )}

                          {/* Connector line stretching right to the center of the next cell */}
                          {hasNext && (
                            <div style={{
                              position: 'absolute', top: '8px', left: centerOffset,
                              width: 'calc(100% + 24px)', height: '4px',
                              background: isLineGreen ? '#22c55e' : '#e2e8f0', zIndex: 0
                            }} />
                          )}

                          {/* Ending line AFTER Feedback */}
                          {!hasNext && (
                            <div style={{
                              position: 'absolute', top: '8px', left: centerOffset,
                              width: '40px', height: '4px', // tiny stub on the right
                              background: '#e2e8f0', zIndex: 0
                            }} />
                          )}

                          {/* Centered Content Block (Circle + Text) */}
                          <div style={{
                            position: 'absolute', left: centerOffset, top: '0',
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            width: '80px', transform: 'translateX(-50%)'
                          }}>
                            {/* Circle */}
                            <div style={{
                              width: '20px', height: '20px', borderRadius: '50%', zIndex: 1,
                              background: isDone ? '#22c55e' : '#fff',
                              border: isDone ? '2px solid #22c55e' : '2px solid #cbd5e1',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '11px', color: isDone ? '#fff' : '#cbd5e1', fontWeight: 800
                            }}>
                              {isDone ? '✓' : ''}
                            </div>

                            {/* Label */}
                            <div style={{ fontSize: '10px', color: isDone ? '#1e293b' : '#94a3b8', fontWeight: 600, marginTop: '8px', textAlign: 'center', lineHeight: '1.3' }}>
                              {step.label}
                            </div>

                            {/* Date */}
                            <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px', textAlign: 'center' }}>
                              {isDone && step.date ? formatDate(step.date) : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        })()}

        {/* Bottom pagination hint */}
        <div style={{ padding: '14px 16px', fontSize: '12px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Showing 1 to {shortlistedForJob.length} of {shortlistedForJob.length} entries</span>
        </div>
      </div>}

    </div>
  );
}
