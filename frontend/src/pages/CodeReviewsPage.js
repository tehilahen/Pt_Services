import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Alert,
  CircularProgress,
  IconButton,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse
} from '@mui/material';
import { APP_BORDER_BLUE } from '../themeTokens';
import {
  tableContainerPaperSx,
  tableHeadCellSx,
  tableHeadCellSortableSx,
  tableNestedHeadCellSx,
  tableBodyRowSx,
  tableStickyRtlSx
} from '../tableStyles';
import {
  Code as CodeIcon,
  Visibility as ViewIcon,
  Schedule as ScheduleIcon,
  BugReport as BugIcon,
  Computer as ComputerIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

function CodeReviewsPage({ user }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [page, setPage] = useState(0);
  const [filterSystem, setFilterSystem] = useState('');
  const [expandedSystems, setExpandedSystems] = useState({});
  const rowsPerPage = 8;
  const navigate = useNavigate();

  useEffect(() => {
    fetchReviews();
  }, [user]);

  useEffect(() => {
    const hasRunning = reviews.some(r => r.status === 'Queued' || r.status === 'Running');
    if (!hasRunning) return;

    const interval = setInterval(fetchReviews, 10000);
    return () => clearInterval(interval);
  }, [reviews]);

  const fetchReviews = async () => {
    try {
      setLoading(prev => reviews.length === 0 ? true : prev);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/code-reviews', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (data.success) {
        setReviews(data.reviews || []);
        setError('');
      } else {
        setError(data.message || 'שגיאה בטעינת סריקות קוד');
      }
    } catch (err) {
      console.error('שגיאה בטעינת סריקות קוד:', err);
      setError('שגיאה בחיבור לשרת');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Succeeded': return '#16A34A';
      case 'Running': return '#A855F7';
      case 'Queued': return '#f77f3c';
      case 'Failed': return '#aa0a21';
      default: return '#7f8c8d';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'Succeeded': return 'הושלם';
      case 'Running': return 'פועל';
      case 'Queued': return 'בתור';
      case 'Failed': return 'נכשל';
      default: return status || 'לא ידוע';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const uniqueSystems = useMemo(() => {
    const systems = [...new Set(reviews.map(r => r.system_name))].filter(Boolean);
    return systems.sort((a, b) => a.localeCompare(b, 'he'));
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    let result = reviews;
    if (filterSystem) {
      result = result.filter(r => r.system_name === filterSystem);
    }
    return result;
  }, [reviews, filterSystem]);

  const groupedSystems = useMemo(() => {
    const groups = {};
    filteredReviews.forEach(review => {
      const key = review.system_name || 'לא ידוע';
      if (!groups[key]) {
        groups[key] = {
          system_name: key,
          system_id: review.system_id,
          reviews: []
        };
      }
      groups[key].reviews.push(review);
    });

    Object.values(groups).forEach(group => {
      group.reviews.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      group.total_scans = group.reviews.length;
      group.latest_reviews = group.reviews.slice(0, 5);
      group.latest_review = group.reviews[0];
      group.has_running = group.reviews.some(r => r.status === 'Running' || r.status === 'Queued');
    });

    let systemsList = Object.values(groups);

    if (sortBy === 'name') {
      systemsList.sort((a, b) => {
        const nameA = (a.system_name || '').toLowerCase();
        const nameB = (b.system_name || '').toLowerCase();
        return sortDirection === 'asc' ? nameA.localeCompare(nameB, 'he') : nameB.localeCompare(nameA, 'he');
      });
    } else if (sortBy === 'date') {
      systemsList.sort((a, b) => {
        const dateA = new Date(a.latest_review?.created_at || 0);
        const dateB = new Date(b.latest_review?.created_at || 0);
        return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
      });
    }

    return systemsList;
  }, [filteredReviews, sortBy, sortDirection]);

  const paginatedSystems = groupedSystems.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const totalPages = Math.ceil(groupedSystems.length / rowsPerPage);

  const toggleExpand = (systemName) => {
    setExpandedSystems(prev => ({ ...prev, [systemName]: !prev[systemName] }));
  };

  const handleSortByName = () => {
    if (sortBy === 'name') {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy('name');
      setSortDirection('asc');
    }
  };

  const handleSortByDate = () => {
    if (sortBy === 'date') {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy('date');
      setSortDirection('desc');
    }
  };

  const renderFindingsChips = (review) => {
    const totalFindings = (review.critical_count || 0) + (review.high_count || 0) + (review.medium_count || 0) + (review.low_count || 0);
    if (review.status === 'Succeeded' && totalFindings > 0) {
      return (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
          {review.critical_count > 0 && (
            <Chip label={`${review.critical_count} קריטי`} size="small"
              sx={{ backgroundColor: '#fef2f2', color: '#dc2626', fontWeight: 600, fontSize: '0.7rem' }} />
          )}
          {review.high_count > 0 && (
            <Chip label={`${review.high_count} גבוה`} size="small"
              sx={{ backgroundColor: '#fff7ed', color: '#ea580c', fontWeight: 600, fontSize: '0.7rem' }} />
          )}
          {review.medium_count > 0 && (
            <Chip label={`${review.medium_count} בינוני`} size="small"
              sx={{ backgroundColor: '#fefce8', color: '#ca8a04', fontWeight: 600, fontSize: '0.7rem' }} />
          )}
          {review.low_count > 0 && (
            <Chip label={`${review.low_count} נמוך`} size="small"
              sx={{ backgroundColor: '#e8f4fc', color: '#A855F7', fontWeight: 600, fontSize: '0.7rem' }} />
          )}
        </Box>
      );
    }
    if (review.status === 'Succeeded') {
      return <Typography sx={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>0</Typography>;
    }
    return <Typography sx={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>-</Typography>;
  };

  if (loading && reviews.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: '#A855F7' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 3, backgroundColor: '#ffffff' }}>
      <Container maxWidth="xl" sx={{ py: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CodeIcon sx={{ fontSize: 32, color: '#A855F7' }} />
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1a1a2e' }}>
              סריקות קוד
            </Typography>
            <Chip
              label={`${groupedSystems.length} מערכות`}
              size="small"
              sx={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#A855F7', fontWeight: 600 }}
            />
            <Chip
              label={`${filteredReviews.length} סריקות`}
              size="small"
              sx={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#A855F7', fontWeight: 600 }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel sx={{ color: '#64748b' }}>סינון לפי מערכת</InputLabel>
              <Select
                value={filterSystem}
                onChange={(e) => { setFilterSystem(e.target.value); setPage(0); }}
                label="סינון לפי מערכת"
                sx={{ backgroundColor: 'white', borderRadius: 2 }}
              >
                <MenuItem value="">הכל</MenuItem>
                {uniqueSystems.map(sys => (
                  <MenuItem key={sys} value={sys}>{sys}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <IconButton onClick={fetchReviews} sx={{ color: '#A855F7' }}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>
        )}

        {/* Table */}
        <TableContainer component={Paper} sx={tableContainerPaperSx}>
          <Table sx={tableStickyRtlSx}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...tableHeadCellSx, width: 50 }} />
                <TableCell sx={tableHeadCellSortableSx}
                  onClick={handleSortByName}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ComputerIcon sx={{ fontSize: 18 }} />
                    מערכת
                    {sortBy === 'name' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                  </Box>
                </TableCell>
                <TableCell sx={{ ...tableHeadCellSx, textAlign: 'center' }}>
                  כמות סריקות
                </TableCell>
                <TableCell sx={tableHeadCellSortableSx}
                  onClick={handleSortByDate}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ScheduleIcon sx={{ fontSize: 18 }} />
                    סריקה אחרונה
                    {sortBy === 'date' && (sortDirection === 'desc' ? <ArrowDownIcon sx={{ fontSize: 16 }} /> : <ArrowUpIcon sx={{ fontSize: 16 }} />)}
                  </Box>
                </TableCell>
                <TableCell sx={tableHeadCellSx}>סטטוס אחרון</TableCell>
                <TableCell sx={{ ...tableHeadCellSx, textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                    <BugIcon sx={{ fontSize: 18 }} />
                    ממצאים (אחרון)
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedSystems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6, color: '#94a3b8' }}>
                    <CodeIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography>לא נמצאו סריקות קוד</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSystems.map((systemGroup) => {
                  const isExpanded = expandedSystems[systemGroup.system_name] || false;
                  const latestReview = systemGroup.latest_review;

                  return (
                    <React.Fragment key={systemGroup.system_name}>
                      {/* System main row */}
                      <TableRow
                        hover
                        onClick={() => toggleExpand(systemGroup.system_name)}
                        sx={{
                          ...tableBodyRowSx,
                          cursor: 'pointer',
                          ...(isExpanded && { backgroundColor: '#f1f5f9' })
                        }}
                      >
                        <TableCell sx={{ width: 50, px: 1 }}>
                          <IconButton size="small" sx={{ color: '#64748b' }}>
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>
                              {systemGroup.system_name}
                            </Typography>
                            {systemGroup.has_running && (
                              <CircularProgress size={14} sx={{ color: '#A855F7' }} />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Chip
                            label={systemGroup.total_scans}
                            size="small"
                            sx={{
                              backgroundColor: 'rgba(168, 85, 247, 0.12)',
                              color: '#A855F7',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              minWidth: 36
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ color: '#475569', fontSize: '0.85rem' }}>
                            {formatDate(latestReview?.created_at)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {latestReview && (
                            <Chip
                              label={getStatusText(latestReview.status)}
                              size="small"
                              sx={{
                                backgroundColor: `${getStatusColor(latestReview.status)}20`,
                                color: getStatusColor(latestReview.status),
                                fontWeight: 600,
                                border: `1px solid ${getStatusColor(latestReview.status)}40`
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {latestReview && renderFindingsChips(latestReview)}
                        </TableCell>
                      </TableRow>

                      {/* Expandable rows - last 5 scans */}
                      <TableRow>
                        <TableCell sx={{ p: 0, borderBottom: isExpanded ? `1px solid ${APP_BORDER_BLUE}` : 'none' }} colSpan={6}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 1, px: 2, backgroundColor: '#fafbfc' }}>
                              <Typography sx={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, mb: 1, mr: 1 }}>
                                {systemGroup.total_scans > 5
                                  ? `5 סריקות אחרונות מתוך ${systemGroup.total_scans}`
                                  : `${systemGroup.total_scans} סריקות`}
                              </Typography>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={tableNestedHeadCellSx}>תאריך</TableCell>
                                    <TableCell sx={tableNestedHeadCellSx}>סטטוס</TableCell>
                                    <TableCell sx={tableNestedHeadCellSx}>Branch</TableCell>
                                    <TableCell sx={{ ...tableNestedHeadCellSx, textAlign: 'center' }}>ממצאים</TableCell>
                                    <TableCell sx={tableNestedHeadCellSx}>הופעל ע"י</TableCell>
                                    <TableCell sx={{ ...tableNestedHeadCellSx, textAlign: 'center' }}>פעולות</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {systemGroup.latest_reviews.map((review) => {
                                    const isRunning = review.status === 'Running' || review.status === 'Queued';
                                    return (
                                      <TableRow key={review.task_id} sx={tableBodyRowSx}>
                                        <TableCell sx={{ fontSize: '0.82rem', color: '#475569' }}>
                                          {formatDate(review.created_at)}
                                        </TableCell>
                                        <TableCell>
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            {isRunning && <CircularProgress size={12} sx={{ color: getStatusColor(review.status) }} />}
                                            <Chip
                                              label={getStatusText(review.status)}
                                              size="small"
                                              sx={{
                                                backgroundColor: `${getStatusColor(review.status)}20`,
                                                color: getStatusColor(review.status),
                                                fontWeight: 600,
                                                fontSize: '0.7rem',
                                                height: 22,
                                                border: `1px solid ${getStatusColor(review.status)}40`
                                              }}
                                            />
                                          </Box>
                                        </TableCell>
                                        <TableCell>
                                          <Typography sx={{ color: '#64748b', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                                            {review.branch || 'master'}
                                          </Typography>
                                        </TableCell>
                                        <TableCell>{renderFindingsChips(review)}</TableCell>
                                        <TableCell>
                                          <Typography sx={{ color: '#64748b', fontSize: '0.82rem' }}>
                                            {review.initiated_by_name || '-'}
                                          </Typography>
                                        </TableCell>
                                        <TableCell>
                                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                            {review.status === 'Succeeded' && (
                                              <>
                                                <IconButton
                                                  size="small"
                                                  onClick={(e) => { e.stopPropagation(); navigate(`/code-reviews/${review.task_id}`); }}
                                                  sx={{ color: '#A855F7', '&:hover': { backgroundColor: 'rgba(52,152,219,0.1)' } }}
                                                  title="צפייה בדוח"
                                                >
                                                  <ViewIcon sx={{ fontSize: 18 }} />
                                                </IconButton>
                                                <IconButton
                                                  size="small"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const token = localStorage.getItem('token');
                                                    window.open(`/api/code-reviews/${review.task_id}/report/download?token=${token}`, '_blank');
                                                  }}
                                                  sx={{ color: '#10b981', '&:hover': { backgroundColor: 'rgba(16,185,129,0.1)' } }}
                                                  title="הורדת דוח"
                                                >
                                                  <DownloadIcon sx={{ fontSize: 18 }} />
                                                </IconButton>
                                              </>
                                            )}
                                            {review.status === 'Failed' && review.error_summary && (
                                              <Typography sx={{ color: '#aa0a21', fontSize: '0.72rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                title={review.error_summary}>
                                                {review.error_summary}
                                              </Typography>
                                            )}
                                          </Box>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 2, gap: 2 }}>
            <IconButton onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} sx={{ color: '#A855F7' }}>
              <ChevronRightIcon />
            </IconButton>
            <Typography sx={{ color: '#64748b', fontSize: '0.9rem' }}>
              עמוד {page + 1} מתוך {totalPages}
            </Typography>
            <IconButton onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} sx={{ color: '#A855F7' }}>
              <ChevronLeftIcon />
            </IconButton>
          </Box>
        )}
      </Container>
    </Box>
  );
}

export default CodeReviewsPage;
