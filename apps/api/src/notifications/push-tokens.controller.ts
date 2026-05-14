import { Controller, Post, Delete, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class PushTokensController {
  constructor(private prisma: PrismaService) {}

  @Post('push-token')
  async registerToken(
    @Body() body: { token: string; platform: string },
    @Request() req: any,
  ) {
    return this.prisma.userPushToken.upsert({
      where: { token: body.token },
      create: {
        userId: req.user.id,
        token: body.token,
        platform: body.platform,
      },
      update: { userId: req.user.id },
    });
  }

  @Delete('push-token')
  async removeToken(@Body() body: { token: string }) {
    return this.prisma.userPushToken.deleteMany({ where: { token: body.token } });
  }
}
