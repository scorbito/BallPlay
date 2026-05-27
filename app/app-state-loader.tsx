import { AppStateProvider } from "@/lib/state/AppState";
import { getCurrentProfileFromDb } from "@/lib/supabase/queries";

type Props = {
  isAnonymous: boolean;
  /** layout.tsx에서 이미 조회한 user.id — getCurrentProfileFromDb의 중복 auth 호출 제거용 */
  userId: string | null;
  children: React.ReactNode;
};

/** AppState 초기 데이터를 서버에서 페치하는 컴포넌트.
 *  layout.tsx에서 Suspense로 감싸 사용 → 데이터 페치 중에도 초기 셸(initial-loader)이 즉시 노출됨. */
export async function AppStateLoader({ isAnonymous, userId, children }: Props) {
  // userId 있으면 profile query만 (auth 왕복 1회 절감). 없으면(비로그인) 페치 자체 skip.
  const profile = userId ? await getCurrentProfileFromDb(userId).catch(() => null) : null;

  return (
    <AppStateProvider
      initialProfile={profile}
      initialIsAnonymous={isAnonymous}
    >
      {children}
    </AppStateProvider>
  );
}
