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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Request } from 'express';
import { User } from '@prisma/client';

import { SuggestionsService } from './suggestions.service.js';
import { CreateSuggestionDto } from './dto/create-suggestion.dto.js';
import { RespondSuggestionDto } from './dto/update-suggestion-status.dto.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@ApiTags('Suggestions')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva sugerencia' })
  async create(
    @Body() createSuggestionDto: CreateSuggestionDto,
    @Req() req: Request & { user: User },
  ) {
    // Pasamos el usuario logueado para que el Service asigne el autor y valide la empresa
    return await this.suggestionsService.create(createSuggestionDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar sugerencias según visibilidad de roles' })
  async findAll(
    @Req() req: Request & { user: User },
    @Query('target') target?: string, // <--- Esto captura el "?target=ADMIN" de la URL
  ) {
    return await this.suggestionsService.findAll(req.user, target);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Obtener mis propias sugerencias' })
  async findMine(@Req() req: Request & { user: User }) {
    return await this.suggestionsService.findMine(req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una sugerencia' })
  async findOne(@Param('id') id: string, @Req() req: Request & { user: User }) {
    return await this.suggestionsService.findOne(id, req.user);
  }

  @Patch(':id/respond')
  @Roles('ADMIN', 'GENERAL_ADMIN')
  async respond(
    @Param('id') id: string,
    @Body() dto: RespondSuggestionDto, // <--- Recibes el objeto completo { response, status }
    @Req() req: Request & { user: User },
  ) {
    // Ahora pasas el objeto 'dto' que cumple con el tipo que pide el Service
    return await this.suggestionsService.respond(id, dto, req.user);
  }
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una sugerencia' })
  async remove(@Param('id') id: string, @Req() req: Request & { user: User }) {
    return await this.suggestionsService.remove(id, req.user);
  }
}
