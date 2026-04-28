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

import { addMinutes, format, isAfter, isBefore, parseISO, setHours, setMinutes, startOfDay, addDays, differenceInDays } from 'date-fns';
import { StudyTask, ProtectedBlock, ScheduledChunk } from '../types';

/**
 * Calculates the Priority Score for an engineering task.
 * Deadline proximity is the dominant factor here.
 */
export function calculatePriorityScore(task: StudyTask, nowAtStartOfDay: Date): number {
  const deadline = parseISO(task.deadline);
  const diffDays = Math.max(differenceInDays(deadline, nowAtStartOfDay), 1);
  
  // Weights (High value = more urgent/important)
  const wDeadline = 100.0; // Urgency multiplier
  const wWeightage = 2.0;  // Academic Importance
  const wConfidence = 1.5; // Study Need (inverse confidence)

  // Formula prioritization logic
  const score = (wDeadline / diffDays) + 
                (task.weightage * wWeightage) + 
                ((11 - task.confidence) * wConfidence);
                
  return parseFloat(score.toFixed(2));
}

/**
 * AI Optimization Engine (Multi-Day Bin Packing)
 * 
 * This function iterates through all pending tasks and assigns them
 * to the earliest possible days while respecting:
 * 1. A daily 5-hour study cap.
 * 2. Academic college hours (10 AM - 5 PM).
 * 3. Priority ranking (Urgent tasks first).
 */
export function generateSchedule(
  tasks: StudyTask[],
  protectedBlocks: ProtectedBlock[],
  startDate: Date
): ScheduledChunk[] {
  const dailyLimitMin = 300; // 5 Hours cap
  const start = startOfDay(startDate);
  
  // Sort tasks by priority (Urgency is highest priority)
  const prioritized = tasks
    .filter(t => t.status !== 'completed')
    .sort((a, b) => calculatePriorityScore(b, start) - calculatePriorityScore(a, start));

  const chunks: ScheduledChunk[] = [];
  const dailyLoadMap: { [date: string]: number } = {};

  for (const task of prioritized) {
    let currentDay = start;
    let isScheduled = false;
    const deadline = parseISO(task.deadline);
    const duration = task.estimatedMinutes;

    // We scan up to 21 days out to find a slot
    for (let dayOffset = 0; dayOffset < 21; dayOffset++) {
      // Force fit logic: If we are on or past the deadline day, we MUST schedule it
      const targetDate = isAfter(currentDay, deadline) ? deadline : currentDay;
      const dateKey = format(targetDate, 'yyyy-MM-dd');
      const dayLoad = dailyLoadMap[dateKey] || 0;

      // 1. Check Daily 5-hour Capacity
      if (dayLoad + duration <= dailyLimitMin) {
        // 2. Find a specific time window on this day
        const slot = findAvailableTimeOnDay(targetDate, duration, protectedBlocks, chunks);
        
        if (slot) {
          chunks.push({
            id: Math.random().toString(36).substr(2, 9),
            taskId: task.id,
            startTime: slot.start.toISOString(),
            endTime: slot.end.toISOString(),
            taskTitle: task.title
          });
          dailyLoadMap[dateKey] = dayLoad + duration;
          isScheduled = true;
          break;
        }
      }

      // Move to next day search
      currentDay = addDays(currentDay, 1);
    }
  }

  return chunks;
}

/**
 * Searches a single calendar day for a viable time block.
 * Respects college hours and user-defined protected blocks.
 */
function findAvailableTimeOnDay(
  day: Date,
  duration: number,
  protectedBlocks: ProtectedBlock[],
  existing: ScheduledChunk[]
): { start: Date; end: Date } | null {
  const dayOfWeek = day.getDay(); // 0 is Sun, 6 is Sat
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  
  // Search window: 07:00 AM to 11:30 PM
  let pointer = setMinutes(setHours(startOfDay(day), 7), 0);
  const cutoff = setMinutes(setHours(startOfDay(day), 23), 30);

  while (isBefore(addMinutes(pointer, duration), cutoff)) {
    const start = pointer;
    const end = addMinutes(pointer, duration);
    
    // Time checks in minutes from midnight
    const sMins = start.getHours() * 60 + start.getMinutes();
    const eMins = end.getHours() * 60 + end.getMinutes();

    let isBlocked = false;

    // Check College Hours Block (10:00 - 17:00 Mon-Fri)
    if (isWeekday) {
      const collegeOpen = 10 * 60;
      const collegeClose = 17 * 60;
      if (sMins < collegeClose && collegeOpen < eMins) isBlocked = true;
    }

    // Check User Protected Blocks
    if (!isBlocked) {
      for (const block of protectedBlocks) {
        const bS = block.startHour * 60 + block.startMinute;
        const bE = block.endHour * 60 + block.endMinute;
        if (sMins < bE && bS < eMins) {
          isBlocked = true;
          break;
        }
      }
    }

    // Check Session Collisions
    if (!isBlocked) {
      for (const c of existing) {
        const cS = parseISO(c.startTime);
        const cE = parseISO(c.endTime);
        // Only compare chunks on the same calendar day
        if (isSameDay(start, cS)) {
          if (start < cE && cS < end) {
            isBlocked = true;
            break;
          }
        }
      }
    }

    if (!isBlocked) return { start, end };

    // Slide search pointer by 15 mins
    pointer = addMinutes(pointer, 15);
  }

  return null;
}

/**
 * Simple helper to check if two dates are on the same calendar day.
 */
function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

