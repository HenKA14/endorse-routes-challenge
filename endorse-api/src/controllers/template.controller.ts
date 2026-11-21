import { TemplateService } from '../services/template.service';

export class TemplateController {
  constructor(private readonly templates: TemplateService) {}

  list = async () => this.templates.listActive();
}
