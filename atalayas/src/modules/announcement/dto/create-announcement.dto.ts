import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  isString,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
export class CreateAnnouncementDto {
  @ApiProperty({ example: 'Mantenimiento de ascensores' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'El lunes se realizarán trabajos...' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({ example: true })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPublic!: boolean;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @Transform(({ value }) => {
    // Caso 1: Es un booleano real
    if (typeof value === 'boolean') return value;
    // Caso 2: Es un string (FormData siempre envía strings)
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === 'true' || v === '1') return true;
      if (v === 'false' || v === '0' || v === '') return false;
    }
    return false; // Por defecto, si hay duda, es falso
  })
  @IsBoolean()
  sendEmail?: boolean; // El nuevo campo para el correo

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  companyId?: string | null;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;
}
