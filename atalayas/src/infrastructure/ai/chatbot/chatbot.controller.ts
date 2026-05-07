// ── chat.controller.ts ────────────────────────────────────────────────────────
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common';
import { ChatBotService, ChatMessage } from './chatbot.service';
import { AuthGuard } from '../../../common/guards/auth.guard';
import {
  IsArray,
  IsString,
  IsIn,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class MessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  content!: string;
}

class ChatDto {
  @IsArray()
  @ArrayMaxSize(50) // Evitar historials infinitos
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages!: MessageDto[];
}

@Controller('chatbot')
@UseGuards(AuthGuard)
export class ChatBotController {
  constructor(private readonly chatService: ChatBotService) {}

  @Post()
  @HttpCode(200)
  async chat(@Request() req: any, @Body() body: ChatDto) {
    return this.chatService.chat(req.user.id, body.messages as ChatMessage[]);
  }
}
