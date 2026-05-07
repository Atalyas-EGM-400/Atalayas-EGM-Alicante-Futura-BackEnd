import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import 'multer';

@Injectable()
export class StorageService {
  // Volvemos a poner el tipo, pero usando un truco con 'any' en los genéricos
  // que suele aplacar a ESLint cuando las librerías son complejas.
  // Si tu linter es EXTREMADAMENTE estricto, podría quejarse de los 'any' aquí,
  // pero es la forma estándar de tipar Supabase en NestJS.
  private supabase: SupabaseClient<any, 'public', any>;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Faltan credenciales de Supabase en el .env');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    try {
      const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;

      // Tipamos explícitamente lo que devuelve el upload
      const { data, error } = await this.supabase.storage
        .from('uploads')
        .upload(uniqueName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      // El error de Supabase suele venir tipado, pero por si acaso lo casteamos
      if (error) {
        const errorMsg = (error as Error).message || 'Error desconocido';
        throw new InternalServerErrorException(
          `Error de Supabase: ${errorMsg}`,
        );
      }

      if (!data) {
        throw new InternalServerErrorException(
          'No se recibieron datos al subir el archivo',
        );
      }

      // Tipamos explícitamente la respuesta del getPublicUrl
      const { data: publicUrlData } = this.supabase.storage
        .from('uploads')
        .getPublicUrl(data.path);

      return publicUrlData.publicUrl;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(
          `Fallo al subir archivo: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'Fallo desconocido al subir el archivo',
      );
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const urlParts = fileUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];

      if (!fileName) {
        throw new InternalServerErrorException('URL de archivo no válida');
      }
      const { error } = await this.supabase.storage
        .from('uploads')
        .remove([fileName]); // Supabase pide un array de nombres

      if (error) {
        const errorMsg = (error as Error).message || 'Error desconocido';
        throw new InternalServerErrorException(
          `Fallo al borrar de Supabase: ${errorMsg}`,
        );
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(
          `Fallo en el servicio de borrado: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'Fallo desconocido al borrar el archivo',
      );
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    originalName: string,
    mimetype: string,
  ): Promise<string> {
    try {
      // Creamos un nombre único para evitar colisiones en el bucket
      const fileExt = originalName.split('.').pop() || 'png';
      const uniqueName = `ai-generated/${Date.now()}-${uuidv4()}.${fileExt}`;

      // Reutilizamos la lógica con el bucket 'uploads'
      const { data, error } = await this.supabase.storage
        .from('uploads') // Asegúrate de que este bucket existe y es público
        .upload(uniqueName, buffer, {
          contentType: mimetype,
          upsert: false, // No sobreescritos, siempre nombres nuevos
        });

      if (error) {
        throw new InternalServerErrorException(
          `Supabase upload error: ${error.message}`,
        );
      }

      const { data: publicUrlData } = this.supabase.storage
        .from('uploads')
        .getPublicUrl(data.path);

      return publicUrlData.publicUrl;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(
        `Fallo al subir buffer generado: ${message}`,
      );
    }
  }
}
