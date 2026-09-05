import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      id?: string;
      user?: User;
    }
  }
}

export {};
