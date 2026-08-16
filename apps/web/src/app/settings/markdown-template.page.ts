import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import type { MarkdownTemplateSummary } from '@project-maker/contracts';
import { markdownTemplatePlaceholderNames } from '@project-maker/contracts';

import { MarkdownTemplateApiService } from './markdown-template-api.service';

@Component({
  selector: 'app-markdown-template-page',
  imports: [
    ButtonModule,
    CardModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    ReactiveFormsModule,
    TagModule,
  ],
  templateUrl: './markdown-template.page.html',
  styleUrl: './markdown-template.page.scss',
})
export class MarkdownTemplatePage implements OnInit {
  private readonly api = inject(MarkdownTemplateApiService);

  readonly templates = signal<readonly MarkdownTemplateSummary[]>([]);
  readonly selected = signal<MarkdownTemplateSummary | null>(null);
  readonly preview = signal<string | null>(null);
  readonly loading = signal(true);
  readonly working = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly placeholders = markdownTemplatePlaceholderNames;
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
    draftContent: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100_000)] }),
  });

  ngOnInit(): void {
    this.load();
  }

  load(preferredId?: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.list().subscribe({
      next: (templates) => {
        this.templates.set(templates);
        const selected = templates.find((item) => item.id === preferredId)
          ?? templates.find((item) => item.isDefault)
          ?? templates[0]
          ?? null;
        if (selected) this.select(selected);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  newTemplate(): void {
    this.selected.set(null);
    this.preview.set(null);
    this.feedback.set(null);
    this.actionError.set(null);
    this.form.reset({ name: '', draftContent: '# {{project.name}}\n\n{{project.context}}' });
  }

  select(template: MarkdownTemplateSummary): void {
    this.selected.set(template);
    this.preview.set(null);
    this.feedback.set(null);
    this.actionError.set(null);
    this.form.reset({ name: template.name, draftContent: template.draftContent });
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.working()) return;
    this.working.set(true);
    this.actionError.set(null);
    const value = this.form.getRawValue();
    const request = this.selected()
      ? this.api.update(this.selected()!.id, value)
      : this.api.create(value);
    request.subscribe({
      next: (template) => {
        this.working.set(false);
        this.feedback.set('Draft mentve. Az előnézet után publikálhatod.');
        this.upsert(template);
        this.selected.set(template);
      },
      error: (error: Error) => {
        this.working.set(false);
        this.actionError.set(error.message);
      },
    });
  }

  showPreview(): void {
    const template = this.selected();
    if (!template || this.working()) return;
    this.working.set(true);
    this.actionError.set(null);
    this.api.preview(template.id).subscribe({
      next: (preview) => {
        this.preview.set(preview.content);
        this.working.set(false);
      },
      error: (error: Error) => {
        this.working.set(false);
        this.actionError.set(error.message);
      },
    });
  }

  publish(): void {
    const template = this.selected();
    if (!template || this.working()) return;
    this.working.set(true);
    this.actionError.set(null);
    this.api.publish(template.id).subscribe({
      next: (published) => {
        this.working.set(false);
        this.feedback.set(`A sablon v${published.latestPublishedVersion} verziója publikálva.`);
        this.upsert(published);
        this.selected.set(published);
      },
      error: (error: Error) => {
        this.working.set(false);
        this.actionError.set(error.message);
      },
    });
  }

  private upsert(template: MarkdownTemplateSummary): void {
    const next = this.templates().filter((item) => item.id !== template.id);
    this.templates.set([...next, template].sort((left, right) =>
      Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name)));
  }
}
