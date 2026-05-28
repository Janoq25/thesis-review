import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProgramsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.program.findMany({
      orderBy: { name: 'asc' },
    });
  }
}
