import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EnrollmentService } from './enrollment.service.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto.js';
import { Request } from 'express';
import { GetUser } from '../../common/decorators/get-user.decorator.js';
import { Res } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { User } from '@prisma/client';
import { UpdateVideoProgressDto } from './dto/update-video-progress.dto.js';
import { CompleteManualLessonDto } from './dto/complete-manual-lesson.dto.js';
import { NotFoundException } from '@nestjs/common';

@ApiTags('Enrollment')
@ApiBearerAuth()
@UseGuards(AuthGuard) // 🔒 Protegemos todas las rutas
@Controller('enrollment')
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) { }

  @Post()
  @ApiOperation({
    summary: 'Matricular a un usuario en un curso (Solo Admins)',
  })
  create(
    @Body() createEnrollmentDto: CreateEnrollmentDto,
    @Req() req: Request & { user: User },
  ) {
    return this.enrollmentService.create(createEnrollmentDto, req.user);
  }

  // ── MATRICULACIÓN MASIVA ──────────────────────────────────────────────────
  @Post('bulk')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GENERAL_ADMIN')
  @ApiOperation({ summary: 'Matricular múltiples usuarios en un curso' })
  bulkEnroll(
    @Body() dto: { userIds: string[]; courseId: string },
    @Req() req: Request & { user: User },
  ) {
    return this.enrollmentService.bulkEnroll(
      dto.userIds,
      dto.courseId,
      req.user,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Ver matriculaciones' })
  findAll(@Req() req: Request & { user: User }) {
    return this.enrollmentService.findAll(req.user);
  }

  // 🚀 RUTAS ESTÁTICAS PRIMERO 🚀
  // Estas rutas deben evaluarse antes para que el ':id' no se las "trague"

  @Patch('video-progress')
  @ApiOperation({ summary: 'Actualizar el segundero de un vídeo' })
  async updateVideoProgress(
    @GetUser() user: User,
    @Body() updateDto: UpdateVideoProgressDto,
  ) {
    // 3. Añadimos el await para que ESLint no se queje
    return await this.enrollmentService.updateVideoProgress(
      user.id,
      updateDto.contentId,
      updateDto.lastTime,
      updateDto.totalDuration,
    );
  }

  @Post('complete-manual')
  @ApiOperation({ summary: 'Marcar lección manual como completada' })
  async completeManual(
    @GetUser() user: User,
    @Body() completeDto: CompleteManualLessonDto,
  ) {
    // 4. Corregimos el nombre al que pusimos en el Service: completeManualLesson
    return await this.enrollmentService.completeManualLesson(
      user.id,
      completeDto.contentId!,
    );
  }
  @Post('content-access')
  async markOnAccess(
    @GetUser() user: User,
    @Body('contentId') contentId: string,
  ) {
    return this.enrollmentService.markContentOnAccess(user.id, contentId);
  }

  // ⬇️ RUTAS DINÁMICAS (CON :id) DESPUÉS ⬇️

  @Get(':id')
  @ApiOperation({ summary: 'Ver detalle de una matriculación' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: User },
  ) {
    return this.enrollmentService.findOne(id, req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar progreso de matriculación' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEnrollmentDto: UpdateEnrollmentDto,
    @Req() req: Request & { user: User },
  ) {
    return this.enrollmentService.update(id, updateEnrollmentDto, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desmatricular a un usuario (Solo Admins)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: User },
  ) {
    return this.enrollmentService.remove(id, req.user);
  }

  @Get('certificate/:courseId')
  async getCertificate(
    @GetUser() user: User,
    @Param('courseId') courseId: string,
    @Res() res
  ) {
    const enrollment = await this.enrollmentService['prisma'].enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId,
        },
      },
    });

    if (!enrollment || enrollment.progress !== 100) {
      throw new ForbiddenException('Curso no completado');
    }

    const course = await this.enrollmentService['prisma'].course.findUnique({
      where: { id: courseId },
    });


    const fullUser = await this.enrollmentService['prisma'].user.findUnique({
      where: { id: user.id },
      include: {
        Company: true,
      },
    });
    if (!fullUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!fullUser.Company) {
      throw new NotFoundException('El usuario no tiene empresa');
    }

    const pdf = await this.enrollmentService.generateCertificate(fullUser, fullUser.Company, course);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=certificado.pdf',
    });

    res.send(pdf);
  }
}
