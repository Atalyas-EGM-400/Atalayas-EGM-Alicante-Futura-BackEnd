import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
  IsNotEmpty,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
export class CreateUserDto {
  @ApiProperty({ example: 'ejemplo@ejemplo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Nombre del usuario' })
  @IsString()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4, { message: 'La contraseña debe tener al menos 4 caracteres' })
  password!: string;

  @ApiProperty({ required: false, example: '' })
  @IsUUID()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  @Transform(({ value }) => value || null)
  companyId?: string;

  @ApiPropertyOptional({
    example: 'EMPLOYEE',
    description: 'Rol del usuario (EMPLOYEE o ADMIN). Por defecto es EMPLOYEE.',
    enum: [Role.EMPLOYEE, Role.ADMIN, Role.GENERAL_ADMIN, Role.PUBLIC],
    required: false,
  })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiProperty({
    example: 'Almacén',
    description: 'Puesto específico de trabajo',
  })
  @IsString()
  @IsNotEmpty({ message: 'El puesto de trabajo (jobRole) es obligatorio' })
  jobRole!: string;
}
