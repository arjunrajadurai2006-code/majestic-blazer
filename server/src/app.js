import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { AppError } from './utils/AppError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();

app.disable('x-powered-by');

// Security Headers with Cross-Origin Resource Policy for image assets
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Explicit CORS allowlists: strict production origins and necessary local development origins
const PRODUCTION_ORIGINS = [
  'https://majestic-blazer-id.vercel.app',
  'https://majestic-blazer.vercel.app',
  'https://majestic-blazer-miup.vercel.app',
  'https://majesticblazer.com',
  'https://www.majesticblazer.com',
];

const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8787',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:8787',
];

export const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    // In production, reject any origin that is not explicitly permitted in the production allowlist
    if (env.isProd) {
      // Localhost origins are strictly forbidden in production
      const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (isLocal) {
        return callback(new AppError(`CORS policy: Origin ${origin} not allowed by CORS`, 403), false);
      }

      const isAllowedProd =
        PRODUCTION_ORIGINS.includes(origin) ||
        env.corsOrigins.includes(origin);

      if (isAllowedProd) {
        return callback(null, true);
      }
      return callback(new AppError(`CORS policy: Origin ${origin} not allowed by CORS`, 403), false);
    }

    // In non-production / development: allow explicit production origins, local dev origins, or configured origins
    const isAllowedDev =
      PRODUCTION_ORIGINS.includes(origin) ||
      LOCAL_DEV_ORIGINS.includes(origin) ||
      env.devOrigins.includes(origin) ||
      env.corsOrigins.includes(origin);

    if (isAllowedDev) {
      return callback(null, true);
    }

    return callback(new AppError(`CORS policy: Origin ${origin} not allowed by CORS`, 403), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['Content-Disposition', 'Retry-After', 'RateLimit-Reset', 'RateLimit-Limit', 'RateLimit-Remaining'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

if (!env.isProd) app.use(morgan('dev'));

// Rate Limiting to prevent DoS & brute-force attacks
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs in production and development
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' },
  // Skip general rate limiting during automated test execution (NODE_ENV=test) to prevent IP exhaustion
  skip: () => process.env.NODE_ENV === 'test' || env.isTest,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // limit login/register attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: (req) => {
    const resetMs = req.rateLimit?.resetTime ? req.rateLimit.resetTime.getTime() - Date.now() : 15 * 60 * 1000;
    const retryAfter = Math.max(1, Math.ceil(resetMs / 1000));
    return {
      success: false,
      message: `Too many authentication attempts. Please wait ${retryAfter} seconds before trying again.`,
      retryAfter,
    };
  },
});

app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/admin/login', authLimiter);

// Serve uploaded product photography statically
app.use('/uploads', express.static(uploadsDir));

// Razorpay webhook signature verification needs the raw unparsed body: keep this BEFORE express.json().
app.use(['/api/payments/webhook', '/api/payments/razorpay/webhook'], express.raw({ type: '*/*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
