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
import { generate } from 'rxjs';
import { EnrollmentService } from '../enrollment/enrollment.service';

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
    // 1. Seguridad y validación de curso
    if (requestUser.role === 'EMPLOYEE' || requestUser.role === 'PUBLIC') {
      throw new ForbiddenException('No tienes permisos para crear contenido');
    }
    // 1. Validaciones de permisos
    const rolesProhibidos = ['EMPLOYEE', 'PUBLIC'];
    if (rolesProhibidos.includes(requestUser.role)) {
      throw new ForbiddenException('No tienes permisos para crear contenido');
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new NotFoundException('El curso no existe');

    // 2. Parsear opciones de IA (Summary, Quiz, Podcast, Video)
    let options = {
      generateSummary: false,
      generateQuiz: false,
      generatePodcast: false,
      generateImage: false,
      generateVideo: false,
      generateLab: false,
    };

    try {
      if (createContentDto.options) {
        options =
          typeof createContentDto.options === 'string'
            ? JSON.parse(createContentDto.options)
            : createContentDto.options;
      }
    } catch (e) {
      console.error('Error parsing options', e);
    }

    let finalUrl = createContentDto.url;
    let summary = '';
    let imageUrl: string | null = null;
    let videoUrl: string | null = null;
    let podcastData: any = null;
    let quizData: any = null;
    let labData: any = null;

    // 3. Procesamiento principal
    if (file) {
      finalUrl = await this.storageService.uploadFile(file);

      // Verificamos si hay alguna opción de IA activa
      if (
        options.generateSummary ||
        options.generateQuiz ||
        options.generatePodcast ||
        options.generateImage ||
        options.generateVideo ||
        options.generateLab
      ) {
        const rawText = await this.aiService.extractTextFromPdf(file.buffer);
        const tasks: Promise<any>[] = [];

        // Tarea: RESUMEN e IMAGEN (Agrupadas)
        if (options.generateSummary) {
          tasks.push(
            this.aiService
              .generateSummary(rawText)
              .then((res) => (summary = res)),
          );
        }

        if (options.generateImage) {
          tasks.push(
            this.aiService
              .generateImage(rawText)
              .then((res) => (imageUrl = res)),
          );
        }

        // Tarea: VÍDEO (Ahora es independiente del resumen)
        if (options.generateVideo) {
          console.log('[AI-Video] Iniciando proceso de búsqueda en Pexels...');
          tasks.push(
            this.aiService
              .generateVideo(rawText)
              .then((res) => {
                if (res) {
                  console.log('[AI-Video] URL recibida con éxito:', res);
                  videoUrl = res;
                }
              })
              .catch((err) => {
                console.error(
                  '[AI-Video] Error en tarea de vídeo:',
                  err.message,
                );
              }),
          );
        }

        // Tarea: QUIZ
        if (options.generateQuiz) {
          tasks.push(
            this.aiService
              .generateQuizFromText(rawText)
              .then((res) => (quizData = res)),
          );
        }

        // Tarea: PODCAST
        if (options.generatePodcast) {
          tasks.push(
            (async () => {
              const { script, audioBuffer } =
                await this.aiService.generatePodcast(rawText);
              const audioUrl = await this.storageService.uploadBuffer(
                audioBuffer,
                `podcast-${Date.now()}.mp3`,
                'audio/mpeg',
              );
              podcastData = { url: audioUrl, script };
            })(),
          );
        }

        if (options.generateLab) {
          tasks.push(
            this.aiService
              .generatePracticeLab(rawText)
              .then((res) => (labData = res))
              .catch((err) => console.error('[AI-Lab] Error:', err.message)),
          );
        }

        // Esperamos a todas las IAs
        await Promise.all(tasks);
      }
    }

    // 4. Calcular orden correlativo
    const lastContent = await this.prisma.content.findFirst({
      where: { courseId },
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
        quiz: quizData as any,
        podcast: podcastData as any,
        practiceLab: labData as any,
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
    const content = await this.prisma.content.findUnique({
      where: { id },
      include: {
        Course: true,
        userProgresses: {
          where: {
            userId: requestUser.id,
          },
        },
      },
    });

    if (!content) throw new NotFoundException(`Contenido no encontrado en DB`);
    if (requestUser.role === 'GENERAL_ADMIN') return content;

    const courseData = content.Course;
    if (!courseData) {
      throw new Error(
        'Error interno: No se pudo cargar la relación del curso.',
      );
    }

    if (
      courseData.companyId !== requestUser.companyId &&
      !courseData.isPublic
    ) {
      throw new ForbiddenException(
        `No tienes permiso para ver este contenido.`,
      );
    }

    const { userProgresses, ...rest } = content;

    return {
      ...rest,
      isCompleted:
        userProgresses.length > 0 ? userProgresses[0].isCompleted : false,
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

    await this.ensureUserProgress(requestUser.id, contentId);

    const progress = await this.prisma.userProgress.upsert({
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
