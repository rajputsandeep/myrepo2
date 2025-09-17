// src/app.ts (replace relevant parts)
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

import authRoutes from './routes/auth';
import meRoutes from './routes/me';
import registerRoutes from "./routes/register";
import license from "./routes/license";
import sessionsRouter from "./routes/session"
import { requireAuth } from './middleware/auth';
import { allowRoles } from './middleware/roleGuard';
import adminRoutes from "./routes/admin"
import rateLimit from 'express-rate-limit';
// import RedisStore from 'rate-limit-redis'; // optional - install if using redis
import Redis from 'ioredis'; // optional
import { errorHandler } from "./middleware/errorHandler";
import { sessionGuard } from './middleware/sessionGuard';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: false }));

const allowedOrigins = [
  "https://synthora-dev.netlify.app",
  "http://localhost:3001",
  "http://localhost:3000",
  "http://localhost:8080"
];
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "x-api-key",
      "X-Client-Id"      
    ],
    exposedHeaders: ["Authorization", "X-Client-Id"]
  })
);

// Preflight
app.options("*", cors());

/**
 * Rate limiter configuration
 *
 * NOTE: For multi-instance production deployments, use RedisStore (example commented).
 */
// Optional: Redis-backed store (uncomment & install packages in prod)
let redisClient: Redis | undefined;
let redisStoreOptions: any = undefined;
/*
redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
});
redisStoreOptions = {
  store: new RedisStore({
    sendCommand: (...args: any[]) => (redisClient as any).call(...args)
  })
};
*/

const GLOBAL_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000); // 15 minute
const GLOBAL_MAX = Number(process.env.RATE_LIMIT_MAX || 100); // requests per IP per window

const globalLimiter = rateLimit({
  windowMs: GLOBAL_WINDOW_MS,
  max: GLOBAL_MAX,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,
  keyGenerator: (req) => {
    // default: use IP. If you want to use a header for trusted clients, change this logic.
    return (req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || '') as string;
  },
  skip: (req) => {
    // Skip health-checks from being rate-limited
    return req.path === '/health';
  },
  handler: (req, res /*, next */) => {
    res.status(429).json({
      success: false,
      message: "Too many requests, please try again later."
    });
  },
  // ...redisStoreOptions // spread this when using Redis store
  ...(redisStoreOptions || {})
});

app.use(globalLimiter);

// Stricter limiter for auth routes (reduce brute-force footprint)
const AUTH_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000); // 15 minutes
const AUTH_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 50);

const authLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  max: AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({ success: false, message: "Too many authentication attempts, try later." });
  },
  ...(redisStoreOptions || {})
});

const LOGIN_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000); //15 min
const LOGIN_MAX = Number(process.env.LOGIN_RATE_LIMIT_MAX || 50);

const loginLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  max: LOGIN_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // best-effort: use IP + login identifier (email/username) if present in body
    const identifier = (req.body && (req.body.email || req.body.username || req.body.usernameOrEmail)) || '';
    return `${req.ip}:${identifier}`.toLowerCase();
  },
  handler: (req, res) => {
    res.status(429).json({ success: false, message: "Too many login attempts, please try again after some time." });
  },
  ...(redisStoreOptions || {})
});

/** Routes */
// apply authLimiter to all /auth routes
app.use('/auth', authLimiter, authRoutes, loginLimiter);

// apply loginLimiter specifically to login path if you have separate login route, e.g.
// app.post('/auth/login', loginLimiter, authLoginHandler) 
// (If authRoutes defines login, you can attach limiter inside authRoutes or export login route and attach limiter)

// Other routes
app.use("/register", registerRoutes);
app.use('/',  requireAuth,sessionGuard, adminRoutes);
app.use('/',  requireAuth,sessionGuard, meRoutes);
// app.use('/licenses', license);
app.use("/api", requireAuth, sessionsRouter, sessionGuard);
app.use(errorHandler); 

// Example protected route
app.get('/admin/ping', requireAuth, allowRoles('Admin'), (req, res) => {
  res.json({ ok: true, msg: 'admin pong', tenantId: (req as any).user?.clientId ?? (req as any).tenantId });
});

export default app;
