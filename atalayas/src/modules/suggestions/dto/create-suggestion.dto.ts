import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { Role, SuggestionStatus } from '@prisma/client';

export class CreateSuggestionDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsUUID()
  @IsNotEmpty()
  authorId!: string;

  @IsEnum(Role)
  @IsNotEmpty()
  authorRole!: Role;

  @IsEnum(Role)
  @IsNotEmpty()
  targetRole!: Role;

  @IsUUID()
  @IsOptional()
  companyId?: string;

  @IsEnum(SuggestionStatus)
  @IsOptional()
  status?: SuggestionStatus;
}
