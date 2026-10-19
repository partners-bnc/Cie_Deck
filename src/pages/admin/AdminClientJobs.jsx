import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { jobService } from '../../services/jobService.js';
import {
  FiBriefcase,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiEdit2,
  FiEye,
  FiList,
  FiPlusSquare,
  FiRefreshCw,
  FiSearch
} from 'react-icons/fi';

const PAGE_SIZE = 20;

export default function AdminClientJobs() {
  const navigate = useNavigate();
  const location = useLocation();

  const initialForm = {
    jobCode: 'JPC-',
    jobTitle: '',
    jobType: 'Full Time',
    jobMode: 'Onsite',
    businessUnit: '',
    clientId: '',
    clientName: '',
    location: '',
    state: '',
    country: 'India',
    payRate: '',
    experience: '',
    education: "Bachelor's Degree / Any Graduate",
    vacancy: '1',
    autoPublishToPortal: true,
    portalJobId: null,
    jobDescription: '',
    recruitmentManager: '',
    status: 'Active',
    priority: 'Medium',
    assignedTo: [],
    reportingClientName: '',
    reportingClientEmail: '',
    reportingClientContact: ''
  };

  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [hrs, setHrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [activeTab, setActiveTab] = useState('view');
  const [editingJob, setEditingJob] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchJobs = async (nextPage = page, nextSearch = searchTerm, nextStatus = statusFilter) => {
    setLoading(true);
    setError('');
    try {
      const result = await jobService.fetchClientJobsPage({
        page: nextPage,
        pageSize: PAGE_SIZE,
        search: nextSearch,
        status: nextStatus
      });
      setJobs(result.data || []);
      setTotalCount(result.total || 0);
    } catch (err) {
      setError('Failed to load jobs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeTab === 'view') {
        fetchJobs(page, searchTerm, statusFilter);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [activeTab, page, searchTerm, statusFilter]);

  const ensureFormDependencies = async () => {
    const [clientsData, hrsData] = await Promise.all([
      clients.length ? Promise.resolve(clients) : jobService.fetchClients(),
      hrs.length ? Promise.resolve(hrs) : jobService.fetchHRs()
    ]);
    setClients(clientsData || []);
    setHrs(hrsData || []);
    return { clientsData: clientsData || [], hrsData: hrsData || [] };
  };

  const applyJobToForm = (job) => {
    const assignedArr = job.assignedTo
      ? job.assignedTo.split(',').map((item) => item.trim()).filter(Boolean)
      : [];

    setEditingJob(job);
    setFormData({
      jobCode: job.jobCode || '',
      jobTitle: job.jobTitle || '',
      jobType: job.jobType || 'Full Time',
      jobMode: job.jobMode || 'Onsite',
      businessUnit: job.businessUnit || '',
      clientId: job.clientId || '',
      clientName: job.clientName || '',
      location: job.location || '',
      state: job.state || '',
      country: job.country || 'India',
      payRate: job.payRate || '',
      experience: job.experience || '',
      education: job.education || "Bachelor's Degree / Any Graduate",
      vacancy: job.vacancy || '1',
      autoPublishToPortal: true,
      portalJobId: job.portalJobId || null,
      jobDescription: job.jobDescription || '',
      recruitmentManager: job.recruitmentManager || '',
      status: job.status || 'Active',
      priority: job.priority || 'Medium',
      assignedTo: assignedArr,
      reportingClientName: job.reportingClientName || '',
      reportingClientEmail: job.reportingClientEmail || '',
      reportingClientContact: job.reportingClientContact || ''
    });
    setActiveTab('form');
  };

  const openEditJob = async (jobCode) => {
    setFormLoading(true);
    setError('');
    try {
      const [job] = await Promise.all([
        jobService.fetchClientJobByCode(jobCode),
        ensureFormDependencies()
      ]);

      if (!job) {
        setError('Job details could not be loaded.');
        return;
      }

      applyJobToForm(job);
    } catch (err) {
      setError('Job details could not be loaded.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleAddClick = async () => {
    setFormLoading(true);
    setError('');
    try {
      await ensureFormDependencies();
      const nextJobCode = await jobService.fetchNextClientJobCode();
      setEditingJob(null);
      setFormData({
        ...initialForm,
        jobCode: nextJobCode
      });
      setActiveTab('form');
    } catch (err) {
      setError('Unable to prepare the job form.');
    } finally {
      setFormLoading(false);
    }
  };

  useEffect(() => {
    if (location.state?.editJobCode) {
      openEditJob(location.state.editJobCode);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'clientSelection') {
      const selectedClient = clients.find((client) => client.clientId === value);
      if (selectedClient) {
        setFormData((prev) => ({
          ...prev,
          clientId: selectedClient.clientId,
          clientName: selectedClient.clientName,
          reportingClientName: '',
          reportingClientEmail: '',
          reportingClientContact: ''
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          clientId: '',
          clientName: '',
          reportingClientName: '',
          reportingClientEmail: '',
          reportingClientContact: ''
        }));
      }
      return;
    }

    if (name === 'reportingClientSelection') {
      const selectedClient = clients.find((client) => client.clientId === formData.clientId);
      const selectedContact = selectedClient?.reportingContacts?.find((contact) => contact.name === value);
      setFormData((prev) => ({
        ...prev,
        reportingClientName: selectedContact?.name || '',
        reportingClientEmail: selectedContact?.email || '',
        reportingClientContact: selectedContact?.contact || ''
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleAssignedHR = (hrName) => {
    setFormData((prev) => {
      const current = prev.assignedTo || [];
      return current.includes(hrName)
        ? { ...prev, assignedTo: current.filter((item) => item !== hrName) }
        : { ...prev, assignedTo: [...current, hrName] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.jobCode || formData.jobCode === 'JPC-') {
      setError("Job Code is required and cannot be just 'JPC-'");
      return;
    }

    if (!editingJob) {
      const existingJob = await jobService.fetchClientJobByCode(formData.jobCode);
      if (existingJob) {
        setError(`Job Code "${formData.jobCode}" already exists. Please use a unique code.`);
        return;
      }
    }

    if (!formData.clientId) {
      setError('Please select a client.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const payload = {
        ...formData,
        assignedTo: Array.isArray(formData.assignedTo) ? formData.assignedTo.join(', ') : formData.assignedTo,
        createdBy: sessionStorage.getItem('bnc_admin_name') || sessionStorage.getItem('bnc_admin_id') || 'Admin',
        modifiedBy: sessionStorage.getItem('bnc_admin_name') || sessionStorage.getItem('bnc_admin_id') || 'Admin'
      };

      const result = editingJob
        ? await jobService.updateClientJob(payload)
        : await jobService.addClientJob(payload);

      if (result?.success) {
        setFormData(initialForm);
        setEditingJob(null);
        setActiveTab('view');
        fetchJobs(1, searchTerm);
        if (result.message) {
          setSuccessMsg(result.message);
          setTimeout(() => setSuccessMsg(''), 7000);
        }
      } else {
        setError(result?.error || 'Failed to save job');
      }
    } catch (err) {
      setError('An error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div style={{ padding: '28px 30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #0f766e, #042f2e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
          }}>
            <FiBriefcase size={20} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#1e293b' }}>Client JPC</h1>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#94a3b8' }}>
              {activeTab === 'view' ? `${totalCount} total jobs` : 'Manage JPC details'}
            </p>
          </div>
        </div>

        <button onClick={() => fetchJobs(page, searchTerm)} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 18px', border: '1px solid #e2e8f0', borderRadius: '12px',
          background: '#fff', color: '#475569', cursor: 'pointer', fontSize: '14px', fontWeight: 700,
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <FiRefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px',
        marginBottom: '28px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start', flexShrink: 0 }}>
          <div style={{
            background: '#f1f5f9',
            padding: '6px',
            borderRadius: '16px',
            display: 'flex',
            gap: '4px',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
          }}>
            <button
              onClick={() => setActiveTab('view')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 24px', borderRadius: '10px', border: 'none',
                background: activeTab === 'view' ? '#0f766e' : 'transparent',
                color: activeTab === 'view' ? '#fff' : '#64748b',
                cursor: 'pointer', fontSize: '14px', fontWeight: 800
              }}
            >
              <FiList size={18} /> View Jobs
            </button>
            <button
              onClick={handleAddClick}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 24px', borderRadius: '10px', border: 'none',
                background: activeTab === 'form' ? '#0f766e' : 'transparent',
                color: activeTab === 'form' ? '#fff' : '#64748b',
                cursor: 'pointer', fontSize: '14px', fontWeight: 800
              }}
            >
              <FiPlusSquare size={18} /> {editingJob ? 'Edit Job' : 'Post Job'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '660px', justifyContent: 'flex-end' }}>
          {activeTab === 'view' ? (
            <>
              <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                <FiSearch style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                <input
                  type="text"
                  placeholder="Search by Job Code, Title, Client, Location..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    width: '100%',
                    height: '46px',
                    padding: '0 16px 0 48px',
                    borderRadius: '16px',
                    border: '2px solid #e2e8f0',
                    fontSize: '14px',
                    background: '#fff',
                    outline: 'none',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    boxSizing: 'border-box',
                    lineHeight: '46px'
                  }}
                />
              </div>

              {/* Status Filter strictly matching search bar design & height */}
              <div style={{ position: 'relative', width: '160px', flexShrink: 0 }}>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by job status"
                  style={{
                    width: '100%',
                    height: '46px',
                    padding: '0 36px 0 16px',
                    borderRadius: '16px',
                    border: '2px solid #e2e8f0',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#334155',
                    background: '#fff',
                    outline: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    boxSizing: 'border-box',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none'
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Closed">Closed</option>
                  <option value="On Hold">On Hold</option>
                </select>
                <FiChevronDown
                  size={16}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748b',
                    pointerEvents: 'none'
                  }}
                />
              </div>
            </>
          ) : <div />}
        </div>
      </div>

      {successMsg && (
        <div style={{ padding: '12px 18px', background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '12px', color: '#047857', fontSize: '13.5px', fontWeight: 700, marginBottom: '20px', maxWidth: '800px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>✅</span>
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#dc2626', fontSize: '13px', marginBottom: '20px', maxWidth: '800px' }}>
          {error}
        </div>
      )}

      {activeTab === 'view' && (
        <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1400px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#475569' }}>Actions</th>
                  {['Job Code', 'Job Title', 'Job Type', 'Job Mode', 'Client', 'Location', 'Experience', 'Pay Rate', 'Manager', 'Status', 'Created On'].map((header) => (
                    <th key={header} style={{
                      padding: '16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#475569',
                      whiteSpace: 'nowrap',
                      minWidth: header === 'Job Code' ? '120px' : undefined
                    }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} style={{ padding: '80px', textAlign: 'center', color: '#94a3b8' }}>
                      <FiRefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '16px', display: 'block', margin: '0 auto 16px' }} />
                      <span style={{ fontSize: '15px', fontWeight: 600 }}>Syncing client JPC...</span>
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ padding: '80px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                      {searchTerm || statusFilter !== 'all' ? 'No matches found.' : 'No job postings found. Switch to "Post Job" to create one.'}
                    </td>
                  </tr>
                ) : jobs.map((job, index) => (
                  <tr key={job.jobCode || index} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => navigate(`/admin/client-jobs/${job.jobCode}`)}>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button onClick={(e) => { e.stopPropagation(); openEditJob(job.jobCode); }} style={{
                          background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', padding: '4px 10px',
                          borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                          fontSize: '11px', fontWeight: 600
                        }} title="Edit Job">
                          <FiEdit2 size={12} /> Edit
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#0f766e', fontWeight: 800, whiteSpace: 'nowrap', minWidth: '120px' }}>
                      <span style={{ whiteSpace: 'nowrap', display: 'inline-block' }}>{job.jobCode}</span>
                      {job.portalJobId && (
                        <div style={{ marginTop: '3px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '10px', background: '#ecfdf5', color: '#047857', padding: '1.5px 6px', borderRadius: '4px', border: '1px solid #a7f3d0', fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block' }}>
                            Portal #{job.portalJobId}
                          </span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>{job.jobTitle}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{job.jobType || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{job.jobMode || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569', fontWeight: 600 }}>{job.clientName}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>
                      {job.location}{job.state ? `, ${job.state}` : ''}{job.country ? `, ${job.country}` : ''}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{job.experience || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{job.payRate || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{job.recruitmentManager || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '6px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 800,
                        background: job.status?.toLowerCase() === 'active' ? '#ecfdf5' : '#fff1f2',
                        color: job.status?.toLowerCase() === 'active' ? '#059669' : '#e11d48',
                        border: `1px solid ${job.status?.toLowerCase() === 'active' ? '#a7f3d0' : '#fecdd3'}`
                      }}>{job.status?.toUpperCase() || 'ACTIVE'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>{formatDate(job.createdOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && !loading && (
            <div style={{
              padding: '14px 18px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} style={{
                  width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff',
                  cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#cbd5e1' : '#475569',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}><FiChevronLeft size={14} /></button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, offset) => {
                  const start = Math.max(1, Math.min(totalPages - 4, page - 2));
                  const pageNumber = start + offset;
                  return (
                    <button key={pageNumber} onClick={() => setPage(pageNumber)} style={{
                      width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                      background: page === pageNumber ? '#0f766e' : '#f8fafc',
                      color: page === pageNumber ? '#fff' : '#475569',
                      fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>{pageNumber}</button>
                  );
                })}
                <button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages} style={{
                  width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? '#cbd5e1' : '#475569',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}><FiChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'form' && (
        <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.04)', padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
          {formLoading ? (
            <div style={{ padding: '80px', textAlign: 'center', color: '#94a3b8' }}>
              <FiRefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
              <div style={{ fontSize: '15px', fontWeight: 600 }}>Loading JPC details...</div>
            </div>
          ) : (
            <>
              <div style={{ borderBottom: '1px solid #f1f5f9', marginBottom: '32px', paddingBottom: '16px' }}>
                <h2 style={{ margin: '0', fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                  {editingJob ? `Update JPC: ${formData.jobCode}` : 'Post New Client JPC'}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748b' }}>
                  Fill out the required information.
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>Job Code *</label>
                  <input required name="jobCode" value={formData.jobCode} onChange={handleChange} disabled={!!editingJob} placeholder="e.g. JPC-113" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', background: editingJob ? '#f8fafc' : '#fff', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>Job Title *</label>
                  <input required name="jobTitle" value={formData.jobTitle} onChange={handleChange} placeholder="e.g. Senior Software Engineer" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>Job Type *</label>
                  <select name="jobType" value={formData.jobType} onChange={handleChange} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', background: '#fff', outline: 'none' }}>
                    <option value="Full Time">Full Time</option>
                    <option value="Part Time">Part Time</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>Job Mode *</label>
                  <select name="jobMode" value={formData.jobMode} onChange={handleChange} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', background: '#fff', outline: 'none' }}>
                    <option value="Onsite">Onsite</option>
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>Client Database Reference *</label>
                  <select name="clientSelection" value={formData.clientId} onChange={handleChange} required style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', background: '#fff', outline: 'none' }}>
                    <option value="">-- Select an onboarded Client --</option>
                    {clients.map((client) => (
                      <option key={client.clientId} value={client.clientId}>{client.clientName} ({client.clientId})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>Reporting Client</label>
                  <select name="reportingClientSelection" value={formData.reportingClientName} onChange={handleChange} disabled={!formData.clientId} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', background: formData.clientId ? '#fff' : '#f8fafc', outline: 'none' }}>
                    <option value="">-- Select Reporting Contact --</option>
                    {clients.find((client) => client.clientId === formData.clientId)?.reportingContacts?.map((contact, index) => (
                      <option key={index} value={contact.name}>{contact.name}</option>
                    ))}
                  </select>
                </div>

                {formData.reportingClientName && (
                  <div style={{ gridColumn: 'span 2', display: 'flex', gap: '16px', background: '#eff6ff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                    <div style={{ flex: 1, fontSize: '13px', color: '#1e3a8a' }}><strong>Email:</strong> {formData.reportingClientEmail}</div>
                    <div style={{ flex: 1, fontSize: '13px', color: '#1e3a8a' }}><strong>Phone:</strong> {formData.reportingClientContact}</div>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>Business Unit</label>
                  <input type="text" name="businessUnit" value={formData.businessUnit} onChange={handleChange} placeholder="Enter business branch..." style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>City Location</label>
                  <input name="location" value={formData.location} onChange={handleChange} placeholder="e.g. Gurgaon" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>State</label>
                    <input name="state" value={formData.state} onChange={handleChange} placeholder="e.g. Haryana" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>Country</label>
                    <input name="country" value={formData.country} onChange={handleChange} placeholder="India" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>Pay Rate / Salary</label>
                  <input name="payRate" value={formData.payRate} onChange={handleChange} placeholder="e.g. Rs 1000000-1200000" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>Years of Experience</label>
                  <input name="experience" value={formData.experience} onChange={handleChange} placeholder="e.g. 3-5 Years" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>Recruitment Manager</label>
                  <select name="recruitmentManager" value={formData.recruitmentManager} onChange={handleChange} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', background: '#fff', outline: 'none' }}>
                    <option value="">-- Select Manager --</option>
                    {hrs.map((hr, index) => (
                      <option key={index} value={hr.hrName}>{hr.hrName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>Status</label>
                  <select name="status" value={formData.status} onChange={handleChange} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', background: '#fff', outline: 'none' }}>
                    <option value="Active">Active</option>
                    <option value="Closed">Closed</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>Assigned To (HR)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: formData.assignedTo?.length ? '10px' : '0' }}>
                    {(formData.assignedTo || []).map((hrName, index) => (
                      <span key={index} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0',
                        padding: '5px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 700
                      }}>
                        {hrName}
                        <span onClick={() => toggleAssignedHR(hrName)} style={{ cursor: 'pointer', fontWeight: 800, fontSize: '15px', color: '#dc2626', lineHeight: 1 }}>x</span>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#f8fafc', boxSizing: 'border-box' }}>
                    {hrs.length === 0 ? (
                      <span style={{ fontSize: '13px', color: '#94a3b8' }}>No HRs available.</span>
                    ) : hrs.map((hr, index) => {
                      const isSelected = (formData.assignedTo || []).includes(hr.hrName);
                      return (
                        <button
                          type="button"
                          key={index}
                          onClick={() => toggleAssignedHR(hr.hrName)}
                          style={{
                            padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                            border: isSelected ? '1.5px solid #059669' : '1.5px solid #cbd5e1',
                            background: isSelected ? '#ecfdf5' : '#fff',
                            color: isSelected ? '#059669' : '#475569',
                            cursor: 'pointer'
                          }}
                        >
                          {isSelected ? 'Selected ' : ''}{hr.hrName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>Priority</label>
                  <select name="priority" value={formData.priority} onChange={handleChange} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', background: '#fff', outline: 'none' }}>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div style={{
                  gridColumn: 'span 2',
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                  border: '1.5px solid #a7f3d0',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0 }}>
                      <input
                        type="checkbox"
                        name="autoPublishToPortal"
                        checked={formData.autoPublishToPortal}
                        onChange={(e) => setFormData(prev => ({ ...prev, autoPublishToPortal: e.target.checked }))}
                        style={{ width: '18px', height: '18px', accentColor: '#0f766e', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#065f46' }}>
                        Automatically publish to Portal Job Listing
                      </span>
                    </label>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#047857', background: '#d1fae5', padding: '3px 10px', borderRadius: '20px' }}>
                      🚀 Auto-Post to Careers Portal
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#047857', lineHeight: 1.4 }}>
                    When checked, saving this JPC will automatically create a matching live job post in the Portal Job Listings with role, location, salary, experience, and JD.
                  </p>

                  {formData.autoPublishToPortal && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '6px', paddingTop: '12px', borderTop: '1px dashed #a7f3d0' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#065f46', marginBottom: '6px' }}>
                          Education Qualification (for Portal Post)
                        </label>
                        <input
                          name="education"
                          value={formData.education}
                          onChange={handleChange}
                          placeholder="e.g. B.Tech, MBA or Any Graduate"
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #6ee7b7', fontSize: '13px', boxSizing: 'border-box', background: '#ffffff', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#065f46', marginBottom: '6px' }}>
                          No. of Vacancies (for Portal Post)
                        </label>
                        <input
                          name="vacancy"
                          value={formData.vacancy}
                          onChange={handleChange}
                          placeholder="e.g. 1"
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #6ee7b7', fontSize: '13px', boxSizing: 'border-box', background: '#ffffff', outline: 'none' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>Job Description Detailed</label>
                  <textarea name="jobDescription" value={formData.jobDescription} onChange={handleChange} rows={6} placeholder="We're Hiring | Role Description..." style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', outline: 'none', resize: 'vertical' }} />
                </div>

                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '16px', marginTop: '16px', background: '#f8fafc', padding: '24px', borderRadius: '16px' }}>
                  <button type="button" onClick={() => setActiveTab('view')} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                  <button type="submit" disabled={isSubmitting} style={{ flex: 1.5, padding: '14px', borderRadius: '12px', border: 'none', background: '#0f766e', color: '#fff', fontWeight: 800, cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '14px', boxShadow: '0 4px 12px rgba(15, 118, 110, 0.2)' }}>
                    {isSubmitting ? 'Saving JPC...' : (editingJob ? 'Update Client JPC' : 'Post JPC')}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
