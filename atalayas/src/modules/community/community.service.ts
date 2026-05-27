import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: {
    name: string;
    logoUrl: string;
    website: string;
    description?: string;
    tipoName: string;
  }) {
    // Forzamos mayúsculas y quitamos espacios para mantener la consistencia de los filtros
    const tipoEstandarizado = dto.tipoName.trim().toUpperCase();

    return this.prisma.community.create({
      data: {
        name: dto.name,
        logoUrl: dto.logoUrl,
        website: dto.website,
        description: dto.description,
        type: tipoEstandarizado, // Guardado directo
      },
    });
  }

  // Para el autocompletado del Front: Le pedimos a la base de datos
  // que nos dé los tipos únicos que existen actualmente creados.
  async getAllTypes() {
    const colaboradores = await this.prisma.community.findMany({
      select: { type: true },
      distinct: ['type'], // Trae solo valores únicos
      orderBy: { type: 'asc' },
    });

    return colaboradores.map((c) => c.type);
  }

  async findAll(type?: string) {
    return this.prisma.community.findMany({
      where:
        type && type !== 'TODOS' ? { type: type.trim().toUpperCase() } : {},
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const entity = await this.prisma.community.findUnique({
      where: { id },
    });

    if (!entity) {
      throw new NotFoundException(`Entidad con ID ${id} no encontrada`);
    }

    return entity;
  }

  async update(id: string, updateCommunityDto: UpdateCommunityDto) {
    // Validamos primero que la entidad exista
    await this.findOne(id);

    // Si en la actualización viene el tipo, también lo estandarizamos
    const updateData: any = { ...updateCommunityDto };
    if (updateCommunityDto.tipoName) {
      updateData.type = updateCommunityDto.tipoName.trim().toUpperCase();
      delete updateData.tipoName; // Eliminamos la propiedad del DTO para que no choque con Prisma
    }

    return this.prisma.community.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    // Validamos primero que exista
    await this.findOne(id);

    return this.prisma.community.delete({
      where: { id },
    });
  }
}
