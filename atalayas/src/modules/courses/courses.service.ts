import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { User } from '@prisma/client';
import { AiService } from '../../infrastructure/ai/ai.service.js';
import { StorageService } from '../../infrastructure/storage/storage.service.js';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
    private readonly aiService: AiService
  ) { }

  async create(
    createCourseDto: CreateCourseDto,
    file: Express.Multer.File,
    requestUser: User,
  ) {
    if (requestUser.role === 'EMPLOYEE' || requestUser.role === 'PUBLIC') {
      throw new ForbiddenException('No tienes permisos para crear cursos');
    }

    const companyId =
      requestUser.role === 'GENERAL_ADMIN' && createCourseDto.companyId
        ? createCourseDto.companyId
        : requestUser.companyId;
    if (!companyId) {
      throw new ForbiddenException('Se requiere ID de empresa válido');
    }

    // 🛡️ Regla de seguridad: Solo GENERAL_ADMIN puede hacer cursos públicos
    if (requestUser.role !== 'GENERAL_ADMIN' && createCourseDto.isPublic) {
      throw new ForbiddenException(
        'Solo administradores generales pueden crear cursos públicos',
      );
    }

    // 🔥 NUEVA VALIDACIÓN: Si es especialización, jobRole es obligatorio
    if (createCourseDto.category === 'ESPECIALIZADO' && !createCourseDto.jobRole) {
      throw new BadRequestException('Los cursos de especialización requieren un rol');
    }

    let fileUrl: string | null = null;

    if (file) {
      fileUrl = await this.storageService.uploadFile(file);
    }

    return await this.prismaService.course.create({
      data: {
        title: createCourseDto.title,
        companyId,
        isPublic: createCourseDto.isPublic || false,
        category: createCourseDto.category || 'BASICO',
        fileUrl,
        // 🔥 NUEVO CAMPO: Si es onboarding, jobRole = null, si es especialización, se usa el valor
        jobRole: createCourseDto.category === 'BASICO' ? null : createCourseDto.jobRole || null,
      },
    });
  }

  /**
   * Actualiza los datos del curso y reemplaza el archivo en storage si se sube uno nuevo.
   */
  async update(
    id: string,
    updateCourseDto: UpdateCourseDto,
    requestUser: User,
    file?: Express.Multer.File,
  ) {
    const course = await this.findOne(id, requestUser);

    if (requestUser.role === 'EMPLOYEE') {
      throw new ForbiddenException('No tienes permisos para actualizar cursos');
    }

    // 🔥 NUEVA VALIDACIÓN: Si se actualiza a especialización, debe tener jobRole
    if (updateCourseDto.category === 'ESPECIALIZADO' && !updateCourseDto.jobRole) {
      throw new BadRequestException('Los cursos de especialización requieren un rol');
    }

    let fileUrl = course.fileUrl;

    if (file) {
      if (course.fileUrl) {
        try {
          await this.storageService.deleteFile(course.fileUrl);
        } catch (error) {
          console.error('Error al borrar archivo viejo:', error);
        }
      }
      fileUrl = await this.storageService.uploadFile(file);
    }

    // 🔥 NUEVO: Determinar el valor de jobRole según la categoría
    let jobRoleValue: string | null = null;
    if (updateCourseDto.category === 'ESPECIALIZADO') {
      jobRoleValue = updateCourseDto.jobRole || course.jobRole;
    } else if (updateCourseDto.category === 'BASICO') {
      jobRoleValue = null;
    } else {
      jobRoleValue = updateCourseDto.jobRole !== undefined ? updateCourseDto.jobRole : course.jobRole;
    }

    return this.prismaService.course.update({
      where: { id: course.id },
      data: {
        title: updateCourseDto.title,
        isPublic: updateCourseDto.isPublic,
        category: updateCourseDto.category,
        fileUrl,
        jobRole: jobRoleValue, // 🔥 NUEVO CAMPO
      },
    });
  }

  /**
   * Obtiene todos los cursos según el rol del usuario (Filtro por empresa o públicos).
   * 🔥 MODIFICADO: Ahora filtra también por jobRole para empleados
   */
  async findAll(requestUser: User) {
    if (requestUser.role === 'GENERAL_ADMIN') {
      return this.prismaService.course.findMany({
        include: { Company: true },
      });
    }

    if (requestUser.role === 'PUBLIC') {
      return this.prismaService.course.findMany({
        where: { isPublic: true },
      });
    }

    // 🔥 NUEVO: Para empleados, filtrar también por su jobRole
    const whereCondition: any = {
      OR: [{ companyId: requestUser.companyId }, { isPublic: true }],
    };

    // Si el empleado tiene un rol específico, mostrar solo cursos que coincidan
    if (requestUser.role === 'EMPLOYEE' && requestUser.jobRole) {
      whereCondition.AND = {
        OR: [
          { jobRole: null }, // Cursos de onboarding (sin restricción)
          { jobRole: requestUser.jobRole }, // Cursos de especialización que coinciden con su rol
        ],
      };
    }

    return this.prismaService.course.findMany({
      where: whereCondition,
      include: {
        Content: true,
        _count: {
          select: {
            Content: true,
          },
        },
      },
    });
  }

  /**
   * Obtiene un curso por ID con sus contenidos y progreso del usuario actual.
   */
  async findOne(id: string, requestUser: User) {
    const course = await this.prismaService.course.findUnique({
      where: { id },
      include: {
        Company: true,
        Content: {
          orderBy: { order: 'asc' },
          include: {
            userProgresses: {
              where: { userId: requestUser.id },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`El curso con ID ${id} no existe`);
    }

    const contentWithProgress = course.Content.map(c => ({
      ...c,
      isCompleted:
        c.userProgresses.length > 0
          ? c.userProgresses[0].isCompleted
          : false,
    }));

    // Validación de acceso por empresa
    if (
      requestUser.role !== 'GENERAL_ADMIN' &&
      course.companyId !== requestUser.companyId &&
      !course.isPublic
    ) {
      throw new ForbiddenException('No tienes permisos para ver este curso');
    }

    // 🔥 NUEVA VALIDACIÓN: Para empleados, verificar si tienen el rol requerido (especialización)
    if (
      requestUser.role === 'EMPLOYEE' &&
      course.category === 'ESPECIALIZADO' &&
      course.jobRole &&
      course.jobRole !== requestUser.jobRole
    ) {
      throw new ForbiddenException('No tienes el rol requerido para acceder a este curso de especialización');
    }

    return {
      ...course,
      Content: contentWithProgress,
    };
  }

  async remove(id: string, requestUser: User) {
    const course = await this.findOne(id, requestUser);

    if (requestUser.role === 'EMPLOYEE') {
      throw new ForbiddenException('No tienes permisos para eliminar cursos');
    }

    if (course.fileUrl) {
      try {
        await this.storageService.deleteFile(course.fileUrl);
      } catch (error) {
        console.error('Error al borrar archivo adjunto:', error);
      }
    }

    return this.prismaService.course.delete({
      where: { id: course.id },
    });
  }

  // 🔥 NUEVO MÉTODO: Obtener roles únicos de todos los empleados (CORREGIDO)
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

  // 🚀 MÉTODO PARA LA IA (CON GENERACIÓN DE QUIZ INCLUIDA)
  async generateContentWithAi(
    courseId: string,
    title: string,
    order: number,
    pdfFile: Express.Multer.File,
    requestUser: User,
  ) {
    // 1. Verificamos que el curso existe y el usuario tiene permisos
    const course = await this.findOne(courseId, requestUser);

    if (!pdfFile || pdfFile.mimetype !== 'application/pdf') {
      throw new BadRequestException('Por favor, sube un archivo PDF válido.');
    }

    const rawText = await this.aiService.extractTextFromPdf(pdfFile.buffer);

    // 2. Pasamos el PDF a nuestro AiService para que haga la magia (DeepSeek + ElevenLabs)
    const { script, audioBuffer } =
      await this.aiService.generatePodcast(rawText);

    // 🚀 2.5 NUEVO: Generamos el Test interactivo usando el resumen que acaba de crear
    console.log('🧠 Generando test interactivo a partir del resumen...');
    const quizData: any = await this.aiService.generateQuizFromText(script);

    // 3. Preparamos el archivo de audio para subirlo a Supabase
    const fileName = `curso_${course.id}_modulo_${Date.now()}.mp3`;
    const audioFileMock = {
      buffer: audioBuffer,
      originalname: fileName,
      mimetype: 'audio/mpeg',
    } as Express.Multer.File;

    console.log('⏳ Subiendo audio a Storage...');
    const audioUrl = await this.storageService.uploadFile(audioFileMock);
    console.log('✅ Audio subido. URL:', audioUrl);

    // 4. GUARDADO EN BASE DE DATOS
    console.log('🔥 Intentando insertar en la tabla Content de Prisma...');

    try {
      const nuevoContenido = await this.prismaService.content.create({
        data: {
          title: title,
          order: Number(order) || 1,
          courseId: course.id,
          summary: script,
          url: audioUrl,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          quiz: quizData,
        },
      });

      console.log('🎉 ¡EXITO! Fila insertada en la BD:', nuevoContenido);
      return nuevoContenido;
    } catch (dbError) {
      console.error('🚨 ERROR FATAL DE PRISMA AL INSERTAR:', dbError);
      throw new InternalServerErrorException(
        'Prisma se ha negado a guardar en la base de datos.',
      );
    }
  }
}