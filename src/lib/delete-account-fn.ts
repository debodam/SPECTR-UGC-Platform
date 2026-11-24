import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export const deleteAccount = createServerFn({ method: "POST" })
  .inputValidator((v: { token: string }) => v)
  .handler(async ({ data }): Promise<{ success?: boolean; error?: string }> => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return { error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server." };
    }

    // Verify the caller's token to get their user ID
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
    const userClient = createClient(supabaseUrl, anonKey);
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(data.token);

    if (authError || !user) {
      return { error: "Invalid or expired session." };
    }

    // Use the admin client to fully delete the auth user (cascades to all data)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await adminClient.auth.admin.deleteUser(user.id);

    if (error) return { error: error.message };
    return { success: true };
  });
