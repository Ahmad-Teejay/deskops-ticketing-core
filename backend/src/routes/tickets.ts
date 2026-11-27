import express = require('express');
import { z } from 'zod';
import { prisma } from '../db';
import {
  requireAuth,
  requireTenant,
  type AuthenticatedRequest,
} from '../middleware/auth';
import { Role } from '../generated/prisma/enums';
import { transitionTicket } from '../services/ticketTransitionService';

const router = express.Router();
const transitionBodySchema = z.object({
  action: z.string(),
});

router.get(
  '/api/v1/tickets/:id',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const organisationId = res.locals.organisationId as string;

    const ticketId = req.params.id;

    if (typeof ticketId !== 'string') {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        organisationId,
      },
    });

    if (!ticket) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    res.status(200).json(ticket);
  },
);

router.post(
  '/api/v1/tickets/:id/transitions',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const ticketId = req.params.id;

    if (typeof ticketId !== 'string') {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const parsedBody = transitionBodySchema.safeParse(req.body);

    if (!parsedBody.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR' });
      return;
    }

    const auth = (req as AuthenticatedRequest).auth!;
    const actorRole = Object.values(Role).find(
      (role) => role === auth.role,
    );

    if (!actorRole) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const result = await transitionTicket({
      ticketId,
      organisationId: res.locals.organisationId as string,
      action: parsedBody.data.action,
      actorId: auth.userId,
      actorRole,
    });

    if (result.kind === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    if (result.kind === 'ILLEGAL_TRANSITION') {
      res.status(409).json({ error: 'ILLEGAL_TRANSITION' });
      return;
    }

    res.status(200).json(result);
  },
);

export default router;