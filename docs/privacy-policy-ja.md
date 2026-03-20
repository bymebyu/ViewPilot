# ViewPilot プライバシーポリシー

> [English](privacy-policy.md) | [한국어](privacy-policy-ko.md) | [**日本語**](privacy-policy-ja.md) | [中文](privacy-policy-zh.md) | [Español](privacy-policy-es.md)

**最終更新日: 2026年3月21日**

## 概要

ViewPilotは、ウェブページのコンテンツをGitHub Copilotと連携できるブラウザ拡張機能です。このプライバシーポリシーでは、どのようなデータが処理され、どのように使用されるかを説明します。

**ViewPilotはGitHubまたはMicrosoftの公式製品ではありません。** この拡張機能を使用するには、有効なGitHub Copilotサブスクリプションが必要です。

## 収集するデータ

**開発者はいかなるデータも収集しません。** ViewPilotには開発者が運営するサーバーがなく、開発者にいかなる情報も送信しません。

## ローカルに保存されるデータ

以下のデータは、`chrome.storage.local`を使用してユーザーのデバイスにのみ保存されます：

- **GitHub OAuthトークン**: GitHub Copilot APIの認証に使用されます。ブラウザのローカルストレージにのみ保存され、第三者に送信されることはありません。
- **チャット履歴**: 会話履歴はブラウザのローカルストレージにのみ保存されます。
- **ユーザー設定**: 選択したAIモデル、言語、フォントサイズ、ウェブ検索設定など。
- **ウェブ検索APIキー**（オプション）: BraveまたはSerper APIキーを提供した場合、ローカルに保存され、該当サービスにのみ送信されます。

## 外部サービスへ送信されるデータ

- **GitHub Copilot API** (`api.githubcopilot.com`): メッセージを送信する際、プロンプトとページコンテキストがAI処理のためにGitHub Copilot APIに送信されます。
- **ウェブ検索**（有効化時）: 設定に応じて以下のサービスのいずれかに検索クエリが送信されます：
  - **DuckDuckGo**（デフォルト、APIキー不要）
  - **Brave Search**（オプション、APIキー必要）
  - **Serper / Google**（オプション、APIキー必要）

  検索クエリテキストのみが送信されます。個人情報、閲覧履歴、ページコンテンツは検索プロバイダーに送信されません。

GitHub Copilot APIとのすべての通信はGitHub独自のプライバシーポリシーに従います。詳細は[GitHubプライバシーステートメント](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement)をご確認ください。

## サードパーティサービス

ViewPilotは以下と通信します：
- **GitHub Copilot API** — AIチャット機能
- **DuckDuckGo / Brave / Serper** — オプションのウェブ検索（ユーザーが明示的に有効化した場合のみ）

分析、トラッキング、広告サービスとは統合していません。

## ユーザーのコントロール

- 拡張機能を通じていつでもチャット履歴と保存データを削除できます。
- GitHubアカウント設定でGitHub OAuthトークンを取り消すことができます。
- 拡張機能をアンインストールすると、ローカルに保存されたすべてのデータが削除されます。

## ポリシーの変更

このプライバシーポリシーは随時更新される場合があります。変更はこのページに更新日と共に掲載されます。

## お問い合わせ

このプライバシーポリシーに関するご質問やご懸念がある場合は、[GitHubリポジトリ](https://github.com/bymebyu/ViewPilot/issues)でイシューを登録してください。

---

*ViewPilotはGil Chang Lee (bymebyu)によって開発されました。*
