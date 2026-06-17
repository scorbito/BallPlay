import { HomeScreen } from "@/components/domain/HomeScreen";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/auth/userTier";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userTier = await getUserTier(supabase);
  const isAnonymous = Boolean(user?.is_anonymous);

  return (
    <HomeScreen
      user={user}
      isAnonymous={isAnonymous}
      isAdmin={userTier.tier === "admin"}
    />
  );
}
