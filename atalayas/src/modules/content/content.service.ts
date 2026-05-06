import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { User } from '@prisma/client';
import { AiService } from '../../infrastructure/ai/ai.service';
import { StorageService } from '../../infrastructure/storage/storage.service';

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly storageService: StorageService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  async create(
    createContentDto: CreateContentDto,
    requestUser: User,
    courseId: string,
    file?: Express.Multer.File,
  ) {
    console.log('courseId:', courseId);
    console.log('requestUser:', requestUser);
    console.log('createContentDto:', createContentDto);
    if (requestUser.role === 'EMPLOYEE' || requestUser.role === 'PUBLIC') {
      throw new ForbiddenException('No tienes permisos para crear contenido');
    }
    // 1. Validaciones de permisos
    const rolesProhibidos = ['EMPLOYEE', 'PUBLIC'];
    if (rolesProhibidos.includes(requestUser.role)) {
      throw new ForbiddenException('No tienes permisos para crear contenido');
    }

    const courseExists = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!courseExists) {
      throw new NotFoundException(`El curso con ID ${courseId} no existe.`);
    }

    if (
      requestUser.role === 'ADMIN' &&
      courseExists.companyId !== requestUser.companyId
    ) {
      throw new ForbiddenException(
        `No tienes permisos para agregar contenido a este curso.`,
      );
    }

    // 2. Parsear opciones de IA
    let options = {
      generateSummary: false,
      generateQuiz: false,
      generatePodcast: false,
    };

    try {
      if (createContentDto.options) {
        options =
          typeof createContentDto.options === 'string'
            ? JSON.parse(createContentDto.options)
            : createContentDto.options;
      }
    } catch (e) {
      console.error('Error parsing options JSON', e);
    }

    let finalUrl = createContentDto.url;
    let summary = '';
    let podcastData: { url: string; script: string } | null = null;
    let quizData: any = null;

    // 3. Procesamiento de archivo y IA
    if (file) {
      finalUrl = await this.storageService.uploadFile(file);

      if (
        options.generateSummary ||
        options.generateQuiz ||
        options.generatePodcast
      ) {
        const rawText = await this.aiService.extractTextFromPdf(file.buffer);

        // Ejecutamos en paralelo para ganar velocidad
        const tasks: Promise<any>[] = [];

        if (options.generateSummary) {
          tasks.push(
            this.aiService
              .generateSummary(rawText)
              .then((res) => (summary = res)),
          );
        }

        if (options.generateQuiz) {
          tasks.push(
            this.aiService
              .generateQuizFromText(rawText)
              .then((res) => (quizData = res)),
          );
        }

        if (options.generatePodcast) {
          tasks.push(
            (async () => {
              const { script, audioBuffer } =
                await this.aiService.generatePodcast(rawText);
              const audioFileMock = {
                buffer: audioBuffer,
                originalname: `podcast_${Date.now()}.mp3`,
                mimetype: 'audio/mpeg',
              } as Express.Multer.File;
              const audioUrl =
                await this.storageService.uploadFile(audioFileMock);
              podcastData = { url: audioUrl, script: script };
            })(),
          );
        }

        await Promise.all(tasks);
      }
    }

    // 4. Lógica de orden
    const lastContent = await this.prisma.content.findFirst({
      where: { courseId: courseId },
      orderBy: { order: 'desc' },
    });
    const nextOrder = lastContent ? lastContent.order + 1 : 1;

    // 5. Persistencia en Base de Datos
    return this.prisma.content.create({
      data: {
        title: createContentDto.title,
        courseId,
        url: finalUrl,
        summary,
        imageUrl,
        videoUrl,
        quiz: quizData,
        podcast: podcastData,
        practiceLab: labData,
        order: nextOrder,
      },
    });
  }

  async findAll(requestUser: User, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException(`El curso con ID ${courseId} no existe.`);
    }
    if (!course) throw new NotFoundException(`Curso no encontrado`);

    if (
      requestUser.role !== 'GENERAL_ADMIN' &&
      course.companyId !== requestUser.companyId
    ) {
      throw new ForbiddenException(`No tienes acceso al curso.`);
    }
    return this.prisma.content.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      include: { Course: true }, // Traemos la información del curso al que pertenece cada contenido
    });
  }

  async findOne(id: string, requestUser: User) {
    // Eliminamos los console.log de depuración para producción
    const content = await this.prisma.content.findUnique({
      where: { id },
      include: {
        Course: true,
        // 🚀 AQUÍ ESTÁ EL CAMBIO: Traemos el progreso solo de este usuario
        // 1. Incluimos el progreso del usuario que hace la petición
        userProgresses: {
          where: {
            userId: requestUser.id,
          },
        },
      },
    });

    if (!content) throw new NotFoundException(`Contenido no encontrado en DB`);

    // Si es un administrador global, devolvemos todo directamente
    if (requestUser.role === 'GENERAL_ADMIN') return content;

    const courseData = content.Course;

    if (!courseData) {
      throw new Error(
        'Error interno: No se pudo cargar la relación del curso.',
      );
    }

    // Validación de seguridad por compañía
    if (
      courseData.companyId !== requestUser.companyId &&
      !courseData.isPublic
    ) {
      throw new ForbiddenException(
        `No tienes permiso para ver este contenido.`,
      );
    }

    // 2. Aplanamos la respuesta para que el frontend reciba "isCompleted" directamente
    // En lugar de UserProgress: [{ isCompleted: true }]
    const { userProgresses, ...rest } = content;

    return {
      ...rest,
      isCompleted:
        userProgresses.length > 0 ? userProgresses[0].isCompleted : false,
      // Opcional: puedes devolver también la fecha si la necesitas
      completedAt:
        userProgresses.length > 0 ? userProgresses[0].completedAt : null,
    };
  }

  async update(
    id: string,
    updateContentDto: UpdateContentDto,
    requestUser: User,
  ) {
    const content = await this.findOne(id, requestUser);
    if (requestUser.role === 'EMPLOYEE') {
      throw new ForbiddenException(
        'No tienes permisos para actualizar contenido',
      );
    }
    if (
      requestUser.role === 'ADMIN' &&
      content.Course.companyId !== requestUser.companyId
    ) {
      throw new ForbiddenException(
        'No tienes permisos para actualizar contenido de este curso',
      );
    }

    return this.prisma.content.update({
      where: { id },
      data: updateContentDto,
    });
  }

  async remove(id: string, requestUser: User) {
    const content = await this.findOne(id, requestUser);
    const role = requestUser.role as string;

    if (role === 'EMPLOYEE') {
      throw new ForbiddenException(
        'No tienes permisos para eliminar contenido',
      );
    }
    if (
      role === 'ADMIN' &&
      content.Course.companyId !== requestUser.companyId
    ) {
      throw new ForbiddenException(
        'No tienes permisos para eliminar contenido de este curso',
      );
    }

    return this.prisma.content.delete({ where: { id } });
  }
  async completeQuiz(
    contentId: string,
    requestUser: User,
    data: { score: number; totalQuestions: number },
  ) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
    });

    if (!content) {
      throw new NotFoundException('Contenido no encontrado');
    }

    const isPerfectScore = data.score === data.totalQuestions;

    return this.prisma.userProgress.upsert({
      where: {
        userId_contentId: {
          userId: requestUser.id,
          contentId: contentId,
        },
      },
      update: {
        isCompleted: isPerfectScore,
        completedAt: isPerfectScore ? new Date() : undefined,
      },
      create: {
        userId: requestUser.id,
        contentId: contentId,
        isCompleted: isPerfectScore,
      },
    });

    if (isPerfectScore) {
      await this.enrollmentService.completeManualLesson(
        requestUser.id,
        contentId,
      );
    }

    return progress;
  }
  private async ensureUserProgress(userId: string, contentId: string) {
    const exists = await this.prisma.userProgress.findUnique({
      where: {
        userId_contentId: { userId, contentId },
      },
    });

    if (!exists) {
      await this.prisma.userProgress.create({
        data: {
          userId,
          contentId,
          isCompleted: false,
          lastTime: 0,
        },
      });
    }
  }
}
