import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  @Roles('ADMIN', 'GENERAL_ADMIN')
  async create(@Body() createUserDto: CreateUserDto, @Req() request: Request) {
    return await this.usersService.create(createUserDto, request['user']);
  }

  @Get()
  async findAll(@Req() request: Request) {
    return await this.usersService.findAll(request['user']);
  }

  @Patch('me/onboarding-done')
  @UseGuards(AuthGuard)
  async markOnboardingDone(@Request() req: any) {
    return this.usersService.markOnboardingDone(req.user.id);
  }

  @Get('roles')
  @Roles('ADMIN', 'GENERAL_ADMIN')
  async getUniqueJobRoles() {
    return await this.usersService.getUniqueJobRoles();
  }

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
  ) {
    return this.usersService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GENERAL_ADMIN')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() request: Request,
  ) {
    return await this.usersService.update(id, updateUserDto, request['user']);
  }

  @Delete(':id')
  @Roles('ADMIN', 'GENERAL_ADMIN')
  async remove(@Param('id') id: string, @Req() request: Request) {
    return await this.usersService.remove(id, request['user']);
  }

  // ── NUEVO: Dar de baja ────────────────────────────────────────────────
  @Patch(':id/deactivate')
  @Roles('ADMIN', 'GENERAL_ADMIN')
  async deactivateUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: Request,
  ) {
    return await this.usersService.deactivateUser(id, request['user']);
  }

  // ── NUEVO: Reactivar ──────────────────────────────────────────────────
  @Patch(':id/reactivate')
  @Roles('ADMIN', 'GENERAL_ADMIN')
  async reactivateUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: Request,
  ) {
    return await this.usersService.reactivateUser(id, request['user']);
  }
}