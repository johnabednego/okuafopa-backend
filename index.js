require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const customCors = require('./middleware/customCors');
const connectDB = require('./config/db');
const setupSwaggerDocs = require('./config/swaggerUiConfig');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');



// Initialize app
const app = express();

// Security headers
app.use(helmet());

// Connect to MongoDB
connectDB();

// CORS
if (!process.env.ALLOWED_ORIGINS) {
  throw new Error('ALLOWED_ORIGINS environment variable is required');
}
app.use(customCors);

// HTTP request logging with Morgan
// 'combined' gives us Apache-style logs whiles 'dev' gives us a concise colored output
app.use(morgan('dev'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));

// Swagger docs (non-production only)
if (process.env.NODE_ENV !== 'production') {
  setupSwaggerDocs(app);
}

// Mount user routes
app.use('/api/users', userRoutes);
// Mount auth routes
app.use('/api/auth', authRoutes);
// Mount product routes
app.use('/api/products', productRoutes);
// Mount order routes
app.use('/api/orders', orderRoutes);
// Mount auditLog routes
app.use('/api/audit-logs', auditLogRoutes);


// Example root route
app.get('/', (req, res) => {
  res.send('Server is Up and Running!');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Gracefully shutting down...');
  app.close(() => {
    console.log('Closed out remaining connections');
    process.exit(0);
  });
});

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
