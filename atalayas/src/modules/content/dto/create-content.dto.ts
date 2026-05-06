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

  @ApiProperty({ example: 'URL del servicio', required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;
  @ApiPropertyOptional({ example: 'URL de una imagen de portada' })
  @IsString()
  @IsOptional()

  // 🚀 ESTE CAMPO ES PARA QUE SWAGGER MUESTRE EL BOTÓN DE SUBIR ARCHIVO
  @ApiProperty({ type: 'string', format: 'binary', required: false })
  @IsOptional()
  file?: any;

  @ApiPropertyOptional({ example: 'URL del video del contenido' })
  @IsString()
  @IsOptional()
  videoUrl?: string;
}
