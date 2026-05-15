// create-content.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsInt,
  IsUUID,
} from 'class-validator';

export class CreateContentDto {
  @ApiProperty({
    example: 'Tema 1: Introducción',
    description: 'Título del contenido',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({
    description: 'Opciones de IA en formato JSON string',
    example:
      '{"generateSummary":true,"generateQuiz":false,"generatePodcast":true}',
  })
  @IsOptional()
  @IsString()
  options?: string;

  @ApiPropertyOptional({
    description: 'URL externa si no se sube archivo',
  })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({
    description: 'URL de una imagen de portada',
    example: 'https://ejemplo.com/imagen.jpg'
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'URL del video del contenido',
    example: 'https://youtube.com/watch?v=...'
  })
  @IsString()
  @IsOptional()
  videoUrl?: string;

  @ApiPropertyOptional({
    description: 'URL de la presentación del contenido',
    example: 'https://docs.google.com/presentation/...'
  })
  @IsString()
  @IsOptional()
  presentationUrl?: string;

  @ApiPropertyOptional({
    description: 'Resumen del contenido (para modo manual)',
    example: 'Este es un resumen del contenido...'
  })
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiPropertyOptional({
    description: 'URL del documento PDF (material descargable)',
    example: 'https://ejemplo.com/documento.pdf'
  })
  @IsString()
  @IsOptional()
  documentUrl?: string;

  @ApiProperty({ type: 'string', format: 'binary', required: false })
  @IsOptional()
  file?: any;
}