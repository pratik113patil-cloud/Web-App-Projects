/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Shared types for the Smart Study Planner.
 * Group 7 Project - Engineering Study Optimization System.
 */

export type TaskStatus = 'pending' | 'completed' | 'in-progress' | 'overdue';

export interface StudyTask {
  id: string;
  title: string;
  subject: string;
  weightage: number; // 1-10 (Syllabus importance)
  deadline: string; // ISO date string
  confidence: number; // 1-10 (1 = low, 10 = expert)
  estimatedMinutes: number;
  status: TaskStatus;
  completedAt?: string;
  category: 'Theory' | 'Lab' | 'Project' | 'Revision';
  scheduledChunks: ScheduledChunk[];
}

export interface ScheduledChunk {
  id: string;
  taskId: string;
  startTime: string; // ISO date string
  endTime: string; // ISO date string
  taskTitle: string;
}

export interface ProtectedBlock {
  id: string;
  label: string;
  dayOfWeek?: number; // 0-6, if undefined it's a daily block
  startHour: number; // 0-23
  startMinute: number;
  endHour: number; // 0-23
  endMinute: number;
  color?: string;
}

export interface ResourceLink {
  id: string;
  title: string;
  url: string;
  category: string;
  type: 'pdf' | 'repo' | 'video' | 'article' | 'other';
  addedAt: string;
}

export interface Flashcard {
  id: string;
  deck_name: string;
  question: string;
  answer_markdown: string;
  deck_status: 'New' | 'Easy' | 'Hard';
}

export interface UserStats {
  studyStreak: number;
  totalHoursStudied: number;
  tasksCompleted: number;
  consistencyScore: number; // Calculated percent
}
