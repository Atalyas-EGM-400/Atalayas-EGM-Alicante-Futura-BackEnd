import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEventDto {
  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  event_date!: string | Date;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  image_url?: string;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  max_capacity?: number;

  @IsUUID()
  @IsOptional()
  companyId?: string;
}
