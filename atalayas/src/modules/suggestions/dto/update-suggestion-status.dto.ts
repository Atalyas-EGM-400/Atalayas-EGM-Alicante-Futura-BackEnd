import { IsEnum, IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { SuggestionStatus } from '@prisma/client';

export class RespondSuggestionDto {
  @IsString()
  @IsOptional()
  response?: string;

  @IsEnum(SuggestionStatus)
  @IsNotEmpty()
  status!: SuggestionStatus;
}
