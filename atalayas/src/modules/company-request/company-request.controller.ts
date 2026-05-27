import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { CompanyRequestService } from './company-request.service';
import { CreateCompanyRequestDto } from './dto/create-company-request.dto';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Query } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { User } from '@prisma/client';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('company-request')
@Controller('company-request')
export class CompanyRequestController {
  constructor(
    private readonly companyRequestService: CompanyRequestService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        document: {
          type: 'string',
          format: 'binary',
        },
        companyName: { type: 'string' },
        cif: { type: 'string' },
        contactName: { type: 'string' },
        contactEmail: { type: 'string' },
        phone: { type: 'string' },
        address: { type: 'string' },
        activity: { type: 'string' },
      },
    },
  })
  @Post()
  @UseInterceptors(
    FileInterceptor('document', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/jpeg',
          'application/png',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Tipo de archivo no permitido'), false);
        }
      },
    }),
  )
  async create(
    @Body() createCompanyRequestDto: CreateCompanyRequestDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.companyRequestService.create(createCompanyRequestDto, file);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('GENERAL_ADMIN')
  async findAll(@Query('archived') archived?: string) {
    return this.companyRequestService.findAll(archived === 'true');
  }

  @Get('pending-counts')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('GENERAL_ADMIN')
  async getPendingCounts() {
    const requests = await this.prisma.companyRequest.count({
      where: { status: 'PENDING' },
    });
    return { requests };
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('GENERAL_ADMIN')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.companyRequestService.findOne(id);
  }

  @Patch(':id/approve')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('GENERAL_ADMIN')
  async approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.companyRequestService.approve(id);
  }

  @Patch(':id/reject')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('GENERAL_ADMIN')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        rejectReason: {
          type: 'string',
          example: 'La empresa no pertenece al polígono.',
        },
      },
    },
  })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { rejectReason: string },
  ) {
    return this.companyRequestService.reject(id, body.rejectReason);
  }

  @Patch(':id/archive')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('GENERAL_ADMIN')
  async archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.companyRequestService.archive(id);
  }

  @Patch(':id/unarchive')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('GENERAL_ADMIN')
  async unarchive(@Param('id', ParseUUIDPipe) id: string) {
    return this.companyRequestService.unarchive(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('GENERAL_ADMIN')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.companyRequestService.remove(id);
  }
}
