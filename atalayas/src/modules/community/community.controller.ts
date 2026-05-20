import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CommunityService } from './community.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';

// Tus Guards e interceptores de Roles personalizados (ajusta las rutas de importación)
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Ecosistema de Proximidad / Community')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Post()
  @Roles('GENERAL_ADMIN') // Solo los administradores globales pueden crear
  @ApiOperation({ summary: 'Crear una nueva entidad en el ecosistema' })
  @ApiResponse({ status: 201, description: 'Entidad creada exitosamente.' })
  @ApiResponse({
    status: 400,
    description: 'Payload inválido o mal estructurado.',
  })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado por falta de privilegios.',
  })
  create(@Body() createCommunityDto: CreateCommunityDto) {
    return this.communityService.create(createCommunityDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener todas las entidades (filtrado opcional por tipo)',
  })
  findAll(@Query('type') type?: string) {
    return this.communityService.findAll(type);
  }

  @Get('tipos')
  @ApiOperation({
    summary:
      'Obtener la lista de categorías/tipos únicos para el autocompletado del Front',
  })
  getAllTypes() {
    return this.communityService.getAllTypes();
  }

  @Get(':id')
  @Roles('GENERAL_ADMIN')
  @ApiOperation({ summary: 'Obtener el detalle de una entidad específica' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.communityService.findOne(id);
  }

  @Patch(':id')
  @Roles('GENERAL_ADMIN')
  @ApiOperation({ summary: 'Actualizar los datos de una entidad existente' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCommunityDto: UpdateCommunityDto,
  ) {
    return this.communityService.update(id, updateCommunityDto);
  }

  @Delete(':id')
  @Roles('GENERAL_ADMIN')
  @ApiOperation({
    summary: 'Eliminar de forma permanente una entidad del ecosistema',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.communityService.remove(id);
  }
}
