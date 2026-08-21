import assert from 'node:assert/strict';

const apiBaseUrl = process.env['API_BASE_URL'] ?? 'http://127.0.0.1:3000';
const appOrigin = process.env['CORS_ORIGIN'] ?? 'http://localhost:8080';

const signUpResponse = await fetch(`${apiBaseUrl}/auth/signup`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: appOrigin },
  body: JSON.stringify({
    email: 'internal-container-smoke@example.test',
    password: 'container-smoke-password-42',
  }),
});
const signUpPayload = await signUpResponse.json().catch(() => null);
assert.equal(
  signUpResponse.status,
  201,
  `POST /auth/signup returned ${String(signUpResponse.status)}: ${JSON.stringify(signUpPayload)}`,
);
const sessionCookie = (signUpResponse.headers.get('set-cookie') ?? '').split(';', 1)[0];
assert.match(sessionCookie, /^pm_session=/);

const project = await requestJson(201, 'POST', '/projects', {
  name: 'Container smoke project',
  customerContactName: 'Container Smoke Contact',
  customerContactEmail: 'container-smoke@example.test',
  internalOwnerName: 'Container Smoke PO/PM',
});

assert.equal(typeof project.id, 'string');

const discoveryFollowUp = await requestJson(
  201,
  'POST',
  `/projects/${project.id}/discovery-follow-ups`,
  {
    category: 'BUSINESS',
    question: 'Megerősítettük az üzleti célt?',
    owner: 'Container Smoke Owner',
    dueDate: '2026-08-12',
    nextStep: 'Egyeztetés a tulajdonossal.',
  },
);

assert.equal(discoveryFollowUp.projectId, project.id);
assert.equal(discoveryFollowUp.status, 'Nyitott');

const baseQuestionBank = await requestJson(200, 'GET', '/settings/base-questions');
const canonicalQuestions = baseQuestionBank.questions.filter((question) =>
  /^general-\d{3}$/.test(question.stableKey),
);

assert.equal(canonicalQuestions.length, 30);

await requestJson(201, 'POST', `/projects/${project.id}/question-schema`, {
  questions: canonicalQuestions.map((question) => ({ stableKey: question.stableKey })),
});

await requestJson(201, 'POST', `/projects/${project.id}/rounds`, { type: 'INITIAL_INTAKE' });

const readiness = await requestJson(200, 'GET', `/projects/${project.id}/readiness`);

assert.equal(readiness.projectId, project.id);
assert.equal(readiness.available, true);

console.log('Container smoke passed: canonical runtime policy loaded through discovery and readiness.');

async function requestJson(expectedStatus, method, path, body) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      cookie: sessionCookie,
      origin: appOrigin,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);

  assert.equal(
    response.status,
    expectedStatus,
    `${method} ${path} returned ${String(response.status)}: ${JSON.stringify(payload)}`,
  );

  return payload;
}
