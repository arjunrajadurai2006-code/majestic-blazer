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

// Robust CORS configuration with support for official domains and Vercel deployments
const allowedOriginPatterns = [
  /^https:\/\/majestic-blazer.*\.vercel\.app$/,
  /^https:\/\/.*\.majesticblazer\.com$/,
  /^https:\/\/majesticblazer\.com$/,
  /^http:\/\/localhost:(5173|5174|3000|5000)$/,
  /^http:\/\/127\.0\.0\.1:(5173|5174|3000|5000)$/,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // In production, reject any origin that is not explicitly allowed
      if (env.isProd) {
        if (env.corsOrigins.includes(origin) || allowedOriginPatterns.some((pattern) => pattern.test(origin))) {
          return callback(null, true);
        }
        return callback(new Error(`CORS policy: Origin ${origin} not allowed by CORS`), false);
      }

      // In non-production or development, allow localhost/patterns or configured origins
      if (allowedOriginPatterns.some((pattern) => pattern.test(origin)) || env.corsOrigins.includes(origin) || env.corsOrigins.length === 0) {
        return callback(null, true);
      }

      return callback(new Error(`CORS policy: Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
  })
);

if (!env.isProd) app.use(morgan('dev'));

// Rate Limiting to prevent DoS & brute-force attacks
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // limit login/register attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts, please try again after 15 minutes' },
});

app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/admin/login', authLimiter);

// Serve uploaded product photography statically
app.use('/uploads', express.static(uploadsDir));

// Razorpay webhook signature verification needs the raw body: keep this BEFORE express.json().
app.use('/api/payments/razorpay/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
