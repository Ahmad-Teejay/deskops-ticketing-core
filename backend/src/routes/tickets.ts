import express = require('express');
import { prisma } from '../db';
import { requireAuth, requireTenant, type AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

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
  '/api/v1/tickets/:id/comments',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const organisationId = res.locals.organisationId as string;
    const ticketId = req.params.id;
    const visibility = req.body?.visibility;
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';

    if (!auth) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (typeof ticketId !== 'string') {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    if (
      visibility !== 'INTERNAL' &&
      visibility !== 'PUBLIC'
    ) {
      res.status(400).json({ error: 'Invalid comment visibility' });
      return;
    }

    if (!body) {
      res.status(400).json({ error: 'Comment text is required' });
      return;
    }

    if (visibility === 'INTERNAL' && auth.role === 'RESIDENT') {
      res.status(403).json({ error: 'Residents cannot add internal notes' });
      return;
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, organisationId },
    });

    if (!ticket) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        organisationId,
        ticketId,
        authorId: auth.userId,
        visibility,
        body,
      },
    });

    res.status(201).json(comment);
  },
);

router.post(
  '/api/v1/tickets/:id/transitions',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const organisationId = res.locals.organisationId as string;
    const ticketId = req.params.id;

    if (!auth) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (typeof ticketId !== 'string') {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    if (req.body?.action !== 'RESOLVE') {
      res.status(400).json({ error: 'This route only handles RESOLVE' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, organisationId },
      });

      if (!ticket) {
        return { kind: 'not-found' as const };
      }

      if (ticket.status !== 'IN_PROGRESS') {
        return { kind: 'illegal-transition' as const };
      }

      const isAdmin = auth.role === 'ADMIN';
      const isAssignedTechnician =
        auth.role === 'TECHNICIAN' && ticket.assigneeId === auth.userId;

      if (!isAdmin && !isAssignedTechnician) {
        return { kind: 'forbidden' as const };
      }

      if (ticket.isBlocking) {
        const internalNote = await tx.comment.findFirst({
          where: {
            ticketId,
            organisationId,
            visibility: 'INTERNAL',
            body: { not: '' },
          },
        });

        if (!internalNote) {
          return { kind: 'internal-note-required' as const };
        }
      }

      const updatedTicket = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          version: { increment: 1 },
        },
      });

      return { kind: 'resolved' as const, ticket: updatedTicket };
    });

    if (result.kind === 'not-found') {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    if (result.kind === 'illegal-transition') {
      res.status(409).json({ error: 'ILLEGAL_TRANSITION' });
      return;
    }

    if (result.kind === 'forbidden') {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }

    if (result.kind === 'internal-note-required') {
      res.status(422).json({
        error: 'INTERNAL_NOTE_REQUIRED',
        message: 'A blocking ticket needs a staff internal note before it can be resolved',
      });
      return;
    }

    res.status(200).json(result.ticket);
  },
);

export default router;