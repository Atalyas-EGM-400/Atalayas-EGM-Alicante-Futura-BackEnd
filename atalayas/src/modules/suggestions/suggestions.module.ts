import { Module } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service.js';
import { SuggestionsController } from './suggestions.controller.js';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module.js'; // Ajusta la ruta según tu carpetas
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SuggestionsController],
  providers: [SuggestionsService],
  exports: [SuggestionsService],
})
export class SuggestionsModule {}
