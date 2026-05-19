import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Req,
  UseGuards,
  Param,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('onboarding')
@UseGuards(AuthGuard, RolesGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) { }

  // POST /onboarding/setup (Solo para Admins)
  @Roles('GENERAL_ADMIN', 'ADMIN')
  @Post('setup')
  async setup(@Req() req, @Body() body: { steps: any[] }) {
    console.log("=== POST /setup ===");
    console.log("CompanyId:", req.user.companyId);
    console.log("Steps a guardar:", body.steps.length);
    return this.onboardingService.savePlan(req.user.companyId, body.steps);
  }

  // GET /onboarding/me (Para el ADMIN)
  @Roles('GENERAL_ADMIN', 'ADMIN')
  @Get('me')
  async getMe(@Req() req) {
    console.log("=== GET /me ===");
    console.log("Usuario ID:", req.user.id);
    console.log("Company ID:", req.user.companyId);
    console.log("Rol:", req.user.role);

    const steps = await this.onboardingService.getAllSteps(req.user.companyId);

    console.log("Steps encontrados:", steps.length);
    if (steps.length > 0) {
      console.log("Primer step:", JSON.stringify(steps[0], null, 2));
    }

    return steps;
  }

  // GET /onboarding/employee (Para el EMPLEADO)
  @Get('employee')
  async getEmployeeDashboard(@Req() req) {
    console.log("=== GET /employee ===");
    console.log("Usuario ID:", req.user.id);
    console.log("JobRole:", req.user.jobRole);

    const user = req.user;
    const companyId = user.companyId;

    const generalOnboarding = await this.onboardingService.getGeneralOnboarding(companyId);
    console.log("General onboarding:", generalOnboarding.length);

    let specializations: any[] = [];
    if (user.jobRole) {
      specializations = await this.onboardingService.getSpecializationsByRole(user.jobRole, companyId);
      console.log("Specializations:", specializations.length);
    }

    return {
      general: generalOnboarding,
      specializations: specializations,
    };
  }

  // POST /onboarding/toggle (Para marcar tareas)
  @Post('toggle')
  async toggle(@Req() req, @Body() body: { taskId: string; done: boolean }) {
    console.log("=== POST /toggle ===");
    console.log("TaskId:", body.taskId);
    console.log("Done:", body.done);
    return this.onboardingService.toggleTask(req.user.id, body.taskId, body.done);
  }

  // PATCH /onboarding/complete-auto/:taskId
  @Patch('complete-auto/:taskId')
  async completeAuto(@Req() req, @Param('taskId') taskId: string) {
    console.log("=== PATCH /complete-auto ===");
    console.log("TaskId:", taskId);
    return this.onboardingService.completeTask(req.user.id, taskId);
  }
}