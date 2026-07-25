import express from 'express';
import cors from 'cors';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './config/swagger.json';
import authRoutes from './routes/auth.routes';
import lockRoutes from './routes/lock.routes';
import permissionRoutes from './routes/permission.routes';
import simulatorRoutes from './routes/simulator.routes';

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());

// Serve static dashboard files from React frontend build
app.use('/dashboard', express.static(path.join(__dirname, '../../frontend/dist')));

// OpenAPI API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/locks', lockRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/simulator', simulatorRoutes);

// Basic Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default app;
