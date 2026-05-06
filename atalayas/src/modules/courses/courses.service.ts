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

    let fileUrl: string | null = null;

    if (file) {
      // Usamos directamente el 'file' que viene de Multer,
      // storageService ya debería encargarse del resto.
      fileUrl = await this.storageService.uploadFile(file);
    }

    return await this.prismaService.course.create({
      // ... resto de tu lógica de creación

      data: {
        title: createCourseDto.title,
        companyId,
        isPublic: createCourseDto.isPublic || false,
        category: createCourseDto.category || 'BASICO',
        fileUrl,
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

    return this.prismaService.course.update({
      where: { id: course.id },
      data: {
        title: updateCourseDto.title,
        isPublic: updateCourseDto.isPublic,
        category: updateCourseDto.category,
        fileUrl,
      },
    });
  }

  /**
   * Obtiene todos los cursos según el rol del usuario (Filtro por empresa o públicos).
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

    return this.prismaService.course.findMany({
      where: {
        OR: [{ companyId: requestUser.companyId }, { isPublic: true }],
      },
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

    return {
      ...course,
      Content: contentWithProgress,
    };
  }

  async findById(courseId: string) {
    return this.prismaService.course.findUnique({
      where: { id: courseId },
    });
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
          quiz: quizData, // 👈 ¡MAGIA! Guardamos el JSON del test aquí
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
