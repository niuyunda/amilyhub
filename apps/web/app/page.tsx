import { redirect } from "next/navigation";

import { appConfig } from "@/src/config/app";
import { getCurrentOperatorSession } from "@/src/features/auth/session";

export default async function HomePage() {
  const session = await getCurrentOperatorSession();
  redirect(session ? appConfig.defaultProtectedPath : "/login");
}
