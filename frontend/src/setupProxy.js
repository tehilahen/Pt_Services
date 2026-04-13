const { createProxyMiddleware } = require('http-proxy-middleware');

// כתובת ה-API מקובץ .env (ברירת מחדל: localhost:5000)
const API_TARGET = process.env.REACT_APP_API_TARGET || 'http://localhost:5000';

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: API_TARGET,
      changeOrigin: true,
      secure: false,
      pathRewrite: {
        '^/api': '/api'
      },
      onError: (err, req, res) => {
        console.error('Proxy Error:', err);
        // אם השרת לא זמין, נחזיר תגובה ריקה
        if (!res.headersSent) {
          res.status(503).json({ error: 'Server unavailable' });
        }
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log('Proxying:', req.method, req.url, '->', proxyReq.path);
      }
    })
  );
}; 