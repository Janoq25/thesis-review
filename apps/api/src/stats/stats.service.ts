import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardKPIs(programId?: string) {
    const where = programId ? { programId } : {};

    const [
      totalAdvances,
      byStatus,
      avgAIScore,
      avgHumanGrade,
      pendingCount,
      lowComplianceCount,
    ] = await Promise.all([
      this.prisma.advance.count({ where }),

      this.prisma.advance.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),

      this.prisma.aIAnalysis.aggregate({
        where: { advance: where },
        _avg: { overallScore: true, gradeConverted: true },
      }),

      this.prisma.review.aggregate({
        where: { advance: where },
        _avg: { finalGrade: true },
      }),

      this.prisma.advance.count({
        where: { ...where, status: { in: ['PENDING', 'AI_PROCESSING', 'AI_COMPLETE'] } },
      }),

      this.prisma.aIAnalysis.count({
        where: {
          advance: where,
          overallScore: { lt: Number(process.env.LOW_COMPLIANCE_ALERT ?? 65) },
        },
      }),
    ]);

    const concordance = await this.calculateAIConcordance(programId);

    return {
      totalAdvances,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      averageAIScore: Math.round((avgAIScore._avg.overallScore ?? 0) * 10) / 10,
      averageAIGrade: Math.round((avgAIScore._avg.gradeConverted ?? 0) * 10) / 10,
      averageHumanGrade: Math.round((avgHumanGrade._avg.finalGrade ?? 0) * 10) / 10,
      pendingCount,
      lowComplianceCount,
      aiConcordance: concordance,
    };
  }

  async getMonthlyTrend(programId?: string, months = 8) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const advances = await this.prisma.advance.findMany({
      where: {
        ...(programId && { programId }),
        createdAt: { gte: since },
      },
      select: { createdAt: true, status: true },
    });

    // Agrupar por mes
    const grouped: Record<string, { month: string; total: number; approved: number }> = {};
    for (const adv of advances) {
      const key = adv.createdAt.toISOString().slice(0, 7); // "2025-10"
      if (!grouped[key]) grouped[key] = { month: key, total: 0, approved: 0 };
      grouped[key].total++;
      if (adv.status === 'APPROVED') grouped[key].approved++;
    }

    return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month));
  }

  async getAdvisorWorkload(programId?: string) {
    const advisors = await this.prisma.user.findMany({
      where: {
        role: 'ADVISOR',
        ...(programId && { programId }),
      },
      select: {
        id: true,
        name: true,
        _count: { select: { reviews: true } },
        reviews: {
          select: { createdAt: true, reviewedAt: true },
          where: { reviewedAt: { not: null } },
          take: 50,
        },
      },
    });

    return advisors.map((advisor) => {
      const avgDays = advisor.reviews.length > 0
        ? advisor.reviews.reduce((sum, r) => {
            const diff = r.reviewedAt!.getTime() - r.createdAt.getTime();
            return sum + diff / 86_400_000;
          }, 0) / advisor.reviews.length
        : 0;

      return {
        advisorId: advisor.id,
        name: advisor.name,
        totalReviews: advisor._count.reviews,
        avgReviewDays: Math.round(avgDays * 10) / 10,
      };
    });
  }

  async getStudentEvolution(studentId: string) {
    const advances = await this.prisma.advance.findMany({
      where: { studentId },
      include: {
        aiAnalysis: {
          select: { overallScore: true, gradeConverted: true },
        },
        review: { select: { finalGrade: true } },
      },
      orderBy: [{ advanceType: 'asc' }, { version: 'asc' }],
    });

    return advances.map((a) => ({
      advanceType: a.advanceType,
      version: a.version,
      status: a.status,
      aiScore: a.aiAnalysis?.overallScore ?? null,
      aiGrade: a.aiAnalysis?.gradeConverted ?? null,
      humanGrade: a.review?.finalGrade ?? null,
      createdAt: a.createdAt,
    }));
  }

  private async calculateAIConcordance(programId?: string): Promise<number> {
    const pairs = await this.prisma.review.findMany({
      where: {
        finalGrade: { not: null },
        advance: {
          ...(programId && { programId }),
          aiAnalysis: { isNot: null },
        },
      },
      select: {
        finalGrade: true,
        advance: { select: { aiAnalysis: { select: { gradeConverted: true } } } },
      },
      take: 500,
    });

    if (pairs.length === 0) return 0;

    const maxGrade = Number(process.env.MAX_GRADE ?? 20);
    const tolerancePct = 0.10; // 10% de tolerancia
    const tolerance = maxGrade * tolerancePct;

    const concordant = pairs.filter((p) => {
      const aiGrade = p.advance.aiAnalysis?.gradeConverted ?? 0;
      const humanGrade = p.finalGrade ?? 0;
      return Math.abs(aiGrade - humanGrade) <= tolerance;
    });

    return Math.round((concordant.length / pairs.length) * 100 * 10) / 10;
  }

    async getGradeDistribution(programId?: string) {
    const reviews = await this.prisma.review.findMany({
      where: {
        finalGrade: { not: null },
        advance: programId ? { programId } : {},
      },
      select: { finalGrade: true },
    });

    const maxGrade = Number(process.env.MAX_GRADE ?? 20);
    const buckets: Record<string, number> = {};
    const bucketSize = maxGrade / 5;

    for (let i = 0; i < 5; i++) {
      const from = Math.round(i * bucketSize);
      const to = Math.round((i + 1) * bucketSize);
      buckets[`${from}-${to}`] = 0;
    }

    for (const { finalGrade } of reviews) {
      if (finalGrade == null) continue;
      const bucket = Math.min(
        4,
        Math.floor((finalGrade / maxGrade) * 5),
      );
      const from = Math.round(bucket * bucketSize);
      const to = Math.round((bucket + 1) * bucketSize);
      buckets[`${from}-${to}`]++;
    }

    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  }

  async generateStatsCsv(programId: string): Promise<string> {
    const advances = await this.prisma.advance.findMany({
      where: { programId },
      include: {
        student: { select: { name: true, email: true } },
        aiAnalysis: { select: { overallScore: true, gradeConverted: true } },
        review: {
          select: {
            finalGrade: true,
            status: true,
            reviewedAt: true,
            reviewer: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const headers = [
      'ID', 'Estudiante', 'Email', 'Tipo avance', 'Versión',
      'Estado', 'Nota IA', '% cumplimiento IA', 'Nota final',
      'Asesor', 'Fecha revisión', 'Fecha carga',
    ];

    const rows = advances.map((a) => [
      a.id,
      a.student.name,
      a.student.email,
      a.advanceType,
      a.version,
      a.status,
      a.aiAnalysis?.gradeConverted?.toFixed(1) ?? '',
      a.aiAnalysis?.overallScore?.toFixed(1) ?? '',
      a.review?.finalGrade?.toFixed(1) ?? '',
      a.review?.reviewer?.name ?? '',
      a.review?.reviewedAt?.toISOString().slice(0, 10) ?? '',
      a.createdAt.toISOString().slice(0, 10),
    ]);

    return [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    }
}
