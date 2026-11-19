import express = require('express');
import type { Request, Response } from 'express';
import cors = require('cors');
import dotenv = require('dotenv');
import authRouter from './routes/auth';
import {
  requireAuth,
  requireTenant,
  type AuthenticatedRequest,
} from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(authRouter);

app.get('/api/v1/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'UP', service: 'DeskOps Ticketing Core' });
});

app.get('/api/v1/me', requireAuth, requireTenant, (req, res) => {
  const auth = (req as AuthenticatedRequest).auth!;

  res.status(200).json({
    userId: auth.userId,
    organisationId: res.locals.organisationId,
    role: auth.role,
  });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});