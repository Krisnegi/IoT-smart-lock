import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import lockRoutes from './routes/lock.routes';
import permissionRoutes from './routes/permission.routes';

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/locks', lockRoutes);
app.use('/api/permissions', permissionRoutes);

// Basic Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default app;
