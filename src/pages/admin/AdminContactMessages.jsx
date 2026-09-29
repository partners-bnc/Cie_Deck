import { useEffect, useState } from 'react';
import { jobService } from '../../services/jobService.js';
import {
  FiEye,
  FiMail,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiX,
  FiMessageSquare,
  FiCheck,
  FiUser
} from 'react-icons/fi';

const STATUS_COLORS = {
  Unread: { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  Read: { bg: '#E0E7FF', text: '#3730A3', border: '#C7D2FE' },
  Replied: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
  Archived: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' }
};

export default function AdminContactMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedItem, setSelectedItem] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(null);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const data = await jobService.fetchContactMessages();
      setMessages(data || []);
    } catch (err) {
      console.error('Failed to load contact messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleStatusChange = async (id, newStatus) => {
    setStatusUpdating(id);
    try {
      await jobService.updateContactMessageStatus(id, newStatus);
      setMessages(prev =>
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
    if (!window.confirm('Are you sure you want to delete this contact message?')) return;
    try {
      await jobService.deleteContactMessage(id);
      setMessages(prev => prev.filter(item => item.id !== id));
      if (selectedItem && selectedItem.id === id) {
        setSelectedItem(null);
      }
    } catch (err) {
      console.error('Failed to delete contact message:', err);
    }
  };

  const handleOpenDetail = async (item) => {
    setSelectedItem(item);
    if ((item.status || 'Unread') === 'Unread') {
      handleStatusChange(item.id, 'Read');
    }
  };

  const filteredMessages = messages.filter(item => {
    const matchesStatus = statusFilter === 'All' || (item.status || 'Unread') === statusFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      (item.full_name || '').toLowerCase().includes(term) ||
      (item.email || '').toLowerCase().includes(term) ||
      (item.phone || '').toLowerCase().includes(term) ||
      (item.subject || '').toLowerCase().includes(term) ||
      (item.message || '').toLowerCase().includes(term);

    return matchesStatus && matchesSearch;
  });

  const counts = {
    total: messages.length,
    unread: messages.filter(m => (m.status || 'Unread') === 'Unread').length,
    read: messages.filter(m => m.status === 'Read').length,
    replied: messages.filter(m => m.status === 'Replied').length,
    archived: messages.filter(m => m.status === 'Archived').length
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
            Contact Messages
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Submissions received from the "Contact Us" page form.
          </p>
        </div>
        <button
          onClick={fetchMessages}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Total Messages</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a' }}>{counts.total}</div>
        </div>
        <div style={{ background: '#FEE2E2', borderRadius: '16px', padding: '16px 20px', border: '1px solid #FECACA' }}>
          <div style={{ fontSize: '12px', color: '#991B1B', fontWeight: 600, marginBottom: '4px' }}>Unread</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#991B1B' }}>{counts.unread}</div>
        </div>
        <div style={{ background: '#E0E7FF', borderRadius: '16px', padding: '16px 20px', border: '1px solid #C7D2FE' }}>
          <div style={{ fontSize: '12px', color: '#3730A3', fontWeight: 600, marginBottom: '4px' }}>Read</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#3730A3' }}>{counts.read}</div>
        </div>
        <div style={{ background: '#D1FAE5', borderRadius: '16px', padding: '16px 20px', border: '1px solid #A7F3D0' }}>
          <div style={{ fontSize: '12px', color: '#065F46', fontWeight: 600, marginBottom: '4px' }}>Replied</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#065F46' }}>{counts.replied}</div>
        </div>
        <div style={{ background: '#F1F5F9', borderRadius: '16px', padding: '16px 20px', border: '1px solid #CBD5E1' }}>
          <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600, marginBottom: '4px' }}>Archived</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#475569' }}>{counts.archived}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px 20px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '260px' }}>
          <FiSearch style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search name, email, subject, message..."
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
              background: '#f8fafc'
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
            <option value="Unread">Unread</option>
            <option value="Read">Read</option>
            <option value="Replied">Replied</option>
            <option value="Archived">Archived</option>
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
                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 700, whiteSpace: 'nowrap' }}>Sender</th>
                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 700, whiteSpace: 'nowrap', minWidth: '180px' }}>Subject</th>
                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 700, minWidth: '300px' }}>Message Preview</th>
                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 700, whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    Loading contact messages...
                  </td>
                </tr>
              ) : filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    No messages found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredMessages.map((item) => {
                  const currentStatus = item.status || 'Unread';
                  const badge = STATUS_COLORS[currentStatus] || STATUS_COLORS.Unread;
                  const isUnread = currentStatus === 'Unread';

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isUnread ? '#fffbfa' : 'transparent',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = isUnread ? '#fffbfa' : 'transparent')}
                    >
                      <td style={{ padding: '14px 18px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {formatDate(item.created_at)}
                      </td>
                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: isUnread ? 700 : 600, color: '#0f172a' }}>{item.full_name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <a href={`mailto:${item.email}`} style={{ color: '#0B2F5B', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <FiMail size={11} /> {item.email}
                          </a>
                          {item.phone && (
                            <a href={`tel:${item.phone}`} style={{ color: '#0B2F5B', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <FiPhone size={11} /> {item.phone}
                            </a>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px', color: '#0f172a', fontWeight: isUnread ? 700 : 600, whiteSpace: 'nowrap', minWidth: '180px' }}>
                        {item.subject || 'General Inquiry'}
                      </td>
                      <td style={{ padding: '14px 18px', color: '#334155', minWidth: '300px', maxWidth: '460px', lineHeight: 1.5 }}>
                        <div style={{ wordBreak: 'break-word' }}>
                          {item.message}
                        </div>
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
                          <option value="Unread">Unread</option>
                          <option value="Read">Read</option>
                          <option value="Replied">Replied</option>
                          <option value="Archived">Archived</option>
                        </select>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => handleOpenDetail(item)}
                            title="Read Message"
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
                background: (STATUS_COLORS[selectedItem.status || 'Unread'] || STATUS_COLORS.Unread).bg,
                color: (STATUS_COLORS[selectedItem.status || 'Unread'] || STATUS_COLORS.Unread).text,
                border: `1px solid ${(STATUS_COLORS[selectedItem.status || 'Unread'] || STATUS_COLORS.Unread).border}`
              }}>
                {selectedItem.status || 'Unread'}
              </span>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Received on {formatDate(selectedItem.created_at)}
              </span>
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
              {selectedItem.subject || 'General Inquiry'}
            </h2>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px' }}>
              From <strong style={{ color: '#0f172a' }}>{selectedItem.full_name}</strong>
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Email Address</div>
                <a href={`mailto:${selectedItem.email}`} style={{ fontSize: '13px', fontWeight: 700, color: '#0B2F5B', textDecoration: 'none' }}>
                  {selectedItem.email}
                </a>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Phone Number</div>
                <a href={selectedItem.phone ? `tel:${selectedItem.phone}` : '#'} style={{ fontSize: '13px', fontWeight: 700, color: '#0B2F5B', textDecoration: 'none' }}>
                  {selectedItem.phone || 'Not provided'}
                </a>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Message Content</div>
              <div style={{
                background: '#f8fafc', borderRadius: '14px', padding: '18px',
                border: '1px solid #e2e8f0', fontSize: '14px', color: '#1e293b',
                lineHeight: 1.7, whiteSpace: 'pre-wrap'
              }}>
                {selectedItem.message}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Status:</span>
                <select
                  value={selectedItem.status || 'Unread'}
                  onChange={(e) => handleStatusChange(selectedItem.id, e.target.value)}
                  style={{
                    padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1',
                    fontSize: '13px', fontWeight: 600, background: '#ffffff', color: '#0f172a'
                  }}
                >
                  <option value="Unread">Unread</option>
                  <option value="Read">Read</option>
                  <option value="Replied">Replied</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <a
                  href={`mailto:${selectedItem.email}?subject=Re: ${encodeURIComponent(selectedItem.subject || 'Your inquiry on Ciedeck')}`}
                  onClick={() => handleStatusChange(selectedItem.id, 'Replied')}
                  style={{
                    padding: '10px 18px', borderRadius: '10px', background: '#0B2F5B', color: '#ffffff',
                    fontSize: '13px', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <FiMail size={14} /> Reply via Email
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
