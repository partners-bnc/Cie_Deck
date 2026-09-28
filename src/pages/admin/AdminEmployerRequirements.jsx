import { useEffect, useState } from 'react';
import { jobService } from '../../services/jobService.js';
import {
  FiBriefcase,
  FiEye,
  FiMail,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiX,
  FiCheckCircle,
  FiClock,
  FiUser,
  FiLayers
} from 'react-icons/fi';

const STATUS_COLORS = {
  New: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  Contacted: { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
  'In Discussion': { bg: '#E0E7FF', text: '#3730A3', border: '#C7D2FE' },
  Closed: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' }
};

export default function AdminEmployerRequirements() {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedItem, setSelectedItem] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(null);

  const fetchRequirements = async () => {
    setLoading(true);
    try {
      const data = await jobService.fetchEmployerRequirements();
      setRequirements(data || []);
    } catch (err) {
      console.error('Failed to load employer requirements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirements();
  }, []);

  const handleStatusChange = async (id, newStatus) => {
    setStatusUpdating(id);
    try {
      await jobService.updateEmployerRequirementStatus(id, newStatus);
      setRequirements(prev =>
        prev.map(item => (item.id === id ? { ...item, status: newStatus } : item))
      );
      if (selectedItem && selectedItem.id === id) {
        setSelectedItem(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this requirement submission?')) return;
    try {
      await jobService.deleteEmployerRequirement(id);
      setRequirements(prev => prev.filter(item => item.id !== id));
      if (selectedItem && selectedItem.id === id) {
        setSelectedItem(null);
      }
    } catch (err) {
      console.error('Failed to delete requirement:', err);
    }
  };

  const filteredRequirements = requirements.filter(item => {
    const matchesStatus = statusFilter === 'All' || (item.status || 'New') === statusFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      (item.company_name || '').toLowerCase().includes(term) ||
      (item.contact_person || '').toLowerCase().includes(term) ||
      (item.email || '').toLowerCase().includes(term) ||
      (item.phone || '').toLowerCase().includes(term) ||
      (item.requirement || '').toLowerCase().includes(term) ||
      (item.details || '').toLowerCase().includes(term);

    return matchesStatus && matchesSearch;
  });

  const counts = {
    total: requirements.length,
    new: requirements.filter(r => (r.status || 'New') === 'New').length,
    contacted: requirements.filter(r => r.status === 'Contacted').length,
    inDiscussion: requirements.filter(r => r.status === 'In Discussion').length,
    closed: requirements.filter(r => r.status === 'Closed').length
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Recent';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div style={{ padding: '28px 32px', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
            Employer Requirements
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Submissions received from the "For Employers" page form.
          </p>
        </div>
        <button
          onClick={fetchRequirements}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '12px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#334155',
            fontSize: '13px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.2s'
          }}
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats Badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div style={{ background: '#ffffff', borderRadius: '14px', padding: '14px 18px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Total Submissions</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a' }}>{counts.total}</div>
        </div>
        <div style={{ background: '#FEF3C7', borderRadius: '14px', padding: '14px 18px', border: '1px solid #FDE68A' }}>
          <div style={{ fontSize: '12px', color: '#92400E', fontWeight: 600, marginBottom: '4px' }}>New</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#92400E' }}>{counts.new}</div>
        </div>
        <div style={{ background: '#DBEAFE', borderRadius: '14px', padding: '14px 18px', border: '1px solid #BFDBFE' }}>
          <div style={{ fontSize: '12px', color: '#1E40AF', fontWeight: 600, marginBottom: '4px' }}>Contacted</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#1E40AF' }}>{counts.contacted}</div>
        </div>
        <div style={{ background: '#E0E7FF', borderRadius: '14px', padding: '14px 18px', border: '1px solid #C7D2FE' }}>
          <div style={{ fontSize: '12px', color: '#3730A3', fontWeight: 600, marginBottom: '4px' }}>In Discussion</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#3730A3' }}>{counts.inDiscussion}</div>
        </div>
        <div style={{ background: '#D1FAE5', borderRadius: '14px', padding: '14px 18px', border: '1px solid #A7F3D0' }}>
          <div style={{ fontSize: '12px', color: '#065F46', fontWeight: 600, marginBottom: '4px' }}>Closed</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#065F46' }}>{counts.closed}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ background: '#ffffff', borderRadius: '16px', padding: '14px 20px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', width: '340px', maxWidth: '100%' }}>
          <FiSearch style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search company, contact, email, requirement..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              borderRadius: '10px',
              border: '1.5px solid #e2e8f0',
              fontSize: '13px',
              outline: 'none',
              fontFamily: 'inherit',
              background: '#f8fafc',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '9px 14px',
              borderRadius: '10px',
              border: '1.5px solid #e2e8f0',
              fontSize: '13px',
              outline: 'none',
              background: '#ffffff',
              color: '#334155',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <option value="All">All Statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="In Discussion">In Discussion</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Table Card */}
      <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 16px rgba(15,23,42,0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 700, whiteSpace: 'nowrap' }}>Date</th>
                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 700, whiteSpace: 'nowrap' }}>Company</th>
                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 700, whiteSpace: 'nowrap' }}>Contact Person</th>
                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 700, minWidth: '170px' }}>Role / Requirement</th>
                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 700, minWidth: '220px' }}>Additional Details</th>
                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'center' }}>Positions</th>
                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 700, whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    Loading employer requirements...
                  </td>
                </tr>
              ) : filteredRequirements.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    No requirements found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredRequirements.map((item) => {
                  const currentStatus = item.status || 'New';
                  const badge = STATUS_COLORS[currentStatus] || STATUS_COLORS.New;

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '14px 18px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {formatDate(item.created_at)}
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {item.company_name}
                      </td>
                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#334155' }}>{item.contact_person}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <a href={`mailto:${item.email}`} style={{ color: '#0B2F5B', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <FiMail size={11} /> {item.email}
                          </a>
                          <a href={`tel:${item.phone}`} style={{ color: '#0B2F5B', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <FiPhone size={11} /> {item.phone}
                          </a>
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px', color: '#0f172a', fontWeight: 600, minWidth: '170px' }}>
                        {item.requirement}
                      </td>
                      <td style={{ padding: '14px 18px', color: '#475569', minWidth: '220px', maxWidth: '320px', lineHeight: 1.5 }}>
                        {item.details ? (
                          <div style={{ wordBreak: 'break-word' }}>{item.details}</div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>None</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', color: '#334155', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {item.positions || '1'}
                      </td>
                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        <select
                          value={currentStatus}
                          disabled={statusUpdating === item.id}
                          onChange={(e) => handleStatusChange(item.id, e.target.value)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`,
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="New">New</option>
                          <option value="Contacted">Contacted</option>
                          <option value="In Discussion">In Discussion</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => setSelectedItem(item)}
                            title="View Details"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#0B2F5B',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              fontWeight: 600
                            }}
                          >
                            <FiEye size={13} /> View
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            title="Delete"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '8px',
                              border: '1px solid #fee2e2',
                              background: '#fef2f2',
                              color: '#dc2626',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              fontSize: '12px'
                            }}
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedItem && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '640px',
            maxHeight: '90vh', overflowY: 'auto', padding: '32px', position: 'relative',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <button
              onClick={() => setSelectedItem(null)}
              style={{
                position: 'absolute', right: '20px', top: '20px',
                background: '#f1f5f9', border: 'none', borderRadius: '50%',
                width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: '#64748b'
              }}
            >
              <FiX size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{
                padding: '4px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                background: (STATUS_COLORS[selectedItem.status || 'New'] || STATUS_COLORS.New).bg,
                color: (STATUS_COLORS[selectedItem.status || 'New'] || STATUS_COLORS.New).text,
                border: `1px solid ${(STATUS_COLORS[selectedItem.status || 'New'] || STATUS_COLORS.New).border}`
              }}>
                {selectedItem.status || 'New'}
              </span>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Submitted on {formatDate(selectedItem.created_at)}
              </span>
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 20px' }}>
              {selectedItem.company_name}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Contact Person</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{selectedItem.contact_person}</div>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Positions Needed</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{selectedItem.positions || '1'}</div>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Email Address</div>
                <a href={`mailto:${selectedItem.email}`} style={{ fontSize: '13px', fontWeight: 700, color: '#0B2F5B', textDecoration: 'none' }}>
                  {selectedItem.email}
                </a>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Phone Number</div>
                <a href={`tel:${selectedItem.phone}`} style={{ fontSize: '13px', fontWeight: 700, color: '#0B2F5B', textDecoration: 'none' }}>
                  {selectedItem.phone}
                </a>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Role / Requirement</div>
              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px', border: '1px solid #e2e8f0', fontSize: '14px', color: '#0f172a', fontWeight: 600 }}>
                {selectedItem.requirement}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Additional Details</div>
              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {selectedItem.details || 'No additional details provided.'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Update Status:</span>
                <select
                  value={selectedItem.status || 'New'}
                  onChange={(e) => handleStatusChange(selectedItem.id, e.target.value)}
                  style={{
                    padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1',
                    fontSize: '13px', fontWeight: 600, background: '#ffffff', color: '#0f172a'
                  }}
                >
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="In Discussion">In Discussion</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <a
                  href={`mailto:${selectedItem.email}?subject=Regarding your requirement for ${encodeURIComponent(selectedItem.requirement)}`}
                  style={{
                    padding: '10px 18px', borderRadius: '10px', background: '#0B2F5B', color: '#ffffff',
                    fontSize: '13px', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <FiMail size={14} /> Send Email
                </a>
                <button
                  onClick={() => setSelectedItem(null)}
                  style={{
                    padding: '10px 18px', borderRadius: '10px', border: '1px solid #cbd5e1',
                    background: '#ffffff', color: '#334155', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
