import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  canRolePerformAction,
  getNextState,
  transitions,
} from './ticketTransitions';

describe('ticket transitions', () => {
  it('returns the next state for an allowed action', () => {
    assert.equal(getNextState('NEW', 'triage'), 'TRIAGED');
  });

  it('returns null for an action that is not allowed from the current state', () => {
    assert.equal(getNextState('NEW', 'close'), null);
  });

  it('allows a dispatcher to triage a ticket', () => {
    assert.equal(canRolePerformAction('DISPATCHER', 'triage'), true);
  });

  it('denies a resident permission to triage a ticket', () => {
    assert.equal(canRolePerformAction('RESIDENT', 'triage'), false);
  });

  it('allows admins every action in the transition table', () => {
    const actions = new Set(
      Object.values(transitions).flatMap((stateTransitions) =>
        Object.keys(stateTransitions),
      ),
    );

    for (const action of actions) {
      assert.equal(
        canRolePerformAction('ADMIN', action),
        true,
        `ADMIN should be allowed to perform ${action}`,
      );
    }
  });
});
 
