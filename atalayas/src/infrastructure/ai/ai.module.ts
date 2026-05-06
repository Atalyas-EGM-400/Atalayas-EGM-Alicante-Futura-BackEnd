import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AuthModule } from '../../modules/auth/auth.module';
import { AiController } from './ai.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageService } from '../storage/storage.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AiController],
  providers: [AiService, StorageService],
  exports: [AiService, StorageService], // 👈 AÑADIMOS ESTO
})
export class AiModule {}
