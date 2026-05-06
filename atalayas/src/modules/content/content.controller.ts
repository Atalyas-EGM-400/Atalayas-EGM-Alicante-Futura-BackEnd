import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { User } from '@prisma/client';

import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('content')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('courses')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  // 1. CREAR CONTENIDO
  @Post(':courseId/content')
  @Roles('ADMIN', 'GENERAL_ADMIN')
  @ApiOperation({ summary: 'Crear contenido manual o con IA para un curso' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Param('courseId') courseId: string,
    @Body() createContentDto: CreateContentDto,
    @Req() req: Request & { user: User },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return await this.contentService.create(
      createContentDto,
      req.user,
      courseId,
      file,
    );
  }

  // 2. OBTENER TODO EL CONTENIDO DE UN CURSO
  @Get(':courseId/content') // 👈 Ruta corregida: GET /courses/ID-CURSO/content
  async findAll(
    @Param('courseId') courseId: string,
    @Req() req: Request & { user: User },
  ) {
    return await this.contentService.findAll(req.user, courseId);
  }

  // 3. OBTENER UNA LECCIÓN ESPECÍFICA (El error 404 estaba aquí)
  @Get(':courseId/content/:contentId') // 👈 Esta es la ruta que llama tu frontend
  async findOne(
    @Param('courseId') courseId: string,
    @Param('contentId') contentId: string,
    @Req() req: Request & { user: User },
  ) {
    // Usamos el contentId para buscar la lección
    return await this.contentService.findOne(contentId, req.user);
  }

  // 4. ACTUALIZAR (Ajustado para seguir la misma lógica de ruta)
  @Patch(':courseId/content/:contentId')
  @Roles('ADMIN', 'GENERAL_ADMIN')
  async update(
    @Param('contentId') contentId: string,
    @Body() updateContentDto: UpdateContentDto,
    @Req() req: Request & { user: User },
  ) {
    return await this.contentService.update(
      contentId,
      updateContentDto,
      req.user,
    );
  }

  // 5. ELIMINAR
  @Delete(':courseId/content/:contentId')
  @Roles('ADMIN', 'GENERAL_ADMIN')
  async remove(
    @Param('contentId') contentId: string,
    @Req() req: Request & { user: User },
  ) {
    return await this.contentService.remove(contentId, req.user);
  }

  @Post(':courseId/content/:contentId/complete') // Ajustada para seguir tu patrón de rutas
  @ApiOperation({ summary: 'Marcar unidad como completada al aprobar el quiz' })
  async complete(
    @Param('contentId') contentId: string,
    @Body() body: { score: number; totalQuestions: number },
    @Req() req: Request & { user: User },
  ) {
    return await this.contentService.completeQuiz(contentId, req.user, body);
  }
}
