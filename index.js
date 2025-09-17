require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const socketService = require('./services/socket');
const customCors = require('./middleware/customCors');
const connectDB = require('./config/db');
const setupSwaggerDocs = require('./config/swaggerUiConfig');
const auditLogRoutes = require('./routes/auditLogRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const productCategoryRoutes = require('./routes/productCategoryRoutes');
const productListingRoutes = require('./routes/productListingRoutes');
const productItemRoutes = require('./routes/productItemRoutes');
const orderRoutes = require('./routes/orderRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const messageRoutes = require('./routes/messageRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const adminRoutes = require('./routes/adminRoutes')


// Initialize app
const server = express();

// Security headers
server.use(helmet());

// Connect to MongoDB
connectDB();

// CORS
if (!process.env.ALLOWED_ORIGINS) {
  throw new Error('ALLOWED_ORIGINS environment variable is required');
}
server.use(customCors);

// HTTP request logging with Morgan
// 'combined' gives us Apache-style logs whiles 'dev' gives us a concise colored output
server.use(morgan('dev'));

// Body parsing middleware
server.use(express.json({ limit: '10mb' }));

// Swagger docs (non-production only)
if (process.env.NODE_ENV !== 'production') {
  setupSwaggerDocs(server);
}

// Mount auditLog routes
server.use('/api/audit-logs', auditLogRoutes);
// Mount user routes
server.use('/api/users', userRoutes);
// Mount auth routes
server.use('/api/auth', authRoutes);
// Mount product-categories routes
server.use('/api/product-categories', productCategoryRoutes);
// Mount product-listings routes
server.use('/api/product-listings', productListingRoutes);
// Mount product-items routes
server.use('/api/product-items', productItemRoutes);
// Mount order routes
server.use('/api/orders', orderRoutes);
// Mount transaction routes
server.use('/api/transactions', transactionRoutes);
// Mount message routes
server.use('/api/messages', messageRoutes);
// Mount feedback routes
server.use('/api/feedbacks', feedbackRoutes);
// Admin
server.use('/api/admin', adminRoutes)


// Example root route
server.get('/', (req, res) => {
  res.send('Server is Up and Running!');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Gracefully shutting down...');
  server.close(() => {
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


const app = http.createServer(server);
socketService.init(app);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;

