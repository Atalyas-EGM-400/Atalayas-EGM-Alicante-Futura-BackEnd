import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { CoursesModule } from './modules/courses/courses.module';
import { DocumentModule } from './modules/document/document.module';
import { CompanyModule } from './modules/company/company.module';
import { EnrollmentModule } from './modules/enrollment/enrollment.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { ContentModule } from './modules/content/content.module';
import { ServicesModule } from './modules/services/services.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { CompanyRequestModule } from './modules/company-request/company-request.module';
import { ChatBotModule } from './infrastructure/ai/chatbot/chatbot.module';
import { AiModule } from './infrastructure/ai/ai.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { StatsModule } from './modules/stats/stats.module';
import { AnnouncementModule } from './modules/announcement/announcement.module';
import { SuggestionsModule } from './modules/suggestions/suggestions.module';
import { ActivityModule } from './modules/activity/activity.module';
import { EventsModule } from './modules/events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CompanyModule,
    CoursesModule,
    DocumentModule,
    EnrollmentModule,
    StorageModule,
    ContentModule,
    ServicesModule,
    AiModule,
    MailerModule.forRoot({
      transport: {
        host: 'sandbox.smtp.mailtrap.io',
        port: 2525,
        auth: {
          user: process.env.MAILTRAP_USER,
          pass: process.env.MAILTRAP_PASS,
        },
      },
      defaults: {
        from: '"Atalayas" <noreply@atalayas.com>',
      },
    }),
    CompanyRequestModule,
    ChatBotModule,
    OnboardingModule,
    StatsModule,
    AnnouncementModule,
    SuggestionsModule,
    ActivityModule,
    EventsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
