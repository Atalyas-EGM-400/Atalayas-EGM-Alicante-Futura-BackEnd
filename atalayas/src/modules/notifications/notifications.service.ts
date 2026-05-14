import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { User } from '@prisma/client';
@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private mailerService: MailerService,
  ) {}

  async notifyByEmail(options: {
    targetCompanyId?: string | null;
    isPublic: boolean;
    title: string;
    message: string;
    type: 'EVENTO' | 'ANUNCIO';
    link: string;
  }) {
    // 1. Buscamos los usuarios que deben recibir el mail
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          options.isPublic ? { role: 'PUBLIC' } : {}, // Si es público, a usuarios externos
          { companyId: options.targetCompanyId }, // A los de la empresa específica
          { role: 'GENERAL_ADMIN' }, // Siempre a los super admins
        ],
      },
    });

    // 2. Enviamos los correos de forma asíncrona (sin bloquear el servidor)
    const emailPromises = users.map((user) =>
      this.mailerService
        .sendMail({
          to: user.email,
          subject: `${options.type === 'ANUNCIO' ? '📢' : '📅'} Atalayas EGM: ${options.title}`,
          html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 15px;">
            <h2 style="color: #333;">Hola ${user.name || 'Usuario'}</h2>
            <p style="font-size: 16px;">Hay un nuevo <strong>${options.type.toLowerCase()}</strong> en la plataforma:</p>
            <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #000; margin: 20px 0;">
              <h3 style="margin-top: 0;">${options.title}</h3>
              <p>${options.message.substring(0, 150)}...</p>
            </div>
            <a href="https://tu-plataforma.com${options.link}" 
               style="display: inline-block; background: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">
               Ver en la plataforma
            </a>
          </div>
        `,
        })
        .catch((err) =>
          console.error(`Error enviando mail a ${user.email}:`, err),
        ),
    );

    // No usamos await aquí para no hacer esperar al Admin mientras se envían 100 correos
    Promise.all(emailPromises);
  }

  async getUnreadCount(user: User) {
    const lastRead = user.lastNotificationsRead || new Date(0); // Si es null, usamos una fecha antigua

    const count = await Promise.all([
      this.prisma.announcement.count({
        where: {
          createdAt: { gt: lastRead },
          OR: [{ companyId: null }, { companyId: user.companyId }],
        },
      }),

      this.prisma.events.count({
        where: {
          created_at: { gt: lastRead },
          OR: [{ companyId: null }, { companyId: user.companyId }],
        },
      }),
    ]);

    return count[0] + count[1]; // Suma de anuncios y eventos nuevos
  }
}
