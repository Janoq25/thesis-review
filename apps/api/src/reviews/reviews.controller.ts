import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Get('panel/:advanceId')
  @Roles('ADVISOR', 'COORDINATOR', 'ADMIN')
  getPanel(@Param('advanceId') advanceId: string) {
    return this.reviewsService.getReviewPanel(advanceId);
  }

  @Post(':advanceId')
  @Roles('ADVISOR', 'COORDINATOR', 'ADMIN')
  saveReview(
    @Param('advanceId') advanceId: string,
    @Body() body: {
      finalGrade: number;
      humanComment: string;
      rubricAnswers: Record<string, boolean>;
      status: 'OBSERVED' | 'APPROVED' | 'REJECTED';
    },
    @Request() req: any,
  ) {
    return this.reviewsService.saveHumanReview({
      advanceId,
      reviewerId: req.user.id,
      ...body,
    });
  }

  @Get(':advanceId/annotations')
  getAnnotations(@Param('advanceId') advanceId: string) {
    return this.reviewsService.getAnnotations(advanceId);
  }

  @Post(':advanceId/annotations')
  @Roles('ADVISOR', 'COORDINATOR', 'ADMIN')
  addAnnotation(
    @Param('advanceId') advanceId: string,
    @Body() body: {
      pageNumber: number;
      paragraph?: string;
      text: string;
      type: 'comment' | 'correction' | 'suggestion';
    },
    @Request() req: any,
  ) {
    return this.reviewsService.addAnnotation({
      advanceId,
      reviewerId: req.user.id,
      annotation: body,
    });
  }

  @Delete('annotations/:id')
  @Roles('ADVISOR', 'COORDINATOR', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAnnotation(@Param('id') id: string, @Request() req: any) {
    return this.reviewsService.deleteAnnotation(id, req.user.id);
  }
}
