import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateCompanyRequestDto } from './dto/create-company-request.dto';
import { UpdateCompanyRequestDto } from './dto/update-company-request.dto';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class CompanyRequestService {
  private supabaseAdmin: ReturnType<typeof createClient>;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly mailerService: MailerService,
  ) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.supabaseAdmin = createClient(supabaseUrl!, supabaseServiceRoleKey!);
  }

  async create(
    createCompanyRequestDto: CreateCompanyRequestDto,
    file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('El documento es obligatorio');

    const fileName = `company-request/${Date.now()}-${file.originalname}`;
    const { error } = await this.supabaseAdmin.storage
      .from('uploads')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
      });

    if (error)
      throw new InternalServerErrorException('Error al subir el documento');

    const { data: urlData } = this.supabaseAdmin.storage
      .from('uploads')
      .getPublicUrl(fileName);

    return this.prismaService.companyRequest.create({
      data: {
        companyName: createCompanyRequestDto.companyName,
        cif: createCompanyRequestDto.cif,
        contactName: createCompanyRequestDto.contactName,
        contactEmail: createCompanyRequestDto.contactEmail,
        phone: createCompanyRequestDto.phone,
        address: createCompanyRequestDto.address,
        activity: createCompanyRequestDto.activity,
        documentUrl: urlData.publicUrl,
        status: 'PENDING',
      },
    });
  }

  async findAll(showArchived = false) {
    const request = this.prismaService.companyRequest.findMany({
      where: { archivedAt: showArchived ? { not: null } : null },
      orderBy: { created_at: 'desc' },
    });
    console.log('Primera solicitud:', JSON.stringify(request, null, 2));
    return request;
  }

  async findOne(id: string) {
    const request = await this.prismaService.companyRequest.findUnique({
      where: { id },
    });

    if (!id) throw new NotFoundException('Solicitud no encontrada');
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    return request;
  }

  async approve(id: string) {
    const request = await this.findOne(id);

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Esta solicitud ya ha sido procesada');
    }

    const company = await this.prismaService.company.create({
      data: { name: request.companyName },
    });

    const password = Math.random().toString(36).slice(-8);

    const { data: authUser, error } =
      await this.supabaseAdmin.auth.admin.createUser({
        email: request.contactEmail,
        password,
        email_confirm: true,
      });

    if (error)
      throw new InternalServerErrorException('Error al crear el usuario');

    await this.prismaService.user.create({
      data: {
        id: authUser.user.id,
        email: request?.contactEmail,
        name: request?.companyName,
        role: 'ADMIN',
        companyId: company.id,
      },
    });

    await this.prismaService.companyRequest.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    await this.mailerService.sendMail({
      to: request.contactEmail,
      subject: '🎉 Solicitud aprobada - Atalayas EGM',
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenido a Atalayas EGM</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333333;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border: 1px border #e1e4e8;">
                
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 40px 20px;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;">Atalayas EGM</h1>
                    <p style="margin: 10px 0 0 0; color: #bfdbfe; font-size: 14px; font-weight: 600; tracking-widest: 0.1em;">CENTRO DE GESTIÓN</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="margin: 0 0 16px 0; color: #1e293b; font-size: 22px; font-weight: 700;">¡Hola, ${request.contactName}!</h2>
                    <p style="margin: 0 0 24px 0; color: #64748b; font-size: 16px; line-height: 1.6;">
                      Nos complace informarte que la solicitud de alta para la empresa <strong style="color: #1e3a8a;">${request.companyName}</strong> ha sido revisada y <strong>aprobada con éxito</strong>. ¡Te damos la bienvenida a nuestra plataforma!
                    </p>

                    <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
                      <h3 style="margin: 0 0 14px 0; color: #334155; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Tus credenciales de acceso:</h3>
                      
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td style="padding: 6px 0; color: #64748b; font-size: 15px; width: 100px;"><strong>Email:</strong></td>
                          <td style="padding: 6px 0; color: #0f172a; font-size: 15px; font-family: monospace; font-weight: bold;">${request.contactEmail}</td>
                        </tr>
                        <tr>
                          <td style="padding: 6px 0; color: #64748b; font-size: 15px;"><strong>Contraseña:</strong></td>
                          <td style="padding: 6px 0; color: #3b82f6; font-size: 15px; font-family: monospace; font-weight: bold; background-color: #eff6ff; padding-left: 8px; border-radius: 4px;">${password}</td>
                        </tr>
                      </table>
                    </div>

                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 35px;">
                      <tr>
                        <td style="vertical-align: top; width: 24px; padding-top: 2px;">
                          <span style="color: #ea580c; font-size: 16px;">⚠️</span>
                        </td>
                        <td style="color: #64748b; font-size: 13px; line-height: 1.5; padding-left: 8px;">
                          <strong>Nota de seguridad:</strong> Esta contraseña es de carácter provisional. Por motivos de protección de datos, se te solicitará cambiarla obligatoriamente cuando accedas por primera vez.
                        </td>
                      </tr>
                    </table>

                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center">
                          <a href="http://localhost:5173/login" target="_blank" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 6px rgba(30, 58, 138, 0.2); transition: background-color 0.2s;">
                            Acceder a la plataforma
                          </a>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <tr>
                  <td style="background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                      Este es un correo automático, por favor no respondas a este mensaje.<br>
                      &copy; ${new Date().getFullYear()} Atalayas EGM. Todos los derechos reservados.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
      `,
    });

    return { message: 'Solicitud aprobada', provisionalPassword: password };
  }

  async reject(id: string, rejectReason: string) {
    const request = await this.findOne(id);

    if (request.status !== 'PENDING')
      throw new BadRequestException('Esta solicitud ya ha sido procesada');

    await this.prismaService.companyRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectReason,
      },
    });

    await this.mailerService.sendMail({
      to: request.contactEmail,
      subject: 'Solicitud rechazada - Atalayas EGM',
      html: `
      <h2>Solicitud rechazada</h2>
      <p>Lamentamos informarle que tu solicitud para <strong>${request.companyName}</strong> ha sido rechazada.</p>
      <p><strong>Motivo:</strong> ${rejectReason}</p>
      <p>Si cree que es un error, contacta con nosotros.</p>
      `,
    });

    return { message: 'Solicitud rechazada' };
  }

  update(id: string, updateCompanyRequestDto: UpdateCompanyRequestDto) {
    return `This action updates a #${id} companyRequest`;
  }

  async remove(id: string) {
    const request = await this.findOne(id);

    await this.prismaService.companyRequest.delete({
      where: { id },
    });
    return `Solicitud borrada con éxito`;
  }

  async archive(id: string) {
    const request = await this.findOne(id);

    if (request.status === 'PENDING') {
      throw new BadRequestException(
        'No puedes archivar una solicitud pendiente',
      );
    }

    return this.prismaService.companyRequest.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  async unarchive(id: string) {
    await this.findOne(id);

    return this.prismaService.companyRequest.update({
      where: { id },
      data: { archivedAt: null },
    });
  }
}
