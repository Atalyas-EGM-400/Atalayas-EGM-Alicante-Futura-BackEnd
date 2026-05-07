import { IsEmail, IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password!: string;

  @ApiProperty({ example: 'Carlos Pérez', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'EMPLOYEE', required: false })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({ example: 'uuid-de-la-empresa', required: false })
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsString()
  @IsNotEmpty({ message: 'El puesto de trabajo es requerido' })
  jobRole?: string;
}
