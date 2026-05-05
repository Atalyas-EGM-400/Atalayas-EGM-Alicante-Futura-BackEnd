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
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Request } from 'express';
import { User } from '@prisma/client';

// 🚀 RUTAS INTERNAS DEL MÓDULO DE CURSOS
import { CoursesService } from './courses.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';

// 🚀 RUTAS HACIA LA NUEVA CARPETA COMMON (Salimos de courses -> modules -> y entramos a common)
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { GenerateAiContentDto } from './dto/generate-ai.dto.js';

@ApiTags('Courses')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) { }

  @Post()
  @Roles('ADMIN', 'GENERAL_ADMIN')
  @ApiOperation({ summary: 'Crear un nuevo curso con imagen' })
  @ApiConsumes('multipart/form-data') // Necesario para procesar archivos
  @UseInterceptors(FileInterceptor('file')) // El nombre 'file' debe coincidir con el campo del Frontend
  async create(
    @Body() createCourseDto: CreateCourseDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user: User },
  ) {
    return await this.coursesService.create(createCourseDto, file, req.user);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener todos los cursos según el rol del usuario',
  })
  async findAll(@Req() req: Request & { user: User }) {
    return await this.coursesService.findAll(req.user);
  }

  @Get('job-roles')
  @Roles('ADMIN', 'GENERAL_ADMIN')
  @ApiOperation({
    summary: 'Obtener todos los roles únicos de empleados para el selector de cursos'
  })
  async getUniqueJobRoles() {
    return await this.coursesService.getUniqueJobRoles();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener los detalles de un curso por ID' })
  async findOne(@Param('id') id: string, @Req() req: Request & { user: User }) {
    return await this.coursesService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GENERAL_ADMIN') // Protegemos el acceso solo a administradores
  @ApiOperation({ summary: 'Actualizar un curso (soporta cambio de imagen)' })
  @ApiConsumes('multipart/form-data') // IMPORTANTE: Para que Swagger permita subir archivo en el Patch
  @UseInterceptors(FileInterceptor('file'))
  async update(
    @Param('id') id: string,
    @Body() updateCourseDto: UpdateCourseDto,
    @Req() req: Request & { user: User },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Pasamos el archivo como cuarto argumento al Service
    return await this.coursesService.update(
      id,
      updateCourseDto,
      req.user,
      file,
    );
  }

  @Delete(':id')
  @Roles('ADMIN', 'GENERAL_ADMIN')
  @ApiOperation({ summary: 'Eliminar un curso y su imagen asociada' })
  async remove(@Param('id') id: string, @Req() req: Request & { user: User }) {
    return await this.coursesService.remove(id, req.user);
  }

  @Post(':id/content/ai')
  @Roles('ADMIN', 'GENERAL_ADMIN')
  @ApiOperation({
    summary: 'Generar contenido educativo automáticamente con IA',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: GenerateAiContentDto })
  @UseInterceptors(FileInterceptor('file'))
  async generateAiContent(
    @Param('id') courseId: string,
    @Body('title') title: string,
    @Body('order') order: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user: User },
  ) {
    console.log(
      `🚀 ¡Petición recibida en el controlador! Título: ${title}, Orden: ${order}`,
    );

    return await this.coursesService.generateContentWithAi(
      courseId,
      title,
      Number(order),
      file,
      req.user,
    );
  }
}