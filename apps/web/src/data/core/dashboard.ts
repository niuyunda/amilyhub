import { getDashboard } from "@/src/services/core-service";

export async function getDashboardOverview() {
  return getDashboard();
}
