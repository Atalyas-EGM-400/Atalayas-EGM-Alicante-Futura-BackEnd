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
import { Prisma } from '@prisma/client';

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly storageService: StorageService,
    private readonly enrollmentService: EnrollmentService,
  ) { }

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
      generatePresentation: false,
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
    let presentationUrl: string | null = null;

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
        options.generateLab ||
        options.generatePresentation
      ) {
        const rawText = await this.aiService.extractTextFromPdf(file.buffer);
        const tasks: Promise<void>[] = [];

        // Tarea: RESUMEN e IMAGEN (Agrupadas)
        if (options.generateSummary) {
          tasks.push(
            this.aiService
              .generateSummary(rawText)
              .then((res) => {
                summary = res;
              })
              .catch((err) =>
                console.error('[AI-Summary] Error:', err.message),
              ),
          );
        }

        if (options.generateImage) {
          tasks.push(
            this.aiService
              .generateImage(rawText)
              .then((res) => {
                imageUrl = res;
              })
              .catch((err) => console.error('[AI-Image] Error:', err.message)),
          );
        }

        if (options.generateVideo) {
          tasks.push(
            this.aiService
              .generateVideo(rawText)
              .then((res) => {
                if (res) videoUrl = res;
              })
              .catch((err) => console.error('[AI-Video] Error:', err.message)),
          );
        }

        if (options.generateQuiz) {
          tasks.push(
            this.aiService
              .generateQuizFromText(rawText)
              .then((res) => {
                quizData = res;
              })
              .catch((err) => console.error('[AI-Quiz] Error:', err.message)),
          );
        }

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
            })().catch((err) =>
              console.error('[AI-Podcast] Error:', err.message),
            ),
          );
        }

        if (options.generateLab) {
          tasks.push(
            this.aiService
              .generatePracticeLab(rawText)
              .then((res) => {
                labData = res;
              })
              .catch((err) => console.error('[AI-Lab] Error:', err.message)),
          );
        }

        if (options.generatePresentation) {
          tasks.push(
            this.aiService
              .generatePresentation(rawText)
              .then(async (buffer) => {
                presentationUrl = await this.storageService.uploadBuffer(
                  buffer,
                  `presentation-${Date.now()}.pptx`,
                  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                );
              })
              .catch((err) =>
                console.error('[AI-Presentation] Error:', err.message),
              ),
          );
        }

        // Esperamos a todas las IAs
        await Promise.allSettled(tasks);
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
        quiz: quizData || undefined,
        podcast: podcastData || undefined,
        practiceLab: labData || undefined,
        presentationUrl,
        order: nextOrder,
      },
    });
  }

  // Método para subir archivos (reutilizable)
  async uploadFile(file: Express.Multer.File): Promise<string> {
    return await this.storageService.uploadFile(file);
  }

  // NUEVO MÉTODO: Creación manual (solo texto y URLs, sin IA)
  async createManual(
    data: {
      title: string;
      summary: string;
      imageUrl: string | null;
      videoUrl: string | null;
      presentationUrl: string | null;
      url: string | null;
    },
    requestUser: User,
    courseId: string,
  ) {
    // 1. Validar permisos
    if (requestUser.role === 'EMPLOYEE' || requestUser.role === 'PUBLIC') {
      throw new ForbiddenException('No tienes permisos para crear contenido');
    }

    // 2. Verificar que el curso existe
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new NotFoundException('El curso no existe');

    // 3. Verificar permisos específicos según el rol
    if (requestUser.role === 'ADMIN') {
      // Si es ADMIN de empresa, verificar que el curso pertenece a su empresa
      if (course.companyId !== requestUser.companyId) {
        throw new ForbiddenException(
          'No tienes permisos para crear contenido en este curso',
        );
      }
    }

    // 4. Calcular orden correlativo
    const lastContent = await this.prisma.content.findFirst({
      where: { courseId },
      orderBy: { order: 'desc' },
    });
    const nextOrder = lastContent ? lastContent.order + 1 : 1;

    // 5. Crear el contenido manualmente
    return this.prisma.content.create({
      data: {
        title: data.title,
        courseId,
        summary: data.summary || '',
        imageUrl: data.imageUrl || null,
        videoUrl: data.videoUrl || null,
        presentationUrl: data.presentationUrl || null,
        url: data.url || null,
        quiz: undefined,
        podcast: undefined,
        practiceLab: undefined,
        order: nextOrder,
      },
    });
  }

  async findAll(requestUser: User, courseId: string) {
    const contents = await this.prisma.content.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      include: {
        Course: true,
        userProgresses: {
          where: {
            userId: requestUser.id,
          },
        },
      },
    });

    return contents.map((content) => {
      const progress = content.userProgresses[0];

      const quizData = content.quiz as any;
      const labData = content.practiceLab as any;

      const hasQuiz = Boolean(
        quizData &&
        quizData !== 'null' &&
        (
          (Array.isArray(quizData) && quizData.length > 0) ||
          (
            typeof quizData === 'object' &&
            quizData.questions &&
            Array.isArray(quizData.questions) &&
            quizData.questions.length > 0
          )
        )
      );

      const hasLab = Boolean(
        labData &&
        labData !== 'null'
      );

      const { userProgresses, ...rest } = content;

      return {
        ...rest,

        hasQuiz,
        hasLab,

        viewed: progress?.viewed ?? false,
        quizCompleted: progress?.quizCompleted ?? false,
        labCompleted: progress?.labCompleted ?? false,

        isCompleted: progress?.isCompleted ?? false,

        completedAt: progress?.completedAt ?? null,
      };
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

    const progress = userProgresses[0];

    const quizData = content.quiz as any;
    const labData = content.practiceLab as any;

    const hasQuiz = Boolean(
      quizData &&
      quizData !== 'null' &&
      (
        (Array.isArray(quizData) && quizData.length > 0) ||
        (
          typeof quizData === 'object' &&
          quizData.questions &&
          Array.isArray(quizData.questions) &&
          quizData.questions.length > 0
        )
      )
    );

    const hasLab = Boolean(
      labData &&
      labData !== 'null'
    );

    return {
      ...rest,

      hasQuiz,
      hasLab,

      viewed: progress?.viewed ?? false,
      quizCompleted: progress?.quizCompleted ?? false,
      labCompleted: progress?.labCompleted ?? false,

      isCompleted: progress?.isCompleted ?? false,

      completedAt: progress?.completedAt ?? null,
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
    const isPerfectScore = data.score === data.totalQuestions;

    if (!isPerfectScore) {
      return {
        success: false,
        message: 'Quiz no aprobado',
      };
    }

    await this.evaluateCompletion(
      requestUser.id,
      contentId,
      'quiz',
    );

    console.log('QUIZ ENDPOINT HIT');
    console.log('BODY:', data);
    console.log('USER:', requestUser);
    return {
      success: true,
    };
  }

  async completeLab(contentId: string, requestUser: User) {
    await this.evaluateCompletion(

      requestUser.id,
      contentId,
      'lab',

    );

    console.log('LAB ENDPOINT HIT');
    console.log('USER:', requestUser.id);
    console.log('CONTENT:', contentId);

    return {
      success: true,
    };
  }

  async markAsViewed(contentId: string, requestUser: User) {
    await this.evaluateCompletion(
      requestUser.id,
      contentId,
      'view',
    );
    console.log('VIEW ENDPOINT HIT');
    console.log('USER:', requestUser.id);
    console.log('CONTENT:', contentId);
    return {
      success: true,
    };
  }

  private async evaluateCompletion(
    userId: string,
    contentId: string,
    action: 'view' | 'quiz' | 'lab',
  ) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
    });

    if (!content) {
      throw new NotFoundException('Contenido no encontrado');
    }

    const quizData = content.quiz as any;
    const labData = content.practiceLab as any;

    const hasQuiz = Boolean(
      quizData &&
      quizData !== 'null' &&
      (
        (Array.isArray(quizData) && quizData.length > 0) ||
        (
          typeof quizData === 'object' &&
          quizData.questions &&
          Array.isArray(quizData.questions) &&
          quizData.questions.length > 0
        )
      )
    );

    const hasLab = Boolean(
      labData &&
      labData !== 'null'
    );

    const progress = await this.prisma.userProgress.upsert({
      where: {
        userId_contentId: {
          userId,
          contentId,
        },
      },

      update: {},
      create: {
        userId,
        contentId,
        viewed: false,
        quizCompleted: false,
        labCompleted: false,
        isCompleted: false,
      },

    });

    let viewed = progress.viewed;
    let quizCompleted = progress.quizCompleted;
    let labCompleted = progress.labCompleted;

    if (action === 'view') {
      viewed = true;
    }

    if (action === 'quiz') {
      quizCompleted = true;
    }

    if (action === 'lab') {
      labCompleted = true;
    }

    let completed = false;

    // SOLO lectura
    if (!hasQuiz && !hasLab) {
      completed = viewed;
    }

    // lectura + quiz
    if (hasQuiz && !hasLab) {
      completed = viewed && quizCompleted;
    }

    // lectura + lab
    if (!hasQuiz && hasLab) {
      completed = viewed && labCompleted;
    }

    // lectura + quiz + lab
    if (hasQuiz && hasLab) {
      completed = viewed && quizCompleted && labCompleted;
    }

    await this.prisma.userProgress.update({
      where: {
        userId_contentId: {
          userId,
          contentId,
        },
      },
      data: {
        viewed,
        quizCompleted,
        labCompleted,
        isCompleted: completed,
        completedAt:
          completed && !progress.isCompleted
            ? new Date()
            : progress.completedAt,
      },
    });

    if (completed) {
      await this.enrollmentService.completeManualLesson(
        userId,
        contentId,
      );
    }

    return completed;
  }
}