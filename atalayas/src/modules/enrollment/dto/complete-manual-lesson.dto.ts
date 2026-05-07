import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteManualLessonDto {
  @ApiProperty({ description: 'ID de la lección (Content)' })
  @IsUUID()
  contentId!: string;
}
