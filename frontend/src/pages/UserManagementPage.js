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
  Chip,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Fade,
  Tooltip,
  FormControlLabel,
  Checkbox,
  Divider,
  Grid,
  Autocomplete
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  LockReset as LockResetIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  Computer as ComputerIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Restore as RestoreIcon
} from '@mui/icons-material';
import axios from 'axios';

function UserManagementPage({ user }) {
  // State
  const [users, setUsers] = useState([]);
  const [userTypes, setUserTypes] = useState([]);
  const [allSystems, setAllSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Dialog states
  const [openUserDialog, setOpenUserDialog] = useState(false);
  const [openPasswordDialog, setOpenPasswordDialog] = useState(false);
  const [openSystemsDialog, setOpenSystemsDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    full_name: '',
    user_type_id: 3
  });
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedSystems, setSelectedSystems] = useState([]);
  const [userSystems, setUserSystems] = useState([]);
  const [systemSearchTerm, setSystemSearchTerm] = useState('');

  // Load data
  useEffect(() => {
    fetchData();
  }, []);

  const getAuthHeaders = () => ({
    'X-User-ID': user?.user_id?.toString() || ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersRes, typesRes, systemsRes] = await Promise.all([
        axios.get('/api/admin/users', { headers: getAuthHeaders() }),
        axios.get('/api/admin/user-types', { headers: getAuthHeaders() }),
        axios.get('/api/admin/systems', { headers: getAuthHeaders() })
      ]);

      if (usersRes.data.success) {
        console.log('Users data from API:', usersRes.data.users);
        setUsers(usersRes.data.users || []);
      }
      if (typesRes.data.success) {
        setUserTypes(typesRes.data.user_types || []);
      }
      if (systemsRes.data.success) {
        setAllSystems(systemsRes.data.systems || []);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      if (err.response?.status === 403) {
        setError('אין הרשאה לגשת לדף זה');
      } else {
        setError('שגיאה בטעינת הנתונים');
      }
      setLoading(false);
    }
  };

  // Filter users
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' || u.user_type_id?.toString() === filterType;
    
    return matchesSearch && matchesFilter;
  });

  // Get role color - Based on actual UsersType table values
  const getRoleColor = (userTypeId) => {
    // Convert to number for comparison
    const typeId = parseInt(userTypeId);
    switch (typeId) {
      case 1: return { bg: 'rgba(170, 10, 33, 0.15)', color: '#aa0a21', label: 'Admin' };
      case 2: return { bg: 'rgba(85, 198, 194, 0.15)', color: '#55c6c2', label: 'System Manager' };
      case 3: return { bg: 'rgba(52, 152, 219, 0.15)', color: '#3498db', label: 'Super Manager' };
      default: return { bg: 'rgba(128, 128, 128, 0.15)', color: '#808080', label: 'לא מוגדר' };
    }
  };

  // Handle add user
  const handleAddUser = () => {
    setFormData({
      username: '',
      password: '',
      email: '',
      full_name: '',
      user_type_id: 3
    });
    setIsEditing(false);
    setSelectedUser(null);
    setOpenUserDialog(true);
  };

  // Handle edit user
  const handleEditUser = (userToEdit) => {
    setFormData({
      username: userToEdit.username || '',
      password: '',
      email: userToEdit.email || '',
      full_name: userToEdit.full_name || '',
      user_type_id: userToEdit.user_type_id || 3
    });
    setIsEditing(true);
    setSelectedUser(userToEdit);
    setOpenUserDialog(true);
  };

  // Handle save user
  const handleSaveUser = async () => {
    try {
      if (isEditing && selectedUser) {
        // Update user
        const updateData = {
          username: formData.username,
          email: formData.email,
          full_name: formData.full_name,
          user_type_id: formData.user_type_id
        };

        const res = await axios.put(
          `/api/admin/users/${selectedUser.id}`,
          updateData,
          { headers: getAuthHeaders() }
        );

        if (res.data.success) {
          setSuccess('משתמש עודכן בהצלחה');
          fetchData();
        } else {
          setError(res.data.message || 'שגיאה בעדכון משתמש');
        }
      } else {
        // Create user
        if (!formData.username || !formData.password) {
          setError('יש למלא שם משתמש וסיסמה');
          return;
        }

        const res = await axios.post(
          '/api/admin/users',
          formData,
          { headers: getAuthHeaders() }
        );

        if (res.data.success) {
          setSuccess('משתמש נוצר בהצלחה');
          fetchData();
        } else {
          setError(res.data.message || 'שגיאה ביצירת משתמש');
        }
      }

      setOpenUserDialog(false);
    } catch (err) {
      console.error('Error saving user:', err);
      setError(err.response?.data?.message || 'שגיאה בשמירת משתמש');
    }
  };

  // Handle deactivate user
  const handleDeactivateUser = async (userToDeactivate) => {
    if (!window.confirm(`האם להשבית את המשתמש ${userToDeactivate.username}?`)) {
      return;
    }

    try {
      const res = await axios.delete(
        `/api/admin/users/${userToDeactivate.id}`,
        { headers: getAuthHeaders() }
      );

      if (res.data.success) {
        setSuccess('משתמש הושבת בהצלחה');
        fetchData();
      } else {
        setError(res.data.message || 'שגיאה בהשבתת משתמש');
      }
    } catch (err) {
      console.error('Error deactivating user:', err);
      setError(err.response?.data?.message || 'שגיאה בהשבתת משתמש');
    }
  };

  // Handle activate user
  const handleActivateUser = async (userToActivate) => {
    try {
      const res = await axios.post(
        `/api/admin/users/${userToActivate.id}/activate`,
        {},
        { headers: getAuthHeaders() }
      );

      if (res.data.success) {
        setSuccess('משתמש הופעל בהצלחה');
        fetchData();
      } else {
        setError(res.data.message || 'שגיאה בהפעלת משתמש');
      }
    } catch (err) {
      console.error('Error activating user:', err);
      setError(err.response?.data?.message || 'שגיאה בהפעלת משתמש');
    }
  };

  // Handle reset password
  const handleOpenPasswordDialog = (userForPassword) => {
    setSelectedUser(userForPassword);
    setNewPassword('');
    setOpenPasswordDialog(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword) {
      setError('יש להזין סיסמה חדשה');
      return;
    }

    try {
      const res = await axios.post(
        `/api/admin/users/${selectedUser.id}/reset-password`,
        { new_password: newPassword },
        { headers: getAuthHeaders() }
      );

      if (res.data.success) {
        setSuccess('סיסמה אופסה בהצלחה');
        setOpenPasswordDialog(false);
      } else {
        setError(res.data.message || 'שגיאה באיפוס סיסמה');
      }
    } catch (err) {
      console.error('Error resetting password:', err);
      setError(err.response?.data?.message || 'שגיאה באיפוס סיסמה');
    }
  };

  // Handle systems management
  const handleOpenSystemsDialog = async (userForSystems) => {
    setSelectedUser(userForSystems);
    
    try {
      const res = await axios.get(
        `/api/admin/users/${userForSystems.id}/systems`,
        { headers: getAuthHeaders() }
      );

      if (res.data.success) {
        const existingSystemIds = res.data.systems.map(s => s.id);
        
        // Also find systems where user is the SystemManager (by full_name)
        const managedSystemIds = allSystems
          .filter(s => s.manager && userForSystems.full_name && 
                       s.manager.toLowerCase().includes(userForSystems.full_name.toLowerCase()))
          .map(s => s.id);
        
        // Combine both lists (remove duplicates)
        const allSelectedIds = [...new Set([...existingSystemIds, ...managedSystemIds])];
        
        setSelectedSystems(allSelectedIds);
        setUserSystems(res.data.systems);
      }
    } catch (err) {
      console.error('Error fetching user systems:', err);
    }

    setOpenSystemsDialog(true);
  };

  const handleSaveSystems = async () => {
    try {
      const res = await axios.put(
        `/api/admin/users/${selectedUser.id}/systems`,
        { system_ids: selectedSystems },
        { headers: getAuthHeaders() }
      );

      if (res.data.success) {
        setSuccess('מערכות משתמש עודכנו בהצלחה');
        setOpenSystemsDialog(false);
      } else {
        setError(res.data.message || 'שגיאה בעדכון מערכות');
      }
    } catch (err) {
      console.error('Error saving systems:', err);
      setError(err.response?.data?.message || 'שגיאה בעדכון מערכות');
    }
  };

  // Format date - with local timezone
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      // Parse the date and display in local timezone
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleString('he-IL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      console.error('Error formatting date:', dateString, e);
      return '-';
    }
  };

  // Clear messages after delay
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={60} sx={{ color: '#3498db' }} />
        <Typography variant="body1" color="text.secondary">
          טוען נתונים...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: 'fit-content',
      background: '#f8f9fa',
      py: 3
    }}>
      <Container maxWidth="xl">
        {/* Header */}
        <Fade in={true} timeout={800}>
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="h4" 
              component="h1" 
              sx={{ 
                fontWeight: 800,
                color: '#2c3e50',
                mb: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}
            >
              <AdminIcon sx={{ fontSize: 40, color: '#3498db' }} />
              ניהול משתמשים
            </Typography>
            <Typography variant="body1" sx={{ color: '#7f8c8d' }}>
              הוספה, עריכה וניהול הרשאות משתמשים במערכת
            </Typography>
          </Box>
        </Fade>

        {/* Alerts */}
        {error && (
          <Fade in={true}>
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          </Fade>
        )}
        {success && (
          <Fade in={true}>
            <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          </Fade>
        )}

        {/* Toolbar */}
        <Fade in={true} timeout={1000}>
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2, 
              mb: 3, 
              borderRadius: 3,
              border: '1px solid rgba(52, 152, 219, 0.2)',
              backgroundColor: 'rgba(255, 255, 255, 0.9)'
            }}
          >
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  placeholder="חיפוש משתמש..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#7f8c8d' }} />
                      </InputAdornment>
                    ),
                    style: { color: '#000' }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      backgroundColor: '#fff'
                    },
                    '& .MuiOutlinedInput-input': {
                      color: '#000'
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel sx={{ color: '#2c3e50', fontWeight: 600 }}>סינון לפי הרשאה</InputLabel>
                  <Select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    label="סינון לפי הרשאה"
                    sx={{ borderRadius: 2, backgroundColor: '#fff' }}
                  >
                    <MenuItem value="all">הכל</MenuItem>
                    {userTypes.map(type => (
                      <MenuItem key={type.id} value={type.id.toString()}>
                        {type.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={5} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddUser}
                  sx={{
                    borderRadius: 2,
                    px: 3,
                    py: 1.2,
                    background: 'linear-gradient(135deg, #3498db 0%, #55c6c2 100%)',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(52, 152, 219, 0.3)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #2980b9 0%, #3498db 100%)',
                      boxShadow: '0 6px 16px rgba(52, 152, 219, 0.4)'
                    }
                  }}
                >
                  הוסף משתמש
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Fade>

        {/* Users Table */}
        <Fade in={true} timeout={1200}>
          <TableContainer 
            component={Paper} 
            elevation={0}
            sx={{ 
              background: '#ffffff',
              border: '1px solid #e0e0e0',
              borderRadius: '16px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              maxHeight: 600,
              overflow: 'auto',
              '&::-webkit-scrollbar': {
                width: '8px',
                height: '8px'
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: 'rgba(52, 152, 219, 0.05)',
                borderRadius: '4px'
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(52, 152, 219, 0.3)',
                borderRadius: '4px',
                '&:hover': {
                  backgroundColor: 'rgba(52, 152, 219, 0.5)'
                }
              },
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(52, 152, 219, 0.3) rgba(52, 152, 219, 0.05)'
            }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: '#ffffff', backgroundColor: '#3498DB', borderBottom: 'none', fontSize: '0.95rem', py: 2 }}>שם משתמש</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#ffffff', backgroundColor: '#3498DB', borderBottom: 'none', fontSize: '0.95rem', py: 2 }}>שם מלא</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#ffffff', backgroundColor: '#3498DB', borderBottom: 'none', fontSize: '0.95rem', py: 2 }}>אימייל</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#ffffff', backgroundColor: '#3498DB', borderBottom: 'none', fontSize: '0.95rem', py: 2 }}>הרשאה</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#ffffff', backgroundColor: '#3498DB', borderBottom: 'none', fontSize: '0.95rem', py: 2 }}>סטטוס</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#ffffff', backgroundColor: '#3498DB', borderBottom: 'none', fontSize: '0.95rem', py: 2 }}>התחברות אחרונה</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#ffffff', backgroundColor: '#3498DB', borderBottom: 'none', fontSize: '0.95rem', py: 2, textAlign: 'center' }}>פעולות</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, backgroundColor: '#ffffff' }}>
                      <Typography color="text.secondary">
                        לא נמצאו משתמשים
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u, index) => {
                    const roleStyle = getRoleColor(u.user_type_id);
                    return (
                      <TableRow 
                        key={u.id}
                        sx={{ 
                          backgroundColor: '#ffffff',
                          '&:hover': { backgroundColor: '#f5f8ff' },
                          borderBottom: '1px solid #f0f0f0',
                          transition: 'background-color 0.2s ease',
                          opacity: u.is_active ? 1 : 0.6
                        }}
                      >
                        <TableCell sx={{ py: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PersonIcon sx={{ color: '#3498db', fontSize: 20 }} />
                            <Typography fontWeight={600} sx={{ color: '#1a252f' }}>{u.username}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 2, color: '#2c3e50' }}>{u.full_name || '-'}</TableCell>
                        <TableCell sx={{ py: 2, color: '#2c3e50' }}>{u.email || '-'}</TableCell>
                        <TableCell sx={{ py: 2 }}>
                          <Chip
                            label={u.user_type_name || roleStyle.label}
                            size="small"
                            sx={{
                              backgroundColor: roleStyle.bg,
                              color: roleStyle.color,
                              fontWeight: 600,
                              border: `1px solid ${roleStyle.color}30`
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ py: 2 }}>
                          {u.is_active ? (
                            <Chip
                              icon={<CheckCircleIcon />}
                              label="פעיל"
                              size="small"
                              sx={{
                                backgroundColor: 'rgba(46, 204, 113, 0.15)',
                                color: '#27ae60',
                                fontWeight: 600,
                                '& .MuiChip-icon': { color: '#27ae60' }
                              }}
                            />
                          ) : (
                            <Chip
                              icon={<CancelIcon />}
                              label="מושבת"
                              size="small"
                              sx={{
                                backgroundColor: 'rgba(231, 76, 60, 0.15)',
                                color: '#e74c3c',
                                fontWeight: 600,
                                '& .MuiChip-icon': { color: '#e74c3c' }
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell sx={{ py: 2 }}>
                          <Typography variant="body2" sx={{ color: '#546e7a' }}>
                            {formatDate(u.last_login_date)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                            <Tooltip title="עריכה">
                              <IconButton
                                size="small"
                                onClick={() => handleEditUser(u)}
                                sx={{ color: '#3498db' }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            
                            {/* Show computer icon for System Manager (user_type_id = 2) */}
                            {(u.user_type_id === 2 || u.user_type_id === '2') && (
                              <Tooltip title="ניהול מערכות">
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenSystemsDialog(u)}
                                  sx={{ color: '#55c6c2' }}
                                >
                                  <ComputerIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            <Tooltip title="איפוס סיסמה">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenPasswordDialog(u)}
                                sx={{ color: '#f39c12' }}
                              >
                                <LockResetIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            
                            {u.is_active ? (
                              <Tooltip title={u.id === user?.user_id ? "לא ניתן להשבית את עצמך" : "השבתה"}>
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeactivateUser(u)}
                                    sx={{ color: '#e74c3c' }}
                                    disabled={u.id === user?.user_id}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            ) : (
                              <Tooltip title="הפעלה">
                                <IconButton
                                  size="small"
                                  onClick={() => handleActivateUser(u)}
                                  sx={{ color: '#27ae60' }}
                                >
                                  <RestoreIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Fade>

        {/* Stats Summary */}
        <Fade in={true} timeout={1400}>
          <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Chip
              label={`סה"כ: ${users.length} משתמשים`}
              sx={{ backgroundColor: 'rgba(52, 152, 219, 0.1)', color: '#3498db', fontWeight: 600 }}
            />
            <Chip
              label={`פעילים: ${users.filter(u => u.is_active).length}`}
              sx={{ backgroundColor: 'rgba(46, 204, 113, 0.1)', color: '#27ae60', fontWeight: 600 }}
            />
            <Chip
              label={`מושבתים: ${users.filter(u => !u.is_active).length}`}
              sx={{ backgroundColor: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c', fontWeight: 600 }}
            />
          </Box>
        </Fade>
      </Container>

      {/* Add/Edit User Dialog */}
      <Dialog 
        open={openUserDialog} 
        onClose={() => setOpenUserDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: '1px solid rgba(52, 152, 219, 0.3)'
          }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <PersonIcon sx={{ color: '#3498db' }} />
          {isEditing ? 'עריכת משתמש' : 'הוספת משתמש חדש'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="שם משתמש"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                disabled={isEditing}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            {!isEditing && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="סיסמה"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="שם מלא"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="אימייל"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>סוג הרשאה</InputLabel>
                <Select
                  value={formData.user_type_id}
                  onChange={(e) => setFormData({ ...formData, user_type_id: e.target.value })}
                  label="סוג הרשאה"
                  sx={{ borderRadius: 2 }}
                >
                  {userTypes.map(type => (
                    <MenuItem key={type.id} value={type.id}>
                      {type.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          
          {(formData.user_type_id === 2 || formData.user_type_id === '2') && (
            <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
              משתמש מסוג "System Manager" יוכל לצפות רק במערכות שתשייך אליו.
              ניתן לנהל את המערכות לאחר יצירת המשתמש.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
          <Button 
            onClick={() => setOpenUserDialog(false)}
            sx={{ borderRadius: 2 }}
          >
            ביטול
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveUser}
            sx={{
              borderRadius: 2,
              background: 'linear-gradient(135deg, #3498db 0%, #55c6c2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2980b9 0%, #3498db 100%)'
              }
            }}
          >
            {isEditing ? 'עדכון' : 'יצירה'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog 
        open={openPasswordDialog} 
        onClose={() => setOpenPasswordDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: '1px solid rgba(52, 152, 219, 0.3)'
          }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <LockResetIcon sx={{ color: '#f39c12' }} />
          איפוס סיסמה - {selectedUser?.username}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField
            fullWidth
            label="סיסמה חדשה"
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
            שים לב: המשתמש יצטרך להשתמש בסיסמה החדשה בהתחברות הבאה.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
          <Button 
            onClick={() => setOpenPasswordDialog(false)}
            sx={{ borderRadius: 2 }}
          >
            ביטול
          </Button>
          <Button
            variant="contained"
            onClick={handleResetPassword}
            sx={{
              borderRadius: 2,
              background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #e67e22 0%, #d35400 100%)'
              }
            }}
          >
            איפוס סיסמה
          </Button>
        </DialogActions>
      </Dialog>

      {/* Systems Management Dialog */}
      <Dialog 
        open={openSystemsDialog} 
        onClose={() => { setOpenSystemsDialog(false); setSystemSearchTerm(''); }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: '1px solid rgba(52, 152, 219, 0.3)'
          }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <ComputerIcon sx={{ color: '#55c6c2' }} />
          ניהול מערכות - {selectedUser?.username}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            בחר את המערכות שהמשתמש יוכל לצפות בהן:
          </Typography>
          
          {/* Search box for systems */}
          <TextField
            fullWidth
            placeholder="חיפוש מערכת..."
            value={systemSearchTerm}
            onChange={(e) => setSystemSearchTerm(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#7f8c8d' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: '#fff'
              },
              '& .MuiOutlinedInput-input': {
                color: '#000000'
              },
              '& .MuiInputBase-input::placeholder': {
                color: '#7f8c8d',
                opacity: 1
              }
            }}
          />
          
          <Box sx={{ 
            maxHeight: 350, 
            overflowY: 'auto',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 2,
            p: 2
          }}>
            {allSystems
              .filter(system => 
                system.name?.toLowerCase().includes(systemSearchTerm.toLowerCase()) ||
                system.url?.toLowerCase().includes(systemSearchTerm.toLowerCase()) ||
                system.ip_address?.toLowerCase().includes(systemSearchTerm.toLowerCase())
              )
              .map(system => (
              <FormControlLabel
                key={system.id}
                control={
                  <Checkbox
                    checked={selectedSystems.includes(system.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSystems([...selectedSystems, system.id]);
                      } else {
                        setSelectedSystems(selectedSystems.filter(id => id !== system.id));
                      }
                    }}
                    sx={{ 
                      color: '#55c6c2',
                      '&.Mui-checked': { color: '#55c6c2' }
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography fontWeight={600}>{system.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {system.url || system.ip_address || 'ללא כתובת'}
                    </Typography>
                  </Box>
                }
                sx={{ 
                  width: '100%', 
                  m: 0, 
                  py: 1,
                  borderBottom: '1px solid rgba(0,0,0,0.05)',
                  '&:last-child': { borderBottom: 'none' }
                }}
              />
            ))}
            {allSystems.filter(system => 
              system.name?.toLowerCase().includes(systemSearchTerm.toLowerCase()) ||
              system.url?.toLowerCase().includes(systemSearchTerm.toLowerCase()) ||
              system.ip_address?.toLowerCase().includes(systemSearchTerm.toLowerCase())
            ).length === 0 && (
              <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                {allSystems.length === 0 ? 'אין מערכות זמינות' : 'לא נמצאו מערכות מתאימות'}
              </Typography>
            )}
          </Box>
          
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Chip
              label={`נבחרו: ${selectedSystems.length} מערכות`}
              size="small"
              sx={{ backgroundColor: 'rgba(85, 198, 194, 0.15)', color: '#55c6c2' }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
          <Button 
            onClick={() => setOpenSystemsDialog(false)}
            sx={{ borderRadius: 2 }}
          >
            ביטול
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveSystems}
            sx={{
              borderRadius: 2,
              background: 'linear-gradient(135deg, #55c6c2 0%, #3498db 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)'
              }
            }}
          >
            שמירה
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default UserManagementPage;

