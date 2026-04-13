import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Button,
  Chip,
  Paper,
  IconButton,
  Collapse,
  FormControl,
  Select,
  MenuItem
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Code as CodeIcon
} from '@mui/icons-material';

const severityColors = {
  Critical: { main: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  High: { main: '#ea580c', bg: '#fff7ed', border: '#fdba74' },
  Medium: { main: '#ca8a04', bg: '#fefce8', border: '#fde047' },
  Low: { main: '#2563eb', bg: '#eff6ff', border: '#93c5fd' }
};

const riskMatrix = {
  Critical: { Low: 'High', Medium: 'Critical', High: 'Critical', 'Very High': 'Critical' },
  High: { Low: 'Medium', Medium: 'High', High: 'Critical', 'Very High': 'Critical' },
  Medium: { Low: 'Low', Medium: 'Medium', High: 'High', 'Very High': 'High' },
  Low: { Low: 'Low', Medium: 'Low', High: 'Medium', 'Very High': 'Medium' }
};

function CodeReviewDetailPage({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [review, setReview] = useState(null);
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedFindings, setExpandedFindings] = useState(new Set());
  const [severityCounts, setSeverityCounts] = useState({ Critical: 0, High: 0, Medium: 0, Low: 0 });

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    // Auto-expand critical findings
    const criticalIds = findings
      .filter(f => f.severity === 'Critical')
      .map(f => f.finding_id);
    setExpandedFindings(new Set(criticalIds));
  }, [findings]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [reviewRes, findingsRes] = await Promise.all([
        fetch(`/api/code-reviews/${id}`, { headers }),
        fetch(`/api/code-reviews/${id}/findings`, { headers })
      ]);

      const reviewData = await reviewRes.json();
      const findingsData = await findingsRes.json();

      if (reviewData.success) {
        setReview(reviewData.review);
      } else {
        setError('Code review not found');
      }

      if (findingsData.success) {
        setFindings(findingsData.findings || []);
        setSeverityCounts(findingsData.severity_counts || { Critical: 0, High: 0, Medium: 0, Low: 0 });
      }
    } catch (err) {
      console.error('Error fetching code review:', err);
      setError('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const toggleFinding = (findingId) => {
    setExpandedFindings(prev => {
      const next = new Set(prev);
      if (next.has(findingId)) {
        next.delete(findingId);
      } else {
        next.add(findingId);
      }
      return next;
    });
  };

  const updateFindingStatus = async (findingId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/code-reviews/findings/${findingId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setFindings(prev => prev.map(f =>
          f.finding_id === findingId ? { ...f, status: newStatus } : f
        ));
      }
    } catch (err) {
      console.error('Error updating finding status:', err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const scrollToSeverity = (severity) => {
    const first = findings.find(f => f.severity === severity);
    if (first) {
      setExpandedFindings(prev => new Set(prev).add(first.finding_id));
      setTimeout(() => {
        document.getElementById(`finding-${first.finding_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };

  const scrollToFinding = (findingId) => {
    setExpandedFindings(prev => new Set(prev).add(findingId));
    setTimeout(() => {
      document.getElementById(`finding-${findingId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleDownload = () => {
    const token = localStorage.getItem('token');
    window.open(`/api/code-reviews/${id}/report/download?token=${token}`, '_blank');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: '#3498DB' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
        <Button onClick={() => navigate('/code-reviews')} sx={{ mt: 2 }}>Back to Reviews</Button>
      </Box>
    );
  }

  const total = findings.length;

  // Normalize status for remediation stats (match report: fixed / partial / open)
  const norm = (s) => {
    if (!s) return 'open';
    const t = String(s).toLowerCase();
    if (['fixed', 'closed', 'טופל', 'סגור', 'ignored'].some(x => t.includes(x))) return 'fixed';
    if (['partial', 'partially fixed', 'partially'].some(x => t.includes(x))) return 'partial';
    return 'open';
  };

  const statusCounts = { fixed: 0, partial: 0, open: 0 };
  const severityStatus = {
    Critical: { fixed: 0, partial: 0, open: 0 },
    High: { fixed: 0, partial: 0, open: 0 },
    Medium: { fixed: 0, partial: 0, open: 0 },
    Low: { fixed: 0, partial: 0, open: 0 }
  };
  findings.forEach((f) => {
    const st = norm(f.status);
    const sev = severityStatus[f.severity] ? f.severity : 'Medium';
    statusCounts[st]++;
    severityStatus[sev][st]++;
  });

  const formatDateForState = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <Box dir="ltr" sx={{ height: '100%', overflow: 'auto', backgroundColor: '#f8fafc', direction: 'ltr', textAlign: 'left', scrollBehavior: 'smooth' }}>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* Back Button */}
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/code-reviews')}
          sx={{ mb: 2, color: '#64748b' }}
        >
          Back to Reviews
        </Button>

        {/* Report Header */}
        <Paper sx={{
          background: 'linear-gradient(135deg, #0c3058 0%, #1e40af 100%)',
          color: 'white',
          p: { xs: 3, md: 5 },
          borderRadius: 4,
          mb: 4,
          boxShadow: '0 4px 24px rgba(12, 48, 88, 0.15)'
        }}>
          {review?.version != null && (
            <Box sx={{ display: 'inline-block', background: 'rgba(255,255,255,0.18)', px: 1.5, py: 0.4, borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: 0.5, mb: 2 }}>
              VERSION {review.version}.0
            </Box>
          )}
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: 'white' }}>
            Security Code Review Report
          </Typography>
          <Typography sx={{ opacity: 0.85, mb: 3, color: 'white' }}>
            {review?.system_name} &mdash; {review?.branch || 'master'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', fontSize: '14px', opacity: 0.9 }}>
            <span>Date: {formatDate(review?.created_at)}</span>
            <span>Task ID: {review?.task_id}</span>
            <span>Total Findings: {total}</span>
          </Box>
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' } }}
            >
              Download HTML Report
            </Button>
          </Box>
        </Paper>

        {/* Summary Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 2, mb: 2 }}>
          <SummaryCard label="Total" count={total} color="#0c3058" isTotal onClick={() => document.getElementById('summary-table')?.scrollIntoView({ behavior: 'smooth' })} />
          <SummaryCard label="Critical" count={severityCounts.Critical} color="#dc2626" onClick={() => scrollToSeverity('Critical')} />
          <SummaryCard label="High" count={severityCounts.High} color="#ea580c" onClick={() => scrollToSeverity('High')} />
          <SummaryCard label="Medium" count={severityCounts.Medium} color="#ca8a04" onClick={() => scrollToSeverity('Medium')} />
          <SummaryCard label="Low" count={severityCounts.Low} color="#2563eb" onClick={() => scrollToSeverity('Low')} />
        </Box>

        {/* Current Remediation State */}
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c3058', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>
          Current Remediation State (as of {formatDateForState(review?.created_at) || '—'})
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 2, mb: 4 }}>
          <RemediationCard
            label="טופלו (Fixed)"
            mainValue={statusCounts.fixed}
            total={total}
            mainColor="#16a34a"
            borderHighlight
          />
          {['Critical', 'High', 'Medium', 'Low'].map((sev) => {
            const ss = severityStatus[sev];
            const totalSev = ss.fixed + ss.partial + ss.open;
            return (
              <RemediationCard
                key={sev}
                label={`${sev} Remaining`}
                mainValue={ss.fixed}
                total={totalSev}
                mainColor={severityColors[sev]?.main ?? '#64748b'}
              />
            );
          })}
        </Box>

        {/* Risk Matrix */}
        <Paper sx={{ borderRadius: 3, mb: 4, overflow: 'hidden', border: '1px solid #e2e8f0', backgroundColor: 'white' }}>
          <Typography sx={{ fontWeight: 700, color: '#0c3058', p: 2, borderBottom: '2px solid #0c3058', fontSize: '1.2rem' }}>
            Risk Assessment Matrix
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0c3058', color: 'white' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', letterSpacing: '0.5px' }}>IMPACT / PROBABILITY</th>
                  {['Low', 'Medium', 'High', 'Very High'].map(p => (
                    <th key={p} style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', letterSpacing: '0.5px' }}>{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['Critical', 'High', 'Medium', 'Low'].map(impact => (
                  <tr key={impact}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, background: '#f8fafc', textAlign: 'left', border: '1px solid #e2e8f0' }}>{impact}</td>
                    {['Low', 'Medium', 'High', 'Very High'].map(prob => {
                      const val = riskMatrix[impact][prob];
                      const c = severityColors[val] || severityColors.Medium;
                      return (
                        <td key={prob} style={{ padding: '12px 16px', textAlign: 'center', background: c.bg, color: c.main, fontWeight: 700, border: '1px solid #e2e8f0' }}>
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Paper>

        {/* Table of Contents */}
        {findings.length > 0 && (
          <Paper sx={{ borderRadius: 3, mb: 4, p: 3, border: '1px solid #e2e8f0', backgroundColor: 'white' }}>
            <Typography sx={{ fontWeight: 700, color: '#0c3058', mb: 2, fontSize: '1.1rem' }}>Table of Contents</Typography>
            <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
              {findings.map(f => {
                const sc = severityColors[f.severity] || severityColors.Medium;
                return (
                  <Box component="li" key={f.finding_id} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, py: 0.8,
                    borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                    '&:hover': { backgroundColor: '#f8fafc' }
                  }}
                    onClick={() => {
                      setExpandedFindings(prev => new Set(prev).add(f.finding_id));
                      document.getElementById(`finding-${f.finding_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  >
                    <Chip label={f.severity?.substring(0, 4).toUpperCase()} size="small"
                      sx={{ backgroundColor: sc.main, color: 'white', fontWeight: 700, fontSize: '0.65rem', height: 22, minWidth: 48 }} />
                    <Typography sx={{ fontSize: '0.9rem', color: '#1e293b' }}>
                      {f.finding_code}: {f.title}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        )}

        {/* Findings */}
        <Typography sx={{ fontWeight: 700, color: '#0c3058', mb: 2, fontSize: '1.3rem', borderBottom: '2px solid #0c3058', pb: 1 }}>
          Detailed Findings
        </Typography>

        {findings.map(f => {
          const sc = severityColors[f.severity] || severityColors.Medium;
          const isOpen = expandedFindings.has(f.finding_id);
          const tags = f.tags ? (typeof f.tags === 'string' ? f.tags.split(',').map(t => t.trim()).filter(Boolean) : f.tags) : [];

          return (
            <Paper key={f.finding_id} id={`finding-${f.finding_id}`} sx={{
              borderRadius: 3, mb: 2, overflow: 'hidden',
              border: '1px solid #e2e8f0', backgroundColor: 'white',
              transition: 'box-shadow 0.2s',
              '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }
            }}>
              {/* Finding Header */}
              <Box onClick={() => toggleFinding(f.finding_id)} sx={{
                display: 'flex', alignItems: 'flex-start', gap: 2,
                p: '20px 24px', cursor: 'pointer', userSelect: 'none',
                '&:hover': { backgroundColor: '#f8fafc' }
              }}>
                <Chip label={f.severity} size="small"
                  sx={{ backgroundColor: sc.main, color: 'white', fontWeight: 700, fontSize: '0.7rem', mt: 0.3 }} />
                <Typography sx={{ flex: 1, fontWeight: 600, fontSize: '1rem', color: '#1e293b' }}>
                  {f.title}
                </Typography>
                <Chip label={f.finding_code} size="small" variant="outlined"
                  sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', mt: 0.3 }} />
                <IconButton size="small" sx={{ mt: -0.5 }}>
                  {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>

              {/* Finding Body */}
              <Collapse in={isOpen}>
                <Box sx={{ px: 3, pb: 3, borderTop: '1px solid #e2e8f0' }}>
                  {/* Meta */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.5, my: 2, p: 2, backgroundColor: '#f8fafc', borderRadius: 2 }}>
                    <MetaItem label="Severity" value={f.severity} />
                    <MetaItem label="Risk" value={f.risk} />
                    <MetaItem label="Probability" value={f.probability} />
                    {f.file_path && <MetaItem label="File" value={`${f.file_path}${f.line_number ? ` (line ${f.line_number})` : ''}`} />}
                    <Box>
                      <Typography sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.3 }}>
                        Status
                      </Typography>
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <Select
                          value={f.status || 'Open'}
                          onChange={(e) => updateFindingStatus(f.finding_id, e.target.value)}
                          sx={{ fontSize: '0.85rem', height: 32 }}
                        >
                          <MenuItem value="Open">Open</MenuItem>
                          <MenuItem value="In Progress">In Progress</MenuItem>
                          <MenuItem value="Fixed">Fixed</MenuItem>
                          <MenuItem value="Ignored">Ignored</MenuItem>
                          <MenuItem value="Closed">Closed</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  </Box>

                  {/* Description */}
                  <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.7, mb: 2, color: '#334155' }}>
                    {f.description}
                  </Typography>

                  {/* Code Snippet */}
                  {f.code_snippet && (
                    <Box sx={{ mb: 2 }}>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', mb: 1 }}>
                        Vulnerable Code
                      </Typography>
                      <Box sx={{
                        backgroundColor: '#1e293b', color: '#e2e8f0', p: 2, borderRadius: 2,
                        fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
                        fontSize: '0.8rem', overflowX: 'auto', whiteSpace: 'pre', lineHeight: 1.6
                      }}>
                        {f.file_path && (
                          <Box sx={{ color: '#94a3b8', fontSize: '0.7rem', borderBottom: '1px solid #334155', pb: 0.8, mb: 1 }}>
                            {f.file_path}
                          </Box>
                        )}
                        {f.code_snippet}
                      </Box>
                    </Box>
                  )}

                  {/* Recommendation */}
                  {f.recommendation && (
                    <Box sx={{ mb: 2 }}>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', mb: 1 }}>
                        Recommendation
                      </Typography>
                      <Box sx={{
                        backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2,
                        p: 2, fontSize: '0.85rem', color: '#166534', lineHeight: 1.6
                      }}>
                        {f.recommendation}
                      </Box>
                    </Box>
                  )}

                  {/* Tags */}
                  {tags.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', mt: 1 }}>
                      {tags.map((tag, idx) => (
                        <Chip key={idx} label={tag} size="small" variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 24, color: '#64748b', borderColor: '#e2e8f0' }} />
                      ))}
                    </Box>
                  )}
                </Box>
              </Collapse>
            </Paper>
          );
        })}

        {/* Summary Table */}
        {findings.length > 0 && (
          <Paper id="summary-table" sx={{ borderRadius: 3, mt: 4, overflow: 'hidden', border: '1px solid #e2e8f0', backgroundColor: 'white' }}>
            <Typography sx={{ fontWeight: 700, color: '#0c3058', p: 2, borderBottom: '2px solid #0c3058', fontSize: '1.2rem' }}>
              Summary & Prioritized Remediation Plan
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0c3058', color: 'white' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Priority</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>ID</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Finding</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Severity</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Risk</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Probability</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map((f, idx) => {
                    const sc = severityColors[f.severity] || severityColors.Medium;
                    return (
                      <tr key={f.finding_id} onClick={() => scrollToFinding(f.finding_id)} style={{ background: sc.bg, cursor: 'pointer', transition: 'filter 0.15s' }} onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.93)'} onMouseLeave={e => e.currentTarget.style.filter = ''}>
                        <td style={{ padding: '10px 16px', fontWeight: 700 }}>{idx + 1}</td>
                        <td style={{ padding: '10px 16px' }}>{f.finding_code}</td>
                        <td style={{ padding: '10px 16px' }}>{f.title}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', color: sc.main, fontWeight: 700 }}>{f.severity}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>{f.risk}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>{f.probability}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Box>
          </Paper>
        )}

        {/* Footer */}
        <Box sx={{ textAlign: 'center', py: 4, color: '#64748b', fontSize: '0.85rem', borderTop: '1px solid #e2e8f0', mt: 4 }}>
          <Typography sx={{ fontWeight: 600, color: '#475569' }}>Security Code Review Report</Typography>
          <Typography sx={{ fontSize: '0.8rem' }}>
            Generated through automated AI-powered source code analysis using Cursor CLI
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', mt: 1, color: '#94a3b8' }}>
            Task ID: {review?.task_id} | Repository: {review?.repo_url} | Branch: {review?.branch}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

function SummaryCard({ label, count, color, isTotal, onClick }) {
  return (
    <Paper onClick={onClick} sx={{
      borderRadius: 3, p: 3, textAlign: 'center',
      border: isTotal ? `2px solid ${color}` : '1px solid #e2e8f0',
      backgroundColor: 'white',
      cursor: 'pointer',
      transition: 'transform 0.2s',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }
    }}>
      <Typography sx={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1, color }}>{count}</Typography>
      <Typography sx={{ fontSize: '0.8rem', color: '#64748b', mt: 0.8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</Typography>
    </Paper>
  );
}

function RemediationCard({ label, mainValue, total, mainColor, borderHighlight }) {
  return (
    <Paper sx={{
      borderRadius: 3, p: 3, textAlign: 'center',
      border: borderHighlight ? `2px solid ${mainColor}` : '1px solid #e2e8f0',
      backgroundColor: 'white',
      transition: 'transform 0.2s',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }
    }}>
      <Typography sx={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1, color: mainColor }}>
        {mainValue}/{total}
      </Typography>
      <Typography sx={{ fontSize: '0.8rem', color: '#64748b', mt: 0.8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</Typography>
    </Paper>
  );
}

function MetaItem({ label, value }) {
  return (
    <Box>
      <Typography sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.3 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.85rem', color: '#1e293b' }}>{value}</Typography>
    </Box>
  );
}

export default CodeReviewDetailPage;
