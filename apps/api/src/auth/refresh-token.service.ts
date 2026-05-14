import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class RefreshTokenService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async createRefreshToken(userId: string, meta?: { userAgent?: string; ip?: string }) {
    const token = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 3_600_000); // 30 días

    // Limpiar tokens viejos del mismo usuario (máx 5 sesiones simultáneas)
    const existing = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'asc' },
    });
    if (existing.length >= 5) {
      await this.prisma.refreshToken.update({
        where: { id: existing[0].id },
        data: { revokedAt: new Date() },
      });
    }

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
        userAgent: meta?.userAgent,
        ipAddress: meta?.ip,
      },
    });

    return token;
  }

  async rotateRefreshToken(oldToken: string, meta?: { userAgent?: string; ip?: string }) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { token: oldToken },
      include: { user: { select: { id: true, email: true, role: true } } },
    });

    if (!record) throw new UnauthorizedException('Refresh token inválido');
    if (record.revokedAt) {
      // Token ya usado — posible robo: revocar toda la familia
      await this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Token reusado — sesiones revocadas por seguridad');
    }
    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    // Revocar el token anterior (rotación)
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const newRefreshToken = await this.createRefreshToken(record.userId, meta);
    const accessToken = this.jwt.sign({
      sub: record.user.id,
      email: record.user.email,
      role: record.user.role,
    });

    return { accessToken, refreshToken: newRefreshToken, user: record.user };
  }

  async revokeAllUserTokens(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeToken(token: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
