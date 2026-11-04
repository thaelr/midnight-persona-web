import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, createGateway } from '../src/lib/gateway';

test('a failed purchase is one request with the unchanged idempotency key', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const gateway = createGateway(async () => 'test-access-token', {
    baseUrl: 'https://gateway.example.test/',
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), init: init! });
      return new Response(JSON.stringify({ error: 'provider_creation_uncertain', request_id: 'safe-request-id' }), {
        status: 503, headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  const input = { client_message_id: 'persistent-purchase-key', chat_code: 'c1234567', sku: 'server-sku', provider: 'nowpayments' };
  await assert.rejects(gateway.createPurchase(input), (error: unknown) =>
    error instanceof ApiError && error.status === 503 && error.code === 'provider_creation_uncertain'
    && error.details.request_id === 'safe-request-id');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://gateway.example.test/web/commerce/purchases');
  assert.deepEqual(JSON.parse(calls[0].init.body as string), input);
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.credentials, 'omit');
});

test('an event cursor is transmitted as exact decimal text, not a JS number', async () => {
  let calledUrl = '';
  const cursor = '18446744073709551615';
  const gateway = createGateway(async () => 'test-access-token', {
    baseUrl: 'https://gateway.example.test',
    fetchImpl: async (input) => {
      calledUrl = String(input);
      return Response.json({ events: [], cursor });
    },
  });
  assert.equal((await gateway.events('c1234567', { after: cursor, limit: 100 })).cursor, cursor);
  assert.equal(new URL(calledUrl).searchParams.get('after'), cursor);
  assert.equal(new URL(calledUrl).searchParams.get('limit'), '100');
});

test('absent configuration and absent session prevent requests', async () => {
  let called = 0;
  const fetchImpl: typeof fetch = async () => { called++; return Response.json({}); };
  await assert.rejects(createGateway(async () => 'token', { baseUrl: '', fetchImpl }).me(),
    (error: unknown) => error instanceof ApiError && error.code === 'gateway_not_configured');
  await assert.rejects(createGateway(async () => null, { baseUrl: 'https://gateway.example.test', fetchImpl }).me(),
    (error: unknown) => error instanceof ApiError && error.status === 401);
  assert.equal(called, 0);
});

test('timeout does not retry or later send a write after slow session restoration', async () => {
  let called = 0;
  let resolveToken!: (token: string) => void;
  const gateway = createGateway(() => new Promise<string>((resolve) => { resolveToken = resolve; }), {
    baseUrl: 'https://gateway.example.test', timeoutMs: 15,
    fetchImpl: async () => { called++; return Response.json({}); },
  });
  await assert.rejects(gateway.sendMessage('c1234567', { client_message_id: 'same-key', text: 'Hello' }),
    (error: unknown) => error instanceof ApiError && error.code === 'request_timeout');
  resolveToken('test-access-token');
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(called, 0);
});

test('timeout of an in-flight mutation preserves uncertain outcome', async () => {
  let called = 0;
  const gateway = createGateway(async () => 'test-access-token', {
    baseUrl: 'https://gateway.example.test', timeoutMs: 15,
    fetchImpl: async () => { called++; return new Promise<Response>(() => {}); },
  });
  await assert.rejects(gateway.sendMessage('c1234567', { client_message_id: 'same-key', text: 'Hello' }),
    (error: unknown) => error instanceof ApiError && error.code === 'request_timeout' && error.details.outcome_unknown === true);
  assert.equal(called, 1);
});

test('unexpected HTML and unsafe API origins cannot masquerade as success', async () => {
  const gateway = createGateway(async () => 'test-access-token', {
    baseUrl: 'https://gateway.example.test', fetchImpl: async () => new Response('<html>Login page</html>', { status: 200 }),
  });
  await assert.rejects(gateway.me(), (error: unknown) => error instanceof ApiError && error.code === 'invalid_response');
  await assert.rejects(createGateway(async () => 'test-access-token', { baseUrl: 'http://external.example.test' }).me(),
    (error: unknown) => error instanceof ApiError && error.code === 'invalid_gateway_url');
});
