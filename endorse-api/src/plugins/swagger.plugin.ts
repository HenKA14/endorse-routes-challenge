import Inert from '@hapi/inert';
import Vision from '@hapi/vision';
import { Server } from '@hapi/hapi';
import HapiSwagger from 'hapi-swagger';

export const registerSwagger = async (server: Server): Promise<void> => {
  const options: HapiSwagger.RegisterOptions = {
    info: { title: 'Endorse Translator API', version: '1.0.0', description: 'Traductor de endosos al formato del core' },
    documentationPath: '/documentation',
    grouping: 'tags',
    securityDefinitions: {
      jwt: { type: 'apiKey', name: 'Authorization', in: 'header', description: 'Bearer <token>' },
    },
    security: [{ jwt: [] }],
  };

  await server.register([Inert, Vision, { plugin: HapiSwagger, options }]);
};
