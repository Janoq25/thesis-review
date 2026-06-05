import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  async create(advisorId: string, data: {
    title: string;
    description?: string;
    startDate?: Date | string;
    deadlineDate?: Date | string;
    templateId?: string;
    advanceType?: string;
  }) {
    const deadline = data.deadlineDate ? new Date(data.deadlineDate) : null;
    const start = data.startDate ? new Date(data.startDate) : null;
    return this.prisma.assignment.create({
      data: {
        advisorId,
        title: data.title,
        description: data.description,
        startDate: start,
        deadlineDate: deadline,
        templateId: data.templateId || null,
        advanceType: data.advanceType || 'chapter_1',
      },
    });
  }

  async findByAdvisor(advisorId: string) {
    return this.prisma.assignment.findMany({
      where: { advisorId },
      include: {
        template: { select: { name: true } },
        _count: { select: { advances: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findForStudent(studentId: string) {
    // Buscar el asesor del estudiante
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { advisorId: true },
    });

    if (!student || !student.advisorId) {
      return [];
    }

    return this.prisma.assignment.findMany({
      where: {
        advisorId: student.advisorId,
        isActive: true,
        OR: [
          { startDate: null },
          { startDate: { lte: new Date() } },
        ],
      },
      include: {
        advances: {
          where: { studentId },
          select: {
            id: true,
            title: true,
            isSimulation: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, requester?: { id: string; role: string }) {
    const includeClause: any = {
      advisor: { select: { name: true, email: true } },
      template: { select: { id: true, name: true, version: true } },
    };

    if (requester?.role === 'ADVISOR') {
      includeClause.advances = {
        where: { isSimulation: false },
        include: {
          student: { select: { id: true, name: true, email: true } },
          plagiarismReport: { select: { overallSimilarity: true, status: true } },
          review: { select: { finalGrade: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      };
    } else if (requester?.role === 'STUDENT') {
      includeClause.advances = {
        where: { studentId: requester.id },
        include: {
          plagiarismReport: { select: { overallSimilarity: true, status: true } },
          review: { select: { finalGrade: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      };
    }

    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      include: includeClause,
    });

    if (!assignment) {
      throw new NotFoundException('Tarea no encontrada');
    }
    return assignment;
  }

  async update(id: string, data: {
    title?: string;
    description?: string;
    startDate?: Date | string | null;
    deadlineDate?: Date | string | null;
    templateId?: string | null;
    advanceType?: string;
    isActive?: boolean;
  }) {
    const deadline = data.deadlineDate !== undefined ? (data.deadlineDate ? new Date(data.deadlineDate) : null) : undefined;
    const start = data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : undefined;
    return this.prisma.assignment.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        startDate: start,
        deadlineDate: deadline,
        templateId: data.templateId,
        advanceType: data.advanceType,
        isActive: data.isActive,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.assignment.delete({
      where: { id },
    });
  }
}
