# ViewPilot 개인정보 처리방침

> [English](privacy-policy.md) | [**한국어**](privacy-policy-ko.md) | [日本語](privacy-policy-ja.md) | [中文](privacy-policy-zh.md) | [Español](privacy-policy-es.md)

**최종 업데이트: 2026년 3월 21일**

## 개요

ViewPilot은 웹 페이지 콘텐츠를 GitHub Copilot과 상호작용할 수 있게 해주는 브라우저 확장 프로그램입니다. 본 개인정보 처리방침은 어떤 데이터가 처리되며 어떻게 사용되는지 설명합니다.

**ViewPilot은 GitHub 또는 Microsoft의 공식 제품이 아닙니다.** 이 확장 프로그램을 사용하려면 유효한 GitHub Copilot 구독이 필요합니다.

## 수집하는 데이터

**개발자는 어떠한 데이터도 수집하지 않습니다.** ViewPilot은 개발자가 운영하는 서버가 없으며, 개발자에게 어떠한 정보도 전송하지 않습니다.

## 로컬에 저장되는 데이터

다음 데이터는 `chrome.storage.local`을 사용하여 사용자의 기기에만 저장됩니다:

- **GitHub OAuth 토큰**: GitHub Copilot API 인증에 사용됩니다. 브라우저의 로컬 저장소에만 저장되며, 제3자에게 전송되지 않습니다.
- **채팅 기록**: 대화 기록은 브라우저의 로컬 저장소에만 저장됩니다.
- **사용자 설정**: 선택한 AI 모델, 언어, 글꼴 크기, 웹 검색 설정 등.
- **웹 검색 API 키** (선택): Brave 또는 Serper API 키를 제공한 경우, 로컬에 저장되며 해당 서비스에만 전송됩니다.

## 외부 서비스로 전송되는 데이터

- **GitHub Copilot API** (`api.githubcopilot.com`): 메시지를 보낼 때, 프롬프트와 페이지 컨텍스트가 AI 처리를 위해 GitHub Copilot API로 전송됩니다.
- **웹 검색** (활성화 시): 설정에 따라 다음 서비스 중 하나로 검색 쿼리가 전송됩니다:
  - **DuckDuckGo** (기본, API 키 불필요)
  - **Brave Search** (선택, API 키 필요)
  - **Serper / Google** (선택, API 키 필요)

  검색 쿼리 텍스트만 전송되며, 개인정보, 브라우징 기록, 페이지 콘텐츠는 검색 서비스에 전송되지 않습니다.

GitHub Copilot API와의 모든 통신은 GitHub의 자체 개인정보 보호정책의 적용을 받습니다. 자세한 내용은 [GitHub 개인정보 처리방침](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement)을 참조하세요.

## 제3자 서비스

ViewPilot은 다음과 통신합니다:
- **GitHub Copilot API** — AI 채팅 기능
- **DuckDuckGo / Brave / Serper** — 선택적 웹 검색 (사용자가 명시적으로 활성화한 경우에만)

분석, 추적 또는 광고 서비스와 통합하지 않습니다.

## 사용자 제어

- 확장 프로그램을 통해 언제든지 채팅 기록 및 저장된 데이터를 삭제할 수 있습니다.
- GitHub 계정 설정에서 GitHub OAuth 토큰을 폐기할 수 있습니다.
- 확장 프로그램을 제거하면 로컬에 저장된 모든 데이터가 삭제됩니다.

## 정책 변경

본 개인정보 처리방침은 수시로 업데이트될 수 있습니다. 변경 사항은 이 페이지에 업데이트된 날짜와 함께 게시됩니다.

## 문의

본 개인정보 처리방침에 대한 질문이나 우려 사항이 있으시면 [GitHub 저장소](https://github.com/bymebyu/ViewPilot/issues)에 이슈를 등록해 주세요.

---

*ViewPilot은 Gil Chang Lee (bymebyu)가 개발했습니다.*
