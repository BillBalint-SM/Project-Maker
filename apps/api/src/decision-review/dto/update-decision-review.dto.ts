import { IsInt, Max, Min, ValidateIf } from 'class-validator';

export class UpdateDecisionReviewDto {
  @ValidateIf((_, value: unknown) => value !== null)
  @IsInt()
  @Min(1)
  @Max(5)
  businessValue!: number | null;

  @ValidateIf((_, value: unknown) => value !== null)
  @IsInt()
  @Min(1)
  @Max(5)
  strategicAlignment!: number | null;

  @ValidateIf((_, value: unknown) => value !== null)
  @IsInt()
  @Min(1)
  @Max(5)
  urgency!: number | null;

  @ValidateIf((_, value: unknown) => value !== null)
  @IsInt()
  @Min(1)
  @Max(5)
  confidence!: number | null;

  @ValidateIf((_, value: unknown) => value !== null)
  @IsInt()
  @Min(1)
  @Max(5)
  complexity!: number | null;

  @ValidateIf((_, value: unknown) => value !== null)
  @IsInt()
  @Min(1)
  @Max(5)
  risk!: number | null;
}
