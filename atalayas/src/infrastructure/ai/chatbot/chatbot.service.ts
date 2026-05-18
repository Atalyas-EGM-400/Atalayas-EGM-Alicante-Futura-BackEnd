import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import OpenAI from 'openai';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

const MAX_PDF_CHARS = 6_000;
const MAX_PDFS = 5;

@Injectable()
export class ChatBotService {
  private readonly logger = new Logger(ChatBotService.name);
  private client: OpenAI;
  private model: string;

  constructor(private readonly prisma: PrismaService) {
    this.client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
    this.model = 'llama-3.3-70b-versatile';
  }

  async chat(userId: string, messages: ChatMessage[]) {
    // 1. Fetch de toda la data relevante en paralelo
    const [
      user,
      services,
      courses,
      documents,
      announcements,
      events,
      onboarding,
    ] = await Promise.all([
      this.fetchUser(userId),
      this.fetchServices(userId),
      this.fetchCourses(userId),
      this.fetchDocuments(userId),
      this.fetchAnnouncements(userId),
      this.fetchEvents(userId),
      this.fetchOnboardingProgress(userId),
    ]);

    const docsWithText = await this.extractPdfTexts(documents);

    const systemPrompt = this.buildSystemPrompt(
      user,
      services,
      courses,
      docsWithText,
      announcements,
      events,
      onboarding ?? [],
    );

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1024,
      temperature: 0.5,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    });

    return { reply: response.choices[0].message.content ?? '' };
  }

  // ── NUEVOS FETCHERS Y ACTUALIZADOS ──────────────────────────────────────────

  private async fetchUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { Company: true },
    });
  }

  private async fetchAnnouncements(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return this.prisma.announcement.findMany({
      where: {
        OR: [{ isPublic: true }, { companyId: user?.companyId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  private async fetchEvents(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return this.prisma.events.findMany({
      where: {
        OR: [{ companyId: user?.companyId }, { companyId: null }], // Eventos de empresa o generales
      },
      orderBy: { event_date: 'asc' },
      take: 5,
    });
  }

  private async fetchOnboardingProgress(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.companyId) return null;

    return this.prisma.onboardingStep.findMany({
      where: { companyId: user.companyId },
      include: {
        onboardingTasks: {
          include: {
            userProgress: { where: { userId } },
          },
        },
      },
      orderBy: { day: 'asc' },
    });
  }

  private async fetchServices(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return this.prisma.service.findMany({
      where: { OR: [{ isPublic: true }, { companyId: user?.companyId }] },
    });
  }

  private async fetchCourses(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });
    return this.prisma.course.findMany({
      where: { OR: [{ isPublic: true }, { companyId: user?.companyId }] },
      include: {
        Enrollment: { where: { userId } },
        Content: { select: { id: true, title: true } },
      },
    });
  }

  private async fetchDocuments(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return this.prisma.document.findMany({
      where: {
        OR: [{ isPublic: true }, { companyId: user?.companyId }, { userId }],
      },
      take: MAX_PDFS,
    });
  }

  private async extractPdfTexts(documents: any[]) {
    // ... (Tu lógica de pdf-parse-fork se mantiene igual)
    const pdfReader = require('pdf-parse-fork');
    const pdfs = documents.filter((d) =>
      d.fileUrl?.toLowerCase().endsWith('.pdf'),
    );
    const results = await Promise.allSettled(
      pdfs.map(async (doc) => {
        try {
          const res = await fetch(doc.fileUrl);
          const arrayBuffer = await res.arrayBuffer();
          const data = await pdfReader(Buffer.from(arrayBuffer));
          return {
            title: doc.title,
            text: data.text.replace(/\s+/g, ' ').trim().slice(0, MAX_PDF_CHARS),
          };
        } catch {
          return { title: doc.title, text: '[Error al leer PDF]' };
        }
      }),
    );
    return results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as any).value);
  }

  // ── SYSTEM PROMPT ACTUALIZADO ──────────────────────────────────────────────

  private buildSystemPrompt(
    user: any,
    services: any[],
    courses: any[],
    docs: any[],
    announcements: any[],
    events: any[],
    onboarding: any[] | null,
  ): string {
    const servicesText = services.length
      ? services.map((s) => `• SERVICIO: "${s.title}" `).join('\n')
      : 'No hay servicios disponibles.';

    const coursesText = courses.length
      ? courses
          .map((c) => {
            const lecciones =
              c.Content && c.Content.length > 0
                ? c.Content.map((cont: any) => `   - ${cont.title}`).join('\n')
                : '   - Sin lecciones detalladas.';
            return `• CURSO: "${c.title}"
            TEMARIO:
          ${lecciones}`;
          })
          .join('\n\n')
      : 'No hay cursos disponibles.';

    const announcementsText = announcements
      .map(
        (a) =>
          `• [${a.createdAt.toLocaleDateString()}] ${a.title}: ${a.content}`,
      )
      .join('\n');

    const eventsText = events
      .map(
        (e) =>
          `• ${e.title} - Fecha: ${e.event_date.toLocaleDateString()} - Ubicación: ${e.location ?? 'N/A'}`,
      )
      .join('\n');

    const onboardingText = onboarding?.length
      ? onboarding
          .map((step) => {
            const tasks = step.onboardingTasks
              .map((t) => `${t.userProgress[0]?.done ? '✅' : '❌'} ${t.label}`)
              .join(', ');
            return `Día ${step.day}: ${tasks}`;
          })
          .join('\n')
      : 'No hay plan de onboarding.';

    return `
Eres el asistente inteligente de Atalayas Ciudad Empresarial. Tu objetivo es ayudar al empleado basándote en su contexto actual.

════ USUARIO Y EMPRESA ════
Empleado: ${user.name} | Puesto: ${user.jobRole}
Empresa: ${user.Company?.name || 'N/A'}
Estado Onboarding: ${user.onboardingDone ? 'Completado' : 'En proceso'}

════ ONBOARDING (Tareas del empleado) ════
${onboardingText}

════ ÚLTIMOS ANUNCIOS ════
${announcementsText}

════ PRÓXIMOS EVENTOS ════
${eventsText}

════ SERVICIOS ════
${servicesText}

════ CURSOS DISPONIBLES ════
${coursesText}

════ DOCUMENTOS CORPORATIVOS ════
${docs.length ? docs.map((d) => `• ${d.title}`).join('\n') : 'No hay documentos adicionales.'}

════ REGLAS CRÍTICAS DE RESPUESTA (CUMPLIMIENTO OBLIGATORIO) ════
1. PRIVACIDAD: No reveles datos de otras empresas.
2. ENLACES: NUNCA escribas "[ID]".
3. Si el usuario pregunta por una lección específica, indícale que puede encontrarla dentro del [Nombre del Curso].
4. Si preguntan por tareas pendientes, consulta la sección de ONBOARDING.
5. Si te preguntan por algun curso o servicio específicamente, indica si es público de Atalayas EGM o si es privado de la empresa para la que trabaja.
6. Responde de forma amable, profesional y concisa en español.
`.trim();
  }
}
