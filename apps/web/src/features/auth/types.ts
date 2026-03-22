export type OperatorRole = "super_admin";

export interface OperatorUser {
  username: string;
  displayName: string;
  role: OperatorRole;
  roleLabel: string;
}
