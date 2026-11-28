import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request = require('supertest');
import bcrypt = require('bcryptjs');

import app from '../app';
import { prisma } from '../db';

const password = 'test-password-for-this-run';
const suffix = `${Date.now()}`;

let organisationAId = '';
let organisationBId = '';
let ticketBId = '';
let emailA = '';

const testTicketIds: string[] = [];

async function createOrgATicket(isBlocking: boolean): Promise<string> {
  const ticket = await prisma.ticket.create({
    data: {
      organisationId: organisationAId,
      propertyId: 'property-a',
      unitId: 'unit-a',
      residentId: 'resident-a',
      title: 'Test ticket',
      description: 'Created for the blocking rule test',
      status: 'IN_PROGRESS',
      isBlocking,
    },
  });

  testTicketIds.push(ticket.id);
  return ticket.id;
}

async function loginAsOrgA(): Promise<string> {
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: emailA, password });

  assert.equal(login.status, 200);
  assert.equal(typeof login.body.token, 'string');

  return login.body.token as string;
}

describe('tenant ticket isolation and blocking rule', () => {
  before(async () => {
    emailA = `org-a-${suffix}@example.test`;

    const organisationA = await prisma.organisation.create({
      data: {
        name: `Test Org A ${suffix}`,
        users: {
          create: {
            email: emailA,
            passwordHash: await bcrypt.hash(password, 10),
            role: 'ADMIN',
            name: 'Org A test admin',
            skills: [],
          },
        },
      },
    });
    organisationAId = organisationA.id;

    const organisationB = await prisma.organisation.create({
      data: { name: `Test Org B ${suffix}` },
    });
    organisationBId = organisationB.id;

    const ticketB = await prisma.ticket.create({
      data: {
        organisationId: organisationBId,
        propertyId: 'property-b',
        unitId: 'unit-b',
        residentId: 'resident-b',
        title: 'Private ticket belonging to Org B',
        description: 'Created for the tenant isolation test',
      },
    });
    ticketBId = ticketB.id;
  });

  after(async () => {
    const organisationIds = [organisationAId, organisationBId].filter(
      (id) => id !== '',
    );

    if (organisationIds.length > 0) {
      await prisma.comment.deleteMany({
        where: { organisationId: { in: organisationIds } },
      });

      await prisma.ticket.deleteMany({
        where: { organisationId: { in: organisationIds } },
      });

      await prisma.user.deleteMany({
        where: { organisationId: { in: organisationIds } },
      });

      await prisma.organisation.deleteMany({
        where: { id: { in: organisationIds } },
      });
    }

    await prisma.$disconnect();
  });

  it('returns 404 when Org A requests Org B’s ticket', async () => {
    const token = await loginAsOrgA();

    const response = await request(app)
      .get(`/api/v1/tickets/${ticketBId}`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: 'NOT_FOUND' });
  });

  it('rejects resolving a blocking ticket without an internal note', async () => {
    const ticketId = await createOrgATicket(true);
    const token = await loginAsOrgA();

    const response = await request(app)
      .post(`/api/v1/tickets/${ticketId}/transitions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'RESOLVE' });

    assert.equal(response.status, 422);
    assert.equal(response.body.error, 'INTERNAL_NOTE_REQUIRED');
  });

  it('allows resolving a blocking ticket after an internal note is added', async () => {
    const ticketId = await createOrgATicket(true);
    const token = await loginAsOrgA();

    const comment = await request(app)
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        visibility: 'INTERNAL',
        body: 'Replaced and tested the projector cable.',
      });

    assert.equal(comment.status, 201);

    const response = await request(app)
      .post(`/api/v1/tickets/${ticketId}/transitions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'RESOLVE' });

    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'RESOLVED');
  });

  it('does not accept a public comment as the required internal note', async () => {
    const ticketId = await createOrgATicket(true);
    const token = await loginAsOrgA();

    const comment = await request(app)
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        visibility: 'PUBLIC',
        body: 'The projector has been fixed.',
      });

    assert.equal(comment.status, 201);

    const response = await request(app)
      .post(`/api/v1/tickets/${ticketId}/transitions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'RESOLVE' });

    assert.equal(response.status, 422);
    assert.equal(response.body.error, 'INTERNAL_NOTE_REQUIRED');
  });

  it('allows resolving a non-blocking ticket without a note', async () => {
    const ticketId = await createOrgATicket(false);
    const token = await loginAsOrgA();

    const response = await request(app)
      .post(`/api/v1/tickets/${ticketId}/transitions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'RESOLVE' });

    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'RESOLVED');
  });
});