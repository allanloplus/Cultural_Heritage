# Allan Lo 和你逛文化

導覽員 **Allan Lo** 與 AI 小助手 **阿拉蕾** 帶你逛臺灣各縣市的文化資產。這是一個知性與旅遊資訊網站，用地圖、雙人語音故事、老地圖時光機、行程規劃和知識遊戲介紹文化資產。

- 規劃設計：Allan Lo，2026/11/1
- 使用 AI 工具：Claude Opus 5.5

第一站是 **嘉義市**（`chiayi-city/`）。以後新增縣市時，每個縣市各有一個資料夾，例如 `tainan-city/`。

## 網站內容

| 頁面 | 說明 |
|---|---|
| `index.html` | 入口頁。臺灣城市地圖與城市卡片，有 Allan 與阿拉蕾的語音開場。 |
| `chiayi-city/#home` | 嘉義市首頁。語音介紹、文化資產統計、四種逛法、今日推薦。 |
| `chiayi-city/#map` | 文資地圖：54 處有形文化資產（國定古蹟 2、市定古蹟 16、歷史建築 33、聚落建築群 1、文化景觀 2），另有 12 處無形文化資產與古物展示點。可依類別、時期、主題篩選或搜尋。點景點會打開詳情，內容包括：照片（附作者與授權）、雙人語音導覽與字幕、介紹、必看重點、冷知識、拍照點、開放資訊、導航、附近的 YouBike 站（可查即時車輛）、小測驗。 |
| `chiayi-city/#time` | 時光地圖：荷蘭、明鄭、清朝、日治、民國初年、民國 60 年、現在，共七個時期。每個時期疊上當年的老地圖（中研院臺灣百年歷史地圖），可調透明度、左右對照。另外還有大事記、當時的地標、當時已經出現的文化資產，以及語音故事與測驗。清朝時期會標出推定的嘉義城牆和城門。 |
| `chiayi-city/#plan` | 行程規劃，可選三個條件：天數（一日、二日、三日、不限）、交通（開車、機車、自行車、走路、YouBike）、景點選法（推薦行程、依主題、自選）。系統會自動排出順路的路線和時間，中午安排午餐。選 YouBike 時，每一段都會列出借車站與還車站，也能查即時可借、可還的數量。行程可以用 Google 地圖導航、複製或列印。 |
| `chiayi-city/#games` | 知識遊戲：文資問答王、時光排序、猜猜我是誰、文資翻翻樂、桃城擲骰大冒險（和 Allan 一隊對戰阿拉蕾）。完成挑戰可以在文資護照上蓋章。 |
| `chiayi-city/#about` | 資料來源、圖片授權清單、使用提醒。 |

## 語音

語音沿用課程網站的做法，用 Microsoft Edge 神經網路語音預先合成：

- Allan：`zh-TW-YunJheNeural`（台灣男聲）
- 阿拉蕾：`zh-TW-HsiaoYuNeural`，音調調高（台灣小女生）

每段對話合成一個 mp3，存在 `chiayi-city/audio/`。`cues.js` 記錄每句的起訖時間與內容雜湊。如果文字改了但語音還沒重新產生，播放器會自動改用瀏覽器內建語音。

## 修改內容與重新產生

需要 Python 3、`pip install edge-tts pillow`、ffmpeg。

```bash
python3 tools/build_data.py
```

```bash
python3 tools/gen_audio.py
```

`gen_audio.py` 只會重新合成內容有變動的句子。

| 檔案 | 內容 |
|---|---|
| `chiayi-city/data/sites-official.json` | 文化部文化資產局開放資料：名稱、類別、地址、座標、官方連結 |
| `chiayi-city/data/sites-content.json` | 每個景點的介紹、重點、冷知識、雙人對話、猜謎線索、測驗 |
| `chiayi-city/data/eras.json` | 時光地圖各時期內容、地標座標、清代城牆推定範圍 |
| `chiayi-city/data/ich.json` | 無形文化資產、民俗與古物，以及它們的公開展示地點 |
| `chiayi-city/data/images.json` | Wikimedia Commons 照片與授權 |
| `chiayi-city/data/ubike.json` | YouBike 2.0 嘉義市站點快照 |
| `chiayi-city/data/extra.json` | 開場與說明對話、遊戲回饋語音、推薦行程、出發點 |
| `tools/portal.json` | 入口頁對話。這段文字也寫在 `index.html` 裡，兩邊要一致。 |

改完 JSON 後，執行 `build_data.py` 會產生 `chiayi-city/js/data.js`（網頁實際讀取的檔案）和 `tools/script.json`（語音腳本）。

照片副本用 `python3 tools/fetch_images.py` 下載到 `chiayi-city/img/`。沒有下載到的照片，網頁會直接連結 Wikimedia Commons。

## 本機預覽與上線

純靜態網站，不需要後端。

```bash
python3 tools/serve.py
```

開啟 http://localhost:8000 即可預覽。這個預覽伺服器支援 HTTP Range，語音可以跳句。Python 內建的 `python3 -m http.server` 不支援 Range，用它預覽時按「下一句」會從頭播放；GitHub Pages 沒有這個問題。

上線用 GitHub Pages：Settings → Pages → Deploy from a branch，選要發布的分支與 `/ (root)`。

## 資料來源與授權

- **文化資產資料**：[文化部文化資產局開放資料](https://data.boch.gov.tw/)、[國家文化資產網](https://nchdb.boch.gov.tw/)（政府資料開放授權條款）。另外與 [維基百科「嘉義市文化資產」](https://zh.wikipedia.org/zh-tw/%E5%98%89%E7%BE%A9%E5%B8%82%E6%96%87%E5%8C%96%E8%B3%87%E7%94%A2) 比對過清單。
- **照片**：Wikimedia Commons 的自由授權照片（CC BY、CC BY-SA、公有領域、CC0）。網頁上都有標示作者、授權與原始頁面連結。沒有自由授權照片的景點，只用連結指向官方代表圖或搜尋結果。
- **老地圖**：[中央研究院人社中心 臺灣百年歷史地圖](https://gis.sinica.edu.tw/tileserver/)。
- **底圖**：內政部國土測繪中心（通用電子地圖、正射影像）、OpenStreetMap。
- **路線**：FOSSGIS OSRM（routing.openstreetmap.de）。服務連不上時，改用直線距離估算。
- **YouBike**：YouBike 微笑單車官方站點資料。站點位置用快照，即時車輛在網頁上查詢。
- **角色**：Allan Lo 與阿拉蕾的角色圖由委託人提供，裁切去背後存放在 `assets/characters/`。

使用提醒：開放時間、導覽場次常有調整，請以各管理單位的公告為準。私人宅第、宿舍與仍在使用的宗教場所，請在公共空間欣賞外觀，不要擅自進入。

護照、造訪紀錄、自選景點只存在使用者自己的瀏覽器（localStorage），不會上傳。

---

Copyright © 2026 Allan Lo. 文字內容與程式碼版權所有；第三方資料與照片依各自授權。
