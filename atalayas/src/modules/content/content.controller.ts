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
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
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
  constructor(private readonly contentService: ContentService) { }

  // 1. CREAR CONTENIDO CON IA
  @Post(':courseId/content')
  @Roles('ADMIN', 'GENERAL_ADMIN')
  @ApiOperation({ summary: 'Crear contenido con IA para un curso' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'file', maxCount: 1 }]))
  async create(
    @Param('courseId') courseId: string,
    @Body() createContentDto: CreateContentDto,
    @Req() req: Request & { user: User },
    @UploadedFiles() files: { file?: Express.Multer.File[] },
  ) {
    const file = files.file ? files.file[0] : undefined;
    return await this.contentService.create(
      createContentDto,
      req.user,
      courseId,
      file,
    );
  }

  // 2. CREAR CONTENIDO MANUAL (con múltiples archivos: PDF, imagen, video, presentación)
  @Post(':courseId/content/manual')
  @Roles('ADMIN', 'GENERAL_ADMIN')
  @ApiOperation({ summary: 'Crear contenido manualmente (con PDF, imagen, video, presentación o URL)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'file', maxCount: 1 },           // PDF del documento
    { name: 'imageFile', maxCount: 1 },      // Imagen
    { name: 'videoFile', maxCount: 1 },      // Video
    { name: 'presentationFile', maxCount: 1 }, // Presentación
  ]))
  async createManual(
    @Param('courseId') courseId: string,
    @UploadedFiles() files: {
      file?: Express.Multer.File[],
      imageFile?: Express.Multer.File[],
      videoFile?: Express.Multer.File[],
      presentationFile?: Express.Multer.File[],
    },
    @Body('title') title: string,
    @Body('summary') summary: string,
    @Body('imageUrl') imageUrl: string,
    @Body('videoUrl') videoUrl: string,
    @Body('presentationUrl') presentationUrl: string,
    @Body('url') url: string,
    @Req() req: Request & { user: User },
  ) {
    let documentUrl: string | null = url || null;
    let finalImageUrl: string | null = imageUrl || null;
    let finalVideoUrl: string | null = videoUrl || null;
    let finalPresentationUrl: string | null = presentationUrl || null;

    // Si se subió un archivo PDF
    if (files.file && files.file[0]) {
      documentUrl = await this.contentService.uploadFile(files.file[0]);
    }

    // Si se subió un archivo de imagen
    if (files.imageFile && files.imageFile[0]) {
      finalImageUrl = await this.contentService.uploadFile(files.imageFile[0]);
    }

    // Si se subió un archivo de video
    if (files.videoFile && files.videoFile[0]) {
      finalVideoUrl = await this.contentService.uploadFile(files.videoFile[0]);
    }

    // Si se subió un archivo de presentación
    if (files.presentationFile && files.presentationFile[0]) {
      finalPresentationUrl = await this.contentService.uploadFile(files.presentationFile[0]);
    }

    return this.contentService.createManual(
      {
        title,
        summary,
        imageUrl: finalImageUrl,
        videoUrl: finalVideoUrl,
        presentationUrl: finalPresentationUrl,
        url: documentUrl,
      },
      req.user,
      courseId,
    );
  }

  // 3. OBTENER TODO EL CONTENIDO DE UN CURSO
  @Get(':courseId/content')
  async findAll(
    @Param('courseId') courseId: string,
    @Req() req: Request & { user: User },
  ) {
    return await this.contentService.findAll(req.user, courseId);
  }

  // 4. OBTENER UNA LECCIÓN ESPECÍFICA
  @Get(':courseId/content/:contentId')
  async findOne(
    @Param('courseId') courseId: string,
    @Param('contentId') contentId: string,
    @Req() req: Request & { user: User },
  ) {
    return await this.contentService.findOne(contentId, req.user);
  }

  // 5. ACTUALIZAR CONTENIDO
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

  // 6. ELIMINAR CONTENIDO
  @Delete(':courseId/content/:contentId')
  @Roles('ADMIN', 'GENERAL_ADMIN')
  async remove(
    @Param('contentId') contentId: string,
    @Req() req: Request & { user: User },
  ) {
    return await this.contentService.remove(contentId, req.user);
  }

  // 7. COMPLETAR UNIDAD
  @Post(':courseId/content/:contentId/complete')
  @ApiOperation({ summary: 'Marcar unidad como completada al aprobar el quiz' })
  async complete(
    @Param('contentId') contentId: string,
    @Body() body: { score: number; totalQuestions: number },
    @Req() req: Request & { user: User },
  ) {
    return await this.contentService.completeQuiz(contentId, req.user, body);
  }
}