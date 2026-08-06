import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const defaultAuditEventLimit = 50;
export const maxAuditEventLimit = 100;
export const maxAuditEventOffset = 100_000;

export class ListAuditEventsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(maxAuditEventOffset)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(maxAuditEventLimit)
  limit?: number;
}
