import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PresenceGateway } from './stats.gateway';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [StatsController],
  providers: [StatsService, PresenceGateway],
})
export class StatsModule {}
