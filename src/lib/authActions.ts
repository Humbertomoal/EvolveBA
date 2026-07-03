"use server";

import { signOut } from "@/src/auth";

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
