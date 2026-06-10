import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

interface CreateProfileInput {
  userId: string;
  email: string;
  name: string;
}

const getAdminClient = () =>
  createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

export const createProfileFn = createServerFn({ method: "POST" })
  .inputValidator((v: CreateProfileInput) => v)
  .handler(async ({ data }) => {
    const admin = getAdminClient();
    const { error } = await admin.from("profiles").upsert(
      { id: data.userId, email: data.email, full_name: data.name },
      { onConflict: "email" }
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
