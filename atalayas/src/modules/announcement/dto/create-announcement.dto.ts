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
  @Transform(({ value }) => value === 'true')
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
