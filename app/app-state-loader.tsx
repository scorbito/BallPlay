import { AppStateProvider } from "@/lib/state/AppState";
import { getCurrentProfileFromDb } from "@/lib/supabase/queries";

type Props = {
  isAnonymous: boolean;
  children: React.ReactNode;
};

/** AppState 초기 데이터를 서버에서 페치하는 컴포넌트.
 *  layout.tsx에서 Suspense로 감싸 사용 → 데이터 페치 중에도 초기 셸(initial-loader)이 즉시 노출됨. */
export async function AppStateLoader({ isAnonymous, children }: Props) {
  const profile = await getCurrentProfileFromDb().catch(() => null);

  return (
    <AppStateProvider
      initialProfile={profile}
      initialIsAnonymous={isAnonymous}
    >
      {children}
    </AppStateProvider>
  );
}
