import { appConfig, clientCredentials } from '../config';
import { ApiClient } from './http';

export type Graph = Record<string, Record<string, number>>;

export interface OptimalRouteRequest {
  accidentLocation: string;
  depots: string[];
  graph?: Graph;
}

export interface OptimalRouteResponse {
  fromDepot: string;
  to: string;
  path: string[];
  distance: number;
}

const client = new ApiClient(appConfig.routesApiUrl, clientCredentials);

export const routesApi = {
  baseUrl: appConfig.routesApiUrl,

  async defaultGraph(): Promise<{ nodes: string[]; graph: Graph }> {
    return (await client.get<{ nodes: string[]; graph: Graph }>('/v1/graph')).data;
  },

  async optimalRoute(request: OptimalRouteRequest): Promise<OptimalRouteResponse> {
    return (await client.post<OptimalRouteResponse>('/v1/routes/optimal', request)).data;
  },
};

export const PDF_ROUTE_EXAMPLE: Required<OptimalRouteRequest> = {
  accidentLocation: 'San Isidro',
  depots: ['Miraflores', 'Ate'],
  graph: {
    Miraflores: { 'San Isidro': 7, Barranco: 3 },
    'San Isidro': { Miraflores: 7, Lince: 4 },
    Barranco: { Miraflores: 3, Surco: 5 },
    Lince: { 'San Isidro': 4, Surco: 6 },
    Surco: { Barranco: 5, Lince: 6, Ate: 10 },
    Ate: { Surco: 10 },
  },
};
