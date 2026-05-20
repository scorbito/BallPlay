import { AppShell } from "@/components/layout/AppShell";

const EFFECTIVE_DATE = "2026-05-08";

export function PrivacyScreen() {
  return (
    <AppShell activeTab="my" title="개인정보처리방침" theme="dark" backHref="/my/settings">
      <article className="legal-doc">
        <header>
          <h1>개인정보처리방침</h1>
          <p className="legal-effective">시행일: {EFFECTIVE_DATE}</p>
        </header>

        <section>
          <p>
            「야구놀이터」(이하 「서비스」)는 「개인정보 보호법」 등 관련 법령을 준수하며, 회원의 개인정보를 안전하게 처리하고 보호하기 위해 본 방침을 수립·공개합니다.
          </p>
        </section>

        <section>
          <h2>1. 수집하는 개인정보 항목</h2>
          <ul>
            <li><strong>필수 항목:</strong> 이메일 주소, 닉네임, 응원팀 정보</li>
            <li><strong>소셜 로그인:</strong> 카카오·Google 계정 식별자(고유 ID), 이메일</li>
            <li><strong>회원이 직접 등록하는 정보:</strong> 직관 기록(경기·결과·동행), 후기 본문, 직관 사진, 티켓 사진, 프로필 사진</li>
            <li><strong>자동 수집:</strong> 서비스 이용 기록, 접속 IP, 쿠키, 디바이스 정보</li>
            <li><strong>수집하지 않는 정보:</strong> 위치 정보, 연락처, 결제 정보(현재 미수집)</li>
          </ul>
        </section>

        <section>
          <h2>2. 개인정보의 수집 및 이용 목적</h2>
          <ul>
            <li>회원 가입 및 본인 확인, 계정 관리</li>
            <li>서비스 제공: 직관 기록 저장, 응원팀 승률 계산, 후기 게시·공유, 친구 관리</li>
            <li>티켓 사진 자동 인증을 위한 AI 분석(아래 3항 참고)</li>
            <li>공지사항·약관 변경 안내, 서비스 운영 관련 통지</li>
            <li>부정 이용 방지, 분쟁 해결, 법령상 의무 이행</li>
          </ul>
        </section>

        <section>
          <h2>3. 처리 위탁</h2>
          <p>서비스 제공을 위해 아래 업체에 일부 처리를 위탁합니다.</p>
          <ul>
            <li><strong>Supabase Inc.</strong> — 회원 인증, 데이터베이스, 사진 저장(Storage)</li>
            <li><strong>Google LLC (Gemini API)</strong> — 티켓 사진 자동 인증을 위한 이미지 분석. 분석 결과는 일시적으로만 처리되며 학습에 사용되지 않습니다.</li>
            <li><strong>KBO 공식 데이터 제공처</strong> — 경기 일정·결과 동기화 (개인정보는 전송하지 않음)</li>
            <li><strong>Vercel Inc.</strong> — 서비스 호스팅</li>
          </ul>
          <p>
            위탁 시 「개인정보 보호법」 제26조에 따라 개인정보가 안전하게 관리될 수 있도록 필요한 사항을 규정하고 감독합니다.
          </p>
        </section>

        <section>
          <h2>4. 보유 및 이용 기간</h2>
          <ul>
            <li>회원 탈퇴 시 모든 개인정보를 즉시 삭제합니다. 단, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.</li>
            <li>비로그인(익명) 회원의 데이터는 해당 디바이스에서 사용이 중단된 후 90일 경과 시 삭제될 수 있습니다.</li>
            <li>부정 이용 방지를 위한 기록: 6개월</li>
          </ul>
        </section>

        <section>
          <h2>5. 제3자 제공</h2>
          <p>
            서비스는 원칙적으로 회원의 개인정보를 외부에 제공하지 않습니다. 단, 다음의 경우는 예외로 합니다.
          </p>
          <ul>
            <li>회원이 사전 동의한 경우</li>
            <li>법령의 규정에 의하거나 수사기관의 적법한 절차에 따른 요구가 있는 경우</li>
          </ul>
        </section>

        <section>
          <h2>6. 회원의 권리</h2>
          <ul>
            <li>회원은 언제든지 본인의 개인정보를 조회·수정·삭제할 수 있습니다(마이 → 프로필 편집·설정).</li>
            <li>회원 탈퇴는 마이 → 설정 → 계정 삭제에서 직접 가능합니다.</li>
            <li>개인정보 관련 문의는 아래 담당자 연락처로 보내주세요.</li>
          </ul>
        </section>

        <section>
          <h2>7. 개인정보 보호 조치</h2>
          <ul>
            <li>비밀번호는 암호화하여 저장하며, 평문으로 보관하지 않습니다.</li>
            <li>전송 구간은 HTTPS 암호화 통신을 사용합니다.</li>
            <li>회원 데이터에 대한 접근은 최소한의 운영 인력으로 제한하며 접근 기록을 보관합니다.</li>
          </ul>
        </section>

        <section>
          <h2>8. 개인정보 보호책임자</h2>
          <ul>
            <li>이메일: daedanbiz@gmail.com</li>
            <li>문의: <a href="/my/contact">문의하기</a></li>
          </ul>
        </section>

        <section>
          <h2>9. 방침의 변경</h2>
          <p>
            본 방침이 변경되는 경우 변경 사항을 시행일 7일 전부터 서비스 내 공지사항에 게시합니다.
            중요한 변경의 경우 30일 전부터 공지합니다.
          </p>
        </section>

        <footer className="legal-footer">
          <p>
            본 개인정보처리방침 초안은 정식 출시 전 법률 자문 검토를 거쳐 확정될 예정입니다.
          </p>
        </footer>
      </article>
    </AppShell>
  );
}
