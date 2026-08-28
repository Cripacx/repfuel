/** Öffentliche Schnittstelle des Workout-Moduls. */
import type { FastifyInstance } from 'fastify';
import type { Database } from '../../core/db.js';
import type { EventBus } from '../../core/event-bus.js';
import type { AuthGuards } from '../auth/index.js';
import { createExerciseRepo } from './repositories/exercise-repo.js';
import { createRoutineRepo } from './repositories/routine-repo.js';
import { createWorkoutRepo } from './repositories/workout-repo.js';
import { workoutRoutes } from './routes.js';
import { seedExercises } from './seed/seed-exercises.js';
import { createExerciseService, type ExerciseService } from './services/exercise-service.js';
import { createRoutineService, type RoutineService } from './services/routine-service.js';
import { createWorkoutService, type WorkoutService } from './services/workout-service.js';

export type { ExerciseService } from './services/exercise-service.js';
export type { RoutineService } from './services/routine-service.js';
export type { WorkoutService } from './services/workout-service.js';

export interface WorkoutModuleOptions {
  db: Database;
  eventBus: EventBus;
  guards: AuthGuards;
}

export interface WorkoutModuleApi {
  exerciseService: ExerciseService;
  workoutService: WorkoutService;
  routineService: RoutineService;
  /** Idempotenter Seed der Übungsbibliothek (beim App-Start aufrufen). */
  seedExercises: () => Promise<number>;
}

export async function registerWorkoutModule(
  app: FastifyInstance,
  opts: WorkoutModuleOptions,
): Promise<WorkoutModuleApi> {
  const exerciseRepo = createExerciseRepo(opts.db);
  const routineRepo = createRoutineRepo(opts.db);
  const workoutRepo = createWorkoutRepo(opts.db);

  const exerciseService = createExerciseService(exerciseRepo);
  const routineService = createRoutineService({ routineRepo, exerciseRepo, exerciseService });
  const workoutService = createWorkoutService({
    workoutRepo,
    routineRepo,
    exerciseService,
    eventBus: opts.eventBus,
  });

  await app.register(
    workoutRoutes({ exerciseService, routineService, workoutService, guards: opts.guards }),
    { prefix: '/api/v1' },
  );

  return { exerciseService, workoutService, routineService, seedExercises: () => seedExercises(opts.db) };
}
