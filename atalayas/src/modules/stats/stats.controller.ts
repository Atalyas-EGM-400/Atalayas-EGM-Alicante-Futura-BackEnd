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
  constructor(private readonly statsService: StatsService) {}

  @Get()
  @Roles('GENERAL_ADMIN', 'ADMIN')
  async getStats(@Req() req: Request & { user: User }) {
    return this.statsService.getGlobalStats(req.user);
  }
}
