import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default';
  badge?: number;
  channelId?: string;
}

@Injectable()
export class NotificationService {
  private readonly EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

  constructor(private prisma: PrismaService) {}

  async sendToUser(userId: string, message: Omit<ExpoMessage, 'to'>) {
    const tokens = await this.prisma.userPushToken.findMany({ where: { userId } });
    if (tokens.length === 0) return;

    const messages: ExpoMessage[] = tokens.map((t) => ({
      to: t.token,
      sound: 'default',
      channelId: 'thesis-review',
      ...message,
    }));

    await fetch(this.EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
  }

  // Eventos del sistema que disparan notificaciones
  async notifyAnalysisComplete(advanceId: string) {
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      include: { aiAnalysis: true, student: true },
    });

    const score = advance.aiAnalysis?.overallScore ?? 0;
    const grade = advance.aiAnalysis?.gradeConverted ?? 0;

    await this.sendToUser(advance.studentId, {
      title: 'Análisis IA completado',
      body: `Tu avance obtuvo ${score.toFixed(0)}% de cumplimiento (${grade.toFixed(1)}/20). ¡Revisa los hallazgos!`,
      data: { screen: 'advance', advanceId },
    });
  }

  async notifyReviewComplete(advanceId: string) {
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      include: { review: { include: { reviewer: true } } },
    });

    const status = advance.status === 'APPROVED' ? 'aprobado' : 'observado';
    const reviewerName = advance.review?.reviewer.name ?? 'Tu asesor';
    const grade = advance.review?.finalGrade;

    await this.sendToUser(advance.studentId, {
      title: `Avance ${status}`,
      body: `${reviewerName} ${status} tu avance.${grade ? ` Nota final: ${grade}/20` : ''}`,
      data: { screen: 'advance', advanceId },
    });
  }

  async notifyPlagiarismAlert(advanceId: string, similarity: number) {
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      include: { student: { include: { advisor: true } } },
    });

    // Notificar al asesor, no al estudiante
    if (advance.student.advisorId) {
      await this.sendToUser(advance.student.advisorId, {
        title: 'Alerta de similitud detectada',
        body: `El avance de ${advance.student.name} presenta ${similarity.toFixed(0)}% de similitud con otro documento del programa.`,
        data: { screen: 'plagiarism', advanceId },
      });
    }
  }
}
