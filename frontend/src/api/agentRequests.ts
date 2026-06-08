import client from './client';
import type {
  AgentRequest,
  AgentRequestListResponse,
  AgentRequestStats,
} from '../types';

export interface AgentRequestFilters {
  status?:          string;
  requestType?:     string;
  containerNumber?: string;
  search?:          string;
  page?:            number;
  limit?:           number;
}

export const listAgentRequests = (filters: AgentRequestFilters = {}) =>
  client.get<AgentRequestListResponse>('/agent-requests', { params: filters }).then((r) => r.data);

export const getAgentRequest = (id: string) =>
  client.get<AgentRequest>(`/agent-requests/${id}`).then((r) => r.data);

export const getAgentRequestStats = () =>
  client.get<AgentRequestStats>('/agent-requests/stats').then((r) => r.data);

export interface CreateAgentRequestPayload {
  requestType:      string;
  containerNumber:  string;
  containerSize:    string;
  sealNumber?:      string;
  bayZone?:         string;
  bayNumber?:       string;
  gangAssigned?:    string;
  agencyName?:      string;
  agentName?:       string;
  agentPhone?:      string;
  itemDescription?: string;
  completionTime?:  string;
  notes?:           string;
}

export const createAgentRequest = (data: CreateAgentRequestPayload) =>
  client.post<AgentRequest>('/agent-requests', data).then((r) => r.data);

export const updateAgentRequest = (id: string, data: { status?: string; notes?: string }) =>
  client.patch<AgentRequest>(`/agent-requests/${id}`, data).then((r) => r.data);
