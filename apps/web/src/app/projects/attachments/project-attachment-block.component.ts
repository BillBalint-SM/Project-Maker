import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import type {
  GovernedAttachment,
  GovernedAttachmentOwnerKind,
} from '@project-maker/contracts';
import { finalize } from 'rxjs';

import { ProjectAttachmentsApiService } from './project-attachments-api.service';

@Component({
  selector: 'app-project-attachment-block',
  imports: [ButtonModule, MessageModule],
  templateUrl: './project-attachment-block.component.html',
  styleUrl: './project-attachment-block.component.scss',
})
export class ProjectAttachmentBlockComponent {
  private readonly api = inject(ProjectAttachmentsApiService);
  private readonly document = inject(DOCUMENT);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly projectId = input.required<string>();
  readonly ownerKind = input.required<GovernedAttachmentOwnerKind>();
  readonly ownerId = input.required<string>();
  readonly mutable = input.required<boolean>();
  readonly attachments = input.required<readonly GovernedAttachment[]>();
  readonly changed = output<void>();

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly selectedFile = signal<File | null>(null);

  chooseFile(event: Event): void {
    this.selectedFile.set((event.target as HTMLInputElement).files?.[0] ?? null);
    this.error.set(null);
    this.feedback.set(null);
  }

  upload(): void {
    const file = this.selectedFile();
    if (!this.mutable() || this.busy() || !file) return;
    this.busy.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.api.upload(this.projectId(), this.ownerKind(), this.ownerId(), file)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.selectedFile.set(null);
          const input = this.fileInput()?.nativeElement;
          if (input) input.value = '';
          this.feedback.set('A fájl feltöltve.');
          this.changed.emit();
        },
        error: (error: Error) => this.error.set(error.message),
      });
  }

  remove(attachment: GovernedAttachment): void {
    if (
      !this.mutable() ||
      this.busy() ||
      !this.document.defaultView?.confirm(`Eltávolítod ezt a fájlt: ${attachment.originalName}?`)
    ) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.api.remove(this.projectId(), attachment.id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.feedback.set('A fájl eltávolítva.');
          this.changed.emit();
        },
        error: (error: Error) => this.error.set(error.message),
      });
  }

  downloadUrl(attachmentId: string): string {
    return this.api.downloadUrl(this.projectId(), attachmentId);
  }

  sizeLabel(sizeBytes: number): string {
    return sizeBytes < 1024
      ? `${sizeBytes} bájt`
      : `${Math.ceil(sizeBytes / 1024)} KiB`;
  }
}
