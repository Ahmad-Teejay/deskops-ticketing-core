import type { Role, TicketStatus } from '../generated/prisma/enums';
import { prisma } from '../db';
import { getNextState } from './ticketTransitions';

type TransitionTicketInput = {
  ticketId: string;
  organisationId: string;
  action: string;
  actorId: string;
  actorRole: Role;
};

export type TransitionTicketResult =
  | { kind: 'NOT_FOUND' }
  | { kind: 'ILLEGAL_TRANSITION' }
  | {
      kind: 'TRANSITIONED';
      ticket: {
        id: string;
        organisationId: string;
        status: TicketStatus;
      };
      event: {
        id: string;
        organisationId: string;
        ticketId: string;
        type: 'TRANSITION';
        fromStatus: TicketStatus;
        toStatus: TicketStatus;
        actorId: string;
        actorRole: Role;
        payload: unknown;
        createdAt: Date;
      };
    };

export function transitionTicket(
  input: TransitionTicketInput,
): Promise<TransitionTicketResult> {
  return prisma.$transaction(async (transaction) => {
    const ticket = await transaction.ticket.findFirst({
      where: {
        id: input.ticketId,
        organisationId: input.organisationId,
      },
      select: {
        id: true,
        organisationId: true,
        status: true,
      },
    });

    if (!ticket) {
      return { kind: 'NOT_FOUND' };
    }

    const toStatus = getNextState(ticket.status, input.action);

    if (!toStatus) {
      return { kind: 'ILLEGAL_TRANSITION' };
    }

    const updatedTicket = await transaction.ticket.update({
      where: { id: ticket.id },
      data: { status: toStatus },
      select: {
        id: true,
        organisationId: true,
        status: true,
      },
    });

    const event = await transaction.ticketEvent.create({
      data: {
        organisationId: ticket.organisationId,
        ticketId: ticket.id,
        type: 'TRANSITION',
        fromStatus: ticket.status,
        toStatus,
        actorId: input.actorId,
        actorRole: input.actorRole,
      },
    });

    return { kind: 'TRANSITIONED', ticket: updatedTicket, event };
  });
}
