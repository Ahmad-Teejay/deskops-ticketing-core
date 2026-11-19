import express = require('express');
import bcrypt = require('bcryptjs');
import jwt = require('jsonwebtoken');
import { prisma } from '../db';

const router = express.Router();

router.post('/api/v1/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({ error: 'Authentication is not configured' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign(
      {
        organisationId: user.organisationId,
        role: user.role,
      },
      secret,
      {
        algorithm: 'HS256',
        subject: user.id,
        expiresIn: '1h',
      },
    );

    res.status(200).json({
      token,
      tokenType: 'Bearer',
      expiresIn: '1h',
    });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Unable to log in' });
  }
});

export default router;