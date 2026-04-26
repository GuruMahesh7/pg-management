import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// 1. Logger middleware (must be first)
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// 2. CORS Configuration
const allowedOrigins = [
  "https://home-haven-connect.vercel.app",
  "https://diziny-deluxe.vercel.app",
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow configured frontend base URL
    const frontendBase = process.env.FRONTEND_BASE_URL?.replace(/\/$/, "");
    
    if (
      allowedOrigins.includes(origin) || 
      (frontendBase && origin === frontendBase) ||
      /^http:\/\/localhost:\d+$/.test(origin)
    ) {
      return callback(null, true);
    }
    
    logger.warn({ origin }, "CORS blocked origin");
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// 3. Other standard middlewares
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. API Routes
app.use("/api", router);

// 5. Global Error Handler (to avoid 500 HTML responses)
app.use((err: any, _req: any, res: any, _next: any) => {
  const statusCode = err.status || err.statusCode || 500;
  logger.error({ err }, "Unhandled server error");
  
  res.status(statusCode).json({
    error: err.message || "Internal Server Error",
    status: statusCode
  });
});

export default app;
