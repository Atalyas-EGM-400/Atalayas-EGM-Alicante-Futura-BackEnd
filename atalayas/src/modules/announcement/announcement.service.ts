import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { User } from '@prisma/client';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AnnouncementService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    createAnnouncementDto: CreateAnnouncementDto,
    requestUser: User,
    file?: Express.Multer.File,
  ) {
    // 1. Validaciones de permisos
    if (
      requestUser.role !== 'GENERAL_ADMIN' &&
      createAnnouncementDto.isPublic
    ) {
      throw new ForbiddenException(
        'Solo administradores generales pueden crear anuncios públicos',
      );
    }

    if (requestUser.role === 'EMPLOYEE' || requestUser.role === 'PUBLIC') {
      throw new ForbiddenException('No tienes permisos para crear anuncios');
    }

    // 2. Gestión de imagen
    let imageUrl = createAnnouncementDto.imageUrl;
    if (file) {
      imageUrl = await this.storageService.uploadFile(file);
    }

    const companyId =
      requestUser.role === 'GENERAL_ADMIN' && createAnnouncementDto.companyId
        ? createAnnouncementDto.companyId
        : requestUser.companyId;

    // 3. Guardado en Base de Datos
    const announcement = await this.prismaService.announcement.create({
      data: {
        title: createAnnouncementDto.title,
        content: createAnnouncementDto.content,
        imageUrl: imageUrl,
        isPublic: createAnnouncementDto.isPublic,
        companyId: companyId,
      },
    });

    // 4. NOTIFICACIÓN POR EMAIL (Nuevo)
    // Verificamos si sendEmail viene en el DTO (recuerda que desde FormData llega como string)
    if (createAnnouncementDto.sendEmail) {
      await this.notificationsService.notifyByEmail({
        targetCompanyId: announcement.companyId,
        isPublic: announcement.isPublic,
        title: announcement.title,
        message: announcement.content,
        type: 'ANUNCIO',
        link: `/dashboard/announcements/${announcement.id}`,
      });
    }

    return announcement;
  }

  async findAll(requestUser: User) {
    if (requestUser.role === 'GENERAL_ADMIN') {
      return await this.prismaService.announcement.findMany({
        include: { Company: true },
        orderBy: { createdAt: 'desc' },
      });
    }
    return await this.prismaService.announcement.findMany({
      where: {
        OR: [{ companyId: requestUser.companyId }, { isPublic: true }],
      },
      include: { Company: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, requestUser: User) {
    if (id === 'new') return null;

    const announcement = await this.prismaService.announcement.findUnique({
      where: { id },
      include: { Company: true },
    });

    if (!announcement) throw new NotFoundException('No encontrado');

    if (requestUser.role === 'PUBLIC' && !announcement.isPublic) {
      throw new ForbiddenException('Acceso denegado');
    }

    return announcement;
  }

  async findPublic() {
    return await this.prismaService.announcement.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async update(
    id: string,
    updateDto: UpdateAnnouncementDto,
    requestUser: User,
    file?: Express.Multer.File, // Añadimos el archivo opcional
  ) {
    const announcement = await this.findOne(id, requestUser);

    if (!announcement) throw new NotFoundException('No encontrado');

    // Seguridad de empresa
    if (
      requestUser.role === 'ADMIN' &&
      announcement.companyId !== requestUser.companyId
    ) {
      throw new ForbiddenException('No es de tu empresa');
    }

    // 1. Lógica de imagen: Si viene un archivo nuevo, lo procesamos
    let finalImageUrl = announcement.imageUrl;
    if (file) {
      // Aquí llamarías a tu servicio de subida (Cloudinary, S3, etc.)
      // finalImageUrl = await this.uploadService.upload(file);
      // Por ahora simulamos que guardamos la ruta si fuera local:
      finalImageUrl = `/uploads/${file.filename}`;
    }

    // 2. Actualizamos en DB
    const updated = await this.prismaService.announcement.update({
      where: { id },
      data: {
        title: updateDto.title ?? announcement.title,
        content: updateDto.content ?? announcement.content,
        imageUrl: finalImageUrl,
        // Manejo de booleanos desde FormData (vienen como string "true"/"false")
        isPublic: updateDto.isPublic === true,
      },
    });

    // 3. OPCIONAL: ¿Quieres que si editan y marcan "notificar" se envíe de nuevo?
    if (updateDto.sendEmail === true) {
      await this.notificationsService.notifyByEmail({
        targetCompanyId: updated.companyId,
        isPublic: updated.isPublic,
        title: `ACTUALIZACIÓN: ${updated.title}`,
        message: updated.content,
        type: 'ANUNCIO',
        link: `/dashboard/announcements/${updated.id}`,
      });
    }

    return updated;
  }

  async remove(id: string, requestUser: User) {
    const announcement = await this.findOne(id, requestUser);

    // SOLUCIÓN AL ERROR NULL
    if (!announcement) throw new NotFoundException('No encontrado');

    if (
      requestUser.role === 'ADMIN' &&
      announcement.companyId !== requestUser.companyId
    ) {
      throw new ForbiddenException('No puedes eliminarlo');
    }

    return await this.prismaService.announcement.delete({ where: { id } });
  }
}
