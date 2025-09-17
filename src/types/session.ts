// src/types/session.ts
import { RefreshToken } from "../entities/RefreshToken";

export type IssuedSession = {
  raw: string;          // the raw refresh token string (secret)
  saved: RefreshToken;  // saved DB row
};

export type RotatedSession = {
  newRaw: string;
  savedNew: RefreshToken;
};
