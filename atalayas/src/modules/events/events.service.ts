import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { User } from '@prisma/client';
import { StorageService } from '../../infrastructure/storage/storage.service';

@Injectable()
export class EventsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async create(
    createDto: CreateEventDto,
    requestUser: User,
    file?: Express.Multer.File,
  ) {
    // 1. Permisos: Solo ADMIN o GENERAL_ADMIN
    if (requestUser.role === 'EMPLOYEE' || requestUser.role === 'PUBLIC') {
      throw new ForbiddenException('No tienes permisos para crear eventos');
    }

    // 2. Imagen
    let imageUrl = createDto.image_url;
    if (file) {
      imageUrl = await this.storageService.uploadFile(file);
    }

    // 3. Determinar CompanyId
    let companyId: string | null;
    if (requestUser.role === 'GENERAL_ADMIN') {
      companyId =
        createDto.companyId !== undefined ? createDto.companyId : null;
    } else {
      companyId = requestUser.companyId;
    }
    return await this.prismaService.events.create({
      data: {
        title: createDto.title,
        description: createDto.description,
        event_date: new Date(createDto.event_date), // Aseguramos que sea objeto Date
        location: createDto.location,
        max_capacity: createDto.max_capacity
          ? Number(createDto.max_capacity)
          : null,
        image_url: imageUrl,
        companyId: companyId,
      },
    });
  }

  async findAll(requestUser: User) {
    // Si es GENERAL_ADMIN, ve todo.
    // Si no, ve los de su empresa O los que no tienen empresa (globales).
    const where =
      requestUser.role === 'GENERAL_ADMIN'
        ? {}
        : {
            OR: [{ companyId: requestUser.companyId }, { companyId: null }],
          };

    return await this.prismaService.events.findMany({
      where,
      include: {
        _count: { select: { EventAttendees: true } },
      },
      orderBy: { event_date: 'asc' },
    });
  }

  async findOne(id: string, requestUser: User) {
    const event = await this.prismaService.events.findUnique({
      where: { id },
      include: {
        Company: { select: { name: true } },
        EventAttendees: {
          include: {
            User: {
              select: {
                name: true,
                email: true,
                avatarUrl: true,
                Company: true,
              },
            },
          },
        },
        _count: { select: { EventAttendees: true } },
      },
    });

    if (!event) throw new NotFoundException('El evento no existe');

    // SEGURIDAD ACTUALIZADA:
    // Permite ver si:
    // 1. Es General Admin
    // 2. El evento es global (companyId === null)
    // 3. El evento pertenece a su empresa
    const isGlobalEvent = event.companyId === null;
    const isMyCompanyEvent = event.companyId === requestUser.companyId;

    if (
      requestUser.role !== 'GENERAL_ADMIN' &&
      !isGlobalEvent &&
      !isMyCompanyEvent
    ) {
      throw new ForbiddenException('No tienes permiso para ver este evento');
    }

    return event;
  }

  // --- Lógica de RSVP (Asistir / Cancelar) ---
  async toggleRSVP(eventId: string, userId: string, status: boolean) {
    return await this.prismaService.eventAttendees.upsert({
      where: {
        event_id_user_id: { event_id: eventId, user_id: userId },
      },
      update: { status, updated_at: new Date() },
      create: { event_id: eventId, user_id: userId, status },
    });
  }

  async update(
    id: string,
    updateDto: UpdateEventDto,
    requestUser: User,
    file?: Express.Multer.File,
  ) {
    // 1. Buscar el evento existente
    const event = await this.prismaService.events.findUnique({
      where: { id },
    });

    if (!event) throw new NotFoundException('Evento no encontrado');

    // 2. Control de Acceso (Seguridad)
    // Si es ADMIN de empresa, verificamos que el evento sea de su misma empresa
    if (
      requestUser.role === 'ADMIN' &&
      event.companyId !== requestUser.companyId
    ) {
      throw new ForbiddenException(
        'No tienes permiso para editar eventos de otra empresa',
      );
    }

    // Si es un rol inferior, prohibimos la edición
    if (requestUser.role === 'EMPLOYEE' || requestUser.role === 'PUBLIC') {
      throw new ForbiddenException('No tienes permisos para editar eventos');
    }

    // 3. Gestión de la imagen
    let imageUrl = event.image_url;
    if (file) {
      // Si suben una nueva, podrías opcionalmente borrar la anterior aquí
      imageUrl = await this.storageService.uploadFile(file);
    }

    // 4. Ejecutar la actualización
    return await this.prismaService.events.update({
      where: { id },
      data: {
        title: updateDto.title ?? event.title,
        description: updateDto.description ?? event.description,
        event_date: updateDto.event_date
          ? new Date(updateDto.event_date)
          : event.event_date,
        location: updateDto.location ?? event.location,
        max_capacity: updateDto.max_capacity
          ? Number(updateDto.max_capacity)
          : event.max_capacity,
        image_url: imageUrl,
        // El companyId NO debería cambiarse a menos que seas GENERAL_ADMIN
        companyId:
          requestUser.role === 'GENERAL_ADMIN' && updateDto.companyId
            ? updateDto.companyId
            : event.companyId,
      },
    });
  }

  async remove(id: string, requestUser: User) {
    const event = await this.prismaService.events.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Evento no encontrado');

    if (
      requestUser.role === 'ADMIN' &&
      event.companyId !== requestUser.companyId
    ) {
      throw new ForbiddenException(
        'No puedes eliminar eventos de otra empresa',
      );
    }

    return await this.prismaService.events.delete({ where: { id } });
  }
}
