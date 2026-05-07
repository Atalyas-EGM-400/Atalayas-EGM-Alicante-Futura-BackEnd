import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  isString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
export class CreateAnnouncementDto {
  @IsString()
  title!: string;

  @IsString()
  content!: string;

  @IsBoolean()
  isPublic!: boolean;

  @IsString()
  @IsOptional()
  companyId?: string | null;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}
