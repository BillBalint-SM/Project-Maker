import type { Project } from '../projects/project.entity';
import type { DiscoveryFollowUpEntity } from '../discovery-follow-ups/discovery-follow-up.entity';

export interface RenderedCustomerFollowUpPing {
  readonly recipientName: string;
  readonly recipientEmail: string;
  readonly subject: string;
  readonly text: string;
  readonly referencedFollowUpVersion: number | null;
}

export function renderCustomerFollowUpPing(
  project: Project,
  messageDraft: string,
  reference: DiscoveryFollowUpEntity | null,
): RenderedCustomerFollowUpPing {
  const referenceLines = reference
    ? [
        '',
        'Kapcsolódó nyitott kérdés',
        `Kérdés: ${reference.question}`,
        `Következő lépés: ${reference.nextStep}`,
        `Határidő: ${reference.dueDate}`,
      ]
    : [];
  return {
    recipientName: project.customerContactName,
    recipientEmail: project.customerContactEmail,
    subject: `Pontosítás kérése — ${project.name}`,
    text: [messageDraft, ...referenceLines].join('\n'),
    referencedFollowUpVersion: reference?.version ?? null,
  };
}
