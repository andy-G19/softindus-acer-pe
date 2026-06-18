export const roles = {
  ADMIN: "ADMIN",
  SELLER: "SELLER",
  WORKSHOP_MASTER: "WORKSHOP_MASTER",
} as const;

export type Role = keyof typeof roles;