import { IsIn, IsInt, Min } from 'class-validator';

export class UpdateProjectPlaybookDto {
  @IsIn(['general', 'system-integration', 'data-migration'])
  playbookId!: string;

  @IsInt()
  @Min(1)
  playbookVersion!: number;
}
