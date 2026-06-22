# 設定步驟：每日自動更新單字庫

## 你會拿到的檔案結構
```
你的repo/
├── .github/
│   └── workflows/
│       └── daily-vocab.yml      ← 排程設定（每天幾點要跑）
├── scripts/
│   └── generate-vocab.js        ← 真正呼叫 OpenAI 的腳本
├── data/
│   └── word-bank.json           ← 累積的單字庫（一開始是空的 []）
└── toefl_tool.html              ← 工具本體（已經改好會自動讀 data/word-bank.json）
```

## 設定步驟

**1. 把這四個檔案放進你的 GitHub repo**，保持上面的資料夾結構（`.github/workflows/` 這層資料夾名稱不能改，GitHub 靠這個路徑辨識 Actions）。

**2. 加入 OpenAI API Key 到 Secrets**
- 到你的 repo → Settings → Secrets and variables → Actions
- 點 "New repository secret"
- Name 填：`OPENAI_API_KEY`
- Value 填你的 OpenAI key（`sk-...` 開頭）
- 存檔。**這個值之後連你自己都看不到明文，只有 Actions 執行時能讀取，安全。**

**3. 手動測試一次**
- 到 repo 的 "Actions" 頁籤
- 左邊選 "Daily Vocab Update"
- 右邊點 "Run workflow" 手動觸發一次（不用等排程時間）
- 跑完後檢查 `data/word-bank.json` 有沒有被自動 commit 更新（應該會多出 40 個單字）

**4. 之後就會自動跑**
- 預設排程是每天 UTC 23:00（= 台灣時間早上 7 點），在 `daily-vocab.yml` 裡的 `cron: '0 23 * * *'` 那行可以改時間
- 每天都會挑一個新主題（環境科學、經濟學、心理學...等14個主題輪流），生成40個不重複的新單字，累加進 `word-bank.json`

## 費用
用的是 `gpt-4o-mini`，一天40個單字的生成量非常小，大概幾分錢美金一天，一個月加起來通常不到一美金，但記得這是你 OpenAI 帳號在計費，要自己留意額度。

## 如果想改參數
打開 `scripts/generate-vocab.js`：
- `WORDS_PER_DAY = 40` → 改這個數字調整每天生成量
- `THEMES` 陣列 → 可以增減或改主題清單
- `model: 'gpt-4o-mini'` → 想要品質更好可以換成 `'gpt-4o'`，但費用會高很多

## 注意事項
- 工具會嘗試 `fetch('./data/word-bank.json')`，這**只有在透過 GitHub Pages（http網址）瀏覽時才會成功**。如果是直接在電腦上雙擊打開 html 檔案（file:// 協定），瀏覽器會擋掉這個 fetch，這時候工具會自動忽略、安靜地繼續用內建的128個單字，不會報錯。
- 如果某天 OpenAI API 額度用完或請求失敗，那天的 Actions 執行會失敗（你會在 Actions 頁籤看到紅色叉），但**不會影響已經累積的 `word-bank.json`**，工具還是能正常運作，只是那天沒有新增單字而已。
