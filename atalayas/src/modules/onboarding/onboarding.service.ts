import { Injectable } from '@nestjs/common';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { OnboardingStep } from '@prisma/client';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  async savePlan(companyId: string, steps: any[]) {
    return this.prisma.$transaction(async (tx) => {
      const createdSteps: OnboardingStep[] = [];

      for (const step of steps) {
        // 1. Upsert del Paso (si existe el día en esa empresa, actualiza; si no, crea)
        const updatedStep = await tx.onboardingStep.upsert({
          where: {
            companyId_day: { companyId, day: step.day },
          },
          update: {
            title: step.title,
            description: step.description,
            badge: step.badge,
          },
          create: {
            day: step.day,
            title: step.title,
            description: step.description,
            badge: step.badge,
            companyId: companyId,
          },
        });

        // 2. Upsert de las Tareas (Corregido para manejar objetos)
        if (step.tasks && Array.isArray(step.tasks)) {
          for (const taskData of step.tasks) {
            // taskData es ahora { label: string, linkAction: string }
            await tx.onboardingTask.upsert({
              where: {
                stepId_label: {
                  stepId: updatedStep.id,
                  label: taskData.label, // Usamos la propiedad label del objeto
                },
              },
              update: {
                linkAction: taskData.linkAction, // Actualizamos el link si cambió
              },
              create: {
                label: taskData.label,
                linkAction: taskData.linkAction,
                stepId: updatedStep.id,
              },
            });
          }

          // 3. Borrar tareas que ya no están en el nuevo plan
          // Extraemos solo los labels (strings) para que 'notIn' funcione
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
      return createdSteps;
    });
  }

  async completeTask(userId: string, taskId: string) {
    return this.prisma.userTaskProgress.upsert({
      where: { userId_taskId: { userId, taskId } },
      update: { done: true }, // Siempre true porque es automático
      create: { userId, taskId, done: true },
    });
  }

  async getEmployeeDashboard(userId: string, companyId: string) {
    return this.prisma.onboardingStep.findMany({
      where: { companyId },
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

  async toggleTask(userId: string, taskId: string, done: boolean) {
    return this.prisma.userTaskProgress.upsert({
      where: {
        userId_taskId: { userId, taskId },
      },
      update: { done },
      create: { userId, taskId, done },
    });
  }
}
