import { Request, ResponseToolkit } from '@hapi/hapi';
import { TranslateRequestDto } from '../entities/translate-request.entity';
import { EndorseTranslatorService } from '../services/endorse-translator.service';

export class EndorseController {
  constructor(private readonly translator: EndorseTranslatorService) {}

  translate = async (request: Request, h: ResponseToolkit) => {
    const result = await this.translator.translate(request.payload as TranslateRequestDto);
    return h
      .response(result.payload)
      .code(200)
      .header('X-Template-Id', String(result.templateId))
      .header('X-Template-Version', String(result.templateVersion));
  };
}
