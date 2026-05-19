import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { OnboardingStep } from '@prisma/client';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) { }

  async savePlan(companyId: string, steps: any[]) {
    console.log("=== savePlan ===");
    console.log("CompanyId:", companyId);
    console.log("Steps a procesar:", steps.length);

    return this.prisma.$transaction(async (tx) => {
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
          for (const taskData of step.tasks) {
            await tx.onboardingTask.upsert({
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
            });
          }

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
    });
  }

  async completeTask(userId: string, taskId: string) {
    return this.prisma.userTaskProgress.upsert({
      where: { userId_taskId: { userId, taskId } },
      update: { done: true },
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

  async getGeneralOnboarding(companyId: string) {
    console.log("=== getGeneralOnboarding ===");
    console.log("CompanyId:", companyId);

    const steps = await this.prisma.onboardingStep.findMany({
      where: {
        companyId: companyId,
        type: 'ONBOARDING',
      },
      orderBy: { day: 'asc' },
      include: {
        onboardingTasks: true,
      },
    });

    console.log("General onboarding steps:", steps.length);
    return steps;
  }

  async getSpecializationsByRole(jobRole: string, companyId: string) {
    console.log("=== getSpecializationsByRole ===");
    console.log("JobRole:", jobRole);
    console.log("CompanyId:", companyId);

    const steps = await this.prisma.onboardingStep.findMany({
      where: {
        companyId: companyId,
        type: 'SPECIALIZATION',
        job_role: jobRole,
      },
      orderBy: { day: 'asc' },
      include: {
        onboardingTasks: true,
      },
    });

    console.log("Specializations steps:", steps.length);
    return steps;
  }

  async getAllSteps(companyId: string) {
    console.log("=== getAllSteps ===");
    console.log("CompanyId:", companyId);

    const steps = await this.prisma.onboardingStep.findMany({
      where: { companyId },
      orderBy: { day: 'asc' },
      include: {
        onboardingTasks: true,
      },
    });

    console.log("Total steps encontrados:", steps.length);
    return steps;
  }
}