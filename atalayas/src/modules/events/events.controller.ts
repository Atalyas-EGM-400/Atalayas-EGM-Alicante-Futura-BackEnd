import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  Patch,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { User } from '@prisma/client';
import { EventsService } from './events.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { UpdateEventDto } from './dto/update-event.dto';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('GENERAL_ADMIN', 'ADMIN')
  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() createDto: CreateEventDto,
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.eventsService.create(createDto, req.user, file);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get()
  async findAll(@Req() req: any) {
    return this.eventsService.findAll(req.user);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.eventsService.findOne(id, req.user);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post(':id/rsvp')
  async rsvp(
    @Param('id') id: string,
    @Body('status') status: boolean,
    @Req() req: any,
  ) {
    // req.user.id viene del token decodificado en el AuthGuard
    return this.eventsService.toggleRSVP(id, req.user.id, status);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('GENERAL_ADMIN', 'ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @Req() req: Request & { user: User },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.eventsService.update(id, updateEventDto, req.user, file);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('GENERAL_ADMIN', 'ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.eventsService.remove(id, req.user);
  }
}
