import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('GENERAL_ADMIN')
  @Post('test-email')
  @ApiOperation({ summary: 'Enviar un correo de prueba al Admin logueado' })
  async sendTestEmail(@Req() req: any) {
    return this.notificationsService.notifyByEmail({
      targetCompanyId: req.user.companyId,
      isPublic: false,
      title: 'Prueba de Sistema',
      message:
        'Si estás leyendo esto, la configuración de correo de Atalayas funciona perfectamente.',
      type: 'ANUNCIO',
      link: '/dashboard',
    });
  }

  @ApiBearerAuth()
  @Get('unread-count')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('GENERAL_ADMIN', 'ADMIN', 'EMPLOYEE')
  @ApiOperation({ summary: 'Obtener contador de notificaciones no leídas' })
  async getUnreadCount(@Req() req: any) {
    return this.notificationsService.getUnreadCount(req.user);
  }

  @ApiBearerAuth()
  @Patch('reset-count')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('GENERAL_ADMIN', 'ADMIN', 'EMPLOYEE')
  @ApiOperation({ summary: 'Resetear el contador de notificaciones' })
  async resetCount(@Req() req: any) {
    return this.prisma.user.update({
      where: { id: req.user.id },
      data: { lastNotificationsRead: new Date() },
    });
  }
}
