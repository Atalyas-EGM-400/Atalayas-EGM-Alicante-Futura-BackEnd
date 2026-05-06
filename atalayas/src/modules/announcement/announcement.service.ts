import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
// Si no tienes este archivo, créalo o usa Partial<CreateAnnouncementDto>
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { User } from '@prisma/client';
import { StorageService } from '../../infrastructure/storage/storage.service';

@Injectable()
export class AnnouncementService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async create(
    createAnnouncementDto: CreateAnnouncementDto,
    requestUser: User,
    file?: Express.Multer.File, // Tercer parámetro opcional para la imagen
  ) {
    if (
      requestUser.role !== 'GENERAL_ADMIN' &&
      createAnnouncementDto.isPublic
    ) {
      throw new ForbiddenException(
        'Solo administradores generales pueden crear cursos públicos',
      );
    }
    // 1. Lógica de permisos (Fuera de la llamada a Prisma)
    if (requestUser.role === 'EMPLOYEE' || requestUser.role === 'PUBLIC') {
      throw new ForbiddenException('No tienes permisos');
    }

    // 2. Lógica de la imagen (Igual que en Cursos)
    let imageUrl = createAnnouncementDto.imageUrl;
    if (file) {
      imageUrl = await this.storageService.uploadFile(file);
    }

    const companyId =
      requestUser.role === 'GENERAL_ADMIN' && createAnnouncementDto.companyId
        ? createAnnouncementDto.companyId
        : requestUser.companyId;

    // 3. LA LLAMADA A PRISMA (Solo 1 argumento: el objeto de configuración)
    return await this.prismaService.announcement.create({
      data: {
        title: createAnnouncementDto.title,
        content: createAnnouncementDto.content,
        imageUrl: imageUrl,
        isPublic: String(createAnnouncementDto.isPublic) === 'true',
        companyId: companyId,
      },
    });
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
    updateAnnouncementDto: UpdateAnnouncementDto,
    requestUser: User,
  ) {
    const announcement = await this.findOne(id, requestUser);

    // SOLUCIÓN AL ERROR NULL: Verificamos existencia antes de acceder a propiedades
    if (!announcement) throw new NotFoundException('No encontrado');

    if (
      requestUser.role === 'ADMIN' &&
      announcement.companyId !== requestUser.companyId
    ) {
      throw new ForbiddenException('No es de tu empresa');
    }

    return await this.prismaService.announcement.update({
      where: { id },
      data: {
        title: updateAnnouncementDto.title,
        content: updateAnnouncementDto.content,
        imageUrl: updateAnnouncementDto.imageUrl,
        isPublic: updateAnnouncementDto.isPublic,
      },
    });
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
