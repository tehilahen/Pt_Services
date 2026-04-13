import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  CircularProgress,
  IconButton,
  Fade
} from '@mui/material';
import {
  ArrowForward as ArrowBackIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import Chart from 'react-apexcharts';
import axios from 'axios';
import {
  APP_BACKGROUND_DEFAULT,
  APP_FONT_FAMILY,
  APP_TEXT_PRIMARY,
  APP_TEXT_SECONDARY,
} from '../themeTokens';

/** חומרה — נשמרת קריאה לנתונים */
const SEVERITY_COLORS = ['#DC2626', '#EA580C', '#D97706', '#16A34A'];
/** סטטוס טיפול — נגיעות tech */
const STATUS_COLORS = ['#F59E0B', '#A855F7', '#64748B', '#06B6D4'];

function DashboardPage({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [severityData, setSeverityData] = useState({ labels: [], series: [] });
  const [statusData, setStatusData] = useState({ labels: [], series: [] });
  const [topSystemsData, setTopSystemsData] = useState({ categories: [], data: [] });

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // הגדרת headers משותפים
      const headers = {
        'X-User-ID': user?.user_id?.toString() || '',
        'X-User-Type-ID': user?.user_type_id?.toString() || ''
      };

      // שליפת כל הנתונים במקביל עם Promise.all - שיפור ביצועים משמעותי
      const [statsRes, statusRes, systemsRes] = await Promise.all([
        axios.get('/api/stats', { headers }),
        axios.get('/api/stats/vulnerabilities-status', { headers }),
        axios.get('/api/systems', { headers })
      ]);

      // עיבוד סטטיסטיקות ממצאים לפי חומרה
      const breakdown = statsRes.data?.vulnerabilities?.breakdown || {};
      setSeverityData({
        labels: ['קריטיות', 'גבוהות', 'בינוניות', 'נמוכות'],
        series: [
          breakdown.Critical || 0,
          breakdown.High || 0,
          breakdown.Medium || 0,
          breakdown.Low || 0
        ]
      });

      // עיבוד סטטיסטיקות סטטוס
      const statusStats = statusRes.data?.status_stats || {};
      const statusLabels = [];
      const statusSeries = [];
      
      if (statusStats['בטיפול'] > 0) { statusLabels.push('בטיפול'); statusSeries.push(statusStats['בטיפול']); }
      if (statusStats['טופל'] > 0) { statusLabels.push('טופל'); statusSeries.push(statusStats['טופל']); }
      if (statusStats['התעלם'] > 0) { statusLabels.push('התעלם'); statusSeries.push(statusStats['התעלם']); }
      if (statusStats['סגור'] > 0) { statusLabels.push('סגור'); statusSeries.push(statusStats['סגור']); }
      
      setStatusData({ labels: statusLabels, series: statusSeries });

      // עיבוד מערכות לגרף עמודות
      const systems = systemsRes.data?.systems || [];
      const topSystems = systems
        .sort((a, b) => (b.total_vulnerabilities || b.vulnerability_count || 0) - (a.total_vulnerabilities || a.vulnerability_count || 0))
        .slice(0, 5);
      
      setTopSystemsData({
        categories: topSystems.map(sys => sys.name.length > 12 ? sys.name.substring(0, 12) + '...' : sys.name),
        data: topSystems.map(sys => sys.total_vulnerabilities || sys.vulnerability_count || 0)
      });

      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  };

  // הגדרות גרף פיי - חומרה
  const severityChartOptions = {
    chart: {
      type: 'pie',
      fontFamily: APP_FONT_FAMILY,
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
        animateGradually: {
          enabled: true,
          delay: 150
        },
        dynamicAnimation: {
          enabled: true,
          speed: 350
        }
      },
      dropShadow: {
        enabled: true,
        top: 3,
        left: 0,
        blur: 8,
        opacity: 0.15
      }
    },
    labels: severityData.labels,
    colors: SEVERITY_COLORS,
    legend: {
      position: 'bottom',
      fontFamily: APP_FONT_FAMILY,
      fontSize: '13px',
      fontWeight: 500,
      labels: {
        colors: APP_TEXT_PRIMARY
      },
      markers: {
        width: 12,
        height: 12,
        radius: 3
      }
    },
    dataLabels: {
      enabled: true,
      formatter: function(val, opts) {
        return opts.w.config.series[opts.seriesIndex];
      },
      style: {
        fontSize: '14px',
        fontFamily: APP_FONT_FAMILY,
        fontWeight: 'bold'
      },
      dropShadow: {
        enabled: false
      }
    },
    tooltip: {
      enabled: true,
      theme: 'dark',
      style: {
        fontSize: '14px',
        fontFamily: APP_FONT_FAMILY
      },
      custom: function({ series, seriesIndex, w }) {
        const label = w.globals.labels[seriesIndex];
        const value = series[seriesIndex];
        return '<div style="background: #0f172a; border: 1px solid rgba(168,85,247,0.25); color: #fff; padding: 12px 16px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); font-family: ' + APP_FONT_FAMILY + '; direction: rtl;">' +
          '<div style="font-weight: 700; font-size: 15px; margin-bottom: 6px; color: #fff;">' + label + '</div>' +
          '<div style="font-size: 18px; color: #A855F7; font-weight: 700;">' + value + ' ממצאים</div>' +
          '</div>';
      }
    },
    stroke: {
      width: 2,
      colors: ['#fff']
    },
    plotOptions: {
      pie: {
        donut: {
          size: '0%'
        },
        expandOnClick: true
      }
    },
    responsive: [{
      breakpoint: 480,
      options: {
        chart: {
          width: 300
        },
        legend: {
          position: 'bottom'
        }
      }
    }]
  };

  // הגדרות גרף דונאט - סטטוס
  const statusChartOptions = {
    chart: {
      type: 'donut',
      fontFamily: APP_FONT_FAMILY,
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800
      },
      dropShadow: {
        enabled: true,
        top: 3,
        left: 0,
        blur: 8,
        opacity: 0.15
      }
    },
    labels: statusData.labels,
    colors: STATUS_COLORS.slice(0, statusData.labels.length),
    legend: {
      position: 'bottom',
      fontFamily: APP_FONT_FAMILY,
      fontSize: '13px',
      fontWeight: 500,
      labels: {
        colors: APP_TEXT_PRIMARY
      }
    },
    dataLabels: {
      enabled: true,
      formatter: function(val, opts) {
        return opts.w.config.series[opts.seriesIndex];
      },
      style: {
        fontSize: '14px',
        fontFamily: APP_FONT_FAMILY,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      y: {
        formatter: function(val) {
          return val + ' ממצאים';
        }
      }
    },
    stroke: {
      width: 2,
      colors: ['#fff']
    },
    plotOptions: {
      pie: {
        donut: {
          size: '55%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '14px',
              fontFamily: APP_FONT_FAMILY,
              color: APP_TEXT_PRIMARY
            },
            value: {
              show: true,
              fontSize: '22px',
              fontFamily: APP_FONT_FAMILY,
              fontWeight: 700,
              color: APP_TEXT_PRIMARY
            },
            total: {
              show: true,
              label: 'סה״כ',
              fontSize: '14px',
              fontFamily: APP_FONT_FAMILY,
              color: APP_TEXT_SECONDARY,
              formatter: function(w) {
                return w.globals.seriesTotals.reduce((a, b) => a + b, 0);
              }
            }
          }
        }
      }
    }
  };

  // הגדרות גרף עמודות אנכי - מערכות
  const barChartOptions = {
    chart: {
      type: 'bar',
      fontFamily: APP_FONT_FAMILY,
      toolbar: {
        show: false
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
        animateGradually: {
          enabled: true,
          delay: 150
        }
      },
      dropShadow: {
        enabled: true,
        top: 2,
        left: 0,
        blur: 4,
        opacity: 0.1
      }
    },
    plotOptions: {
      bar: {
        horizontal: false,
        borderRadius: 8,
        columnWidth: '55%',
        distributed: true,
        dataLabels: {
          position: 'top'
        }
      }
    },
    colors: ['#A855F7', '#10B981', '#34D399', '#059669', '#6EE7B7'],
    dataLabels: {
      enabled: true,
      offsetY: -25,
      style: {
        fontSize: '14px',
        fontFamily: APP_FONT_FAMILY,
        fontWeight: 700,
        colors: [APP_TEXT_PRIMARY]
      }
    },
    legend: {
      show: false
    },
    xaxis: {
      categories: topSystemsData.categories,
      labels: {
        style: {
          fontSize: '11px',
          fontFamily: APP_FONT_FAMILY,
          colors: APP_TEXT_PRIMARY,
          fontWeight: 600
        },
        rotate: -25,
        rotateAlways: false
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      labels: {
        show: false
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    grid: {
      borderColor: 'rgba(168, 85, 247, 0.22)',
      strokeDashArray: 0,
      xaxis: {
        lines: {
          show: false
        }
      },
      yaxis: {
        lines: {
          show: true
        }
      }
    },
    tooltip: {
      enabled: true,
      theme: 'dark',
      style: {
        fontSize: '14px',
        fontFamily: APP_FONT_FAMILY
      },
      custom: function({ series, seriesIndex, dataPointIndex, w }) {
        const systemName = w.globals.labels[dataPointIndex];
        const value = series[seriesIndex][dataPointIndex];
        return '<div style="background: #0f172a; border: 1px solid rgba(168,85,247,0.25); color: #fff; padding: 12px 16px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); font-family: ' + APP_FONT_FAMILY + '; direction: rtl;">' +
          '<div style="font-weight: 700; font-size: 15px; margin-bottom: 6px; color: #fff;">' + systemName + '</div>' +
          '<div style="font-size: 18px; color: #A855F7; font-weight: 700;">' + value + ' ממצאים</div>' +
          '</div>';
      }
    }
  };

  const barChartSeries = [{
    name: 'ממצאים',
    data: topSystemsData.data
  }];

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress 
          size={60} 
          sx={{ 
            color: '#A855F7',
            '& .MuiCircularProgress-circle': {
              strokeLinecap: 'round',
            }
          }} 
        />
        <Typography variant="h6" sx={{ mt: 2, color: APP_TEXT_PRIMARY }}>
          טוען דאשבורד...
        </Typography>
      </Container>
    );
  }

  const paperChartSx = {
    p: 3,
    height: 380,
    backgroundColor: '#fff',
    borderRadius: '14px',
    border: '1px solid #E2E8F0',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    '&:hover': {
      boxShadow: '0 8px 28px rgba(168, 85, 247, 0.12)',
      transform: 'translateY(-2px)',
    },
  };

  return (
    <Box sx={{
      height: 'fit-content',
      background: APP_BACKGROUND_DEFAULT,
    }}>
      <Container maxWidth="xl" sx={{ py: 3, position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <Fade in={true} timeout={600}>
          <Box sx={{ mb: 3 }}>
            <Box display="flex" alignItems="center" mb={1}>
              <IconButton 
                onClick={() => navigate(-1)} 
                sx={{ 
                  color: APP_TEXT_SECONDARY,
                  mr: 2,
                  '&:hover': { color: '#A855F7', backgroundColor: 'rgba(168, 85, 247, 0.1)' }
                }}
              >
                <ArrowBackIcon />
              </IconButton>
              <SecurityIcon sx={{ fontSize: 36, color: '#A855F7', mr: 1.5 }} />
              <Typography 
                variant="h4" 
                component="h1" 
                sx={{ 
                  fontWeight: 800,
                  color: APP_TEXT_PRIMARY,
                  letterSpacing: '-0.5px'
                }}
              >
                דאשבורד
              </Typography>
            </Box>
          </Box>
        </Fade>

        {/* Charts Grid */}
        <Grid container spacing={3}>
          {/* גרף A - פיי חומרה */}
          <Grid item xs={12} md={4}>
            <Fade in={true} timeout={800}>
              <Paper sx={paperChartSx}>
                <Typography 
                  variant="h6" 
                  component="h2" 
                  sx={{ 
                    mb: 1, 
                    textAlign: 'center',
                    fontWeight: 700,
                    color: APP_TEXT_PRIMARY,
                    fontSize: '1rem'
                  }}
                >
                  התפלגות ממצאים לפי חומרה
                </Typography>
                <Chart
                  options={severityChartOptions}
                  series={severityData.series}
                  type="pie"
                  height={310}
                />
              </Paper>
            </Fade>
          </Grid>

          {/* גרף B - דונאט סטטוס */}
          <Grid item xs={12} md={4}>
            <Fade in={true} timeout={1000}>
              <Paper sx={paperChartSx}>
                <Typography 
                  variant="h6" 
                  component="h2" 
                  sx={{ 
                    mb: 1, 
                    textAlign: 'center',
                    fontWeight: 700,
                    color: APP_TEXT_PRIMARY,
                    fontSize: '1rem'
                  }}
                >
                  סטטוס טיפול בממצאים
                </Typography>
                {statusData.series.length > 0 ? (
                  <Chart
                    options={statusChartOptions}
                    series={statusData.series}
                    type="donut"
                    height={310}
                  />
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 310 }}>
                    <Typography sx={{ color: APP_TEXT_SECONDARY }}>אין נתונים להצגה</Typography>
                  </Box>
                )}
              </Paper>
            </Fade>
          </Grid>

          {/* גרף C - עמודות מערכות */}
          <Grid item xs={12} md={4}>
            <Fade in={true} timeout={1200}>
              <Paper sx={paperChartSx}>
                <Typography 
                  variant="h6" 
                  component="h2" 
                  sx={{ 
                    mb: 1, 
                    textAlign: 'center',
                    fontWeight: 700,
                    color: APP_TEXT_PRIMARY,
                    fontSize: '1rem'
                  }}
                >
                  טופ 5 מערכות לפי ממצאים
                </Typography>
                {topSystemsData.data.length > 0 ? (
                  <Chart
                    options={barChartOptions}
                    series={barChartSeries}
                    type="bar"
                    height={310}
                  />
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 310 }}>
                    <Typography sx={{ color: APP_TEXT_SECONDARY }}>אין נתונים להצגה</Typography>
                  </Box>
                )}
              </Paper>
            </Fade>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default DashboardPage;
