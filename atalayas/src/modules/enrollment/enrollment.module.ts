import { Module } from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';
import { EnrollmentController } from './enrollment.controller';
import { ConfigModule } from '@nestjs/config/dist/config.module';
import { AuthModule } from '../../modules/auth/auth.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, CoursesModule],
  controllers: [EnrollmentController],
  providers: [EnrollmentService],
  exports: [EnrollmentService],
})
export class EnrollmentModule { }
