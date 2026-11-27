import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getNextState } from './ticketTransitions';

describe('ticket transitions', () => {
  it('returns the next state for an allowed action', () => {
    assert.equal(getNextState('NEW', 'triage'), 'TRIAGED');
  });

  it('returns null for an action that is not allowed from the current state', () => {
    assert.equal(getNextState('NEW', 'close'), null);
  });
});
 
