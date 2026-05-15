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

    if (requestUser.role === 'EMPLOYEE' || requestUser.role === 'PUBLIC') {
      throw new ForbiddenException('No tienes permisos para crear usuarios');
    }

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

    const password =
      createUserDto.password || Math.random().toString(36).slice(-8);

    const authUser = await this.authService.register({
      email: createUserDto.email,
      password: password,
      name: createUserDto.name,
      role: finalRole,
      companyId: finalCompanyId,
      jobRole: createUserDto.jobRole,
    });

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

  async getUniqueJobRoles() {
    const users = await this.prismaService.user.findMany({
      where: { role: 'EMPLOYEE' },
      select: { jobRole: true },
      distinct: ['jobRole'],
    });

    return users
      .map((u) => u.jobRole)
      .filter(
        (role): role is string =>
          role !== null && role !== undefined && role.trim() !== '',
      );
  }

  // ── NUEVO: Dar de baja a un empleado ─────────────────────────────────
  async deactivateUser(id: string, requestUser: User) {
    const target = await this.findOne(id, requestUser);

    if (target.id === requestUser.id) {
      throw new ForbiddenException('No puedes darte de baja a ti mismo');
    }

    if (target.status === 'INACTIVE') {
      throw new ForbiddenException('Este empleado ya está dado de baja');
    }

    return this.prismaService.user.update({
      where: { id },
      data: {
        status: 'INACTIVE',
        leftAt: new Date(),
      },
    });
  }

  // ── NUEVO: Reactivar un empleado ──────────────────────────────────────
  async reactivateUser(id: string, requestUser: User) {
    const target = await this.findOne(id, requestUser);

    if (target.status === 'ACTIVE') {
      throw new ForbiddenException('Este empleado ya está activo');
    }

    return this.prismaService.user.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        leftAt: null,
      },
    });
  }
}