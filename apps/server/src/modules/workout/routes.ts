import type { FastifyInstance } from 'fastify';
import {
  createExerciseRequestSchema,
  createRoutineRequestSchema,
  lastSetsQuerySchema,
  listExercisesQuerySchema,
  listWorkoutsQuerySchema,
  updateRoutineRequestSchema,
  upsertSetRequestSchema,
  upsertWorkoutRequestSchema,
  uuidSchema,
} from '@repfuel/shared';
import { z } from 'zod';
import type { AuthGuards } from '../auth/index.js';
import type { ExerciseService } from './services/exercise-service.js';
import type { RoutineService } from './services/routine-service.js';
import type { WorkoutService } from './services/workout-service.js';

const idParams = z.object({ id: uuidSchema });
const setParams = z.object({ id: uuidSchema, setId: uuidSchema });

export interface WorkoutRoutesDeps {
  exerciseService: ExerciseService;
  routineService: RoutineService;
  workoutService: WorkoutService;
  guards: AuthGuards;
}

export function workoutRoutes(deps: WorkoutRoutesDeps) {
  const { exerciseService, routineService, workoutService, guards } = deps;

  return async function register(app: FastifyInstance) {
    app.addHook('preHandler', guards.requireAuth);
    const uid = (req: { sessionUser: { id: string } | null }) => req.sessionUser!.id;

    // --- Übungen ---
    app.get('/exercises/facets', async (req) => {
      return { facets: await exerciseService.facets(uid(req)) };
    });

    app.get('/exercises', async (req) => {
      const query = listExercisesQuerySchema.parse(req.query);
      return { exercises: await exerciseService.list(uid(req), query) };
    });

    app.post('/exercises', async (req) => {
      const body = createExerciseRequestSchema.parse(req.body);
      return { exercise: await exerciseService.createCustom(uid(req), body) };
    });

    // --- Routinen ---
    app.get('/routines', async (req) => ({ routines: await routineService.list(uid(req)) }));

    app.post('/routines', async (req) => {
      const body = createRoutineRequestSchema.parse(req.body);
      return { routine: await routineService.create(uid(req), body) };
    });

    app.get('/routines/:id', async (req) => {
      const { id } = idParams.parse(req.params);
      return { routine: await routineService.get(uid(req), id) };
    });

    app.patch('/routines/:id', async (req) => {
      const { id } = idParams.parse(req.params);
      const body = updateRoutineRequestSchema.parse(req.body);
      return { routine: await routineService.update(uid(req), id, body) };
    });

    app.delete('/routines/:id', async (req, reply) => {
      const { id } = idParams.parse(req.params);
      await routineService.remove(uid(req), id);
      return reply.code(204).send();
    });

    // --- Workouts & Sätze ---
    app.get('/workouts', async (req) => {
      const query = listWorkoutsQuerySchema.parse(req.query);
      return { workouts: await workoutService.list(uid(req), query) };
    });

    app.get('/workouts/last-sets', async (req) => {
      const { exerciseIds } = lastSetsQuerySchema.parse(req.query);
      return { lastSets: await workoutService.lastSets(uid(req), exerciseIds) };
    });
    app.get('/stats/strength', async (req) => {
      const query = z.object({ exerciseId: uuidSchema }).parse(req.query);
      return { stats: await workoutService.strengthStats(uid(req), query.exerciseId) };
    });


    app.get('/workouts/:id', async (req) => {
      const { id } = idParams.parse(req.params);
      return { workout: await workoutService.get(uid(req), id) };
    });

    app.put('/workouts/:id', async (req) => {
      const { id } = idParams.parse(req.params);
      const body = upsertWorkoutRequestSchema.parse(req.body);
      return { workout: await workoutService.upsert(uid(req), id, body) };
    });

    app.delete('/workouts/:id', async (req, reply) => {
      const { id } = idParams.parse(req.params);
      await workoutService.remove(uid(req), id);
      return reply.code(204).send();
    });

    app.put('/workouts/:id/sets/:setId', async (req) => {
      const { id, setId } = setParams.parse(req.params);
      const body = upsertSetRequestSchema.parse(req.body);
      return { set: await workoutService.upsertSet(uid(req), id, setId, body) };
    });

    app.delete('/workouts/:id/sets/:setId', async (req, reply) => {
      const { id, setId } = setParams.parse(req.params);
      await workoutService.removeSet(uid(req), id, setId);
      return reply.code(204).send();
    });
  };
}
