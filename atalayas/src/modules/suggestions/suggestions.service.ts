import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { CreateSuggestionDto } from './dto/create-suggestion.dto.js';
import { RespondSuggestionDto } from './dto/update-suggestion-status.dto.js';
import { User } from '@prisma/client';

@Injectable()
export class SuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createSuggestionDto: CreateSuggestionDto, requestUser: User) {
    // Si es ADMIN_GENERAL y especifica empresa, se usa esa. Si no, la del usuario.
    const companyId =
      requestUser.role === 'GENERAL_ADMIN' && createSuggestionDto.companyId
        ? createSuggestionDto.companyId
        : requestUser.companyId;

    return await this.prisma.suggestion.create({
      data: {
        title: createSuggestionDto.title,
        content: createSuggestionDto.content,
        authorId: requestUser.id,
        authorRole: requestUser.role,
        targetRole: createSuggestionDto.targetRole,
        companyId: companyId || null,
        status: 'PENDING',
      },
    });
  }

  async findAll(requestUser: User, target?: string) {
    const { role, id, companyId } = requestUser;

    // 1. ADMIN DE EMPRESA
    if (role === 'ADMIN') {
      if (target === 'ADMIN') {
        // ESTO ES PARA LA "BANDEJA DE ENTRADA"
        // Solo lo que otros le envían a él (misma empresa, para ADMIN, y que NO sea él mismo)
        return await this.prisma.suggestion.findMany({
          where: {
            targetRole: 'ADMIN',
            companyId: companyId,
            NOT: { authorId: id },
          },
          include: { User: true },
          orderBy: { createdAt: 'desc' },
        });
      } else {
        // ESTO ES PARA "MIS SOLICITUDES"
        // Solo lo que el Admin ha redactado personalmente
        return await this.prisma.suggestion.findMany({
          where: { authorId: id },
          include: { User: true },
          orderBy: { createdAt: 'desc' },
        });
      }
    }

    // 2. ADMIN GENERAL (Sigue igual)
    if (role === 'GENERAL_ADMIN') {
      return await this.prisma.suggestion.findMany({
        where: { targetRole: 'GENERAL_ADMIN' },
        include: { User: true, Company: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    // 3. EMPLEADO (Sigue igual)
    if (role === 'EMPLOYEE') {
      return await this.prisma.suggestion.findMany({
        where: { authorId: id },
        include: { User: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    return [];
  }

  async findOne(id: string, requestUser: User) {
    const suggestion = await this.prisma.suggestion.findUnique({
      where: { id },
      include: { User: true, Company: true },
    });

    if (!suggestion) {
      throw new NotFoundException(`Sugerencia no encontrada`);
    }

    // Seguridad: Un empleado no puede consultar IDs de sugerencias ajenas.
    if (
      requestUser.role === 'EMPLOYEE' &&
      suggestion.authorId !== requestUser.id
    ) {
      throw new ForbiddenException(
        'No tienes permiso para ver esta sugerencia',
      );
    }

    return suggestion;
  }

  async findMine(user: User) {
    return await this.prisma.suggestion.findMany({
      where: {
        authorId: user.id, // Filtra para que el empleado solo vea las suyas
      },
      orderBy: {
        createdAt: 'desc', // Las más nuevas primero
      },
      // Si quieres incluir quién respondió, puedes añadir:
      // include: { author: true }
    });
  }

  async respond(id: string, dto: RespondSuggestionDto, requestUser: User) {
    // 1. Bloqueo para empleados
    if (requestUser.role === 'EMPLOYEE') {
      throw new ForbiddenException(
        'Los empleados no pueden responder sugerencias',
      );
    }

    // 2. Verificamos existencia y permisos de visión
    await this.findOne(id, requestUser);

    // 3. Actualizamos con los datos del DTO
    return await this.prisma.suggestion.update({
      where: { id },
      data: {
        response: dto.response || null,
        status: dto.status,
        respondedAt: new Date(),
      },
    });
  }

  async remove(id: string, requestUser: User) {
    const suggestion = await this.prisma.suggestion.findUnique({
      where: { id },
    });

    if (!suggestion) {
      throw new NotFoundException('La sugerencia no existe');
    }

    // 2. Lógica de permisos por Rol

    // CASO EMPLEADO: Solo la suya y si está PENDING
    if (requestUser.role === 'EMPLOYEE') {
      if (suggestion.authorId !== requestUser.id) {
        throw new ForbiddenException(
          'No puedes eliminar una sugerencia que no creaste',
        );
      }
      if (suggestion.status !== 'PENDING') {
        throw new BadRequestException(
          'No puedes eliminar una sugerencia que ya ha sido procesada',
        );
      }
    } else if (requestUser.role === 'ADMIN') {
      if (suggestion.companyId !== requestUser.companyId) {
        throw new ForbiddenException(
          'No puedes eliminar sugerencias de otra empresa',
        );
      }
    }

    // 3. Ejecutar el borrado
    return await this.prisma.suggestion.delete({
      where: { id },
    });
  }
}
