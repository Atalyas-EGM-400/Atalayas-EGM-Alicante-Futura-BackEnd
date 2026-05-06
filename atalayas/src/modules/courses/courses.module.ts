import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthModule } from '../../modules/auth/auth.module';
import { AiModule } from '../../infrastructure/ai/ai.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';

@Module({
  imports: [PrismaModule, AuthModule, AiModule, StorageModule],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule { }
