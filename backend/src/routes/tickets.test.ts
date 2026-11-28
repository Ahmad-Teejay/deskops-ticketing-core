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
let legalTicketId = '';
let illegalTicketId = '';
let forbiddenTicketId = '';
let userAId = '';
let emailA = '';
let emailResident = '';

async function loginAsOrgA(email: string = emailA): Promise<string> {
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  assert.equal(login.status, 200);
  assert.equal(typeof login.body.token, 'string');

  return login.body.token;
}

describe('ticket API behavior', () => {
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

    emailResident = `resident-${suffix}@example.test`;
    await prisma.user.create({
      data: {
        organisationId: organisationAId,
        email: emailResident,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'RESIDENT',
        name: 'Org A test resident',
        skills: [],
      },
    });

    const userA = await prisma.user.findUniqueOrThrow({
      where: { email: emailA },
      select: { id: true },
    });
    userAId = userA.id;

    const organisationB = await prisma.organisation.create({
      data: { name: `Test Org B ${suffix}` },
    });
    organisationBId = organisationB.id;

    const legalTicket = await prisma.ticket.create({
      data: {
        organisationId: organisationAId,
        propertyId: 'property-a',
        unitId: 'unit-a',
        residentId: 'resident-a',
        title: 'Ticket for legal transition',
        description: 'Created for the legal transition test',
      },
    });
    legalTicketId = legalTicket.id;

    const illegalTicket = await prisma.ticket.create({
      data: {
        organisationId: organisationAId,
        propertyId: 'property-a',
        unitId: 'unit-a',
        residentId: 'resident-a',
        title: 'Ticket for illegal transition',
        description: 'Created for the illegal transition test',
      },
    });
    illegalTicketId = illegalTicket.id;

    const forbiddenTicket = await prisma.ticket.create({
      data: {
        organisationId: organisationAId,
        propertyId: 'property-a',
        unitId: 'unit-a',
        residentId: 'resident-a',
        title: 'Ticket for forbidden transition',
        description: 'Created for the role permission test',
      },
    });
    forbiddenTicketId = forbiddenTicket.id;

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
    const ticketIds = [
      ticketBId,
      legalTicketId,
      illegalTicketId,
      forbiddenTicketId,
    ].filter((id) => id !== '');

    if (ticketIds.length > 0) {
      await prisma.ticketEvent.deleteMany({
        where: { ticketId: { in: ticketIds } },
      });
      await prisma.ticket.deleteMany({
        where: { id: { in: ticketIds } },
      });
    }

    const organisationIds = [organisationAId, organisationBId].filter(
      (id) => id !== '',
    );

    if (organisationIds.length > 0) {
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

  it('updates the ticket and stores one event for a legal transition', async () => {
    const token = await loginAsOrgA();

    const response = await request(app)
      .post(`/api/v1/tickets/${legalTicketId}/transitions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'triage' });

    assert.equal(response.status, 200);
    assert.equal(response.body.ticket.status, 'TRIAGED');

    const events = await prisma.ticketEvent.findMany({
      where: { ticketId: legalTicketId },
    });

    assert.equal(events.length, 1);
    assert.equal(events[0]?.type, 'TRANSITION');
    assert.equal(events[0]?.fromStatus, 'NEW');
    assert.equal(events[0]?.toStatus, 'TRIAGED');
    assert.equal(events[0]?.actorId, userAId);
    assert.equal(events[0]?.actorRole, 'ADMIN');
    assert.ok(events[0]?.createdAt instanceof Date);
    assert.ok(Number.isFinite(events[0]?.createdAt.getTime()));
  });

  it('rejects an illegal transition without changing the ticket or writing an event', async () => {
    const token = await loginAsOrgA();

    const response = await request(app)
      .post(`/api/v1/tickets/${illegalTicketId}/transitions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'close' });

    assert.equal(response.status, 409);
    assert.deepEqual(response.body, { error: 'ILLEGAL_TRANSITION' });

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id: illegalTicketId },
      select: { status: true },
    });
    const events = await prisma.ticketEvent.findMany({
      where: { ticketId: illegalTicketId },
    });

    assert.equal(ticket.status, 'NEW');
    assert.equal(events.length, 0);
  });

  it('denies a resident an otherwise legal transition without writing to the database', async () => {
    const token = await loginAsOrgA(emailResident);

    const response = await request(app)
      .post(`/api/v1/tickets/${forbiddenTicketId}/transitions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'triage' });

    assert.equal(response.status, 403);
    assert.deepEqual(response.body, { error: 'FORBIDDEN' });

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id: forbiddenTicketId },
      select: { status: true },
    });
    const events = await prisma.ticketEvent.findMany({
      where: { ticketId: forbiddenTicketId },
    });

    assert.equal(ticket.status, 'NEW');
    assert.equal(events.length, 0);
  });
});