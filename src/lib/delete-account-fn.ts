import { createServerFn } from "@tanstack/react-start";
import { deleteAuthUser, userIdFor } from "./server-auth";

export const deleteAccount = createServerFn({ method: "POST" })
  .inputValidator((v: { token: string }) => v)
  .handler(async ({ data }): Promise<{ success?: boolean; error?: string }> => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return { error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server." };
    }
    // Verify the caller's token to get their user id, then delete that user (all their data cascades).
    const userId = await userIdFor(data.token);
    if (!userId) return { error: "Invalid or expired session." };
    const error = await deleteAuthUser(userId, serviceRoleKey);
    return error ? { error } : { success: true };
  });
