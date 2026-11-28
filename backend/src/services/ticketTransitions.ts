import type { Role } from '../generated/prisma/enums';

export type TicketState =
  | 'NEW'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'RESOLVED'
  | 'CLOSED';

export const transitions: Readonly<
  Record<TicketState, Readonly<Record<string, TicketState>>>
> = {
  NEW: { triage: 'TRIAGED' },
  TRIAGED: { assign: 'ASSIGNED' },
  ASSIGNED: { unassign: 'TRIAGED', start: 'IN_PROGRESS' },
  IN_PROGRESS: { hold: 'ON_HOLD', resolve: 'RESOLVED' },
  ON_HOLD: { resume: 'IN_PROGRESS' },
  RESOLVED: { close: 'CLOSED', reopen: 'ASSIGNED' },
  CLOSED: { reopen: 'ASSIGNED' },
};

const roleActions: Readonly<Record<Role, readonly string[]>> = {
  ADMIN: Array.from(
    new Set(
      Object.values(transitions).flatMap((stateTransitions) =>
        Object.keys(stateTransitions),
      ),
    ),
  ),
  DISPATCHER: ['triage', 'assign', 'unassign', 'close', 'reopen'],
  TECHNICIAN: ['start', 'hold', 'resolve', 'resume'],
  RESIDENT: [],
};

export function getNextState(
  from: TicketState,
  action: string,
): TicketState | null {
  return transitions[from][action] ?? null;
}

export function canRolePerformAction(role: Role, action: string): boolean {
  return roleActions[role].includes(action);
}
