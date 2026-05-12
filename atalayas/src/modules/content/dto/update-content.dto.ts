import { PartialType } from '@nestjs/swagger';
import { CreateContentDto } from './create-content.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsInt,
  IsObject,
} from 'class-validator';

export class UpdateContentDto extends PartialType(CreateContentDto) {
  @ApiProperty({
    example: 'Tema 1: Introducción',
    description: 'Título del contenido',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsObject()
  @IsOptional()
  quiz?: any;

  @IsObject()
  @IsOptional()
  podcast?: any;

  @ApiProperty({ example: 'PDF del contenido', required: false })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiProperty({ example: 'URL de la imagen del contenido', required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'https://supabase.co/.../presentation.pptx' })
  @IsString()
  @IsOptional()
  presentationUrl?: string;
}
