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
  constructor(private readonly onboardingService: OnboardingService) {}

  @Roles('GENERAL_ADMIN', 'ADMIN')
  @Post('setup')
  async setup(@Req() req, @Body() body: { steps: any[] }) {
    return this.onboardingService.savePlan(req.user.companyId, body.steps);
  }

  @Roles('GENERAL_ADMIN', 'ADMIN')
  @Get('me')
  async getMe(@Req() req) {
    return this.onboardingService.getAllSteps(req.user.companyId);
  }

  // CORREGIDO: Enviamos el req.user.id al servicio para mapear las tareas hechas
  @Get('employee')
  async getEmployeeDashboard(@Req() req) {
    console.log('=== GET /employee ===');
    const user = req.user;
    const companyId = user.companyId;
    const userId = user.id;

    const generalOnboarding = await this.onboardingService.getGeneralOnboarding(
      companyId,
      userId,
    );
    console.log('General onboarding encontrado:', generalOnboarding.length);

    let specializations: any[] = [];
    if (user.jobRole) {
      specializations = await this.onboardingService.getSpecializationsByRole(
        user.jobRole,
        companyId,
        userId,
      );
      console.log('Specializations encontradas:', specializations.length);
    }

    return {
      general: generalOnboarding,
      specializations: specializations,
    };
  }

  @Post('toggle')
  async toggle(@Req() req, @Body() body: { taskId: string; done: boolean }) {
    console.log('=== POST /toggle ===');
    return this.onboardingService.toggleTask(
      req.user.id,
      body.taskId,
      body.done,
    );
  }

  @Patch('complete-auto/:taskId')
  async completeAuto(@Req() req, @Param('taskId') taskId: string) {
    return this.onboardingService.completeTask(req.user.id, taskId);
  }
}
