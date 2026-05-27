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
    // 1. Obtenemos el usuario primero para tener el companyId disponible
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });

    // 2. Ejecutamos las 6 consultas en un único Promise.all
    const [
      completedContents,
      enrollments,
      documents,
      announcements,
      completedTasks,
      events,
    ] = await Promise.all([
      // 1. Contenidos
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

      // 2. Inscripciones
      this.prisma.enrollment.findMany({
        where: { userId },
        orderBy: { Course: { createdAt: 'desc' } },
        take: limit,
        include: { Course: { select: { title: true, createdAt: true } } },
      }),

      // 3. Documentos
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

      // 4. Anuncios
      this.prisma.announcement.findMany({
        where: {
          OR: [{ isPublic: true }, { companyId: user?.companyId ?? undefined }],
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),

      // 5. Tareas de onboarding
      this.prisma.userTaskProgress.findMany({
        where: { userId, done: true },
        orderBy: { created_at: 'desc' },
        take: limit,
        include: { Task: { select: { label: true } } },
      }),

      // 6. EVENTOS (Debe ir dentro del Promise.all)
      this.prisma.events.findMany({
        where: {
          OR: [
            { companyId: user?.companyId ?? undefined },
            { companyId: null },
          ],
        },
        include: {
          Company: { select: { name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: limit,
      }),
    ]);

    // 3. Mapeo uniforme
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

      ...events.map((ev) => ({
        id: ev.id,
        type: 'EVENT_ADDED' as const,
        title: `Nuevo evento: ${ev.title}`,
        description: ev.Company?.name || 'Atalayas EGM',
        icon: 'bi-calendar-event-fill',
        createdAt: ev.created_at,
        href: `/dashboard/employee/events/${ev.id}`,
      })),
    ];

    // 4. Ordenar y limitar
    return items
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}
