import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsUUID,
  Min,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEventDto {
  @ApiProperty({ example: 'Cena de Navidad' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'Evento anual para empleados', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2024-12-24T20:00:00Z' })
  @IsDateString()
  event_date!: string; // Se recibe como string y el servicio lo convierte a Date

  @ApiProperty({ example: 'Restaurante El Faro', required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  image_url?: string;

  @ApiProperty({ example: 50, required: false })
  @Transform(({ value }) => (value ? Number(value) : undefined)) // Convierte el string del FormData a número
  @IsInt()
  @Min(1)
  @IsOptional()
  max_capacity?: number;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  companyId?: string;

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
    return false;
  })
  @IsBoolean()
  sendEmail?: boolean;
}
