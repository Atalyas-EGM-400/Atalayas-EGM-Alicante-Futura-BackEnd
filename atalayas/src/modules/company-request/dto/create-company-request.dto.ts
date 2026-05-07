import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCompanyRequestDto {
  @ApiProperty({ example: 'Empresa S.L' })
  @IsString()
  companyName!: string;

  @ApiProperty({ example: 'B1234567' })
  @IsString()
  cif!: string;

  @ApiProperty({ example: 'Juan García' })
  @IsString()
  contactName!: string;

  @ApiProperty({ example: 'juan@empresa.com' })
  @IsEmail()
  contactEmail!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  activity?: string;
}
