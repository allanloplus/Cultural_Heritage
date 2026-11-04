# 新增縣市作業手冊

這份手冊整理了嘉義市、嘉義縣、雲林縣、臺南市等縣市建置的實際流程（之後又做了高雄、屏東、臺東、金門、宜蘭、花蓮、連江、澎湖、基隆）。新的縣市照著做，就能做出和前四個一致的網站。開新的 Claude Code session 時，請先讀完這份手冊、`SPEC.md` 與 `PROMPTS.md` 再動手。

網站分成兩個 repo（GitHub Pages 每個網站上限 1 GB）：臺北市、新北市、桃園市、新竹市、新竹縣、苗栗縣、臺中市、彰化縣、南投縣放**第二網站** `Cultural_Heritage2`，其餘放本 repo（第一網站）。共用程式、工具與這份手冊只在第一網站。做第二網站的縣市前，先讀〈兩個網站〉。

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
| `tests/portal.js` | 入口頁測試：縣市卡片、地圖小卡、選單連結（兩個網站），地圖標籤避讓結果與截圖 |
| `size_report.py` | 步驟 0、11：容量檢查，**分網站**對照 GitHub Pages 各 1 GB 上限，700 MB 提醒、900 MB 停止（見〈容量管理〉） |
| `../sites.py` | 兩個網站的對應：縣市在哪個 repo（讀 `assets/js/cities.js` 的 `site` 欄位與 `SITE2` 清單）、第二網站 clone 的位置（`CH2_DIR`） |

工作檔放在 `/tmp/newcity/`，不進版控，容器重開就會消失。需要保留的成果一定要寫進 repo 再推送。

## 前置準備

```bash
pip install pypinyin edge-tts pillow opencc-python-reimplemented
```

```bash
python3 tools/serve.py 8766 &
```

- 預覽和測試要用 `tools/serve.py`（支援 Range，語音才能拖曳），不要用 `python3 -m http.server`。
- `serve.py` 用路徑區分兩個網站：`http://localhost:8766/Cultural_Heritage/`（第一網站）、`http://localhost:8766/Cultural_Heritage2/`（第二網站的 clone）。第二網站的縣市頁用第一網站的正式網址載入共用程式，`serve.py` 會換成本機路徑，一定要用這種網址預覽。
- 測試程式可用環境變數 `PORT`（預設 8766）與 `SHOTS`（截圖目錄，預設 `/tmp/newcity/shots`）。
- 這個雲端環境經過代理：Python 下載、語音合成都要設 `TTS_CA_BUNDLE=/root/.ccr/ca-bundle.crt`。`common.py` 會自動找。
- 瀏覽器測試：`NODE_PATH=$(npm root -g) node ...`（Playwright 與 Chromium 已預裝，不要重裝）。

## 兩個網站

| 網站 | repo | 網址 | 放什麼 |
|---|---|---|---|
| 第一網站 | `allanloplus/Cultural_Heritage`（本 repo） | https://cultural.123hi.org/（自訂網域，repo 的 `CNAME`；舊網址 allanloplus.github.io/Cultural_Heritage/ 會轉過去） | 全站首頁、共用程式 `assets/`、全部工具 `tools/`、本手冊；嘉義市、嘉義縣、雲林縣、臺南市、高雄市、屏東縣、臺東縣、金門縣、宜蘭縣、花蓮縣、連江縣、澎湖縣、基隆市 |
| 第二網站 | `allanloplus/Cultural_Heritage2` | https://allanloplus.github.io/Cultural_Heritage2/ | 只放縣市資料夾：臺北市、新北市、桃園市、新竹市、新竹縣、苗栗縣、臺中市、彰化縣、南投縣（依 2026/11/1 資料約 1,787 處、約 610 MB） |

### 怎麼運作

- **縣市在哪個網站**：以 `assets/js/cities.js` 為準。清單裡每筆可設 `site: 2`；沒設的依 `SITE2` 那一行（上表第二網站的 9 個縣市）。入口頁卡片、地圖小卡、右上角選單與縣市頁的「切換縣市」都用 `SiteCities.href()`／`imgSrc()` 連到正確的網站。
- **共用程式只有一份**：第二網站的縣市頁由 `build_data.py` 依 `tools/city_template.html` 產生，`{{root}}` 會換成第一網站的網址 `https://cultural.123hi.org/`，所以 CSS、JS、角色圖、`cities.js` 都從第一網站載入，「全站首頁」連到第一網站。第一網站的縣市仍是 `../`，頁面和以前一模一樣。`app.js` 的替代圖與關於頁角色圖依載入路徑自動判斷。
- **代表照片**：第二網站縣市在 `cities.js` 的 `img` 寫相對於第二網站根目錄的路徑（例如 `taipei-city/img/xxx-0.webp`），會自動加上第二網站的網址。
- **網址設定**：兩個網站的正式網址寫在 `cities.js` 的 `SITES` 那一行（第一網站 `https://cultural.123hi.org/`、第二網站 `https://allanloplus.github.io/Cultural_Heritage2/`），`tools/sites.py` 也讀這一行。換網域（例如第二網站也設自訂網域）只要改這一行，再跑 `build_data.py`。
- **護照**：兩個網站網域不同，localStorage 不共用；每個縣市本來就各有一本護照（`cy.<slug>.passport`），所以只差在語音速度等偏好要各設一次。
- **工具**：`build_data.py`、`gen_audio.py`、`fetch_images.py` 與 `tools/newcity/*` 只放在第一網站，透過 `tools/sites.py` 讀寫第二網站的 clone。用法完全相同，例如 `python3 tools/gen_audio.py taipei-city`、`python3 tools/fetch_images.py taipei-city`。`build_data.py` 會一次處理兩個網站，`tools/script.json` 裡第二網站的 group 會多一個 `"site": 2`。
- **第二網站 clone 的位置**：預設是本 repo 旁邊的 `Cultural_Heritage2`（例如 `/home/user/Cultural_Heritage2`），否則用環境變數 `CH2_DIR` 指定。`python3 tools/sites.py` 會印出兩個網站的位置與各自的縣市。
- **第二網站的根目錄** `index.html` 會自動轉到第一網站的入口頁 https://cultural.123hi.org/。
- **本機預覽**：`tools/serve.py` 把第二網站頁面裡的 `https://cultural.123hi.org/` 換成 `/Cultural_Heritage/`；`cities.js` 在 localhost 也自動改用本機路徑。

### 新 session 怎麼掛載第二個 repo

1. 用 `add_repo` 掛載 `allanloplus/Cultural_Heritage2`，`access: "push"`，再照工具的指示 clone 到 `/home/user/Cultural_Heritage2`（和本 repo 同一層）。
2. 兩個 repo 都從 `main` 開始，各自切到 session 指定的工作分支：

   ```bash
   git -C /home/user/Cultural_Heritage2 fetch origin main && git -C /home/user/Cultural_Heritage2 checkout -B <工作分支> origin/main
   ```

3. 確認對應：`python3 tools/sites.py`。

### 第二網站的縣市：資料放哪裡

- **第二網站**（`Cultural_Heritage2/<slug>/`）：`data/*.json`（含 `config.json`，步驟 2 直接寫在這裡）、`img/`、`audio/`、`js/data.js`、`index.html`。
- **第一網站**（本 repo）：`assets/js/cities.js`、`tools/portal.json` 與 `index.html` 的問候語、`audio/portal.mp3` 與 `audio/cues.js`、根目錄 README、本手冊的容量紀錄、`tools/newcity/manual/<slug>.json`（跨縣市文資）。
- 工作檔仍在 `/tmp/newcity/<slug>/`。

### 兩個 PR 與合併順序

第二網站的縣市要開**兩個 PR**：

1. **Cultural_Heritage2**：縣市資料夾（標題例如「新增臺北市（縣市資料）」）。
2. **Cultural_Heritage**：`cities.js`、入口頁問候語與語音、README、容量紀錄（標題例如「開放臺北市（入口頁與清單）」）。內文附上第一個 PR 的連結。

**先合併第二網站，再合併第一網站。** 反過來的話，入口頁會先出現連結，點進去卻是 404。兩個 PR 都由使用者合併；session 不要自己合併。

第二網站第一次上線前，使用者要在 Cultural_Heritage2 的 Settings → Pages 設定 Deploy from a branch → `main` / `(root)`（只要設一次）。

## 流程總覽

以臺南（246 處有形、99 項無形）為例：內容 agent 13 個，語音約 360 段（合成約 40 分鐘），全程約半天。

0. 容量檢查：`size_report.py --next <這個縣市的文資數> --city <縣市>`，看它所在網站做完會不會越過 700 MB，會的話先問使用者（見〈容量管理〉）
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
11. 更新 README 與容量紀錄，提交推送，建立 PR 合併到 `main`（見〈發布流程〉；第二網站的縣市開兩個 PR，見〈兩個網站〉）

## 步驟詳解

### 0. 容量檢查

```bash
python3 tools/newcity/size_report.py --next 600 --city 臺北市
```

- `--next` 填這個縣市有形加無形文資的大約數量，可先跑步驟 3 的 `build_base.py` 看 stats.txt，或用開場指示裡的試算。
- `--city` 填縣市名稱或 slug，程式依 `cities.js` 判斷是哪個網站，只預估那個網站；也可以用 `--site 1`／`--site 2`。
- 印出「⚠️」（做完會越過 700 MB）或「⛔」（會越過或已超過 900 MB）時，**先停下來問使用者**，不要自行決定。

### 1. 下載資料

```bash
python3 tools/newcity/fetch_sources.py 高雄市
```

- 文資局的檔案很大、伺服器很慢：1.1、1.2、6.1 各要 10 分鐘以上。可以先做別的事。
- 已下載的檔案會略過，中斷了重跑即可。

### 2. 寫 config.json

複製 `tainan-city/data/config.json` 到 `<slug>/data/config.json` 再修改。第二網站的縣市寫在 `/home/user/Cultural_Heritage2/<slug>/data/config.json`（之後的工具都會到那裡找）。可以先跑一次步驟 3，看 `/tmp/newcity/<slug>/stats.txt` 的統計再填：

- **基本**：`slug`、`name`、`short`。
- **地圖**：
  - `center`、`zoom`：stats.txt 有座標中位數。
  - `minZoom`、`detailZoom`、`timeZoom`。
  - `fitSites: true`（選用）：文資地圖與行程地圖一開始就縮放到涵蓋全部景點。有離島、範圍很廣的縣市（例如臺東要同時看到綠島、蘭嶼）才需要，必要時把 `minZoom` 調小一級。
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
- **planner.islands[].links**（選填）：兩座離島之間另有短程船班時，設定分鐘數，例如東莒 `{"西莒": 25}`，否則離島之間的航段會用 `seaMin` 估算。範例：`lienchiang-county`。
- **noPhotoBase**（選填）：國土測繪中心正射影像沒有涵蓋的縣市（例如馬祖）設 `true`，底圖選單不列正射影像，關於頁也不提。
- **fitSites**（選填）：景點分散在好幾座島時設 `true`，文資地圖的初始畫面會縮放到看得到全部景點。
- **planner.noVisit**（選填）：一般民眾無法前往的景點 `{景點id: "原因"}`（例如軍事管制的離島燈塔、仍在使用的營區）。行程不排路線，結果上方列出原因，自選清單標示「無法前往」。
- **eras**：每個時期要疊的老地圖圖層與說明。
  - **可用圖層**：`1904`、`1916`、`1921`、`1944`、`1945`、`1950`、`1966`、`corona`、`1989`、`photo`，定義在 `assets/js/city/timemap.js` 的 `LAYERS`。
  - **沒有實測地圖的時期**：加 `"paper": true`。
  - 馬祖不在任何中研院圖層裡，正射影像（`photo`）也沒有涵蓋，七個時期的前六期用 `paper`，「現在」不疊圖層，直接用通用電子地圖。
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
- **跨縣市文資**：官方只登錄在鄰縣、但也經過本縣市的文資（例如八通關古道只登錄南投縣），寫在 `tools/newcity/manual/<slug>.json`：`[{"caseId", "category", "town", "address", "lat", "lng", "note"}]`。`build_base.py` 會取出該筆官方紀錄，用這裡的行政區與座標覆蓋，`note` 會放進 `texts.manualNote` 給 agent 看。範例：`hualien-county`。

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
  - **同一處有兩筆官方紀錄**（例如縣登錄後又由文化部登錄為重要聚落）：合併成一處，從 `sites-official.json` 與分組檔移除重複的那筆，在保留的那筆加 `"extraLinks": [{"title": "…", "url": "…"}]`，詳情頁會多一顆官方連結按鈕。範例：`penghu-county` 的望安花宅聚落。
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

- **`assets/js/cities.js`**：把籌備中那一筆改成 `slug`、`on: true`（第二網站的縣市保留或加上 `site: 2`，`img` 寫相對於第二網站根目錄的路徑），並填 `img`（代表照片，相對網站根目錄）、`credit`（作者與授權）、`desc`（數量與特色）。需要讓人一看就知道通稱時（例如連江縣＝馬祖），另填 `label`（例如「連江縣（馬祖）」），卡片、地圖標籤與切換選單會顯示它，`name` 仍維持官方縣名。清單裡沒有這個縣市（例如屏東縣）就新增一筆，`lat`、`lng` 填縣市中心，`nick` 填一句特色。入口頁地圖上標籤會壓到其他縣市時，可設 `tip: "left"`：標籤放在標記左側、標記放在標籤上層，地圖寬度小於 600px 時標籤只顯示縣名（澎湖用這個設定，避免壓到嘉義、臺南）。另有 `tip: "right"`：標籤放在標記右側、標記在上層，手機只顯示縣名（基隆用；宜蘭同時改成 `left`，兩縣標籤才不會疊在一起）。
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

```bash
NODE_PATH=$(npm root -g) node tools/newcity/tests/portal.js
```

- **兩個網站**：測試程式依 `cities.js` 找縣市在哪個網站。`cities.js` 還沒有這個 slug 時（開放前），`city_smoke.js` 會看哪個網站有這個資料夾，也可以加 `--site 2`；`cues_all.js` 可以把縣市頁網址當參數，例如 `cues_all.js /Cultural_Heritage2/taipei-city/`。
- **通過標準**：最後一行要是 `no errors`；`cues_all.js` 每個縣市的 `bad` 都要是空的，徽章顯示「預錄語音」。
- **一定要看截圖**（`/tmp/newcity/shots/`）：手機版地圖、詳情頁、行程、棋盤，以及入口頁地圖（`portal-map*.png`，新縣市的標籤有沒有壓到別人）。可用 PIL 把幾張拼成一張再看。
- `city_smoke.js` 也會檢查「全站首頁」連到 `/Cultural_Heritage/`、切換選單的每個連結、角色圖與替代圖都載得到；`portal.js` 檢查入口頁卡片、地圖小卡、選單的每個連結與照片。

### 11. 收尾

- **根目錄 `README.md`**：開頭的開放縣市清單，加上一列這個縣市的說明（數量、特色、推薦行程）。
- **容量**：執行 `python3 tools/newcity/size_report.py`，在〈容量管理〉該網站的容量紀錄表加一列（日期、縣市、網站大小、占 1 GB 比例）。
- **提交**：commit 訊息結尾照規定加上協作者與 session 連結。推送到 session 指定的工作分支。
- **上線**：建立 PR 合併到 `main`（見〈發布流程〉），由使用者在 GitHub 按下合併後才會上線。第二網站的縣市開兩個 PR，先合併第二網站（見〈兩個網站〉）。
- **回報使用者（繁體中文）**：完成項目、數量、需要使用者確認的判斷（合併、近似座標、未收錄古物），並提醒開放時間以現場公告為準。

## 發布流程（`main` 分支）

正式網站從 `main` 分支發布（GitHub → Settings → Pages → Deploy from a branch → `main` / `(root)`）。每完成一個縣市才合併一次：網站不會出現做到一半的縣市，GitHub Pages 的重建次數也大幅減少（每小時 10 次的軟上限）。

1. 新 session 從 `main` 開始，在 session 指定的工作分支開發、推送。
2. 縣市完成、測試通過後，先把 `main` 的最新內容合併進工作分支（第二網站的縣市兩個 repo 都要做）：

   ```bash
   git fetch origin main && git merge origin/main
   ```

   - **衝突時**：同時有其他縣市剛上線，`assets/js/cities.js`、`tools/portal.json`、`index.html`、`audio/cues.js`、`audio/portal.mp3`、`README.md` 可能衝突。
   - **處理方式**：文字檔保留兩邊的縣市；入口頁問候語要列出所有開放縣市，再執行 `python3 tools/build_data.py` 與 `python3 tools/gen_audio.py audio portal` 重新合成入口頁語音，最後跑一次 `cues_all.js`。
   - 用 merge，不要 rebase 後 force push。
3. 建立 PR：從工作分支到 `main`，標題例如「新增金門縣」。內文列出數量、測試結果、需要使用者確認的判斷。第二網站的縣市在兩個 repo 各開一個，並在回報中寫明**先合併 Cultural_Heritage2、再合併 Cultural_Heritage**。
4. **使用者在 GitHub 按下合併**後，`main` 更新，網站約 1～2 分鐘後上線。session 不要自己合併 PR。

PR 同時是變更紀錄：每個縣市何時上線、改了什麼，都查得到。

## 容量管理

GitHub 免費方案的限制（2026/11 查證，見 GitHub Pages limits 文件）。**每個網站各自計算**：第一網站與第二網站各有 1 GB。

| 限制 | 上限 |
|---|---|
| Pages 發布網站大小 | 1 GB |
| 每月流量 | 100 GB（軟性），一次造訪約 3.4 MB，約 3 萬次造訪 |
| 每小時重建 | 10 次（軟性） |
| repo 大小 | 建議 1 GB 以下，強烈建議 5 GB 以下 |

- **平均用量**：每處文資平均約 0.34 MB，其中語音約占 76%。
- **全臺推估**：全部做完約 1.23 GB，會超過 1 GB，所以 2026/11/4 起分成兩個網站（見〈兩個網站〉）：第一網站 13 縣市約 626 MB；第二網站 9 縣市依 11/1 資料約 1,787 處、約 610 MB。
- **門檻（每個網站各自）**：
  - **700 MB：提醒。** 這個網站開放下一個縣市前，先請使用者決定怎麼辦。
  - **900 MB：停止。** 這個網站不再開放新縣市。
- `size_report.py` 與 `build_data.py` 都會分網站印出目前用量與提醒。

### 到 700 MB 時要請使用者決定的事

已採用「開第二個 GitHub repo」（2026/11/4）。若某個網站再到 700 MB，可再考慮：

| 方案 | 做法 | 優點 | 缺點 |
|---|---|---|---|
| A | 改用 Cloudflare Pages 發布，原始碼仍放 GitHub，只部署 `main` | 沒有 1 GB 網站上限，官方宣稱不限流量；程式不用改 | 使用者要申請免費 Cloudflare 帳號並連結 GitHub；每月 500 次部署、20,000 個檔案（全臺約 9,000 個）；網址改為 `*.pages.dev`，可掛自己的網域 |
| B | 語音搬到第二個 GitHub repo | 仍全在 GitHub | 要改語音路徑；全臺語音約 950 MB，仍逼近上限 |
| C | 語音位元率從 32 kbps 降到 24 kbps | 省約 25%，可延後撞牆 | 音質略降，要先試聽；全部語音要重新合成 |

### 容量紀錄

每完成一個縣市，在**該網站**的表加一列（`size_report.py` 該網站的合計）。

#### 第一網站（Cultural_Heritage）

| 日期 | 事件 | 網站大小 | 占 1 GB |
|---|---|---|---|
| 2026-11-03 | 六縣市（嘉義市、嘉義縣、雲林縣、臺南市、高雄市、屏東縣） | 355 MB | 35% |
| 2026-11-03 | 加入臺東縣 | 383 MB | 37% |
| 2026-11-03 | 加入金門縣；建立 `main` 發布分支與容量檢查 | 461 MB | 45% |
| 2026-11-03 | 加入宜蘭縣 | 518 MB | 51% |
| 2026-11-04 | 加入花蓮縣 | 558 MB | 54% |
| 2026-11-04 | 加入連江縣（馬祖） | 566 MB | 55% |
| 2026-11-04 | 加入澎湖縣 | 602 MB | 59% |
| 2026-11-04 | 加入基隆市 | 626 MB | 61% |
| 2026-11-04 | 建立第二網站；共用程式與工具支援兩個網站（第一網站不再新增縣市） | 626 MB | 61% |

#### 第二網站（Cultural_Heritage2）

| 日期 | 事件 | 網站大小 | 占 1 GB |
|---|---|---|---|
| 2026-11-04 | 建立第二網站骨架（首頁轉址、README） | 0 MB | 0% |

## 規則（不可違反）

- **語言**：全部使用繁體中文（台灣用字），包括網站內容、回覆使用者的訊息、提交訊息以外的說明文字。`validate.py` 會檢查簡體字。
- **稱呼**：阿拉蕾稱呼導覽員為「Allan」，不用「羅顧問」。`build_data.py` 與 `merge.py` 也會自動轉換。
- **Email**：使用者的 Email 只用來辨識使用者，**絕不可**放進 User-Agent、網址、檔案或任何對外請求。User-Agent 一律用 `AllanLoCultureSite/1.0 (https://github.com/allanloplus/Cultural_Heritage)`。
- **個資**：私人宅第只寫到路名或里名；不公開保存者的住家地址、電話、身分證字號。
- **版權**：照片只用 CC 或公有領域，並標示作者與授權；有疑慮就用連結。
- **頁尾署名**：「規劃設計：Allan Lo，https://www.123hi.org，2026年11月｜使用 AI 工具：Claude Opus 5.5」寫在 `tools/city_template.html`、入口頁 `index.html` 與 `assets/js/city/app.js`（關於頁），第二網站的 `index.html`、`README.md` 也有，網址要能點；不要改。
- **Git**：
  - 兩個網站都從 `main` 分支發布。**不要直接推送到任何 `main`**，在 session 指定的工作分支開發，完成後建立 PR，由使用者合併（見〈發布流程〉、〈兩個網站〉）。
  - **不要自己建立 repo。**
  - 推送節奏：每完成一個階段推送一次；語音合成期間約每 30 分鐘一次，不要每幾分鐘推送。
  - 結束一個回合前，所有變更（包括新檔案）都要提交並推送到工作分支（stop hook 會檢查）。

## 已知陷阱

| 狀況 | 原因與解法 |
|---|---|
| 語音合成一直失敗「No audio was received」 | 服務端間歇性問題，與文字無關。限流時約一半請求隨機失敗、同一句重試就會成功，`gen_audio.py` 失敗後只等 2～5 秒就重試（最多 60 次；以前用指數退避，澎湖時一分鐘只合成 2 句，改了以後約 20 句）。還是失敗就整個重跑；若連「你好」都失敗，是出口被暫時封鎖，見步驟 8 |
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
| 入口頁地圖看不到離島 | 入口頁地圖依所有縣市標記自動縮放，上方多留一點空間給最北的馬祖；西邊離島（經度小於 119.6）與最北的離島（緯度大於 25.9）的標籤放在標記右側，手機才不會被切掉 |
| 第二網站的縣市頁在本機預覽時用到線上的舊程式 | 用了 `python3 -m http.server` 或直接開資料夾，頁面會載入正式網址 `https://cultural.123hi.org/assets/…`。用 `tools/serve.py`（會把正式網址換成本機路徑），網址要有 `/Cultural_Heritage2/` |
| 工具說找不到第二網站的 clone | 還沒掛載 `Cultural_Heritage2`，或 clone 不在本 repo 旁邊；掛載後 clone 到 `/home/user/Cultural_Heritage2`，或設 `CH2_DIR` |
| 第二網站的縣市寫到第一網站 | `cities.js` 沒有這個縣市、`SITE2` 也沒列，且資料夾還不存在。先把 `config.json` 建在第二網站的 clone，或在 `cities.js` 補上 `site: 2` |
| 官方說明年號與西元對不上 | 金門的官方資料常見這種矛盾（例如「民國元年（1911）」），請 agent 不寫有矛盾的數字，並在回報中列出 |

## 驗收清單

- [ ] `merge.py` 三種都通過（沒有錯誤，提醒都已確認）
- [ ] `build_data.py` 印出的景點數、無形文資數、YouBike 站數正確
- [ ] `cues_all.js`：所有縣市 `bad` 為空，入口頁與各縣市徽章為「預錄語音」
- [ ] `city_smoke.js` 桌機、手機都 `no errors`，截圖看過
- [ ] 入口頁：縣市卡片、地圖標記、右上角功能表、問候語文字與語音都已更新；`portal.js` 為 `no errors`
- [ ] 縣市頁：麵包屑「全站首頁 › 縣市」、切換選單、「○○總覽」分頁正常
- [ ] `config.board`、`extra.reactions`、行程提醒、午餐與晚上建議都是這個縣市的內容
- [ ] 沒有簡體字（`validate.py` 會檢查）、沒有 Email、沒有私人門牌
- [ ] `size_report.py` 已執行，該網站的容量紀錄表已加一列；沒有越過 700 MB，或已經問過使用者
- [ ] 根目錄 README 已更新；全部已提交並推送到工作分支，並已建立合併到 `main` 的 PR（第二網站的縣市：兩個 PR，並告訴使用者先合併 Cultural_Heritage2）

## 產生縣市交接提示詞

使用者說「相同模式，我要建立○○」時，總控 session **先試算、再產生提示詞**：提示詞要能直接貼到新的 session，照〈開場指示範本〉，再加上「特別注意事項」與「參考」兩段。試算只看資料，**不寫進 repo**。

### 1. 同步與下載

```bash
git -C /home/user/Cultural_Heritage fetch origin main && git -C /home/user/Cultural_Heritage merge --ff-only origin/main
```

- 這個 session 第一次試算時，先下載資料（文資局開放資料、YouBike 站點、維基百科頁面；已下載的會略過）。文資局很慢，可以背景執行：

  ```bash
  python3 tools/newcity/fetch_sources.py 臺北市
  ```

### 2. 用暫存目錄跑 build_base.py

```bash
NEWCITY_DIR=/tmp/newcity-trial python3 tools/newcity/build_base.py 臺北市 taipei-city
```

- `NEWCITY_DIR` 指到暫存目錄，而且這個縣市還沒有 `config.json`，所以不會寫進任何 repo（`fetch_sources.py` 的快取在 `/tmp/newcity/cache`，用 `ln -s /tmp/newcity/cache /tmp/newcity-trial/cache` 共用，免得重抓）。
- 看 `stats.txt`：
  - **類別**：有沒有國定古蹟、市定或縣定古蹟、紀念建築、考古遺址、文化景觀。列出國定古蹟清單（`sites_base.json` 裡 `category` 為「國定古蹟」的名稱）。
  - **行政區**：數量與分布、沒有行政區的紀錄、沒有座標的紀錄。
  - **同名**：要提醒合併或加註。
  - **YouBike 區碼**：「本縣市的 YouBike 區碼」。顯示「沒有」時要提醒查證（例如基隆在 YouBike 官方資料中沒有站點；跨縣市營運的站點可能登錄在鄰縣）。
  - **可能跨縣市**：登錄在別的縣市、但地址文字提到本縣市的紀錄。逐筆判斷，例如八通關古道登錄在南投，東端在花蓮玉里，就要寫進 `tools/newcity/manual/<slug>.json`。把握「低」的多半是假陽性，例如臺北市的「基隆路」、各地的「中山路」型路名，或同名的里、廟。
- 也可以直接看 `/tmp/newcity/cache/boch/*.json` 的 `addresses` 補查。

### 3. 特殊情況檢查表

| 項目 | 要看什麼 | 寫進提示詞的方式 |
|---|---|---|
| 離島、無法前往 | 有沒有離島（`planner.islands`）、軍事管制或一般民眾不能去的地點（`planner.noVisit`） | 列出島名、港口與要設 noVisit 的景點 |
| 時期 | 有沒有西班牙、荷蘭時期；金門、馬祖沒有日治時期 | 需要時要求設 `eraLabels`，並寫清楚各期名稱 |
| 敏感題材 | 原住民族、戰爭、二二八、白色恐怖、災害現況（例如地震、颱風後封閉的步道） | 要求中立、莊重、兩面並陳，災害地點提醒出發前查最新狀況 |
| 私人宅第 | 仍有人住的古厝、日式宿舍轉作商店或餐廳 | 只寫到路名或里名，提醒在外觀參觀；商店寫「目前作為商店使用，營業時間以店家公告為準」，不寫店名以外的個資 |
| 沒有火車 | 縣市境內沒有臺鐵 | 要求改 `board.trainText` |
| 地圖與選單 | `cities.js` 的 `REGIONS` 有沒有這個縣市；名稱太長或會壓到別人的要設 `mapLabel`、`tip` | 寫明要設的值，並要求看 `portal-map*.png` |
| 網站 | `cities.js` 的 `site`／`SITE2` | 第二網站的縣市要掛載 `Cultural_Heritage2`、開兩個 PR |

### 4. 數量與派工

- **有形**：`stats.txt` 的總數 → 景點 agent 數量＝分組份數（每份約 25 處）。
- **無形與古物**：從快取數本縣市的紀錄（`in_city`），決定民俗、表演藝術與工藝古物 agent 要不要拆開：

  ```bash
  python3 -c "import sys,json;sys.path.insert(0,'tools/newcity');from common import load,in_city;c=sys.argv[1];[print(f,sum(1 for x in load('/tmp/newcity/cache/boch/'+f+'.json',[]) if in_city(x,c) or c in (x.get('belongCity') or '')+(x.get('govInstitutionName') or ''))) for f in ['4.1','4.2','5.1','5.2','5.3','6.1']]" 臺北市
  ```

- **批次**：一批 5～6 個 agent（見 `PROMPTS.md`）。例如有形 300 處＝12 份，加上時期、民俗、工藝古物＝15 個，分三批。古物上百件時，工藝古物拆成兩個 agent。

### 5. 容量

```bash
python3 tools/newcity/size_report.py --next <有形＋無形數> --city 臺北市
```

- 說明這個縣市放第一或第二網站、做完後該網站約幾 MB、占 1 GB 的比例；會越過 700 MB 就在提示詞裡要求先問使用者。

### 6. 寫提示詞

1. 用下面〈開場指示範本〉，第二網站的縣市用「第二網站」版。
2. 加「特別注意事項」：第 3 節表格裡適用的項目，每項一兩句，寫具體名稱（景點、島、事件）。
3. 加「參考」：有形與無形的數量、國定古蹟清單、行政區數與前幾名、YouBike 區碼（或「沒有，請查證」）、跨縣市候選、容量預估與網站。註明「依 ○/○ 下載的資料，重新下載後數字可能略有不同」。
4. 提示詞整段放在一個 `text` 區塊裡，方便使用者複製。

## 開新 session 時的開場指示（範本）

把下面整段貼到新的 Claude Code session，替換〈縣市〉與〈slug〉（例如 changhua-county），並把最後的「參考」換成該縣市的試算（見〈產生縣市交接提示詞〉）或刪掉。縣市有特殊狀況（離島、無古蹟、沒有日治時期、原住民族文化等）時，再加一段「特別注意事項」。

放**第二網站**的縣市（臺北市、新北市、桃園市、新竹市、新竹縣、苗栗縣、臺中市、彰化縣、南投縣），把範本裡標「第二網站」的四行換進去（取代原本的「從 main 分支開始…」與「完成並測試通過後…」兩行）：

```text
- 這個縣市放第二網站：用 add_repo 掛載 allanloplus/Cultural_Heritage2（access: push），照工具指示 clone 到 /home/user/Cultural_Heritage2，先讀手冊〈兩個網站〉。縣市資料夾（含 config.json）放在 Cultural_Heritage2；cities.js、入口頁問候語與語音、README、容量紀錄改在 Cultural_Heritage。
- 兩個 repo 都從 main 開始，在這個 session 指定的工作分支開發與推送；不要直接推送到任何 main，也不要自己建立 repo。每完成一個階段推送一次，語音合成期間約每 30 分鐘一次。
- 預覽與測試用 python3 tools/serve.py 8766（網址要有 /Cultural_Heritage2/〈slug〉/）；city_smoke.js、cues_all.js、portal.js 都要通過。
- 完成並測試通過後，兩個 repo 都照手冊〈發布流程〉合併 main 的最新內容，在第二網站的容量紀錄表加一列，然後建立兩個 PR（我同意建立 PR）：縣市資料夾的 PR 開在 Cultural_Heritage2，cities.js 等的 PR 開在 Cultural_Heritage；回報時寫明先合併 Cultural_Heritage2、再合併 Cultural_Heritage。
```

```text
依相同模式，生成「〈縣市〉」的文化資產網站，資料夾為 〈slug〉。

開始前請先完整閱讀：
1. tools/newcity/README.md（新增縣市作業手冊）
2. tools/newcity/SPEC.md 與 tools/newcity/PROMPTS.md
3. 根目錄 README.md，並參考最近完成的縣市資料夾作為範例

工作要求：
- 先做步驟 0 容量檢查：python3 tools/newcity/size_report.py --next 〈有形＋無形文資數〉 --city 〈縣市〉；若做完會越過 700 MB，先停下來問我。
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
