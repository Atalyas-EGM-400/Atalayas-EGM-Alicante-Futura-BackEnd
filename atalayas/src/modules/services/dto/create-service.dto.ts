import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  isString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
export class CreateServiceDto {
  @ApiProperty({ example: 'Nombre del servicio' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 'Descripción del servicio', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'URL del servicio', required: false })
  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @ApiProperty({ required: false, example: '' })
  @IsUUID()
  @IsOptional()
  @Transform(({ value }) => value || undefined)
  companyId?: string;

  @ApiProperty({ default: false, required: false, example: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiProperty({ default: false, required: false, example: false })
  @IsString()
  @IsOptional()
  providerName?: string;

  @ApiProperty({ default: false, required: false, example: false })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ default: false, required: false, example: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ default: false, required: false, example: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ default: false, required: false, example: false })
  @IsString()
  @IsOptional()
  schedule?: string;

  @ApiProperty({ default: false, required: false, example: false })
  @IsString()
  @IsOptional()
  externalUrl?: string;

  @ApiProperty({ default: false, required: false, example: false })
  @IsString()
  @IsOptional()
  price?: string;
}
