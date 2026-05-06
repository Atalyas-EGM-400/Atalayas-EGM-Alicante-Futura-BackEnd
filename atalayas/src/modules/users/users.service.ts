import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { User, Role } from '@prisma/client';
import { AuthService } from '../../modules/auth/auth.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly authService: AuthService,
  ) { }

  async create(createUserDto: CreateUserDto, requestUser: User) {
    console.log('--- NUEVA CREACIÓN ---');
    console.log('Rol recibido del front:', createUserDto.role);

    // 1. Validación de permisos
    if (requestUser.role === 'EMPLOYEE' || requestUser.role === 'PUBLIC') {
      throw new ForbiddenException('No tienes permisos para crear usuarios');
    }

    // 2. Lógica de Multitenancy y Roles
    let finalCompanyId: string | null;
    let finalRole: Role;

    if (requestUser.role === 'GENERAL_ADMIN') {
      if (!createUserDto.companyId) {
        throw new ForbiddenException(
          'Un GENERAL_ADMIN debe especificar el companyId',
        );
      }
      finalCompanyId = createUserDto.companyId;
      finalRole = (createUserDto.role as Role) || Role.EMPLOYEE;
    } else {
      if (!requestUser.companyId) {
        throw new ForbiddenException(
          'Tu usuario no tiene una empresa asignada.',
        );
      }
      finalCompanyId = requestUser.companyId;
      if (createUserDto.role === 'GENERAL_ADMIN') {
        throw new ForbiddenException(
          'No puedes crear un usuario con rol GENERAL_ADMIN',
        );
      }
      finalRole = (createUserDto.role as Role) || Role.EMPLOYEE;
    }

    // 3. Generación de contraseña temporal
    const password =
      createUserDto.password || Math.random().toString(36).slice(-8);

    // 4. LLAMADA CORREGIDA AL AUTH SERVICE (Error TS2554 arreglado)
    // Pasamos UN SOLO OBJETO que contenga todo lo que el RegisterDto espera
    const authUser = await this.authService.register({
      email: createUserDto.email,
      password: password,
      name: createUserDto.name,
      role: finalRole,
      companyId: finalCompanyId,
      jobRole: createUserDto.jobRole,
    });
    // Retornamos la password provisional SOLO UNA VEZ para que el admin la vea
    return {
      ...authUser,
      provisionalPassword: createUserDto.password ? undefined : password,
    };
  }

  async findAll(requestUser: User) {
    if (requestUser.role === 'GENERAL_ADMIN') {
      return await this.prismaService.user.findMany({
        include: { Company: true },
      });
    }

    if (requestUser.role === 'ADMIN') {
      return await this.prismaService.user.findMany({
        where: { companyId: requestUser.companyId },
        include: { Company: true },
      });
    }

    throw new ForbiddenException('No tienes permisos para ver los usuarios');
  }

  async findOne(id: string, requestUser: User) {
    const user = await this.prismaService.user.findUnique({
      where: { id },
      include: { Company: true },
    });

    if (!user) throw new NotFoundException(`Usuario no encontrado`);

    // Validación de empresa para el Admin normal
    if (
      requestUser.role === 'ADMIN' &&
      user.companyId !== requestUser.companyId
    ) {
      throw new ForbiddenException('Este usuario pertenece a otra empresa.');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto, requestUser: User) {
    await this.findOne(id, requestUser);
    const updateData = { ...updateUserDto };

    if (requestUser.role !== 'GENERAL_ADMIN' && updateData.companyId) {
      delete updateData.companyId;
    }

    return this.prismaService.user.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: updateData as any,
    });
  }

  async remove(id: string, requestUser: User) {
    await this.findOne(id, requestUser);

    if (id === requestUser.id) {
      throw new ForbiddenException('No puedes eliminarte a ti mismo');
    }

    await this.prismaService.user.delete({ where: { id } });
    await this.authService.deleteUser(id);

    return { message: 'Usuario eliminado correctamente' };
  }

  async markOnboardingDone(userId: string) {
    return this.prismaService.user.update({
      where: { id: userId },
      data: { onboardingDone: true },
    });
  }

  // 🔥 NUEVO MÉTODO: Obtener roles únicos de todos los empleados
  async getUniqueJobRoles() {
    const users = await this.prismaService.user.findMany({
      where: {
        role: 'EMPLOYEE', // Solo empleados, no admins
      },
      select: { jobRole: true },
      distinct: ['jobRole'],
    });

    // Filtramos manualmente los que son null o vacíos
    return users
      .map(u => u.jobRole)
      .filter((role): role is string => role !== null && role !== undefined && role.trim() !== '');
  }
}