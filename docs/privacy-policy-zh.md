# ViewPilot 隐私政策

> [English](privacy-policy.md) | [한국어](privacy-policy-ko.md) | [日本語](privacy-policy-ja.md) | [**中文**](privacy-policy-zh.md) | [Español](privacy-policy-es.md)

**最后更新: 2026年3月21日**

## 概述

ViewPilot 是一款浏览器扩展程序，可让您通过 GitHub Copilot 与网页内容进行交互。本隐私政策说明了哪些数据会被处理以及如何使用。

**ViewPilot 不是 GitHub 或 Microsoft 的官方产品。** 使用此扩展程序需要有效的 GitHub Copilot 订阅。

## 收集的数据

**开发者不收集任何数据。** ViewPilot 没有开发者运营的服务器，不会向开发者传输任何信息。

## 本地存储的数据

以下数据仅使用 `chrome.storage.local` 存储在用户设备上：

- **GitHub OAuth 令牌**: 用于 GitHub Copilot API 认证。仅存储在浏览器本地存储中，不会传输给任何第三方。
- **聊天记录**: 对话记录仅存储在浏览器本地存储中。
- **用户设置**: 所选 AI 模型、语言、字体大小、网页搜索设置等。
- **网页搜索 API 密钥**（可选）: 如果您提供了 Brave 或 Serper API 密钥，它们将存储在本地，仅发送给相应的服务。

## 发送到外部服务的数据

- **GitHub Copilot API** (`api.githubcopilot.com`): 发送消息时，提示和页面上下文将被发送到 GitHub Copilot API 进行 AI 处理。
- **网页搜索**（启用时）: 根据配置，搜索查询将发送到以下服务之一：
  - **DuckDuckGo**（默认，无需 API 密钥）
  - **Brave Search**（可选，需要 API 密钥）
  - **Serper / Google**（可选，需要 API 密钥）

  仅发送搜索查询文本。不会向搜索提供商传输个人数据、浏览历史或页面内容。

与 GitHub Copilot API 的所有通信均受 GitHub 自身隐私政策的约束。详情请参阅 [GitHub 隐私声明](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement)。

## 第三方服务

ViewPilot 与以下服务通信：
- **GitHub Copilot API** — AI 聊天功能
- **DuckDuckGo / Brave / Serper** — 可选的网页搜索（仅在用户明确启用时）

我们不与任何分析、跟踪或广告服务集成。

## 用户控制

- 您可以随时通过扩展程序清除聊天记录和存储的数据。
- 您可以通过 GitHub 账户设置撤销 GitHub OAuth 令牌。
- 卸载扩展程序将删除所有本地存储的数据。

## 政策变更

我们可能会不时更新本隐私政策。变更将在本页面上以更新日期发布。

## 联系方式

如果您对本隐私政策有任何问题或疑虑，请在我们的 [GitHub 仓库](https://github.com/bymebyu/ViewPilot/issues) 提交 issue。

---

*ViewPilot 由 Gil Chang Lee (bymebyu) 开发。*
