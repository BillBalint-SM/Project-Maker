import { createHash } from 'node:crypto';

import type { AnswerValue } from '@project-maker/contracts';

export interface HandoffProjectionQuestion {
  readonly order: number;
  readonly topic: string;
  readonly text: string;
  readonly answer: AnswerValue | null;
  readonly status: string;
  readonly rationale: string | null;
}

export interface HandoffProjection {
  readonly projectName: string;
  readonly recipientName: string;
  readonly recipientEmail: string;
  readonly internalOwnerName: string;
  readonly roundDate: string;
  readonly version: number;
  readonly supersededVersion: number | null;
  readonly modificationSummary: string | null;
  readonly sourceContentVersion: number;
  readonly questions: readonly HandoffProjectionQuestion[];
}

export interface RenderedHandoff {
  readonly subject: string;
  readonly textContent: string;
  readonly htmlContent: string;
  readonly previewDigest: string;
}

export function renderHandoff(projection: HandoffProjection): RenderedHandoff {
  const subject = `Project Maker – Initial Intake summary – ${projection.projectName} – version ${projection.version}`;
  const header = [
    `Project: ${projection.projectName}`,
    `Customer contact: ${projection.recipientName}`,
    `Internal project owner: ${projection.internalOwnerName}`,
    `Interview date: ${projection.roundDate}`,
    `Version: ${projection.version}`,
  ];
  if (projection.supersededVersion !== null) header.push(`Superseded version: ${projection.supersededVersion}`);
  if (projection.modificationSummary) header.push(`Change summary: ${projection.modificationSummary}`);
  const questions = projection.questions.flatMap((question) => [
    '',
    `${question.order}. [${question.topic}] ${question.text}`,
    `Answer: ${formatAnswer(question.answer)}`,
    `Status: ${formatAssessmentStatus(question.status)}`,
    ...(question.rationale ? [`Rationale: ${question.rationale}`] : []),
  ]);
  const textContent = [...header, ...questions].join('\n');
  const htmlContent = `<article><h1>${escapeHtml(subject)}</h1>${header.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}<ol>${projection.questions.map((question) => `<li><h2>${escapeHtml(question.topic)}</h2><p>${escapeHtml(question.text)}</p><p><strong>Answer:</strong> ${escapeHtml(formatAnswer(question.answer))}</p><p><strong>Status:</strong> ${escapeHtml(formatAssessmentStatus(question.status))}</p>${question.rationale ? `<p><strong>Rationale:</strong> ${escapeHtml(question.rationale)}</p>` : ''}</li>`).join('')}</ol></article>`;
  const previewDigest = createHash('sha256')
    .update(JSON.stringify({ subject, textContent, htmlContent, sourceContentVersion: projection.sourceContentVersion }))
    .digest('hex');
  return { subject, textContent, htmlContent, previewDigest };
}

function formatAnswer(value: AnswerValue | null): string {
  if (value === null) return 'No answer recorded';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function formatAssessmentStatus(status: string): string {
  return ({
    'Nincs meg': 'Missing',
    'Részben megvan': 'Partially complete',
    'Kész': 'Complete',
    'Nem releváns': 'Not applicable',
  } as Readonly<Record<string, string>>)[status] ?? status;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}
