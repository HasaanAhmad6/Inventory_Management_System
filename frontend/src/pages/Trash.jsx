import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Trash() {
  const { isSuperUser } = useAuth();
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [restoring, setRestoring] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const fetchTrashItems = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await API.get('trash/');
      setItems(res.data.items || []);
      setFilteredItems(res.data.items || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load trash items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrashItems();
  }, []);

  useEffect(() => {
    let filtered = items;

    if (typeFilter !== 'All') {
      filtered = filtered.filter(item => item.type === typeFilter);
    }

    if (search) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    setFilteredItems(filtered);
  }, [typeFilter, search, items]);

  const handleRestore = (item) => {
    setSelectedItem(item);
    setShowRestoreConfirm(true);
  };

  const handlePermanentDelete = (item) => {
    setSelectedItem(item);
    setShowDeleteConfirm(true);
  };

  const confirmRestore = async () => {
    if (!selectedItem) return;
    const item = selectedItem;
    
    setRestoring(item.id);
    setError('');
    setSuccess('');
    setShowRestoreConfirm(false);

    try {
      await API.post('trash/restore/', { type: item.type, id: item.id });
      setSuccess(`${item.type} "${item.name}" restored successfully!`);
      fetchTrashItems();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to restore item.');
    } finally {
      setRestoring(null);
      setSelectedItem(null);
    }
  };

  const confirmPermanentDelete = async () => {
    if (!selectedItem) return;
    const item = selectedItem;

    setDeleting(item.id);
    setError('');
    setSuccess('');
    setShowDeleteConfirm(false);

    try {
      await API.delete('trash/permanent/', { data: { type: item.type, id: item.id } });
      setSuccess(`${item.type} "${item.name}" permanently deleted.`);
      fetchTrashItems();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to permanently delete item.');
    } finally {
      setDeleting(null);
      setSelectedItem(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  const typeIcons = {
    Product: '📦',
    Category: '📁',
    Supplier: '🤝',
    Purchase: '🛒',
    Sale: '💰',
    User: '👤',
  };

  const clearFilters = () => { setSearch(''); setTypeFilter('All'); };
  const hasActiveFilters = search || typeFilter !== 'All';

  return (
    <Layout>
      <div style={{ padding: '28px 24px' }}>
        {/* Header */}
        <div style={styles.pageHeader}>
          <div>
            <h2 style={styles.pageTitle}>🗑️ Trash</h2>
            <p style={styles.pageSubtitle}>{items.length} deleted item{items.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={fetchTrashItems} style={styles.refreshBtn}>
            ↻ Refresh
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div style={styles.errorAlert}>
            {error}
            <button onClick={() => setError('')} style={styles.alertCloseBtn}>✖</button>
          </div>
        )}
        {success && (
          <div style={styles.successAlert}>
            {success}
            <button onClick={() => setSuccess('')} style={styles.alertCloseBtn}>✖</button>
          </div>
        )}

        {/* Filter Bar */}
        <div style={styles.filterBar}>
          <div style={styles.searchWrapper}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              style={styles.searchInput}
              placeholder="Search by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button onClick={() => setSearch('')} style={styles.clearBtn}>✖</button>}
          </div>
          <select style={styles.filterSelect} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="All">All Types</option>
            <option value="Product">📦 Products</option>
            <option value="Category">📁 Categories</option>
            <option value="Supplier">🤝 Suppliers</option>
            <option value="Purchase">🛒 Purchases</option>
            <option value="Sale">💰 Sales</option>
            <option value="User">👤 Users</option>
          </select>
          {hasActiveFilters && (
            <button onClick={clearFilters} style={styles.clearFiltersBtn}>Clear Filters</button>
          )}
          <div style={styles.resultCount}>{filteredItems.length} of {items.length} shown</div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={styles.emptyBox}><div style={{ color: '#94A3B8' }}>Loading trash items...</div></div>
        ) : filteredItems.length === 0 ? (
          <div style={styles.emptyBox}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              {items.length === 0 ? '🎉' : '🔍'}
            </div>
            <div style={{ fontWeight: 600, color: '#fff' }}>
              {items.length === 0 ? 'Trash is empty!' : 'No items match your filter'}
            </div>
            <div style={{ color: '#94A3B8', fontSize: 14, marginTop: 4 }}>
              {items.length === 0 ? 'Deleted items will appear here.' : 'Try adjusting your search or filter.'}
            </div>
            {hasActiveFilters && <button onClick={clearFilters} style={{ ...styles.refreshBtn, marginTop: 16 }}>Clear Filters</button>}
          </div>
        ) : (
          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHead}>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Deleted By</th>
                  <th style={styles.th}>Deleted At</th>
                  <th style={{...styles.th, textAlign: 'right'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, i) => (
                  <tr
                    key={`${item.type}-${item.id}`}
                    style={{
                      ...styles.tableRow,
                      backgroundColor: i % 2 === 0 ? '#14142b' : '#0f0f23'
                    }}
                  >
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{typeIcons[item.type] || '📄'}</span>
                        <span style={styles.typeBadge}>{item.type}</span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>{item.name}</div>
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: '#94A3B8' }}>{item.deleted_by || '—'}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: '#94A3B8', fontSize: 13 }}>{formatDate(item.deleted_at)}</span>
                    </td>
                    <td style={{...styles.td, textAlign: 'right'}}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleRestore(item)}
                          disabled={restoring === item.id || deleting === item.id}
                          style={{
                            ...styles.restoreBtn,
                            opacity: (restoring === item.id || deleting === item.id) ? 0.5 : 1,
                            cursor: (restoring === item.id || deleting === item.id) ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {restoring === item.id ? '⌛' : '↻'} Restore
                        </button>
                        {isSuperUser() && (
                          <button
                            onClick={() => handlePermanentDelete(item)}
                            disabled={restoring === item.id || deleting === item.id}
                            style={{
                              ...styles.deleteBtn,
                              opacity: (restoring === item.id || deleting === item.id) ? 0.5 : 1,
                              cursor: (restoring === item.id || deleting === item.id) ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {deleting === item.id ? '⌛' : '🗑'} Delete Forever
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    <ConfirmModal
        open={showRestoreConfirm}
        title="Restore Item"
        message={selectedItem ? `Restore this ${selectedItem.type.toLowerCase()} "${selectedItem.name}"? It will be moved back to the active list.` : ""}
        onConfirm={confirmRestore}
        onCancel={() => { setShowRestoreConfirm(false); setSelectedItem(null); }}
        confirmText="Restore"
        isDanger={false}
      />
      <ConfirmModal
        open={showDeleteConfirm}
        title="Permanent Delete"
        message={selectedItem ? `⚠️ PERMANENTLY DELETE this ${selectedItem.type.toLowerCase()} "${selectedItem.name}"?\n\nThis action CANNOT be undone! The item will be removed from the database forever.` : ""}
        onConfirm={confirmPermanentDelete}
        onCancel={() => { setShowDeleteConfirm(false); setSelectedItem(null); }}
        confirmText="Delete Forever"
        isDanger={true}
      />
    </Layout>
  );
}

const styles = {
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle: { margin: 0, fontSize: 26, fontWeight: 700, color: '#FFFFFF' },
  pageSubtitle: { margin: '4px 0 0', color: '#CBD5E1', fontSize: 14 },
  refreshBtn: { backgroundColor: '#1E40AF', color: 'white', border: 'none', padding: '10px 22px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, boxShadow: '0 4px 12px rgba(30,64,175,0.3)' },
  errorAlert: { backgroundColor: '#450a0a66', border: '1px solid #dc262688', color: '#fca5a5', padding: '12px 16px', borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  successAlert: { backgroundColor: '#14532d66', border: '1px solid #16a34a88', color: '#86efac', padding: '12px 16px', borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  alertCloseBtn: { background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 18, padding: 0, marginLeft: 16 },
  filterBar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap', backgroundColor: '#1a1a2e', border: '1px solid #2a2a4a', padding: '16px 20px', borderRadius: 12 },
  searchWrapper: { position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 200 },
  searchIcon: { position: 'absolute', left: 12, fontSize: 15, pointerEvents: 'none' },
  searchInput: { width: '100%', padding: '9px 36px 9px 36px', borderRadius: 8, border: '1px solid #2a2a4a', fontSize: 14, outline: 'none', backgroundColor: '#0f0f23', color: '#fff', boxSizing: 'border-box' },
  clearBtn: { position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 14, padding: 0 },
  filterSelect: { padding: '9px 14px', borderRadius: 8, border: '1px solid #2a2a4a', fontSize: 14, backgroundColor: '#0f0f23', cursor: 'pointer', outline: 'none', color: '#E2E8F0' },
  clearFiltersBtn: { padding: '9px 16px', borderRadius: 8, border: '1px solid #7f1d1d', backgroundColor: '#2b1014', color: '#f87171', fontSize: 13, cursor: 'pointer', fontWeight: 600 },
  resultCount: { color: '#94A3B8', fontSize: 13, whiteSpace: 'nowrap', marginLeft: 'auto' },
  emptyBox: { textAlign: 'center', padding: 60, backgroundColor: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 12 },
  tableCard: { backgroundColor: '#1a1a2e', borderRadius: 12, border: '1px solid #2a2a4a', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  tableHead: { backgroundColor: '#0f0f23' },
  th: { padding: '14px 16px', textAlign: 'left', color: '#E2E8F0', fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' },
  tableRow: { borderBottom: '1px solid #2a2a4a' },
  td: { padding: '14px 16px', verticalAlign: 'middle', color: '#E2E8F0' },
  typeBadge: { backgroundColor: '#172554', color: '#93c5fd', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: '1px solid #1e3a8a' },
  restoreBtn: { backgroundColor: '#065f4633', color: '#6ee7b7', border: '1px solid #059669', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  deleteBtn: { backgroundColor: '#450a0a66', color: '#fca5a5', border: '1px solid #dc262688', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
};
