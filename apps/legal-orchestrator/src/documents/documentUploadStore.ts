import type { DocumentRecord } from "./documentUploadService.js";

export interface DocumentUploadStore {
  save(record: DocumentRecord): void;
  getById(id: string): DocumentRecord | null;
  deleteById(id: string): boolean;
}

export class InMemoryDocumentUploadStore implements DocumentUploadStore {
  private readonly records = new Map<string, DocumentRecord>();

  save(record: DocumentRecord): void {
    this.records.set(record.id, record);
  }

  getById(id: string): DocumentRecord | null {
    return this.records.get(id) ?? null;
  }

  deleteById(id: string): boolean {
    return this.records.delete(id);
  }
}
