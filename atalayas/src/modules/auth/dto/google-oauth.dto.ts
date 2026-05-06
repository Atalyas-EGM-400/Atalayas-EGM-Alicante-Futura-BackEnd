import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleOAuthDto {
  @ApiProperty({ example: '' })
  @IsString()
  token!: string;
}