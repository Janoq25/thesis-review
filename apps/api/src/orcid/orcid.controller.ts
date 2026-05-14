import {
  Controller, Get, Post, Param, Query,
  Redirect, UseGuards, Request, Body,
} from '@nestjs/common';
import { OrcidService } from './orcid.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('orcid')
export class OrcidController {
  constructor(private orcidService: OrcidService) {}

  @Get('connect')
  @UseGuards(JwtAuthGuard)
  @Redirect()
  connect(@Request() req: any) {
    const url = this.orcidService.getAuthorizationUrl(req.user.id);
    return { url };
  }

  @Get('callback')
  @Redirect(`${process.env.FRONTEND_URL}/profile?orcid=connected`)
  async callback(@Query('code') code: string, @Query('state') state: string) {
    await this.orcidService.handleOAuthCallback(code, state);
  }

  @Get('profile/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADVISOR', 'COORDINATOR', 'ADMIN')
  getProfile(@Param('userId') userId: string) {
    return this.orcidService['prisma'].orcidProfile.findUnique({
      where: { userId },
      include: {
        publications: { orderBy: { year: 'desc' }, take: 20 },
      },
    });
  }

  @Post('sync/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADVISOR', 'ADMIN')
  async sync(@Param('userId') userId: string) {
    await this.orcidService.syncPublications(userId);
    return { message: 'Sincronización completada' };
  }

  @Get('compatibility')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  async getCompatibility(
    @Query('advisorId') advisorId: string,
    @Query('advanceId') advanceId: string,
  ) {
    const chunks = await this.orcidService['prisma'].advanceChunk.findMany({
      where: { advanceId },
      select: { content: true },
      take: 10,
    });
    const text = chunks.map((c) => c.content).join(' ');
    return this.orcidService.calculateCompatibility(advisorId, text);
  }

  @Get('advisors/ranking')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  async getAdvisorsRanking(@Query('advanceId') advanceId: string) {
    const advisors = await this.orcidService['prisma'].user.findMany({
      where: { role: 'ADVISOR', orcidProfile: { isNot: null } },
      include: { orcidProfile: { select: { keywords: true, displayName: true } } },
    });

    const chunks = await this.orcidService['prisma'].advanceChunk.findMany({
      where: { advanceId },
      select: { content: true },
      take: 8,
    });
    const text = chunks.map((c) => c.content).join(' ');

    const rankings = await Promise.all(
      advisors.map(async (advisor) => {
        const { score, matchedKeywords } = await this.orcidService.calculateCompatibility(
          advisor.id,
          text,
        );
        return {
          advisorId: advisor.id,
          name: advisor.name,
          orcidKeywords: advisor.orcidProfile?.keywords ?? [],
          score,
          matchedKeywords,
        };
      }),
    );

    return rankings.sort((a, b) => b.score - a.score);
  }
}
