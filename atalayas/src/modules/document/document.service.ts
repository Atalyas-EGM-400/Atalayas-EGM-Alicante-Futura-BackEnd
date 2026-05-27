import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException, // Añadido
} from '@nestjs/common';
import { CreateDocumentDto } from './dto/create-document.dto.js';
import { UpdateDocumentDto } from './dto/update-document.dto.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { User } from '@prisma/client';
import { StorageService } from '../../infrastructure/storage/storage.service.js'; // 1. Importamos el StorageService
import 'multer';

@Injectable()
export class DocumentService {
  // 2. Inyectamos el StorageService en el constructor
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async create(
    createDocumentDto: CreateDocumentDto,
    requestUser: User,
    file: Express.Multer.File,
  ) {
    if (requestUser.role === 'EMPLOYEE' || requestUser.role === 'PUBLIC') {
      throw new ForbiddenException('No tienes permiso para subir documentos');
    }

    if (!file) {
      throw new BadRequestException('El archivo físico es obligatorio');
    }

    let finalCompanyId: string | null = null;
    let finalIsPublic: boolean = false;

    // --- CORRECCIÓN DE SEGURIDAD PARA MULTIPART/FORM-DATA ---
    // Saneamos los strings falsos que vienen del formulario
    const rawCompanyId = createDocumentDto.companyId;
    const cleanCompanyId =
      rawCompanyId &&
      rawCompanyId !== '' &&
      rawCompanyId !== 'null' &&
      rawCompanyId !== 'undefined'
        ? rawCompanyId
        : null;

    if (requestUser.role === 'GENERAL_ADMIN') {
      // Forzar conversión limpia a booleano
      finalIsPublic = String(createDocumentDto.isPublic) === 'true';
      finalCompanyId = cleanCompanyId;
    } else {
      // Si es Admin normal, SIEMPRE va a su empresa
      finalCompanyId = requestUser.companyId;
    }

    // Saneamos también el userId por si acaso
    let finalUserId: string | null = null;
    const rawUserId = createDocumentDto.userId;
    const cleanUserId =
      rawUserId &&
      rawUserId !== '' &&
      rawUserId !== 'null' &&
      rawUserId !== 'undefined'
        ? rawUserId
        : null;

    if (cleanUserId) {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: cleanUserId },
      });
      if (!targetUser) throw new NotFoundException(`Usuario no encontrado`);
      if (finalCompanyId !== null && targetUser.companyId !== finalCompanyId) {
        throw new ForbiddenException(
          'Imposible, el empleado seleccionado pertenece a otra empresa.',
        );
      }
      finalUserId = cleanUserId;
    }

    // Subir el archivo a Supabase
    const fileUrl = await this.storageService.uploadFile(file);

    return this.prisma.document.create({
      data: {
        title: createDocumentDto.title,
        fileUrl: fileUrl,
        isPublic: finalIsPublic,
        companyId: finalCompanyId, // Ahora sí guardará un NULL real de SQL
        userId: finalUserId,
      },
    });
  }

  async findAll(requestUser: User) {
    // 1. SÚPER ADMIN: Ve absolutamente todo (Globales y de todas las empresas)
    if (requestUser.role === 'GENERAL_ADMIN') {
      return this.prisma.document.findMany({
        include: { Company: true, User: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    // 2. ADMIN DE EMPRESA: Ve Globales + TODOS los de su empresa
    if (requestUser.role === 'ADMIN') {
      return this.prisma.document.findMany({
        where: {
          OR: [
            // CORRECCIÓN AQUÍ: Forzamos el NULL real de la base de datos
            {
              isPublic: true,
              companyId: { equals: null },
            },
            // Toda la caja fuerte de su empresa (públicos y privados de sus empleados)
            {
              companyId: requestUser.companyId,
            },
          ],
        },
        include: { Company: true, User: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    // 3. EMPLEADOS: Seguridad ajustada
    return this.prisma.document.findMany({
      where: {
        OR: [
          // Nivel 1: Globales del sistema (Subidos por el GENERAL_ADMIN para todos)
          {
            isPublic: true,
            companyId: { equals: null },
          },

          // Nivel 2: Documentos compartidos de SU empresa (userId es null)
          {
            companyId: requestUser.companyId,
            userId: { equals: null },
          },

          // Nivel 3: SOLO SUS documentos personales privados
          {
            companyId: requestUser.companyId,
            userId: requestUser.id,
          },
        ],
      },
      include: { Company: true, User: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, requestUser: User) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: { Company: true, User: true },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    // Si el usuario no es SuperAdmin, tenemos que validar accesos
    if (requestUser.role !== 'GENERAL_ADMIN') {
      // Permitir el acceso si el documento es global (isPublic y sin empresa)
      const isGlobalDoc = document.isPublic && !document.companyId;
      const belongsToMyCompany = document.companyId === requestUser.companyId;

      if (!isGlobalDoc && !belongsToMyCompany) {
        throw new ForbiddenException(
          'No tienes permisos para ver este documento',
        );
      }
    }

    return document;
  }

  async update(
    id: string,
    updateDocumentDto: UpdateDocumentDto,
    requestUser: User,
  ) {
    await this.findOne(id, requestUser);

    if (requestUser.role === 'EMPLOYEE') {
      throw new ForbiddenException('Los empleados no pueden editar documentos');
    }

    return this.prisma.document.update({
      where: { id },
      data: updateDocumentDto,
    });
  }

  async remove(id: string, requestUser: User) {
    // 1. Buscamos el documento. Si no existe o no es de su empresa, findOne lanzará un error y parará aquí.
    const document = await this.findOne(id, requestUser);

    // 2. Seguridad extra: Los empleados no pueden borrar
    if (requestUser.role === 'EMPLOYEE') {
      throw new ForbiddenException('Los empleados no pueden borrar documentos');
    }

    // 3. ELIMINACIÓN FÍSICA: Borramos el archivo de Supabase usando la URL que guardamos
    if (document.fileUrl) {
      await this.storageService.deleteFile(document.fileUrl);
    }

    // 4. ELIMINACIÓN LÓGICA: Borramos la fila en la base de datos
    return this.prisma.document.delete({
      where: { id },
    });
  }
}
