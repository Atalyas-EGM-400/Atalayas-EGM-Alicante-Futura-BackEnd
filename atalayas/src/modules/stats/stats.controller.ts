import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { User } from '@prisma/client';
import { StatsService } from './stats.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Stats')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) { }

  // Este endpoint es para los Admins de empresa (tu panel normal)
  @Get()
  @Roles('ADMIN')
  async getStats(@Req() req: Request & { user: User }) {
    return this.statsService.getGlobalStats(req.user);
  }

  // Este endpoint es para el Admin General (tu panel de control de infraestructura)
  @Get('general')
  @Roles('GENERAL_ADMIN')
  async getGeneralStats(@Req() req: Request & { user: User }) {
    return this.statsService.getGlobalStats(req.user);
  }
}