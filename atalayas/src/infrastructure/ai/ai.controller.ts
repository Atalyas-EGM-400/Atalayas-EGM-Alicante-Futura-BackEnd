import {
  Controller,
  Post,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AiService } from './ai.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js'; // 👈 Usando tu Guard

@ApiTags('IA') // Agrupa en Swagger
@ApiBearerAuth()
@Controller('ai')
@UseGuards(AuthGuard) // 👈 Protegido igual que el ChatBot
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('test-podcast')
  @HttpCode(200) // 👈 Igual que tu controlador de Chat
  @ApiOperation({ summary: 'Genera un audio podcast a partir de un PDF' })
  @ApiConsumes('multipart/form-data') // 👈 Necesario para que Swagger muestre el botón de subir archivo
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          // Este es el nombre que usaremos en el Form-Data
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async testPodcast(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const rawText = await this.aiService.extractTextFromPdf(file.buffer);
    return this.aiService.generatePodcast(rawText);
  }

  /**
   * NUEVO ENDPOINT: Genera imagen explicativa
   */
  @Post('generate-explanatory-image')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Genera una imagen explicativa y la guarda en Supabase a partir de un PDF',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async generateImage(@UploadedFile() file: Express.Multer.File) {
    // 1. Extraer texto del PDF
    const rawText = await this.aiService.extractTextFromPdf(file.buffer);

    // 2. Generar la imagen, subirla a Supabase y obtener la URL pública
    // El método generateExplanatoryImage ya se encarga de todo el flujo
    const imageUrl = await this.aiService.generateImage(rawText);

    return {
      message: 'Imagen generada y almacenada con éxito',
      url: imageUrl,
    };
  }
  @Post('generate-lab-config')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Genera el JSON de configuración para el simulador Canvas a partir de un PDF',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async generateLab(@UploadedFile() file: Express.Multer.File) {
    // 1. Extraer texto
    const rawText = await this.aiService.extractTextFromPdf(file.buffer);

    // 2. Generar la lógica del laboratorio
    const labConfig = await this.aiService.generatePracticeLab(rawText);

    return {
      message: 'Configuración de laboratorio generada con éxito',
      data: labConfig,
    };
  }
}
