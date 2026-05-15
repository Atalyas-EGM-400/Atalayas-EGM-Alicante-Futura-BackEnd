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
  UseInterceptors, // 👈 NUEVO: Necesario para los interceptores
  UploadedFile, // 👈 NUEVO: Necesario para capturar el archivo
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express'; // 👈 NUEVO: El lector de archivos
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
} from '@nestjs/swagger'; // 👈 NUEVO: ApiConsumes
import { CompanyService } from './company.service.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';
import { Request } from 'express';

// 1. IMPORTAMOS TU PROPIO GUARD
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { User } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator.js';

@ApiTags('Company')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('company')
export class CompanyController {
  // 👇 Aquí está definida como companiesService (con 's')
  constructor(private readonly companiesService: CompanyService) { }

  @Post()
  @ApiOperation({ summary: 'Crear una empresa nueva (Solo General Admin)' })
  create(
    @Body() createCompanyDto: CreateCompanyDto,
    @Req() req: Request & { user: User },
  ) {
    const requestUser = req.user;
    return this.companiesService.create(createCompanyDto, requestUser);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las empresas (Solo General Admin)' })
  findAll(@Req() req: Request & { user: User }) {
    const requestUser = req.user;
    return this.companiesService.findAll(requestUser);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver detalles de una empresa por ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: User },
  ) {
    const requestUser = req.user;
    return this.companiesService.findOne(id, requestUser);
  }

  // 🚀 AQUÍ ESTÁ LA MAGIA ARREGLADA
  @Patch(':id')
  @ApiOperation({ summary: 'Modificar una empresa y su logo' })
  @ApiConsumes('multipart/form-data') // Le decimos a Swagger que aceptamos archivos
  @UseInterceptors(FileInterceptor('file')) // El interceptor abre la "caja fuerte" del frontend
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCompanyDto: UpdateCompanyDto, // Ahora sí llega con todos los datos de texto
    @Req() req: Request & { user: User },
    @UploadedFile() file?: Express.Multer.File, // Capturamos la foto de forma independiente
  ) {
    const requestUser = req.user;
    // Le pasamos todo (incluyendo el archivo) al servicio que ya teníamos preparado
    return this.companiesService.update(
      id,
      updateCompanyDto,
      requestUser,
      file,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Borrar una empresa (Solo General Admin)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: User },
  ) {
    const requestUser = req.user;
    return this.companiesService.remove(id, requestUser);
  }

  // ── DAR DE BAJA ────────────────────────────────────────────────
  @Patch(':id/deactivate')
  @Roles('GENERAL_ADMIN') // Solo el Admin General debería poder dar de baja empresas enteras
  async deactivateCompany(@Param('id', new ParseUUIDPipe()) id: string) {
    // 👇 Corregido a companiesService 👇
    return await this.companiesService.deactivateCompany(id);
  }

  // ── REACTIVAR ──────────────────────────────────────────────────
  @Patch(':id/reactivate')
  @Roles('GENERAL_ADMIN')
  async reactivateCompany(@Param('id', new ParseUUIDPipe()) id: string) {
    // 👇 Corregido a companiesService 👇
    return await this.companiesService.reactivateCompany(id);
  }
}
