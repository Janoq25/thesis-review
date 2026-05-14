import {
  Controller, Post, Get, Body, UseGuards,
  Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { RefreshTokenService } from './refresh-token.service';
import { Ip, Headers } from '@nestjs/common';


@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  login(@Request() req: any) {
    return this.authService.login(req.user);
  }

  @Post('register')
  @Throttle({ short: { limit: 3, ttl: 60_000 } })
  register(
    @Body()
    body: {
      email: string;
      password: string;
      name: string;
      role: string;
      programId?: string;
    },
  ) {
    return this.authService.register(body);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 3, ttl: 300_000 } })
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Request() req: any) {
    return this.authService.me(req.user.id);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: { refreshToken: string },
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.refreshTokenService.rotateRefreshToken(body.refreshToken, {
      ip,
      userAgent: ua,
    });
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body() body: { refreshToken?: string },
    @Request() req: any,
  ) {
    if (body.refreshToken) {
      await this.refreshTokenService.revokeToken(body.refreshToken);
    } else {
      await this.refreshTokenService.revokeAllUserTokens(req.user.id);
    }
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@Request() req: any) {
    await this.refreshTokenService.revokeAllUserTokens(req.user.id);
  }

}
