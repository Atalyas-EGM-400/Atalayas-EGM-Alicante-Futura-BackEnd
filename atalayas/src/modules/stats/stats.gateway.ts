import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io'; // 👈 CAMBIO 1: Importamos Namespace en lugar de Server
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

interface MySocketData {
  companyId?: string;
  userId?: string;
}

@WebSocketGateway({
  namespace: '/stats',
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Namespace; // 👈 CAMBIO 2: Le decimos a TypeScript que esto es un Namespace

  private connectedUsers = new Set<string>();

  constructor(private readonly prisma: PrismaService) { }

  async handleConnection(client: Socket) {
    this.connectedUsers.add(client.id);
    this.broadcastCount();

    try {
      const auth = client.handshake.auth as { token?: unknown };
      const token = typeof auth.token === 'string' ? auth.token : undefined;

      if (token) {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payloadBase64 = parts[1];
          const payloadBuffer = Buffer.from(payloadBase64, 'base64');

          const payload = JSON.parse(
            payloadBuffer.toString('utf-8'),
          ) as {
            sub?: unknown;
            companyId?: unknown;
            user_metadata?: Record<string, unknown>;
            app_metadata?: Record<string, unknown>;
          };

          const extractId = (val: unknown): string | undefined => {
            if (typeof val === 'string') return val;
            if (typeof val === 'number') return val.toString();
            return undefined;
          };

          const userId = extractId(payload.sub);

          let companyId =
            extractId(payload.companyId) ||
            extractId(payload.user_metadata?.companyId) ||
            extractId(payload.app_metadata?.companyId);

          if (!companyId && userId) {
            const userInDb = await this.prisma.user.findUnique({
              where: { id: userId },
              select: { companyId: true },
            });
            if (userInDb?.companyId) {
              companyId = userInDb.companyId;
            }
          }

          console.log(
            `🔌 Socket conectado -> UserID: ${userId || 'Global'} | Empresa: ${companyId || 'Global'}`,
          );

          if (companyId && userId) {
            const socketData = client.data as MySocketData;
            socketData.companyId = companyId;
            socketData.userId = userId;

            const roomName = `company_${companyId}`;
            void client.join(roomName);

            this.broadcastCompanyCount(companyId);
          }
        }
      }
    } catch (error) {
      console.warn('Socket: Conexión sin token válido (se mantiene en global).');
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedUsers.delete(client.id);
    this.broadcastCount();

    const socketData = client.data as MySocketData;
    const companyId = socketData.companyId;

    if (companyId) {
      console.log(`❌ Socket desconectado de la Empresa: ${companyId}`);
      this.broadcastCompanyCount(companyId);
    }
  }

  private broadcastCount() {
    this.server.emit('userCount', this.connectedUsers.size);
  }

  private broadcastCompanyCount(companyId: string) {
    const roomName = `company_${companyId}`;

    // Ahora TypeScript sabe que "server" es un Namespace, por lo que .adapter y .rooms existen y son accesibles
    const room = this.server.adapter.rooms.get(roomName);

    if (!room) {
      this.server.to(roomName).emit('companyUserCount', 0);
      return;
    }

    const uniqueUsers = new Set<string>();

    for (const socketId of room) {
      // Al ser un Namespace, .sockets es un Map que contiene todas las conexiones de este namespace
      const clientSocket = this.server.sockets.get(socketId);

      if (clientSocket) {
        const socketData = clientSocket.data as MySocketData;
        if (socketData.userId) {
          uniqueUsers.add(socketData.userId);
        }
      }
    }

    this.server.to(roomName).emit('companyUserCount', uniqueUsers.size);
  }
}