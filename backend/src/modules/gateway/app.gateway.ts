import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  // จำกัด origin เท่ากับ frontend จริง (เดิม '*' คู่ credentials เป็น misconfig)
  cors: {
    origin: [process.env.FRONTEND_URL, 'http://localhost:3000'].filter(Boolean),
    credentials: true,
  },
  namespace: '/ws',
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AppGateway.name);
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) { client.disconnect(); return; }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('jwt.secret'),
      });

      client.data.userId = payload.sub;
      client.data.orgId = payload.orgId;

      client.join(`user:${payload.sub}`);
      client.join(`org:${payload.orgId}`);

      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub).add(client.id);

      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId).delete(client.id);
      if (this.userSockets.get(userId).size === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket) {
    client.emit('heartbeat:ack', { timestamp: new Date().toISOString() });
  }

  @SubscribeMessage('notification:read')
  handleNotificationRead(@ConnectedSocket() client: Socket, @MessageBody() data: { id: string }) {
    this.logger.debug(`Notification read: ${data.id}`);
  }

  sendNotificationToUser(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification:new', notification);
  }

  sendToOrg(orgId: string, event: string, data: any) {
    this.server.to(`org:${orgId}`).emit(event, data);
  }

  broadcastDocumentStatus(orgId: string, documentId: string, status: string) {
    this.sendToOrg(orgId, 'document:status_changed', { documentId, status });
  }

  broadcastApprovalUpdate(orgId: string, requestId: string, status: string) {
    this.sendToOrg(orgId, 'approval:result', { requestId, status });
  }
}
