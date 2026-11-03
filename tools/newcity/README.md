# 新增縣市作業手冊

這份手冊整理了嘉義市、嘉義縣、雲林縣、臺南市等縣市建置的實際流程（之後又做了高雄、屏東、臺東、金門）。新的縣市照著做，就能做出和前四個一致的網站。開新的 Claude Code session 時，請先讀完這份手冊、`SPEC.md` 與 `PROMPTS.md` 再動手。

## 檔案

| 檔案 | 用途 |
|---|---|
| `README.md` | 本手冊：流程、規則、驗收清單、已知陷阱 |
| `SPEC.md` | 內容撰寫規格（景點、對話、時光地圖、無形文資），給內容 agent 讀 |
| `PROMPTS.md` | 派給內容 agent 的指示範本、縣市補充規格範本、分批派工建議 |
| `common.py` | 共用設定：User-Agent、代理 CA、下載與重試、縣市比對 |
| `fetch_sources.py` | 步驟 1：下載文資局開放資料、YouBike 站點、維基百科文資列表 |
| `build_base.py` | 步驟 3：篩出縣市的文資，產生景點 id、agent 分組檔、統計、`sites-official.json`、`ubike.json` |
| `images.py` | 步驟 4：從維基百科列表配代表照片，查 Commons 授權，寫 `images.json` |
| `validate.py` | 檢查 agent 輸出：欄位、語音規則、題目、個資、簡體字 |
| `merge.py` | 步驟 6：合併 agent 輸出成網站資料，有錯誤就不寫檔 |
| `tests/city_smoke.js` | 縣市頁冒煙測試（桌機、手機），截圖存在 `/tmp/newcity/shots/` |
| `tests/cues_all.js` | 全站語音核對：每個開放縣市的每一句語音都要和文字一致 |
| `size_report.py` | 步驟 0、11：容量檢查，對照 GitHub Pages 1 GB 上限，700 MB 時提醒是否搬遷（見〈容量管理〉） |

工作檔放在 `/tmp/newcity/`，不進版控，容器重開就會消失。需要保留的成果一定要寫進 repo 再推送。

## 前置準備

```bash
pip install pypinyin edge-tts pillow opencc-python-reimplemented
```

```bash
python3 tools/serve.py 8766 &
```

- 預覽和測試要用 `tools/serve.py`（支援 Range，語音才能拖曳），不要用 `python3 -m http.server`。
- 這個雲端環境經過代理：Python 下載、語音合成都要設 `TTS_CA_BUNDLE=/root/.ccr/ca-bundle.crt`。`common.py` 會自動找。
- 瀏覽器測試：`NODE_PATH=$(npm root -g) node ...`（Playwright 與 Chromium 已預裝，不要重裝）。

## 流程總覽

以臺南（246 處有形、99 項無形）為例：內容 agent 13 個，語音約 360 段（合成約 40 分鐘），全程約半天。

0. 容量檢查：`size_report.py --next <這個縣市的文資數>`，會越過 700 MB 就先問使用者（見〈容量管理〉）
1. 下載資料：`fetch_sources.py`
2. 寫 `config.json`
3. 景點清單與分組：`build_base.py`
4. 照片：`images.py` → `tools/fetch_images.py`（背景執行）
5. 寫縣市補充規格，分批派內容 agent（景點、時光地圖、民俗、工藝古物）
6. 合併：`merge.py`，加上人工修正
7. 寫 `extra.json`：開場對話、遊戲反應、出發點、推薦行程
8. `build_data.py` → `gen_audio.py`（背景執行）
9. 開放縣市：`cities.js`、入口頁問候語與語音
10. 測試：`city_smoke.js`（桌機、手機）、`cues_all.js`，看截圖
11. 更新 README 與容量紀錄，提交推送，建立 PR 合併到 `main`（見〈發布流程〉）

## 步驟詳解

### 0. 容量檢查

```bash
python3 tools/newcity/size_report.py --next 600
```

- `--next` 填這個縣市有形加無形文資的大約數量，可先跑步驟 3 的 `build_base.py` 看 stats.txt，或用 `PROMPTS.md`／開場指示裡的試算。
- 印出「⚠️」（做完會越過 700 MB）或「⛔」（已超過 900 MB）時，**先停下來問使用者**是否要先搬遷，不要自行決定。

### 1. 下載資料

```bash
python3 tools/newcity/fetch_sources.py 高雄市
```

- 文資局的檔案很大、伺服器很慢：1.1、1.2、6.1 各要 10 分鐘以上。可以先做別的事。
- 已下載的檔案會略過，中斷了重跑即可。

### 2. 寫 config.json

複製 `tainan-city/data/config.json` 到 `<slug>/data/config.json` 再修改。可以先跑一次步驟 3，看 `/tmp/newcity/<slug>/stats.txt` 的統計再填：

- **基本**：`slug`、`name`、`short`。
- **地圖**：
  - `center`、`zoom`：stats.txt 有座標中位數。
  - `minZoom`、`detailZoom`、`timeZoom`。
- **categories**：照 stats.txt 的類別，順序是國定古蹟 → 市定（縣定）古蹟 → 歷史建築 → 紀念建築 → 聚落建築群 → 考古遺址 → 文化景觀。
- **towns**：全部行政區，依地理順序排，這會決定 agent 分組。
- **YouBike**：
  - `ubikeAreas`：YouBike 區碼，stats.txt 有範圍內的區碼統計，例如高雄市是 `12`。沒有 YouBike 就填 `[]`。
  - `ubikeUrl`：該縣市的 YouBike 頁面。
- **維基與標題**：
  - `wiki`：維基百科「<縣市>文化資產」的標題與網址。
  - `introTitle`、`quizTitle`。
- **board**（遊戲用，都要換成這個縣市的）：
  - `name`：例如「港都擲骰大冒險」。
  - `start`：例如「出發：高雄車站」。
  - `train`：在地小火車或交通，例如「哈瑪星舊鐵道」。
  - `food`：在地小吃，例如「○○補給站」。
- **planner**：
  - `speeds`：各交通方式的速度。
  - `hints`：五種交通方式的提醒，依當地情況改寫。
  - `defaultMode`：預設交通方式。
  - `lunchNote`、`eveningNote`：在地小吃、夜市。
  - `walkMaxKm`、`bikeMaxKm`、`ubikeStationMaxKm`、`farKm`。
  - `islands`（有離島才填）：`[{name, bbox:[南,西,北,東], port, portName, mainPort, back, seaMin, note, lunchNote}]`。港口座標要用 OpenStreetMap 查證。跨海路段會顯示「搭船／搭機」，自動分天時同一天不跨兩區。範例：`pingtung-county`（小琉球）、`taitung-county`（綠島、蘭嶼）。
- **eraLabels**（選填）：依縣市覆寫景點的時期名稱，例如金門沒有日治、荷蘭時期：`{"dutch": "明代以前", "japan": "民國初年與日軍占領（1912–1945）", …}`。era 代碼不變，只改顯示；沒設定的縣市照舊。時光地圖各期的名稱與年代則寫在 `eras.json` 的 `name`、`range`。
- **board.trainText**（選填）：棋盤「小火車」格的說明文字，沒有火車的縣市可改，例如金門「開上金門大橋，前進 3 格！」。
- **planner.noVisit**（選填）：一般民眾無法前往的景點 `{景點id: "原因"}`（例如軍事管制的離島燈塔、仍在使用的營區）。行程不排路線，結果上方列出原因，自選清單標示「無法前往」。
- **eras**：每個時期要疊的老地圖圖層與說明。
  - **可用圖層**：`1904`、`1916`、`1921`、`1944`、`1945`、`1950`、`1966`、`corona`、`1989`、`photo`，定義在 `assets/js/city/timemap.js` 的 `LAYERS`。
  - **沒有實測地圖的時期**：加 `"paper": true`。
  - 先到中研院百年歷史地圖確認這個縣市在各圖層的覆蓋範圍。沒有涵蓋的地方圖磚只有 936 或 197 位元組（空白），可以用小腳本抽幾個點檢查。金門完全不在任何中研院圖層裡，前六期都用 `paper`，「現在」只疊 `photo`。
  - 都沒有用到中研院圖層時，關於頁不會列中研院；沒有 `ubikeUrl` 時不列 YouBike 來源。
- **html**：頁面的標題、描述與首頁文案，全部換成這個縣市的內容。

### 3. 景點清單與分組

```bash
python3 tools/newcity/build_base.py 高雄市 kaohsiung-city
```

- **產生**：`sites_base.json`、`part1..N.json`（每份約 25 處）、`stats.txt`；有 config 時再寫 `sites-official.json` 和 `ubike.json`。
- **id 規則**：行政區拼音-名稱拼音，例如 `gushan-dagouyingguoling`。
  - 拼音偶爾讀錯破音字，臺南就把「赤嵌」讀成 chiqian。用 `--rename 舊id=新id` 修正。
  - **id 一旦派給 agent 就不要再改。**
- **注意**：stats.txt 列出的「沒有行政區」「沒有座標」「同名」都要人工處理。

### 4. 照片

```bash
python3 tools/newcity/images.py 高雄市 kaohsiung-city
```

```bash
TTS_CA_BUNDLE=/root/.ccr/ca-bundle.crt nohup python3 tools/fetch_images.py kaohsiung-city > /tmp/fetch_kh.log 2>&1 &
```

- **配對規則**：名稱完全相同，或 4 字以上互相包含才算。寧可沒有照片，也不要配錯。
- **一張照片配給多處**：程式會列出來，人工判斷配錯的，用 `--none id1 id2` 排除後重跑。
- **授權**：只收 CC 和公有領域。網頁會標示作者、授權與原始頁面。
- **限流**：Wikimedia 會限流（429），下載會很慢。`fetch_images.py` 每張都存檔，可以中斷重跑，沒下載到的照片網頁會直接連 Commons 原圖。
- **縣市卡片**：入口頁的縣市卡片需要一張代表照片，從已下載的 `<slug>/img/*.webp` 挑一張，例如國定古蹟。

### 5. 派內容 agent

1. 依 `PROMPTS.md` 第 0 節寫 `/tmp/newcity/<slug>/SPEC_CITY.md`。
2. 依第 1～4 節派 agent：景點每份一個，再加時期、民俗、工藝古物各一個。
   - **要分批**，一批 5～6 個。碰到用量上限時，用 SendMessage 請原 agent 繼續，不要重派。
3. agent 的輸出放在 `/tmp/newcity/<slug>/out/`。容器重開就會消失，**合併後就要提交推送**。

### 6. 合併與人工修正

```bash
python3 tools/newcity/merge.py sites kaohsiung-city /tmp/newcity/kaohsiung-city/out/content-part*.json
```

```bash
python3 tools/newcity/merge.py eras kaohsiung-city /tmp/newcity/kaohsiung-city/out/eras.json
```

```bash
python3 tools/newcity/merge.py ich kaohsiung-city /tmp/newcity/kaohsiung-city/out/ich-folk.json /tmp/newcity/kaohsiung-city/out/ich-arts.json
```

- **把關**：`merge.py` 會擋下 id 不一致、語音規則錯誤、簡體字、疑似個資，先修正 agent 輸出再合併。
- **常見人工修正**：
  - **年代真的不詳**：在 `sites-content.json` 設 `"era": "unknown", "yearUnknown": true`。
  - **缺行政區**：補 `sites-official.json` 的 `town`。
  - **座標明顯錯誤**：在 `sites-content.json` 改 `lat`、`lng`。這兩個欄位會覆蓋官方座標。
- **agent 回報中的判斷**：例如合併了哪些紀錄、哪些座標是近似點，要整理起來最後告訴使用者。

### 7. 寫 extra.json

複製 `tainan-city/data/extra.json` 再改寫，**每一句都要換成這個縣市的內容**。

- **對話**：
  - `intro`：首頁開場，8～10 句。
  - `timeIntro`、`planIntro`、`gameIntro`：各 4～5 句。
  - 規則同 SPEC.md 第二節。
- **reactions**：遊戲反應，12 句，**順序不能變**：
  1. 答對
  2. 答對
  3. 答錯
  4. 答錯
  5. 阿拉蕾擲骰
  6. 玩家贏
  7. 阿拉蕾贏
  8. 平手
  9. 時光排序完成
  10. 蓋章
  11. 翻翻樂完成
  12. 看解說

  第 1、6、9 句要換成在地說法。之前雲林和臺南沿用了嘉義的「嘉義通」「雞肉飯」，已修正，不要再犯。
- **starts**：出發點，例如火車站、高鐵站、市中心地標，最後兩筆固定是 `gps` 和 `pick`。座標用 Nominatim 查。
- **plans**：推薦行程，格式為 `{"1": {"name": "一日：…", "days": [[景點id, …]]}, "2": {…}, "3": {…}}`。`days` 每一項是一天的景點 id 陣列，一天約 8～10 處、照地理順序排。
- **離島行程**：`plans` 除了 `1`、`2`、`3` 之外可以另加行程（例如 `"green": {"label": "離島：綠島", "name": …, "days": [[…]]}`），會在天數按鈕裡多一顆，`label` 是按鈕文字。離島不要放進一、二日遊。
- **food**：可留空陣列。

### 8. 產生網頁資料與語音

```bash
python3 tools/build_data.py
```

```bash
TTS_CA_BUNDLE=/root/.ccr/ca-bundle.crt nohup python3 tools/gen_audio.py > /tmp/gen_kh.log 2>&1 &
```

- **速度**：每分鐘約 9 段，只合成內容有變的句子。
- **失敗**：語音服務偶爾連續回「No audio was received」，這和文字內容無關。重跑即可，已完成的會略過。
- **cues.js**：每完成一段就寫回，所以中途也可以提交。
- **兩個語音工作不要同時跑**：它們會寫同一個 `cues.js`。
- **只合成某個縣市**：`python3 tools/gen_audio.py pingtung-county`（參數是縣市資料夾名稱）；入口頁用 `python3 tools/gen_audio.py audio portal`。多個 session 同時建置不同縣市時一定要這樣做，才不會合成或提交別人的語音。
- **語音服務長時間封鎖**：同一個網路出口短時間請求太多，Edge 語音服務會連續好幾個小時對所有句子都回「No audio was received」（連「你好」都失敗）。這時設 `TTS_CONCURRENCY=1` 降低並行數，用迴圈每隔幾分鐘重跑；仍然不行就先開放縣市（網頁會改用瀏覽器內建語音），之後再開新的 session 補合成。
- **對話改了任何一個字**，就要重跑 `gen_audio.py`，否則那段會改用瀏覽器內建語音。

### 9. 開放縣市

- **`assets/js/cities.js`**：把籌備中那一筆改成 `slug`、`on: true`，並填 `img`（代表照片，相對網站根目錄）、`credit`（作者與授權）、`desc`（數量與特色）。清單裡沒有這個縣市（例如屏東縣）就新增一筆，`lat`、`lng` 填縣市中心，`nick` 填一句特色。
- **入口頁問候語**：`tools/portal.json` 第 4 句和 `index.html` 裡的 `PORTAL` 必須**一字不差**，列出所有開放縣市。改完執行：

  ```bash
  python3 tools/build_data.py
  ```

  ```bash
  TTS_CA_BUNDLE=/root/.ccr/ca-bundle.crt python3 tools/gen_audio.py portal
  ```

  入口頁語音要**立刻**重新合成並推送，否則使用者會聽到舊的問候。
- **`index.html` 的 meta description**：列出所有開放縣市。

### 10. 測試

```bash
NODE_PATH=$(npm root -g) node tools/newcity/tests/city_smoke.js kaohsiung-city
```

```bash
NODE_PATH=$(npm root -g) node tools/newcity/tests/city_smoke.js kaohsiung-city mobile
```

```bash
NODE_PATH=$(npm root -g) node tools/newcity/tests/cues_all.js
```

- **通過標準**：最後一行要是 `no errors`；`cues_all.js` 每個縣市的 `bad` 都要是空的，徽章顯示「預錄語音」。
- **一定要看截圖**（`/tmp/newcity/shots/`）：手機版地圖、詳情頁、行程、棋盤。可用 PIL 把幾張拼成一張再看。

### 11. 收尾

- **根目錄 `README.md`**：開頭的開放縣市清單，加上一列這個縣市的說明（數量、特色、推薦行程）。
- **容量**：執行 `python3 tools/newcity/size_report.py`，在〈容量管理〉的容量紀錄表加一列（日期、縣市、網站大小、占 1 GB 比例）。
- **提交**：commit 訊息結尾照規定加上協作者與 session 連結。推送到 session 指定的工作分支。
- **上線**：建立 PR 合併到 `main`（見〈發布流程〉），由使用者在 GitHub 按下合併後才會上線。
- **回報使用者（繁體中文）**：完成項目、數量、需要使用者確認的判斷（合併、近似座標、未收錄古物），並提醒開放時間以現場公告為準。

## 發布流程（`main` 分支）

正式網站從 `main` 分支發布（GitHub → Settings → Pages → Deploy from a branch → `main` / `(root)`）。每完成一個縣市才合併一次：網站不會出現做到一半的縣市，GitHub Pages 的重建次數也大幅減少（每小時 10 次的軟上限）。

1. 新 session 從 `main` 開始，在 session 指定的工作分支開發、推送。
2. 縣市完成、測試通過後，先把 `main` 的最新內容合併進工作分支：

   ```bash
   git fetch origin main && git merge origin/main
   ```

   - **衝突時**：同時有其他縣市剛上線，`assets/js/cities.js`、`tools/portal.json`、`index.html`、`audio/cues.js`、`audio/portal.mp3`、`README.md` 可能衝突。
   - **處理方式**：文字檔保留兩邊的縣市；入口頁問候語要列出所有開放縣市，再執行 `python3 tools/build_data.py` 與 `python3 tools/gen_audio.py audio portal` 重新合成入口頁語音，最後跑一次 `cues_all.js`。
   - 用 merge，不要 rebase 後 force push。
3. 建立 PR：從工作分支到 `main`，標題例如「新增金門縣」。內文列出數量、測試結果、需要使用者確認的判斷。
4. **使用者在 GitHub 按下合併**後，`main` 更新，網站約 1～2 分鐘後上線。session 不要自己合併 PR。

PR 同時是變更紀錄：每個縣市何時上線、改了什麼，都查得到。

## 容量管理

GitHub 免費方案的限制（2026/11 查證，見 GitHub Pages limits 文件）：

| 限制 | 上限 |
|---|---|
| Pages 發布網站大小 | 1 GB |
| 每月流量 | 100 GB（軟性），一次造訪約 3.4 MB，約 3 萬次造訪 |
| 每小時重建 | 10 次（軟性） |
| repo 大小 | 建議 1 GB 以下，強烈建議 5 GB 以下 |

- **平均用量**：每處文資平均約 0.34 MB，其中語音約占 76%。
- **全臺推估**：全部做完約 1.25 GB，會超過 1 GB。
- **門檻**：
  - **700 MB：提醒。** 開放下一個縣市前，先請使用者決定是否搬遷。
  - **900 MB：停止。** 不再開放新縣市，先完成搬遷或瘦身。
- `size_report.py` 與 `build_data.py` 都會自動印出目前用量與提醒。

### 到 700 MB 時要請使用者決定的事

| 方案 | 做法 | 優點 | 缺點 |
|---|---|---|---|
| A（建議） | 改用 Cloudflare Pages 發布，原始碼仍放 GitHub，只部署 `main` | 沒有 1 GB 網站上限，官方宣稱不限流量；程式不用改 | 使用者要申請免費 Cloudflare 帳號並連結 GitHub；每月 500 次部署、20,000 個檔案（全臺約 9,000 個）；網址改為 `*.pages.dev`，可掛自己的網域 |
| B | 語音搬到第二個 GitHub repo | 仍全在 GitHub | 要改語音路徑；全臺語音約 950 MB，仍逼近上限 |
| C | 語音位元率從 32 kbps 降到 24 kbps | 省約 25%，可延後撞牆 | 音質略降，要先試聽；全部語音要重新合成 |

### 容量紀錄

每完成一個縣市，在下表加一列（`size_report.py` 的合計）：

| 日期 | 事件 | 網站大小 | 占 1 GB |
|---|---|---|---|
| 2026-11-03 | 六縣市（嘉義市、嘉義縣、雲林縣、臺南市、高雄市、屏東縣） | 355 MB | 35% |
| 2026-11-03 | 加入臺東縣 | 383 MB | 37% |
| 2026-11-03 | 加入金門縣；建立 `main` 發布分支與容量檢查 | 461 MB | 45% |
| 2026-11-03 | 加入宜蘭縣（語音合成中，完成後預估約 520 MB） | 483 MB | 47% |

## 規則（不可違反）

- **語言**：全部使用繁體中文（台灣用字），包括網站內容、回覆使用者的訊息、提交訊息以外的說明文字。`validate.py` 會檢查簡體字。
- **稱呼**：阿拉蕾稱呼導覽員為「Allan」，不用「羅顧問」。`build_data.py` 與 `merge.py` 也會自動轉換。
- **Email**：使用者的 Email 只用來辨識使用者，**絕不可**放進 User-Agent、網址、檔案或任何對外請求。User-Agent 一律用 `AllanLoCultureSite/1.0 (https://github.com/allanloplus/Cultural_Heritage)`。
- **個資**：私人宅第只寫到路名或里名；不公開保存者的住家地址、電話、身分證字號。
- **版權**：照片只用 CC 或公有領域，並標示作者與授權；有疑慮就用連結。
- **頁尾署名**：網站的設計者署名「規劃設計：Allan Lo, 2026/11/1，使用 AI 工具：Claude Opus 5.5」由 `build_data.py` 寫入，不要改。
- **Git**：
  - 網站從 `main` 分支發布。**不要直接推送到 `main`**，在 session 指定的工作分支開發，完成後建立 PR，由使用者合併（見〈發布流程〉）。
  - 推送節奏：每完成一個階段推送一次；語音合成期間約每 30 分鐘一次，不要每幾分鐘推送。
  - 結束一個回合前，所有變更（包括新檔案）都要提交並推送到工作分支（stop hook 會檢查）。

## 已知陷阱

| 狀況 | 原因與解法 |
|---|---|
| 語音合成一直失敗「No audio was received」 | 服務端間歇性問題，與文字無關。`gen_audio.py` 已有 20 次重試，還是失敗就整個重跑；若連「你好」都失敗，是出口被暫時封鎖，見步驟 8 |
| Python 下載出現 SSL「Missing Subject Key Identifier」 | Python 3.13 預設嚴格 X.509，代理憑證沒有 SKI。`common.py`、`fetch_images.py`、`gen_audio.py` 已關掉嚴格模式（仍完整驗證憑證）；自己寫的腳本請用 `common.get()` |
| 改了對話，網頁卻用瀏覽器內建語音 | `cues.js` 的雜湊和文字不符，重跑 `gen_audio.py`，再用 `cues_all.js` 確認 |
| 入口頁語音和文字不一致 | `tools/portal.json` 與 `index.html` 的 `PORTAL` 不同步，或沒重跑 `gen_audio.py portal` |
| Wikimedia、維基百科 429 | 限流。放慢、重跑；`fetch_images.py` 會接著做 |
| 文資局下載逾時 | 檔案大、伺服器慢，`fetch_sources.py` 的逾時是 25 分鐘，重跑即可 |
| 沙箱裡瀏覽器連不到路線服務（OSRM） | 代理不允許網址含分號，測試程式已改用 curl 轉送。正式網站不受影響 |
| 語音無法拖曳進度 | 預覽伺服器不支援 Range，請用 `tools/serve.py` |
| `pgrep -f` 找到自己 | 用 `ps -eo args \| grep "^python3 tools/gen_audio.py"` 判斷背景工作是否還在跑 |
| 新類別在地圖上沒有顏色 | 在 `assets/js/city/app.js` 的 `CAT` 加顏色（已有：國定、市定、縣定古蹟、歷史建築、紀念建築、聚落建築群、考古遺址、文化景觀、無形文資） |
| 複製別的縣市設定後忘了改 | 用 grep 搜尋前一個縣市的名稱、小吃、車站，例如「嘉義」「雞肉飯」「府城」，確認都換掉了 |
| 照片配錯景點 | 只用完全相同或 4 字以上包含的名稱配對；`images.py` 會列出一照多配，人工排除 |
| 一個景點沒有行政區 | stats.txt 會列出，手動補 `sites-official.json` 的 `town` |
| 入口頁地圖看不到離島 | 入口頁地圖依所有縣市標記自動縮放；西邊離島（經度小於 119.6）的標籤放在標記右側，手機才不會被切掉 |
| 官方說明年號與西元對不上 | 金門的官方資料常見這種矛盾（例如「民國元年（1911）」），請 agent 不寫有矛盾的數字，並在回報中列出 |

## 驗收清單

- [ ] `merge.py` 三種都通過（沒有錯誤，提醒都已確認）
- [ ] `build_data.py` 印出的景點數、無形文資數、YouBike 站數正確
- [ ] `cues_all.js`：所有縣市 `bad` 為空，入口頁與各縣市徽章為「預錄語音」
- [ ] `city_smoke.js` 桌機、手機都 `no errors`，截圖看過
- [ ] 入口頁：縣市卡片、地圖標記、右上角功能表、問候語文字與語音都已更新
- [ ] 縣市頁：麵包屑「全站首頁 › 縣市」、切換選單、「○○總覽」分頁正常
- [ ] `config.board`、`extra.reactions`、行程提醒、午餐與晚上建議都是這個縣市的內容
- [ ] 沒有簡體字（`validate.py` 會檢查）、沒有 Email、沒有私人門牌
- [ ] `size_report.py` 已執行，容量紀錄表已加一列；沒有越過 700 MB，或已經問過使用者
- [ ] 根目錄 README 已更新；全部已提交並推送到工作分支，並已建立合併到 `main` 的 PR

## 開新 session 時的開場指示（範本）

把下面整段貼到新的 Claude Code session，替換〈縣市〉與〈slug〉（例如 changhua-county），並把最後的「參考」換成該縣市的試算（用 `build_base.py` 的 stats.txt）或刪掉。縣市有特殊狀況（離島、無古蹟、沒有日治時期、原住民族文化等）時，再加一段「特別注意事項」。

```text
依相同模式，生成「〈縣市〉」的文化資產網站，資料夾為 〈slug〉。

開始前請先完整閱讀：
1. tools/newcity/README.md（新增縣市作業手冊）
2. tools/newcity/SPEC.md 與 tools/newcity/PROMPTS.md
3. 根目錄 README.md，並參考最近完成的縣市資料夾作為範例

工作要求：
- 先做步驟 0 容量檢查：python3 tools/newcity/size_report.py --next 〈有形＋無形文資數〉；若做完會越過 700 MB，先停下來問我是否要搬遷。
- 照手冊的步驟 0～11 進行；內容 agent 依 PROMPTS.md 分批派，每批 5～6 個。
- 角色、語音（Allan 台灣男聲、阿拉蕾台灣小女生聲，設定以 tools/gen_audio.py 為準）與網站功能要和前面的縣市一致；合成語音時只跑本縣市：python3 tools/gen_audio.py 〈slug〉。
- 全部使用繁體中文，包括回覆我的訊息，不可出現簡體字。
- 我的 Email 不可放進任何 User-Agent、網址、檔案或對外請求。
- 從 main 分支開始，在這個 session 指定的工作分支開發與推送；不要直接推送到 main。每完成一個階段推送一次，語音合成期間約每 30 分鐘一次。
- 完成並測試通過後，照手冊〈發布流程〉合併 main 的最新內容、在容量紀錄表加一列，然後建立合併到 main 的 PR（我同意建立 PR），由我在 GitHub 按合併上線。
- 若碰到用量上限，請寫明目前進度與下一步再停下來，我會說「請繼續」。
- 完成後用繁體中文回報：各類數量、容量（size_report.py 的結果）、需要我確認的判斷（合併、近似座標、未收錄項目），並提醒開放時間以現場公告為準。

參考：〈試算的數量、鄉鎮分布、YouBike 區碼〉。重新下載後數字可能略有不同。
```
