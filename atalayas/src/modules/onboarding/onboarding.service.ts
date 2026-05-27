import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { OnboardingStep } from '@prisma/client';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  async savePlan(companyId: string, steps: any[]) {
    console.log('=== savePlan ===');
    console.log('CompanyId:', companyId);
    console.log('Steps a procesar:', steps.length);

    return this.prisma.$transaction(
      async (tx) => {
        const createdSteps: OnboardingStep[] = [];

        for (const step of steps) {
          console.log(`Procesando step día ${step.day}, tipo: ${step.type}`);

          const updatedStep = await tx.onboardingStep.upsert({
            where: {
              companyId_day: { companyId, day: step.day },
            },
            update: {
              title: step.title,
              description: step.description,
              badge: step.badge,
              type: step.type || 'ONBOARDING',
              job_role: step.jobRole,
            },
            create: {
              day: step.day,
              title: step.title,
              description: step.description,
              badge: step.badge,
              type: step.type || 'ONBOARDING',
              job_role: step.jobRole,
              companyId: companyId,
            },
          });

          if (step.tasks && Array.isArray(step.tasks)) {
            const taskPromises = step.tasks.map((taskData) =>
              tx.onboardingTask.upsert({
                where: {
                  stepId_label: {
                    stepId: updatedStep.id,
                    label: taskData.label,
                  },
                },
                update: {
                  linkAction: taskData.linkAction,
                },
                create: {
                  label: taskData.label,
                  linkAction: taskData.linkAction,
                  stepId: updatedStep.id,
                },
              }),
            );

            await Promise.all(taskPromises);

            const currentLabels = step.tasks.map((t: any) => t.label);
            await tx.onboardingTask.deleteMany({
              where: {
                stepId: updatedStep.id,
                label: { notIn: currentLabels },
              },
            });
          }

          createdSteps.push(updatedStep);
        }

        console.log(`Creados/actualizados ${createdSteps.length} steps`);
        return createdSteps;
      },
      {
        timeout: 15000,
      },
    );
  }

  async completeTask(userId: string, taskId: string) {
    return this.prisma.userTaskProgress.upsert({
      where: { userId_taskId: { userId, taskId } },
      update: { done: true },
      create: { userId, taskId, done: true },
    });
  }

  async toggleTask(userId: string, taskId: string, done: boolean) {
    return this.prisma.userTaskProgress.upsert({
      where: {
        userId_taskId: { userId, taskId },
      },
      update: { done },
      create: { userId, taskId, done },
    });
  }

  // CORREGIDO: Ahora incluye el progreso del usuario actual
  async getGeneralOnboarding(companyId: string, userId: string) {
    console.log('=== getGeneralOnboarding ===');
    return this.prisma.onboardingStep.findMany({
      where: {
        companyId: companyId,
        type: 'ONBOARDING',
      },
      orderBy: { day: 'asc' },
      include: {
        onboardingTasks: {
          include: {
            userProgress: {
              where: { userId: userId },
            },
          },
        },
      },
    });
  }

  // CORREGIDO: Ahora incluye el progreso del usuario actual
  async getSpecializationsByRole(
    jobRole: string,
    companyId: string,
    userId: string,
  ) {
    console.log('=== getSpecializationsByRole ===');
    return this.prisma.onboardingStep.findMany({
      where: {
        companyId: companyId,
        type: 'SPECIALIZATION',
        job_role: jobRole,
      },
      orderBy: { day: 'asc' },
      include: {
        onboardingTasks: {
          include: {
            userProgress: {
              where: { userId: userId },
            },
          },
        },
      },
    });
  }

  async getAllSteps(companyId: string) {
    return this.prisma.onboardingStep.findMany({
      where: { companyId },
      orderBy: { day: 'asc' },
      include: {
        onboardingTasks: true,
      },
    });
  }
}
