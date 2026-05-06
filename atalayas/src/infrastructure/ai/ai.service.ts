import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';
import axios from 'axios';
import { extractText } from 'unpdf';
import { StorageService } from '../storage/storage.service';


type QuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
};

type PodcastResult = {
  script: string;
  audioBuffer: Buffer;
};

type PracticeLab = {
  scenarioTitle: string;
  instruction: string;
  backgroundImage: string; // Sugerencia de asset (ej: "industrial_barrel")
  draggables: {
    id: string;
    content: string;
    description: string;
  }[];
  dropZones: {
    id: string;
    expectedId: string; // El ID del draggable que debe ir aquí
    label: string;
    position: { x: number; y: number }; // Coordenadas relativas (%)
  }[];
};

@Injectable()
export class AiService {
  private aiClient: OpenAI;

  constructor(private readonly storageService: StorageService) {
    this.aiClient = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  async extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
    const pdfBytes = new Uint8Array(pdfBuffer);
    const pdfData = await extractText(pdfBytes, { mergePages: true });
    return pdfData.text || '';
  }

  async generateSummary(text: string): Promise<string> {
    console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY);
    const completion = await this.aiClient.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'Eres un redactor experto en síntesis corporativa. Genera un resumen ejecutivo estructurado por puntos clave sin usar encabezados Markdown (#).',
        },
        { role: 'user', content: text },
      ],
    });
    return completion.choices[0].message.content || '';
  }

  async generateQuizFromText(summaryText: string): Promise<QuizQuestion[]> {
    try {
      const prompt = `
        Eres un profesor experto. Genera un test de 4 preguntas de opción múltiple.
        REGLA ESTRICTA: Responde ÚNICAMENTE con un Array JSON. 
        No incluyas explicaciones.
        Formato: [{"question": "...", "options": ["...", "..."], "correctAnswer": "..."}]
        Texto: "${summaryText}"
      `;

      const response = await this.aiClient.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        response_format: { type: 'json_object' }, // Groq soporta JSON mode
      });

      let content = response.choices[0].message.content || '[]';

      // Limpieza por si el modelo incluye Markdown
      content = content
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(content) as
        | { questions?: QuizQuestion[] }
        | QuizQuestion[];
      // Si el modelo envuelve el array en un objeto { "questions": [...] }
      return Array.isArray(parsed) ? parsed : parsed.questions || [];
    } catch (error) {
      console.error('🚨 Error generando el Quiz:', error);
      return [];
    }
  }

  async generatePodcast(text: string): Promise<PodcastResult> {
    try {
      // 1. Generar guion ameno
      const completion = await this.aiClient.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'Eres un locutor de podcast. Resume el texto de forma amena y directa. Máximo 2 párrafos. No incluyas acotaciones.',
          },
          { role: 'user', content: text },
        ],
      });

      const rawScript = completion.choices[0].message.content || '';
      const cleanScript = rawScript.replace(/\*\*|__|#+|\[.*?\]/g, '').trim();

      // 2. Generar audio con ElevenLabs (URL corregida)
      const audioResponse = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL`,
        {
          text: cleanScript,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        },
        {
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        },
      );

      return {
        script: cleanScript,
        audioBuffer: Buffer.from(audioResponse.data as ArrayBuffer),
      };
    } catch (error: any) {
      console.error('🚨 Error en Podcast Pipeline:', error);

      if (axios.isAxiosError(error) && error.response?.status === 402) {
        throw new InternalServerErrorException('Cuota de ElevenLabs agotada.');
      }

      throw new InternalServerErrorException(
        'Error al generar contenido de audio.',
      );
    }
  }

  async generateImage(text: string): Promise<string> {
    try {
      // 1. LLM (Groq) analiza el texto corporativo y crea un prompt visual
      const completion = await this.aiClient.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'You are a professional commercial photographer and art director. ' +
              'Analyze the document text to identify the most iconic and professional physical object that represents its core theme. ' +
              'Convert that specific subject into a HIGH-END PHOTOGRAPHIC visual prompt. ' +
              'STYLE: Professional laboratory and university photography, shot on 35mm lens, f/2.8. ' +
              'LIGHTING: Cinematic natural light, soft shadows, clear high-key faculty atmosphere. ' +
              'COMPOSITION: Sharp focus on the identified subject in the foreground, beautiful blurred background (bokeh) reflecting the professional scientific setting. ' +
              'DETAILS: Photorealistic textures, glass, brushed metal, safety equipment, or universal warning symbols. ' +
              'PALETTE: Clean whites, corporate blues, and safety yellow or red accent tones. ' +
              'RESTRICTIONS: NO TEXT, NO ALPHANUMERIC CHARACTERS, NO BRAND LOGOS, NO DISTORTED FACES. ' +
              'Output ONLY the English prompt.',
          },
          // Pasamos un subconjunto del texto para no saturar el prompt
          {
            role: 'user',
            content: `Analyze and create a visual prompt for: ${text.substring(0, 2500)}`,
          },
        ],
        temperature: 0.5, // Equilibrio entre creatividad y adherencia al texto
      });

      const visualPrompt =
        completion.choices[0].message.content ||
        'Corporate networking illustration';
      console.log(`[AI-Image] Prompt generado: ${visualPrompt}`); // Útil para depurar

      // 2. Generar imagen con Pollinations (API Abierta/Gratis)
      const encodedPrompt = encodeURIComponent(visualPrompt);
      // Usamos el modelo 'flux' en pollinations para mayor calidad, 'turbo' para velocidad
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;

      // 3. Descargar la imagen de la IA como Buffer
      const imageResponse = await axios.get<ArrayBuffer>(imageUrl, {
        responseType: 'arraybuffer',
      });
      const imageBuffer = Buffer.from(imageResponse.data);

      // 4. Guardar permanentemente usando tu StorageService actualizado
      const finalPublicUrl = await this.storageService.uploadBuffer(
        imageBuffer,
        'explanatory-image.png',
        'image/png',
      );

      return finalPublicUrl;
    } catch (error: unknown) {
      console.error('[AI-Image-Error]', error);
      throw new InternalServerErrorException(
        'Error generando o guardando la imagen explicativa',
      );
    }
  }

  private async generateVideoKeywords(text: string): Promise<string> {
    const completion = await this.aiClient.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'Extract 2 or 3 essential keywords in English for a stock video search. Output ONLY the keywords separated by spaces. Example: "laboratory safety chemicals"',
        },
        {
          role: 'user',
          content: `Topic: ${text.substring(0, 1000)}`,
        },
      ],
      temperature: 0.3,
    });
    return completion.choices[0].message.content || 'corporate training';
  }

  /**
   * ACTUALIZADA: Implementación con Pexels + Descarga Segura
   */
  async generateVideo(rawText: string): Promise<string | null> {
    console.log('--- [DEBUG VIDEO] Inicio del proceso ---');

    try {
      // 1. Keywords
      let keywords = await this.generateVideoKeywords(rawText);
      keywords = keywords.replace(/[".]/g, '').trim();
      console.log(`[DEBUG VIDEO] Keywords generadas: "${keywords}"`);

      // 2. Validación de API Key
      if (!process.env.PEXELS_API_KEY) {
        console.error(
          '[DEBUG VIDEO] ERROR: PEXELS_API_KEY no encontrada en .env',
        );
        return 'https://static.videezy.com/system/resources/previews/000/012/367/original/Pexels_Videos_3938.mp4';
      }

      // 3. Llamada a Pexels
      console.log('[DEBUG VIDEO] Llamando a API de Pexels...');
      const pexelsResponse = await axios.get(
        'https://api.pexels.com/videos/search',
        {
          params: {
            query: keywords,
            per_page: 1,
            orientation: 'landscape',
            size: 'medium',
          },
          headers: { Authorization: process.env.PEXELS_API_KEY },
        },
      );

      const videoData = pexelsResponse.data.videos?.[0];

      if (!videoData) {
        console.warn(
          '[DEBUG VIDEO] Pexels no encontró nada. Usando backup de seguridad.',
        );
        return 'https://static.videezy.com/system/resources/previews/000/012/367/original/Pexels_Videos_3938.mp4';
      }

      console.log(`[DEBUG VIDEO] Video encontrado ID: ${videoData.id}`);

      // 4. Selección de archivo
      const videoFile =
        videoData.video_files.find(
          (f: any) => f.file_type === 'video/mp4' && f.width < 1920,
        ) || videoData.video_files[0];

      if (!videoFile?.link) {
        console.error(
          '[DEBUG VIDEO] No se encontró un link válido en el objeto de Pexels',
        );
        throw new Error('Link de video no disponible');
      }

      // 5. Descarga del Buffer
      console.log('[DEBUG VIDEO] Descargando buffer del video...');
      const response = await axios.get(videoFile.link, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36',
        },
        timeout: 30000, // 30 segundos
      });

      console.log(
        `[DEBUG VIDEO] Buffer recibido. Tamaño: ${response.data.byteLength} bytes`,
      );

      // 6. Subida a Storage
      console.log('[DEBUG VIDEO] Subiendo a Supabase Storage...');
      const finalUrl = await this.storageService.uploadBuffer(
        Buffer.from(response.data),
        `video-${Date.now()}.mp4`,
        'video/mp4',
      );

      console.log(`[DEBUG VIDEO] ¡ÉXITO! URL Final: ${finalUrl}`);
      return finalUrl;
    } catch (error: any) {
      console.error('--- [DEBUG VIDEO] FALLO GLOBAL EN VIDEO ---');
      console.error('Mensaje:', error.message);
      if (error.response) {
        console.error('Data Error Pexels:', error.response.data);
        console.error('Status Error Pexels:', error.response.status);
      }

      // Retornamos el backup para que el campo videoUrl NO sea null y no rompa la base de datos
      return 'https://static.videezy.com/system/resources/previews/000/012/367/original/Pexels_Videos_3938.mp4';
    }
  }
  async generatePracticeLab(text: string): Promise<PracticeLab> {
    const completion = await this.aiClient.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Actúa como un experto en diseño instruccional para formación de empleados.
Tu objetivo es extraer el CONOCIMIENTO OPERATIVO del documento, no su estructura.

REGLA DE ORO: Pregúntate "¿Qué debe HACER o RECORDAR el empleado el primer día?"
Los draggables deben ser respuestas a esa pregunta, nunca títulos de sección.

JERARQUÍA DE EXTRACCIÓN (en orden de prioridad):
1. PROCEDIMIENTOS CRÍTICOS: pasos específicos, temperaturas, tiempos, proporciones
   Ejemplos válidos: "Autoclave 120°C / 20 min", "Lejía 1:10 · esperar 30 min"
2. UMBRALES Y LÍMITES: cifras que determinan qué hacer
   Ejemplos válidos: "Volumen > 100 mL → residuo especial", "Máx. 80% capacidad envase"
3. RESPONSABLES Y CONTACTOS: quién hace qué
   Ejemplos válidos: "Empresa CONSENUR (residuos sanitarios)", "Director de grupo: etiquetado"
4. PROHIBICIONES CLAVE: lo que NUNCA se debe hacer
   Ejemplos válidos: "Nunca disolventes por fregadera", "No almacenar > 150 cm altura"

Las dropZones deben ser los 3-4 PROCESOS PRINCIPALES del documento
(no subcategorías, sino fases o áreas de responsabilidad operativa).

REGLAS DE CALIDAD:
- Cada draggable debe ser autoexplicativo en ≤6 palabras
- Prioriza datos cuantitativos y verbos de acción
- Si el PDF tiene listas de procedimientos, cada paso es un draggable candidato
- Genera entre 8 y 10 draggables y 3-4 dropZones

FORMATO JSON ESTRICTO:
{
  "scenarioTitle": "Título técnico ≤40 caracteres",
  "instruction": "Instrucción de acción para el empleado",
  "draggables": [{"id": "proc_1", "nombre": "Autoclave 120°C / 20 min"}],
  "dropZones": [{"id": "bio_solido", "nombre": "Residuos Biológicos Sólidos"}],
  "validation": {"proc_1": "bio_solido"}
}

PROHIBIDO: IDs con la palabra "residuo", "zona", "item" o números solos.
PROHIBIDO: draggables que sean nombres de secciones o categorías genéricas.`,
        },
        {
          role: 'user',
          content: `Crea un laboratorio de práctica basado en este contenido: ${text.substring(0, 3000)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = completion.choices[0].message.content || '{}';

    try {
      return JSON.parse(content) as PracticeLab;
    } catch (e) {
      console.error('Error parseando Lab Practice:', e);
      // Retorno de seguridad por si falla
      return {
        scenarioTitle: 'Práctica de seguridad',
        instruction: 'Arrastra los elementos a su lugar correcto',
        backgroundImage: 'generic_workplace',
        draggables: [],
        dropZones: [],
      };
    }
  }
}
