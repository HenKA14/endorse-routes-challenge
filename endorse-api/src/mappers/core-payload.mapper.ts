import { CoreEndorsementDto } from '../entities/core-endorsement.entity';
import { setByPath } from '../utils/object-path';

export interface ResolvedField {
  targetPath: string;
  value: unknown;
}

/**
 * Construye el JSON del core a partir de pares (ruta destino, valor) ya
 * resueltos. El orden de la lista es el orden de las claves en la salida.
 */
export class CorePayloadMapper {
  build(fields: ResolvedField[]): CoreEndorsementDto {
    const payload: CoreEndorsementDto = {};
    for (const { targetPath, value } of fields) {
      setByPath(payload, targetPath, value);
    }
    return payload;
  }
}
