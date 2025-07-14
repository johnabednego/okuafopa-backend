const cors = require('cors');

// Load allowed origins from .env
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [];

const corsOptions = {
  origin: true, // Let custom middleware handle dynamic origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Okuafopa-api-key', 'x-requested-with'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

const customCors = (req, res, next) => {
  const origin = req.headers.origin;

  // 1. Allow requests without Origin header (browser visit, same-origin, curl, etc.)
  if (!origin) {
    return cors(corsOptions)(req, res, next);
  }

  // 2. Validate cross-origin request origin
  if (!allowedOrigins.includes(origin)) {
    return res.status(403).json({
      message: `CORS policy does not allow access from origin: ${origin}`,
    });
  }

  // 3. Allow valid cross-origin request
  return cors({ ...corsOptions, origin })(req, res, next);
};

module.exports = customCors;
