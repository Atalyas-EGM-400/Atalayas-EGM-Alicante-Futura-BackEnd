import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { StorageService } from '../../infrastructure/storage/storage.service.js'; // 👈 1. Importamos StorageService
import { User } from '@prisma/client';

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService, // 👈 2. Lo inyectamos en el constructor
  ) {}

  async create(createCompanyDto: CreateCompanyDto, requestUser: User) {
    // 🔒 SEGURIDAD: Solo un súper admin puede dar de alta nuevas empresas
    if (requestUser.role !== 'GENERAL_ADMIN') {
      throw new ForbiddenException(
        'Solo los administradores generales pueden crear empresas',
      );
    }

    return this.prisma.company.create({
      data: createCompanyDto,
    });
  }

  async findAll(requestUser: User) {
    // 🔒 SEGURIDAD: Solo un súper admin puede ver el listado de TODAS las empresas
    if (requestUser.role !== 'GENERAL_ADMIN') {
      throw new ForbiddenException(
        'No tienes permisos para ver todas las empresas',
      );
    }

    return this.prisma.company.findMany({
      include: {
        _count: {
          select: {
            User: true, // Para mostrar el número de empleados,
          },
        },
      },
      orderBy: {
        name: 'asc', // Opcional: las devuelve ordenadas alfabéticamente
      },
    });
  }

  async findOne(id: string, requestUser: User) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { User: true }, // Trae a los empleados
    });

    if (!company) {
      throw new NotFoundException(`Empresa con ID ${id} no encontrada`);
    }

    // 🔒 SEGURIDAD: Un usuario normal solo puede ver los datos de SU PROPIA empresa
    if (requestUser.role !== 'GENERAL_ADMIN' && requestUser.companyId !== id) {
      throw new ForbiddenException(
        'No tienes permisos para ver los datos de esta empresa',
      );
    }

    return company;
  }

  // 👇 3. Añadimos el parámetro "file" al método update
  async update(
    id: string,
    updateCompanyDto: UpdateCompanyDto,
    requestUser: User,
    file?: Express.Multer.File,
  ) {
    // 1. Comprobamos que la empresa existe primero
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException(`Empresa con ID ${id} no encontrada`);
    }

    // 2. 🔒 SEGURIDAD ESTRICTA DE ROLES (Tu lógica impecable):
    const isGeneralAdmin = requestUser.role === 'GENERAL_ADMIN';
    const isAdminOfThisCompany =
      requestUser.role === 'ADMIN' && requestUser.companyId === id;

    // Si NO es General Admin, Y TAMPOCO es el Admin de esta empresa en concreto -> Bloqueado
    if (!isGeneralAdmin && !isAdminOfThisCompany) {
      throw new ForbiddenException(
        'No tienes permisos para modificar los datos de esta empresa',
      );
    }

    // 3. Preparamos los datos a guardar
    const dataToUpdate: {
      name?: string;
      address?: string;
      description?: string;
      website?: string;
      contactEmail?: string;
      contactPhone?: string;
      cif?: string;
      activity?: string;
      logoUrl?: string;
    } = { ...updateCompanyDto };

    // 4. Gestión del Logo (Avatar de la empresa)
    if (file) {
      const newLogoUrl = await this.storageService.uploadFile(file);
      dataToUpdate.logoUrl = newLogoUrl;

      // Borramos el logo antiguo si existía
      if (company.logoUrl) {
        try {
          await this.storageService.deleteFile(company.logoUrl);
        } catch (error) {
          console.error('Error borrando logo antiguo de la empresa:', error);
        }
      }
    }

    // 5. Si pasa la seguridad y procesamos todo, actualizamos
    return this.prisma.company.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  async remove(id: string, requestUser: User) {
    // 🔒 SEGURIDAD: Solo un súper admin puede DESTRUIR una empresa entera
    if (requestUser.role !== 'GENERAL_ADMIN') {
      throw new ForbiddenException(
        'Solo los administradores generales pueden borrar empresas',
      );
    }

    await this.findOne(id, requestUser); // Validamos que exista

    return this.prisma.company.delete({
      where: { id },
    });
  }
}
