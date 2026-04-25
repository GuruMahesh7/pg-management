import "express";
import type { AdminRole } from "../auth/admin-auth";

declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: number;
        email: string;
        role: AdminRole;
        createdAt: Date;
      };
    }
  }
}

export {};
