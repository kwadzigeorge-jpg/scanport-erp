import client from './client';

export interface BoardEntry {
  scanner:      string;
  date:         string;
  shift:        string;
  status:       string;
  faultType:    string | null;
  faultNote:    string | null;
  updateRemark: string | null;
  scanCount:    number;
  preparedBy:   string | null;
  sessionId:    number;
}

export interface BoardState {
  date:        string;
  shift:       string;
  sessionId:   number;
  preparedBy:  string;
  board:       BoardEntry[];
}

export interface HistoryEntry {
  id:        string;
  date:      string;
  shift:     string;
  scanner:   string;
  changes:   { field: string; from: string | null; to: string | null }[];
  updatedBy: string;
  sessionId: number;
  createdAt: string;
}

export const getBoard = (date?: string, shift?: string) =>
  client.get<BoardState>('/scanner-board', { params: { date, shift } }).then(r => r.data);

export const updateScanner = (scanner: string, data: Partial<BoardEntry> & { date: string; shift: string }) =>
  client.patch<BoardEntry>(`/scanner-board/${scanner}`, data).then(r => r.data);

export const updateHeader = (date: string, shift: string, preparedBy: string) =>
  client.patch('/scanner-board/header/meta', { date, shift, preparedBy }).then(r => r.data);

export const getHistory = (date?: string, shift?: string, all?: boolean) =>
  client.get<HistoryEntry[]>('/scanner-board/history', { params: { date, shift, all } }).then(r => r.data);

export const clearHistory = (date: string, shift: string) =>
  client.delete('/scanner-board/history', { data: { date, shift } }).then(r => r.data);
