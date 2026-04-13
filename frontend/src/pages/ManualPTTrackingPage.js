import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  CircularProgress,
  Tooltip,
  Autocomplete,
  InputAdornment,
  Menu,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Assignment as AssignmentIcon,
  Search as SearchIcon,
  ArrowDropDown as ArrowDropDownIcon,
  FilterList as FilterListIcon
} from '@mui/icons-material';
import axios from 'axios';
import {
  tableContainerPaperSx,
  tableHeadCellSx,
  tableHeadCellSortableSx,
  tableBodyRowSx,
  tableScrollbarSx,
  tableStickyRtlSx
} from '../tableStyles';

const STATUS_OPTIONS = [
  { value: 'הכנה', label: 'הכנה' },
  { value: 'התנעה', label: 'התנעה' },
  { value: 'בבדיקה', label: 'בבדיקה' },
  { value: 'הסתיים', label: 'הסתיים' }
];

function ManualPTTrackingPage({ user }) {
  const [items, setItems] = useState([]);
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    system_id: null,
    system_name: '',
    last_pt_date: '',
    next_check_date: '',
    system_managers: '',
    sensitivity_level: '',
    status: 'הכנה'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLastPtFrom, setFilterLastPtFrom] = useState('');
  const [filterLastPtTo, setFilterLastPtTo] = useState('');
  const [filterNextCheckFrom, setFilterNextCheckFrom] = useState('');
  const [filterNextCheckTo, setFilterNextCheckTo] = useState('');
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const [filterMenuColumn, setFilterMenuColumn] = useState(null);

  const getAuthHeaders = () => ({
    'X-User-ID': user?.user_id?.toString() || ''
  });

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get('/api/admin/pt-tracking', { headers: getAuthHeaders() });
      if (res.data.success) {
        setItems(res.data.items || []);
      } else {
        setError(res.data.message || 'שגיאה בטעינת הנתונים');
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setError('אין הרשאה לגשת לדף זה');
      } else {
        setError('שגיאה בטעינת הנתונים');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSystems = async () => {
    try {
      const res = await axios.get('/api/admin/systems', { headers: getAuthHeaders() });
      if (res.data.success) {
        setSystems(res.data.systems || []);
      }
    } catch (err) {
      console.error('Error fetching systems:', err);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchSystems();
  }, []);

  const formatDate = (d) => {
    if (!d) return '–';
    const date = new Date(d);
    return date.toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const handleAdd = () => {
    setFormData({
      system_id: null,
      system_name: '',
      last_pt_date: '',
      next_check_date: '',
      system_managers: '',
      sensitivity_level: '',
      status: 'הכנה'
    });
    setSelectedItem(null);
    setIsEditing(false);
    setOpenDialog(true);
  };

  const handleEdit = (row) => {
    setFormData({
      system_id: row.system_id,
      system_name: row.system_name || '',
      last_pt_date: row.last_pt_date ? row.last_pt_date.slice(0, 10) : '',
      next_check_date: row.next_check_date ? row.next_check_date.slice(0, 10) : '',
      system_managers: row.system_managers || '',
      sensitivity_level: row.sensitivity_level || '',
      status: row.status || 'הכנה'
    });
    setSelectedItem(row);
    setIsEditing(true);
    setOpenDialog(true);
  };

  const handleSave = async () => {
    try {
      setError(null);
      if (!formData.system_id) {
        setError('יש לבחור מערכת');
        return;
      }
      if (isEditing && selectedItem) {
        const res = await axios.put(
          `/api/admin/pt-tracking/${selectedItem.id}`,
          {
            system_id: formData.system_id,
            last_pt_date: formData.last_pt_date || null,
            next_check_date: formData.next_check_date || null,
            system_managers: formData.system_managers || null,
            sensitivity_level: formData.sensitivity_level || null,
            status: formData.status
          },
          { headers: getAuthHeaders() }
        );
        if (res.data.success) {
          setSuccess('הרשומה עודכנה בהצלחה');
          setOpenDialog(false);
          fetchItems();
        } else {
          setError(res.data.message || 'שגיאה בעדכון');
        }
      } else {
        const res = await axios.post(
          '/api/admin/pt-tracking',
          {
            system_id: formData.system_id,
            last_pt_date: formData.last_pt_date || null,
            next_check_date: formData.next_check_date || null,
            system_managers: formData.system_managers || null,
            sensitivity_level: formData.sensitivity_level || null,
            status: formData.status
          },
          { headers: getAuthHeaders() }
        );
        if (res.data.success) {
          setSuccess('הרשומה נוצרה בהצלחה');
          setOpenDialog(false);
          fetchItems();
        } else {
          setError(res.data.message || 'שגיאה ביצירה');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בשמירה');
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`למחוק מעקב עבור "${row.system_name}"?`)) return;
    try {
      const res = await axios.delete(`/api/admin/pt-tracking/${row.id}`, { headers: getAuthHeaders() });
      if (res.data.success) {
        setSuccess('הרשומה נמחקה');
        fetchItems();
      } else {
        setError(res.data.message || 'שגיאה במחיקה');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה במחיקה');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'הכנה': return { bg: 'rgba(247, 127, 60, 0.15)', color: '#f77f3c' };
      case 'התנעה': return { bg: 'rgba(168, 85, 247, 0.15)', color: '#A855F7' };
      case 'בבדיקה': return { bg: 'rgba(255, 193, 7, 0.2)', color: '#d97706' };
      case 'הסתיים': return { bg: 'rgba(46, 204, 113, 0.15)', color: '#27ae60' };
      default: return { bg: 'rgba(128, 128, 128, 0.15)', color: '#7f8c8d' };
    }
  };

  const systemOptions = systems.map(s => ({
    id: s.id,
    name: s.name,
    email: (s.email || '').trim(),
    manager: (s.manager || '').trim()
  }));
  const selectedSystemOption = formData.system_id
    ? systemOptions.find(s => s.id === formData.system_id) || null
    : null;

  const buildInitialSystemManagers = (val) => {
    if (!val) return '';
    const parts = [];
    if (val.email) parts.push(val.email);
    if (val.manager) parts.push(val.manager);
    return parts.join(', ');
  };

  const hasActiveFilter = (col) => {
    if (col === 'system_name') return !!searchTerm.trim();
    if (col === 'last_pt') return !!filterLastPtFrom || !!filterLastPtTo;
    if (col === 'next_check') return !!filterNextCheckFrom || !!filterNextCheckTo;
    if (col === 'status') return filterStatus !== 'all';
    return false;
  };

  const handleOpenFilter = (e, column) => {
    e.stopPropagation();
    setFilterMenuAnchor(e.currentTarget);
    setFilterMenuColumn(column);
  };

  const handleCloseFilter = () => {
    setFilterMenuAnchor(null);
    setFilterMenuColumn(null);
  };

  const clearColumnFilter = (column) => {
    if (column === 'system_name') setSearchTerm('');
    if (column === 'last_pt') { setFilterLastPtFrom(''); setFilterLastPtTo(''); }
    if (column === 'next_check') { setFilterNextCheckFrom(''); setFilterNextCheckTo(''); }
    if (column === 'status') setFilterStatus('all');
  };

  const filteredItems = items.filter((row) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term ||
      (row.system_name || '').toLowerCase().includes(term) ||
      (row.system_managers || '').toLowerCase().includes(term) ||
      (row.sensitivity_level || '').toLowerCase().includes(term);
    const matchesStatus = filterStatus === 'all' || row.status === filterStatus;

    const lastPt = (row.last_pt_date || '').toString().slice(0, 10);
    const matchesLastPt = (!filterLastPtFrom || lastPt >= filterLastPtFrom) &&
      (!filterLastPtTo || lastPt <= filterLastPtTo);

    const nextCheck = (row.next_check_date || '').toString().slice(0, 10);
    const matchesNextCheck = (!filterNextCheckFrom || nextCheck >= filterNextCheckFrom) &&
      (!filterNextCheckTo || nextCheck <= filterNextCheckTo);

    return matchesSearch && matchesStatus && matchesLastPt && matchesNextCheck;
  });

  return (
    <Container maxWidth={false} sx={{ py: 3, px: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#1a252f' }}>
          מעקב סריקות PT ידניות (חוסן)
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          sx={{
            backgroundColor: '#A855F7',
            '&:hover': { backgroundColor: '#7C3AED' }
          }}
        >
          הוספת מעקב
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Paper
        sx={{
          ...tableContainerPaperSx,
          overflow: 'hidden'
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress sx={{ color: '#A855F7' }} />
          </Box>
        ) : (
          <TableContainer
            sx={{
              maxHeight: 'calc(100vh - 280px)',
              ...tableScrollbarSx
            }}
          >
            <Table stickyHeader sx={tableStickyRtlSx}>
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={tableHeadCellSortableSx}
                    onClick={(e) => handleOpenFilter(e, 'system_name')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
                      <span>שם מערכת</span>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {hasActiveFilter('system_name') && <FilterListIcon sx={{ fontSize: 16, opacity: 0.9 }} />}
                        <ArrowDropDownIcon sx={{ fontSize: 20 }} />
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell
                    sx={tableHeadCellSortableSx}
                    onClick={(e) => handleOpenFilter(e, 'last_pt')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
                      <span>PT אחרון</span>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {hasActiveFilter('last_pt') && <FilterListIcon sx={{ fontSize: 16, opacity: 0.9 }} />}
                        <ArrowDropDownIcon sx={{ fontSize: 20 }} />
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell
                    sx={tableHeadCellSortableSx}
                    onClick={(e) => handleOpenFilter(e, 'next_check')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
                      <span>תאריך בדיקה הבא</span>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {hasActiveFilter('next_check') && <FilterListIcon sx={{ fontSize: 16, opacity: 0.9 }} />}
                        <ArrowDropDownIcon sx={{ fontSize: 20 }} />
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={tableHeadCellSx}>מנהלי מערכת</TableCell>
                  <TableCell sx={tableHeadCellSx}>רמת רגישות</TableCell>
                  <TableCell
                    sx={tableHeadCellSortableSx}
                    onClick={(e) => handleOpenFilter(e, 'status')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
                      <span>סטטוס</span>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {hasActiveFilter('status') && <FilterListIcon sx={{ fontSize: 16, opacity: 0.9 }} />}
                        <ArrowDropDownIcon sx={{ fontSize: 20 }} />
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ ...tableHeadCellSx, textAlign: 'center' }}>
                    <Typography variant="caption" component="span" sx={{ opacity: 0.9 }}>{filteredItems.length} / {items.length}</Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, backgroundColor: '#ffffff' }}>
                      <Typography color="text.secondary">
                        {items.length === 0 ? 'אין רשומות. הוסף מעקב חדש.' : 'לא נמצאו רשומות התואמות לסינון.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((row) => {
                    const statusStyle = getStatusColor(row.status);
                    return (
                      <TableRow
                        key={row.id}
                        sx={tableBodyRowSx}
                      >
                        <TableCell sx={{ py: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AssignmentIcon sx={{ color: '#A855F7', fontSize: 20 }} />
                            <Typography fontWeight={600} sx={{ color: '#1a252f' }}>{row.system_name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 2, color: '#2c3e50' }}>{formatDate(row.last_pt_date)}</TableCell>
                        <TableCell sx={{ py: 2, color: '#2c3e50' }}>{formatDate(row.next_check_date)}</TableCell>
                        <TableCell sx={{ py: 2, color: '#2c3e50' }}>{row.system_managers || '–'}</TableCell>
                        <TableCell sx={{ py: 2, color: '#2c3e50' }}>{row.sensitivity_level || '–'}</TableCell>
                        <TableCell sx={{ py: 2 }}>
                          <Box
                            component="span"
                            sx={{
                              px: 1.5,
                              py: 0.5,
                              borderRadius: 1,
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              backgroundColor: statusStyle.bg,
                              color: statusStyle.color,
                              border: `1px solid ${statusStyle.color}30`
                            }}
                          >
                            {row.status}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                            <Tooltip title="עריכה">
                              <IconButton size="small" onClick={() => handleEdit(row)} sx={{ color: '#A855F7' }}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="מחיקה">
                              <IconButton size="small" onClick={() => handleDelete(row)} sx={{ color: '#e74c3c' }}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={handleCloseFilter}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { minWidth: 220, maxWidth: 320, p: 2 } }}
      >
        {filterMenuColumn === 'system_name' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="subtitle2" color="text.secondary">סינון לפי שם מערכת</Typography>
            <TextField
              size="small"
              placeholder="הקלד לחיפוש..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              fullWidth
              autoFocus
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            {hasActiveFilter('system_name') && (
              <Button size="small" onClick={() => clearColumnFilter('system_name')}>נקה סינון</Button>
            )}
          </Box>
        )}
        {filterMenuColumn === 'last_pt' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="subtitle2" color="text.secondary">סינון PT אחרון</Typography>
            <TextField size="small" label="מ־" type="date" value={filterLastPtFrom} onChange={(e) => setFilterLastPtFrom(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
            <TextField size="small" label="עד" type="date" value={filterLastPtTo} onChange={(e) => setFilterLastPtTo(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
            {hasActiveFilter('last_pt') && (
              <Button size="small" onClick={() => clearColumnFilter('last_pt')}>נקה סינון</Button>
            )}
          </Box>
        )}
        {filterMenuColumn === 'next_check' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="subtitle2" color="text.secondary">סינון תאריך בדיקה הבא</Typography>
            <TextField size="small" label="מ־" type="date" value={filterNextCheckFrom} onChange={(e) => setFilterNextCheckFrom(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
            <TextField size="small" label="עד" type="date" value={filterNextCheckTo} onChange={(e) => setFilterNextCheckTo(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
            {hasActiveFilter('next_check') && (
              <Button size="small" onClick={() => clearColumnFilter('next_check')}>נקה סינון</Button>
            )}
          </Box>
        )}
        {filterMenuColumn === 'status' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="subtitle2" color="text.secondary">סינון לפי סטטוס</Typography>
            <FormControlLabel
              control={<Checkbox checked={filterStatus === 'all'} onChange={() => setFilterStatus('all')} size="small" />}
              label="הכל"
            />
            {STATUS_OPTIONS.map((opt) => (
              <FormControlLabel
                key={opt.value}
                control={<Checkbox checked={filterStatus === opt.value} onChange={() => setFilterStatus(opt.value)} size="small" />}
                label={opt.label}
              />
            ))}
            {hasActiveFilter('status') && (
              <Button size="small" onClick={() => clearColumnFilter('status')} sx={{ mt: 0.5 }}>נקה סינון</Button>
            )}
          </Box>
        )}
      </Menu>

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          dir: 'rtl',
          sx: {
            direction: 'rtl',
            backgroundColor: '#ffffff',
            color: '#1a252f',
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            '& .MuiDialogTitle-root': { textAlign: 'right' },
            '& .MuiDialogContent-root': { textAlign: 'right' },
            '& .MuiDialogActions-root': { flexDirection: 'row-reverse' },
            '& .MuiInputLabel-root, & label.MuiInputLabel-root, & .MuiInputLabel-outlined': {
              color: '#2c3e50',
              right: 14,
              left: 'unset !important',
              transformOrigin: 'top right'
            },
            '& .MuiInputLabel-shrink': {
              transform: 'translate(-14px, -9px) scale(0.75) !important'
            },
            '& .MuiOutlinedInput-notchedOutline legend': { textAlign: 'right' },
            '& .MuiOutlinedInput-notchedOutline legend span': { paddingLeft: 0, paddingRight: 8.5 },
            '& .MuiOutlinedInput-input': { color: '#1a252f', textAlign: 'right', direction: 'rtl' },
            '& .MuiOutlinedInput-root': { direction: 'rtl' },
            '& .MuiSelect-select': { textAlign: 'right', direction: 'rtl' },
            '& .MuiAutocomplete-input': { textAlign: 'right', direction: 'rtl' }
          }
        }}
      >
        <DialogTitle
          sx={{
            color: '#1a252f',
            fontWeight: 700,
            fontSize: '1.25rem',
            textAlign: 'right',
            borderBottom: '1px solid #e9ecef',
            pb: 2,
            pt: 2.5,
            direction: 'rtl'
          }}
        >
          {isEditing ? 'עריכת מעקב' : 'הוספת מעקב'}
        </DialogTitle>
        <DialogContent
          sx={{
            direction: 'rtl',
            backgroundColor: '#ffffff',
            pt: 3,
            pb: 2,
            textAlign: 'right',
            '& .MuiInputLabel-root, & label.MuiInputLabel-root, & .MuiInputLabel-outlined': {
              color: '#2c3e50',
              right: 14,
              left: 'unset !important',
              transformOrigin: 'top right'
            },
            '& .MuiInputLabel-shrink': {
              transform: 'translate(-14px, -9px) scale(0.75) !important'
            },
            '& .MuiOutlinedInput-notchedOutline legend': { textAlign: 'right' },
            '& .MuiOutlinedInput-notchedOutline legend span': { paddingLeft: 0, paddingRight: 8.5 },
            '& .MuiOutlinedInput-input': { color: '#1a252f', textAlign: 'right', direction: 'rtl' },
            '& .MuiOutlinedInput-root': { direction: 'rtl' },
            '& .MuiSelect-select': { textAlign: 'right', direction: 'rtl' },
            '& .MuiAutocomplete-input': { textAlign: 'right', direction: 'rtl' }
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, direction: 'rtl', textAlign: 'right' }}>
            <Typography
              component="h2"
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                color: '#1a252f',
                fontSize: '1.1rem',
                mb: 0.5,
                borderBottom: '1px solid #e9ecef',
                pb: 1
              }}
            >
              מערכת *
            </Typography>
            <Autocomplete
              options={systemOptions}
              getOptionLabel={(opt) => opt.name}
              value={selectedSystemOption}
              onChange={(e, val) => {
                const initialManagers = buildInitialSystemManagers(val);
                setFormData(prev => ({
                  ...prev,
                  system_id: val?.id ?? null,
                  system_name: val?.name ?? '',
                  system_managers: initialManagers || prev.system_managers
                }));
              }}
              disabled={isEditing}
              renderInput={(params) => <TextField {...params} placeholder="בחר מערכת" required />}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#f8f9fa',
                  flexDirection: 'row-reverse'
                }
              }}
            />
            <TextField
              label="PT אחרון"
              type="date"
              value={formData.last_pt_date}
              onChange={(e) => setFormData(prev => ({ ...prev, last_pt_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              sx={{
                '& .MuiOutlinedInput-root': { backgroundColor: '#f8f9fa', flexDirection: 'row-reverse' }
              }}
            />
            <TextField
              label="תאריך בדיקה הבא (מתעדכן אוטומטית +18 חודשים)"
              type="date"
              value={formData.next_check_date}
              onChange={(e) => setFormData(prev => ({ ...prev, next_check_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              sx={{
                '& .MuiOutlinedInput-root': { backgroundColor: '#f8f9fa', flexDirection: 'row-reverse' }
              }}
            />
            <TextField
              label="מנהלי מערכת"
              value={formData.system_managers}
              onChange={(e) => setFormData(prev => ({ ...prev, system_managers: e.target.value }))}
              multiline
              maxRows={2}
              sx={{ '& .MuiOutlinedInput-root': { backgroundColor: '#f8f9fa' } }}
            />
            <TextField
              label="רמת רגישות"
              value={formData.sensitivity_level}
              onChange={(e) => setFormData(prev => ({ ...prev, sensitivity_level: e.target.value }))}
              sx={{ '& .MuiOutlinedInput-root': { backgroundColor: '#f8f9fa' } }}
            />
            <FormControl
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#f8f9fa',
                  flexDirection: 'row-reverse'
                },
                '& .MuiSelect-select': { textAlign: 'right' }
              }}
            >
              <InputLabel id="dialog-status-label">סטטוס</InputLabel>
              <Select
                labelId="dialog-status-label"
                value={formData.status}
                label="סטטוס"
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                sx={{ '& .MuiSelect-select': { textAlign: 'right' } }}
              >
                {STATUS_OPTIONS.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            backgroundColor: '#f8f9fa',
            borderTop: '1px solid #e9ecef',
            flexDirection: 'row-reverse',
            gap: 1
          }}
        >
          <Button onClick={() => setOpenDialog(false)} sx={{ color: '#2c3e50' }}>
            ביטול
          </Button>
          <Button variant="contained" onClick={handleSave} sx={{ backgroundColor: '#A855F7', '&:hover': { backgroundColor: '#7C3AED' } }}>
            שמירה
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default ManualPTTrackingPage;
