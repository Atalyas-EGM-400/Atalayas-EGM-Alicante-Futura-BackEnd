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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { User } from '@prisma/client';
import { AnnouncementService } from './announcement.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@ApiTags('Announcement')
@Controller('announcement')
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('GENERAL_ADMIN', 'ADMIN')
  @Post()
  @UseInterceptors(FileInterceptor('image')) // 'image' es el nombre que pusimos en el FormData del Front
  async create(
    @Body() createDto: any, // Usa CreateAnnouncementDto
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.announcementService.create(createDto, req.user, file);
  }

  @Get('public')
  async findPublic() {
    return this.announcementService.findPublic();
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Get()
  async findAll(@Req() req: Request & { user: User }) {
    return this.announcementService.findAll(req.user);
  }
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Get(':id') // <- Verifica que no diga '/:id' o 'announcement/:id'
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.announcementService.findOne(id, req.user);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request & { user: User }) {
    return this.announcementService.remove(id, req.user);
  }
}
