import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ConfigModule } from '@nestjs/config/dist/config.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthModule } from '../../modules/auth/auth.module';
import { AiModule } from '../../infrastructure/ai/ai.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { EnrollmentModule } from '../enrollment/enrollment.module';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, AiModule, StorageModule, EnrollmentModule],
  controllers: [ContentController],
  providers: [ContentService, PrismaService],
})
export class ContentModule {}
