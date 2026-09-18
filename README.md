# MAGI Vote — 三机决议系统

Evangelion 风格的 MAGI 投票页：对同一议题并行调用三次 DeepSeek（Melchior / Balthasar / Casper），各自返回 **赞成 / 反对 / 保留** + 短理由，再按多数决议；平票则显示红色 **「决议保留」**。

> 非官方同人界面。样式为自制 CSS（橙黑 + 警戒条纹），未使用任何官方素材。

## 功能概览

| 机位 | 角色侧重 |
|------|----------|
| **MELCHIOR-1** | 逻辑 / 证据 |
| **BALTHASAR-2** | 伦理 / 情感 |
| **CASPER-3** | 落地 / 可行 |

完整 system prompt 字符串见仓库根目录 [`prompts.js`](./prompts.js)。

## 安装与运行

```bash
git clone https://github.com/UrabeMikotoX1145/magi-vote.git
cd magi-vote
npm install
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY
npm run dev    # 开发（node --watch）
# 或
npm start      # 生产
```

浏览器打开：<http://localhost:3000>

环境变量：

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key（必填，仅服务端读取） |
| `PORT` | 可选，默认 `3000` |

**切勿**把 `.env` 提交进 Git（已在 `.gitignore` 中忽略）。

## API

`POST /api/vote`

```json
{ "question": "是否应立刻启动某个项目？" }
```

返回示例：

```json
{
  "question": "...",
  "results": [
    { "id": "melchior", "name": "MELCHIOR-1", "label": "逻辑/证据", "vote": "赞成", "reason": "..." },
    { "id": "balthasar", "name": "BALTHASAR-2", "label": "伦理/情感", "vote": "保留", "reason": "..." },
    { "id": "casper", "name": "CASPER-3", "label": "落地/可行", "vote": "反对", "reason": "..." }
  ],
  "decision": "决议保留",
  "tie": true,
  "counts": { "赞成": 1, "反对": 1, "保留": 1 }
}
```

决议规则：某一选项得票 ≥ 2 且严格多于其它选项 → 该选项；否则 → **决议保留**（含三方各异或 1–1–1）。

DeepSeek：`https://api.deepseek.com/chat/completions`，模型 `deepseek-chat`，`Authorization: Bearer <DEEPSEEK_API_KEY>`。

## Prompt 注入说明：system vs user

本项目刻意把 **角色指令** 与 **用户议题** 分开：

1. **System message（`prompts.js`）**  
   写死在服务端，定义该 MAGI 机位的人格、投票准则、以及必须输出的 JSON 格式。  
   用户无法通过页面直接改写这些字符串。

2. **User message**  
   仅包含用户输入的议题文本，作为 `role: "user"` 发送。

这能降低「用户在问题里写 *忽略以上指令*」一类 **prompt injection** 的成功率：模型仍可能被诱导，但 system 与 user 分离是行业基线做法。  
额外防护建议（未全部实现，可自行加强）：

- 限制问题长度（本项目已限制 2000 字）
- 对输出做 JSON schema / 枚举校验（本项目会规范化 vote）
- 不把用户文本拼进 system prompt

**请勿**在前端或日志中打印 API Key；服务端只用 `process.env.DEEPSEEK_API_KEY`。

## 项目结构

```
magi-vote/
├── prompts.js          # 三份完整 system prompt
├── server.js           # Express：静态页 + POST /api/vote
├── public/
│   ├── index.html
│   ├── style.css       # NERV/MAGI 橙黑主题
│   └── app.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## 许可

个人同人玩具项目。Eva / NERV / MAGI 等为原作商标与设定，与官方无关。
