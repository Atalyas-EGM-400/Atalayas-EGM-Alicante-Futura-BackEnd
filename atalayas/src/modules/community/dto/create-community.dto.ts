import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateCommunityDto {
  @ApiProperty({
    description: 'Nombre oficial de la entidad o colaborador',
    example: 'Universidad de Alicante',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'URL pública del logotipo de la entidad',
    example: 'https://atalayas.com/wp-content/uploads/2026/02/logo-ua.png',
  })
  @IsUrl()
  @IsNotEmpty()
  logoUrl!: string;

  @ApiProperty({
    description: 'Sitio web oficial de la organización',
    example: 'https://www.ua.es',
  })
  @IsUrl()
  @IsNotEmpty()
  website!: string;

  @ApiProperty({
    description:
      'Tipo o categoría de la entidad. Se procesará en mayúsculas de forma interna.',
    example: 'Universidades y Centros de Investigación',
  })
  @IsString()
  @IsNotEmpty()
  tipoName!: string;

  @ApiPropertyOptional({
    description:
      'Breve descripción de las actividades o convenios de la entidad',
    example: 'Universidad pública con una fuerte vocación de I+D+i.',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
