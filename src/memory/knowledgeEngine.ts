import { findKnowledgeNotes, findEntityHistory } from '../db/db';

export interface KnowledgeNoteResult {
  question: string;
  answer: string;
  source: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  lastUpdated: string;
  evidenceExplanation: string;
}

export interface TimelineEvent {
  entitySignature: string;
  eventType: 'CREATED' | 'MODIFIED' | 'INCIDENT' | 'OWNERSHIP_CHANGE';
  timestamp: string;
  actor: string;
  description: string;
}

export function queryWhyCodeExists(entitySignature: string): KnowledgeNoteResult {
  const notes = findKnowledgeNotes(entitySignature) as any[];

  if (notes.length > 0) {
    const primary = notes[0];
    return {
      question: primary.question,
      answer: primary.answer,
      source: primary.source,
      confidence: primary.confidence as 'HIGH' | 'MEDIUM' | 'LOW',
      lastUpdated: primary.last_updated,
      evidenceExplanation: `Matched ingested institutional memory from ${primary.source} (Updated: ${primary.last_updated}).`
    };
  }

  return {
    question: 'Why was this code created?',
    answer: 'No explicit Jira ticket or postmortem note is attached to this entity.',
    source: 'HEURISTIC_ANALYSIS',
    confidence: 'LOW',
    lastUpdated: new Date().toISOString().split('T')[0],
    evidenceExplanation: `No knowledge note found for stable signature '${entitySignature}'.`
  };
}

export function getEntityTimeline(entitySignature: string): TimelineEvent[] {
  const events = findEntityHistory(entitySignature) as any[];
  return events.map(e => ({
    entitySignature: e.entity_signature,
    eventType: e.event_type,
    timestamp: e.timestamp,
    actor: e.actor,
    description: e.description
  }));
}
