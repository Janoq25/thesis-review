import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class DeadlinesService {
  private readonly logger = new Logger(DeadlinesService.name);
  private readonly filePath = path.join(process.cwd(), 'data', 'deadlines.json');

  private async readDeadlinesFile(): Promise<Record<string, Record<string, string>>> {
    try {
      const dirPath = path.dirname(this.filePath);
      await fs.mkdir(dirPath, { recursive: true });
      const data = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(data || '{}');
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return {};
      }
      this.logger.error(`Error reading deadlines file: ${err.message}`);
      return {};
    }
  }

  private async writeDeadlinesFile(data: Record<string, Record<string, string>>): Promise<void> {
    try {
      const dirPath = path.dirname(this.filePath);
      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.error(`Error writing deadlines file: ${err.message}`);
      throw err;
    }
  }

  async getDeadlinesForProgram(programId: string): Promise<Record<string, string>> {
    const data = await this.readDeadlinesFile();
    return data[programId] || {};
  }

  async updateDeadlines(programId: string, deadlines: Record<string, string>): Promise<Record<string, string>> {
    const data = await this.readDeadlinesFile();
    data[programId] = deadlines;
    await this.writeDeadlinesFile(data);
    return deadlines;
  }

  async checkDeadline(programId: string, advanceType: string): Promise<boolean> {
    const deadlines = await this.getDeadlinesForProgram(programId);
    const deadlineStr = deadlines[advanceType];
    if (!deadlineStr) return true; // No deadline set, so it's allowed

    const deadlineDate = new Date(deadlineStr);
    if (isNaN(deadlineDate.getTime())) return true; // Invalid date, allow

    return new Date() <= deadlineDate; // Returns true if before/at deadline, false if after
  }
}
