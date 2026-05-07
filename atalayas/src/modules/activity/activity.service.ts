import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ActivityItem } from './activity.types';

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  async getActivityForUser(
    userId: string,
    limit = 10,
  ): Promise<ActivityItem[]> {
    // Todas las queries en paralelo
    const [
      completedContents,
      enrollments,
      documents,
      announcements,
      completedTasks,
    ] = await Promise.all([
      // 1. Contenidos completados recientemente
      this.prisma.userProgress.findMany({
        where: { userId, isCompleted: true },
        orderBy: { completedAt: 'desc' },
        take: limit,
        include: {
          Content: {
            select: { title: true, Course: { select: { title: true } } },
          },
        },
      }),

      // 2. Inscripciones en cursos
      this.prisma.enrollment.findMany({
        where: { userId },
        orderBy: { Course: { createdAt: 'desc' } },
        take: limit,
        include: { Course: { select: { title: true, createdAt: true } } },
      }),

      // 3. Documentos subidos al usuario o a su empresa
      this.prisma.user
        .findUnique({ where: { id: userId }, select: { companyId: true } })
        .then((user) =>
          this.prisma.document.findMany({
            where: {
              OR: [
                { userId },
                { companyId: user?.companyId ?? undefined, isPublic: true },
              ],
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
          }),
        ),

      // 4. Anuncios de la empresa o públicos
      this.prisma.user
        .findUnique({ where: { id: userId }, select: { companyId: true } })
        .then((user) =>
          this.prisma.announcement.findMany({
            where: {
              OR: [
                { isPublic: true },
                { companyId: user?.companyId ?? undefined },
              ],
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
          }),
        ),

      // 5. Tareas de onboarding completadas
      this.prisma.userTaskProgress.findMany({
        where: { userId, done: true },
        orderBy: { created_at: 'desc' },
        take: limit,
        include: { Task: { select: { label: true } } },
      }),
    ]);

    // Mapear cada tabla a ActivityItem uniforme
    const items: ActivityItem[] = [
      ...completedContents.map((p) => ({
        id: p.id,
        type: 'CONTENT_COMPLETED' as const,
        title: 'Completado ' + p.Content.title,
        description: `En el curso "${p.Content.Course.title}"`,
        icon: 'bi-check-circle-fill',
        createdAt: p.completedAt,
        href: undefined,
      })),

      ...enrollments.map((e) => ({
        id: e.id,
        type: 'COURSE_ENROLLED' as const,
        title: `Inscrito en "${e.Course.title}"`,
        description: 'Nuevo curso iniciado',
        icon: 'bi-journal-bookmark-fill',
        createdAt: e.Course.createdAt,
        href: `/dashboard/employee/courses/${e.courseId}`,
      })),

      ...documents.map((d) => ({
        id: d.id,
        type: 'DOCUMENT_ADDED' as const,
        title: d.title,
        description: 'Documento disponible',
        icon: 'bi-file-earmark-text-fill',
        createdAt: d.createdAt,
        href: `/dashboard/documents`,
      })),

      ...announcements.map((a) => ({
        id: a.id,
        type: 'ANNOUNCEMENT' as const,
        title: a.title,
        description:
          a.content.slice(0, 60) + (a.content.length > 60 ? '…' : ''),
        icon: 'bi-megaphone-fill',
        createdAt: a.createdAt,
        href: `/dashboard/employee/announcements/${a.id}`,
      })),

      ...completedTasks.map((t) => ({
        id: t.id,
        type: 'TASK_COMPLETED' as const,
        title: t.Task.label,
        description: 'Tarea de onboarding completada',
        icon: 'bi-rocket-takeoff-fill',
        createdAt: t.created_at,
        href: `/dashboard/employee/onboarding`,
      })),
    ];

    // Ordenar por fecha descendente y limitar
    return items
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}
