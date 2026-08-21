import { IsOptional, IsUUID } from 'class-validator';

export class AssignProjectInitiativeDto {
  @IsOptional()
  @IsUUID('4')
  initiativeId!: string | null;
}
