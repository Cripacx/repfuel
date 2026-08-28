import type {
  AdminInviteDto,
  AdminSettingsDto,
  AdminUserDto,
  ApiErrorBody,
  BodyWeightDto,
  CreateExerciseRequest,
  CreateFoodRequest,
  CreateInviteRequest,
  CreateRoutineRequest,
  ExerciseDto,
  FoodDto,
  InstanceStatusDto,
  LastSetsResponse,
  ListExercisesQuery,
  ListWeightQuery,
  ListWorkoutsQuery,
  LoginOptionsRequest,
  MealDto,
  MeResponse,
  NutritionStatsResponse,
  PasswordLoginRequest,
  PasswordRegisterRequest,
  ProfileDto,
  RegisterOptionsRequest,
  RegistrationModeResponse,
  RoutineDto,
  SetDto,
  SetPasswordRequest,
  SyncBatchRequest,
  SyncBatchResponse,
  UpdateMeRequest,
  UpdateProfileRequest,
  UpdateRoutineRequest,
  UpdateSettingsRequest,
  UpdateUserRequest,
  UpsertMealRequest,
  UpsertSetRequest,
  UpsertWeightRequest,
  UpsertWorkoutRequest,
  WorkoutDto,
} from '@repfuel/shared';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';

const BASE_URL = '/api/v1';

/** Wird für jede nicht-2xx-Antwort der API geworfen; `code`/`message` kommen 1:1 vom Server. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.error;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).error === 'string' &&
    typeof (value as Record<string, unknown>).message === 'string'
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      credentials: 'same-origin',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch (cause) {
    // Netzwerkfehler (Server nicht erreichbar, offline, CORS, ...) — bewusst nicht als
    // ApiError modelliert, damit Aufrufer zwischen "Server hat abgelehnt" und
    // "Server nicht erreichbar" unterscheiden können.
    throw new TypeError('network request failed', { cause });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    const errorBody: ApiErrorBody = isApiErrorBody(body)
      ? body
      : { error: 'unknown_error', message: response.statusText || 'Unknown error' };
    throw new ApiError(response.status, errorBody);
  }

  return body as T;
}

function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

function put<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

function del(path: string): Promise<void> {
  return request<void>(path, { method: 'DELETE' });
}

/** Baut einen Query-String aus definierten Werten; `undefined`/`null` werden übersprungen. */
function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export interface RegisterOptionsResponse {
  flowId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
}

export interface LoginOptionsResponse {
  flowId: string;
  options: PublicKeyCredentialRequestOptionsJSON;
}

export interface RegisterVerifyBody {
  flowId: string;
  response: RegistrationResponseJSON;
}

export interface LoginVerifyBody {
  flowId: string;
  response: AuthenticationResponseJSON;
}

export const api = {
  // --- Auth ---
  getRegistrationMode: (): Promise<RegistrationModeResponse> => get('/auth/registration-mode'),
  getRegisterOptions: (body: RegisterOptionsRequest): Promise<RegisterOptionsResponse> =>
    post('/auth/register-options', body),
  postRegisterVerify: (body: RegisterVerifyBody): Promise<MeResponse> =>
    post('/auth/register', body),
  getLoginOptions: (body: LoginOptionsRequest): Promise<LoginOptionsResponse> =>
    post('/auth/login-options', body),
  postLoginVerify: (body: LoginVerifyBody): Promise<MeResponse> => post('/auth/login', body),
  registerWithPassword: (body: PasswordRegisterRequest): Promise<MeResponse> =>
    post('/auth/register-password', body),
  loginWithPassword: (body: PasswordLoginRequest): Promise<MeResponse> =>
    post('/auth/login-password', body),
  setPassword: (body: SetPasswordRequest): Promise<void> => post('/auth/password', body),
  logout: (): Promise<void> => post('/auth/logout'),
  getMe: (): Promise<MeResponse> => get('/auth/me'),
  updateMe: (body: UpdateMeRequest): Promise<MeResponse> => patch('/auth/me', body),

  // --- Admin ---
  admin: {
    getUsers: (): Promise<{ users: AdminUserDto[] }> => get('/admin/users'),
    updateUser: (id: string, body: UpdateUserRequest): Promise<{ user: AdminUserDto }> =>
      patch(`/admin/users/${id}`, body),
    deleteUser: (id: string): Promise<void> => del(`/admin/users/${id}`),
    getInvites: (): Promise<{ invites: AdminInviteDto[] }> => get('/admin/invites'),
    createInvite: (body: CreateInviteRequest): Promise<{ invite: AdminInviteDto }> =>
      post('/admin/invites', body),
    deleteInvite: (id: string): Promise<void> => del(`/admin/invites/${id}`),
    getSettings: (): Promise<{ settings: AdminSettingsDto }> => get('/admin/settings'),
    updateSettings: (body: UpdateSettingsRequest): Promise<{ settings: AdminSettingsDto }> =>
      patch('/admin/settings', body),
    getStatus: (): Promise<{ status: InstanceStatusDto }> => get('/admin/status'),
  },

  // --- Übungen ---
  exercises: {
    list: (params: Partial<ListExercisesQuery> = {}): Promise<{ exercises: ExerciseDto[] }> =>
      get(
        `/exercises${query({
          q: params.q,
          muscle: params.muscle,
          equipment: params.equipment,
          limit: params.limit,
          offset: params.offset,
        })}`,
      ),
    create: (body: CreateExerciseRequest): Promise<{ exercise: ExerciseDto }> =>
      post('/exercises', body),
  },

  // --- Routinen ---
  routines: {
    list: (): Promise<{ routines: RoutineDto[] }> => get('/routines'),
    create: (body: CreateRoutineRequest): Promise<{ routine: RoutineDto }> =>
      post('/routines', body),
    get: (id: string): Promise<{ routine: RoutineDto }> => get(`/routines/${id}`),
    update: (id: string, body: UpdateRoutineRequest): Promise<{ routine: RoutineDto }> =>
      patch(`/routines/${id}`, body),
    remove: (id: string): Promise<void> => del(`/routines/${id}`),
  },

  // --- Workouts & Sätze ---
  workouts: {
    list: (params: Partial<ListWorkoutsQuery> = {}): Promise<{ workouts: WorkoutDto[] }> =>
      get(`/workouts${query({ from: params.from, to: params.to, limit: params.limit })}`),
    lastSets: (exerciseIds: string[]): Promise<{ lastSets: LastSetsResponse }> =>
      exerciseIds.length === 0
        ? Promise.resolve({ lastSets: {} })
        : get(`/workouts/last-sets${query({ exerciseIds: exerciseIds.join(',') })}`),
    get: (id: string): Promise<{ workout: WorkoutDto }> => get(`/workouts/${id}`),
    upsert: (id: string, body: UpsertWorkoutRequest): Promise<{ workout: WorkoutDto }> =>
      put(`/workouts/${id}`, body),
    remove: (id: string): Promise<void> => del(`/workouts/${id}`),
    upsertSet: (
      workoutId: string,
      setId: string,
      body: UpsertSetRequest,
    ): Promise<{ set: SetDto }> => put(`/workouts/${workoutId}/sets/${setId}`, body),
    removeSet: (workoutId: string, setId: string): Promise<void> =>
      del(`/workouts/${workoutId}/sets/${setId}`),
  },

  // --- Gewicht ---
  weight: {
    list: (params: Partial<ListWeightQuery> = {}): Promise<{ entries: BodyWeightDto[] }> =>
      get(`/weight${query({ from: params.from, to: params.to, limit: params.limit })}`),
    upsert: (id: string, body: UpsertWeightRequest): Promise<{ entry: BodyWeightDto }> =>
      put(`/weight/${id}`, body),
    remove: (id: string): Promise<void> => del(`/weight/${id}`),
  },

  // --- Profil / Ziele ---
  profile: {
    get: (): Promise<{ profile: ProfileDto }> => get('/auth/profile'),
    update: (body: UpdateProfileRequest): Promise<{ profile: ProfileDto }> =>
      patch('/auth/profile', body),
  },

  // --- Lebensmittel ---
  foods: {
    search: (q: string, limit = 20): Promise<{ foods: FoodDto[] }> =>
      get(`/foods/search${query({ q, limit })}`),
    byBarcode: (code: string): Promise<{ food: FoodDto }> =>
      get(`/foods/barcode/${encodeURIComponent(code)}`),
    create: (body: CreateFoodRequest): Promise<{ food: FoodDto }> => post('/foods', body),
  },

  // --- Mahlzeiten ---
  meals: {
    list: (params: { from?: string; to?: string; limit?: number } = {}): Promise<{
      meals: MealDto[];
    }> => get(`/meals${query({ from: params.from, to: params.to, limit: params.limit })}`),
    upsert: (id: string, body: UpsertMealRequest): Promise<{ meal: MealDto }> =>
      put(`/meals/${id}`, body),
    remove: (id: string): Promise<void> => del(`/meals/${id}`),
  },

  // --- Offline-Sync ---
  sync: {
    batch: (body: SyncBatchRequest): Promise<SyncBatchResponse> => post('/sync/batch', body),
  },

  // --- Statistiken ---
  stats: {
    nutrition: (params: {
      from: string;
      to: string;
      tzOffsetMinutes: number;
    }): Promise<NutritionStatsResponse> =>
      get(
        `/stats/nutrition${query({ from: params.from, to: params.to, tzOffsetMinutes: params.tzOffsetMinutes })}`,
      ),
  },
};
