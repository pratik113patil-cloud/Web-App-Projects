/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Group 7 - Smart Scheduling Algorithm v1.2
 * 
 * This engine handles:
 * 1. Task Prioritization (Importance / Time Remaining / Confidence)
 * 2. Gap Filling (Avoiding protected blocks)
 * 3. Dynamic Rescheduling (Managing overtime)
 */

import { addMinutes, format, isAfter, isBefore, parseISO, setHours, setMinutes, startOfDay, addDays, differenceInMinutes, isWithinInterval } from 'date-fns';
import { StudyTask, ProtectedBlock, ScheduledChunk } from '../types';

/**
 * Calculates a Priority Score for an engineering task.
 * Higher score = Higher ranking in the study queue.
 * 
 * Heuristics:
 * 1. Deadline Proximity: Massive multiplier for immediate deadlines.
 * 2. Academic Importance: High weightage subjects prioritized.
 * 3. Confidence Deficit: Low confidence areas (1-3) flagged for more attention.
 */
export function calculatePriorityScore(task: StudyTask, now: Date): number {
  const deadline = parseISO(task.deadline);
  const diffDays = Math.max(0.1, differenceInMinutes(deadline, now) / (24 * 60));
  
  // Weights for the algorithm
  const wWeightage = 2.0;       // Importance factor
  const wConfidence = 1.5;      // Study need factor
  const wDeadline = 15.0;       // Urgency factor
  
  // (Weightage * multiplier) + (Inverse Confidence) + (Urgency factor / Days Remaining)
  const score = (task.weightage * wWeightage) + 
                ((11 - task.confidence) * wConfidence) + 
                (wDeadline / diffDays);
                
  return parseFloat(score.toFixed(2));
}

/**
 * AI Optimization Engine (Constraint Satisfaction)
 * 
 * Strict Physical Constraints:
 * 1. College Block: 10:00 AM - 05:00 PM (Monday through Friday)
 * 2. Daily Fatigue Cap: Max 5 hours of total study per day
 * 3. Weekly Dynamic: Weekends have zero predefined blocks (Full availability)
 * 4. Temporal Integrity: No sessions starting after 11:30 PM
 */
export function generateSchedule(
  tasks: StudyTask[],
  protectedBlocks: ProtectedBlock[],
  startDate: Date
): ScheduledChunk[] {
  const dailyStudyLimitMinutes = 300; // 5 Hours cap as per engineering constraints
  
  // Sort tasks by AI Priority Score
  const activeTasks = tasks
    .filter(t => t.status !== 'completed')
    .sort((a, b) => calculatePriorityScore(b, startDate) - calculatePriorityScore(a, startDate));

  const chunks: ScheduledChunk[] = [];
  let currentPointer = startDate;
  
  // Study planning horizon (Next 14 days)
  const horizon = addDays(startDate, 14);

  // Tracks total scheduled minutes per day to enforce 5h cap
  const dailyMinutesMap: { [date: string]: number } = {};

  for (const task of activeTasks) {
    let remainingMinutes = task.estimatedMinutes;
    // Segment logic: No session should exceed 90 mins to maintain focus
    const maxChunkSize = 90;

    while (remainingMinutes > 0 && isBefore(currentPointer, horizon)) {
      const duration = Math.min(remainingMinutes, maxChunkSize);
      
      const slot = findNextAvailableSlot(
        currentPointer, 
        duration, 
        protectedBlocks, 
        chunks,
        dailyMinutesMap,
        dailyStudyLimitMinutes,
        horizon
      );

      if (slot) {
        chunks.push({
          id: `${task.id}-${chunks.length}`,
          taskId: task.id,
          startTime: slot.start.toISOString(),
          endTime: slot.end.toISOString(),
          taskTitle: task.title
        });

        // Update daily minute counters
        const dateKey = format(slot.start, 'yyyy-MM-dd');
        dailyMinutesMap[dateKey] = (dailyMinutesMap[dateKey] || 0) + duration;
        
        remainingMinutes -= duration;
        currentPointer = slot.end;
      } else {
        // Critical alert would trigger here if a high-priority task can't be scheduled
        break;
      }
    }
  }

  return chunks;
}

/**
 * Checks if a specific time interval is physically viable
 */
function isSlotAvailable(
  start: Date,
  end: Date,
  protectedBlocks: ProtectedBlock[],
  existingChunks: ScheduledChunk[]
): boolean {
  const day = start.getDay(); // 0 is Sunday, 1-5 is Mon-Fri
  const startHour = start.getHours();
  const startMinute = start.getMinutes();
  const startTotal = startHour * 60 + startMinute;
  
  const endHour = end.getHours();
  const endMinute = end.getMinutes();
  const endTotal = endHour * 60 + endMinute;

  // 1. College Hours Constraint: 10:00 - 17:00 (Mon-Fri)
  if (day >= 1 && day <= 5) {
    const collegeStart = 10 * 60; // 10:00 AM
    const collegeEnd = 17 * 60;   // 05:00 PM
    if (startTotal < collegeEnd && collegeStart < endTotal) {
      return false;
    }
  }

  // 2. Standard Maintenance Blocks (Daily sleep/rest)
  for (const block of protectedBlocks) {
    const bStart = block.startHour * 60 + block.startMinute;
    const bEnd = block.endHour * 60 + block.endMinute;
    if (startTotal < bEnd && bStart < endTotal) return false;
  }

  // 3. Collision Detection with existing Academic sessions
  for (const chunk of existingChunks) {
    const cStart = parseISO(chunk.startTime);
    const cEnd = parseISO(chunk.endTime);
    if (start < cEnd && cStart < end) return false;
  }

  return true;
}

/**
 * Advanced Search Engine for the next valid temporal window
 */
function findNextAvailableSlot(
  startPoint: Date,
  durationMinutes: number,
  protectedBlocks: ProtectedBlock[],
  existingChunks: ScheduledChunk[],
  dailyMinutesMap: { [date: string]: number },
  dailyLimit: number,
  horizon: Date
): { start: Date; end: Date } | null {
  let searchPointer = startPoint;

  while (isBefore(searchPointer, horizon)) {
    const h = searchPointer.getHours();
    
    // Day scheduling boundaries (07:00 AM to 11:59 PM)
    if (h < 7) {
      searchPointer = setMinutes(setHours(searchPointer, 7), 0);
      continue;
    }
    if (h >= 23 && searchPointer.getMinutes() > 30) {
      searchPointer = addDays(startOfDay(searchPointer), 1);
      searchPointer = setHours(searchPointer, 7);
      continue;
    }

    const dateKey = format(searchPointer, 'yyyy-MM-dd');
    const currentDayMinutes = dailyMinutesMap[dateKey] || 0;

    // Check Daily Cap (5 hours)
    if (currentDayMinutes + durationMinutes > dailyLimit) {
      searchPointer = addDays(startOfDay(searchPointer), 1);
      searchPointer = setHours(searchPointer, 7);
      continue;
    }

    const end = addMinutes(searchPointer, durationMinutes);
    
    // Safety check: ensure session completes within the same calendar day
    if (end.getHours() >= 24 || end.getDay() !== searchPointer.getDay()) {
      searchPointer = addDays(startOfDay(searchPointer), 1);
      searchPointer = setHours(searchPointer, 7);
      continue;
    }

    if (isSlotAvailable(searchPointer, end, protectedBlocks, existingChunks)) {
      return { start: searchPointer, end };
    }

    // Iterative search increment (15-minute granularity)
    searchPointer = addMinutes(searchPointer, 15);
  }

  return null;
}
