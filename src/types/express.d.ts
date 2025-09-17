// src/types/express.d.ts
declare global {
  namespace Express {
    export interface UserPayload {
      sub: string;                    // userId / superadminId
      email: string;
      role: string;                   // role name (e.g. 'admin', 'agent', 'superadmin')
      clientId?: string | null;       // client/tenant id for tenant users
      typ?: 'superadmin' | 'user' ;    // actor type (used in auth checks)
      perms?: string[];               // optional cached permissions (e.g. ['roles.create'])
      jti?: string;    
          
    }

    export interface Request {
      user?: UserPayload;
      clientId?: string | null;
      /**
       * Optional request-scoped actor helper used for audit population.
       * Set this in a middleware after authentication, e.g.:
       *   req.actor = { id: req.user?.sub ?? null, type: req.user?.typ ?? 'system' }
       */
      actor?: {
        id: string | null;
        type: 'user' | 'superadmin' | 'system' | string;
      };
    }
  }
}

export {};
