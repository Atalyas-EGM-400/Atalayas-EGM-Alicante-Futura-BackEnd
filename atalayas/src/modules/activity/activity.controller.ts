import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

@Controller('activity')
@UseGuards(AuthGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('me')
  getMyActivity(
    @GetUser() user: { id: string },
    @Query('limit') limit?: string,
  ) {
    return this.activityService.getActivityForUser(
      user.id,
      limit ? Math.min(parseInt(limit), 20) : 10,
    );
  }
}
