# 「Allan Lo 和你逛文化」內容撰寫規格（所有縣市共用）

給撰寫景點、時光地圖、無形文化資產內容的 agent 看。每個縣市另有一份補充規格（`/tmp/newcity/<slug>/SPEC_CITY.md`，範本見 `PROMPTS.md`），兩份都要讀。寫完用 `python3 tools/newcity/validate.py` 自我檢查，沒有錯誤才交件。

## 角色與風格

網站是知性兼旅遊的導覽網站，兩位角色用「對話」介紹文化資產，語音用 Microsoft Edge TTS 預先合成：

- **A＝Allan Lo**：光頭、黑框眼鏡、親切幽默的中年大叔導覽員，愛講冷笑話、愛吃在地小吃，知識淵博但不掉書袋。台灣男聲。
- **R＝阿拉蕾**：AI 小助手，戴耳機和麥克風的小女生，好奇、活潑、反應快，常吐槽 Allan，會問觀眾想問的問題。台灣小女生聲。
- 阿拉蕾稱呼導覽員一律用「**Allan**」，不要用「羅顧問」「顧問」。

風格要生動、幽默、活潑、口語化，用台灣用語，但**事實必須正確**。

## 共通規則

- **繁體中文（台灣用字）**，不可出現簡體字。罕用字只有在正式名稱或史料原文就是這樣寫時才用。
- **資料來源**：以文化部文化資產局開放資料為主（輸入檔的 `texts` 欄位），可再參考中文維基百科和政府網站。不確定的就不要寫，寧可少寫，不可捏造人名、年代、數字。
- **隱私**：
  - 私人宅第只寫到路名或里名，不寫門牌。
  - 不公開任何保存者、藝師的住家地址、電話、身分證字號。
  - 任何檔案、請求都不可以出現 Email。
- **網路禮儀**：
  - 對外請求一律用 User-Agent `AllanLoCultureSite/1.0 (https://github.com/allanloplus/Cultural_Heritage)`。
  - OpenStreetMap Nominatim 每次查詢至少間隔 5 秒。多位同事共用同一個網路出口。
  - 維基百科與 Commons 會限流（HTTP 429），請節制，失敗就等。
- **敏感議題**：族群、政治、歷史事件要中立，依可靠來源。宗教儀式要尊重禁忌，官方紀錄有的禁忌照實寫。已拆除、損毀或只剩遺構的，要如實說明。

## 一、景點內容（content-partN.json）

輸出 JSON 陣列，順序與輸入相同，每處一筆：

```json
{
  "id": "與輸入相同",
  "short": "顯示用短名稱（10 字內）",
  "year": 1910,
  "yearText": "1910年（明治43年）",
  "era": "japan",
  "themes": ["日式建築"],
  "summary": "一句話亮點，25 字內",
  "intro": "150～260 字的正式介紹（中性、正確、易讀）：歷史沿革與價值",
  "highlights": ["必看重點1（30 字內）", "必看重點2", "必看重點3"],
  "funFact": "冷知識或小故事（60 字內，要有根據）",
  "photoSpot": "拍照建議（30 字內）",
  "visitMin": 30,
  "openNote": "開放資訊摘要（依官方資料；未開放就寫「目前僅能外觀參觀」之類），可提大眾運輸，不可捏造班次",
  "dialogue": [{"who": "A", "text": "……"}, {"who": "R", "text": "……"}],
  "clues": ["猜謎線索1（最難）", "線索2", "線索3（最簡單）"],
  "quiz": [{"q": "題目", "options": ["甲", "乙", "丙", "丁"], "answer": 2, "explain": "解說（40 字內）"}],
  "lat": 22.627, "lng": 120.265, "coordNote": "官方座標"
}
```

- **year**：創建年（整數，最佳估計），用來給時光排序遊戲排序。史前遺址用負數，代表西元前。
  - 真的無法判斷時，`year` 填大約值、`era` 填 `"unknown"`、加 `"yearUnknown": true`，`yearText` 寫「年代不詳」。網站會標示「年代不詳」，也不會放進時光排序遊戲。
- **era**：只能是 `prehistoric | dutch | zheng | qing | japan | postwar | modern | unknown`。`postwar` 指 1945–1980，`modern` 指 1981 以後。
- **themes**：從縣市補充規格的固定清單選 1～3 個。
- **clues**：「猜猜我是誰」卡牌用，不能出現名稱本身。
- **quiz**：2 題四選一。四個選項長度相近、都合理。正確答案位置要分散，不要都放第一個。題目要能從 intro、highlights、funFact 學到。
- **lat、lng、coordNote**：
  - 只在官方座標看起來有問題時才查證：落在別的行政區、和另一處完全相同，或明顯是區公所、里中心的代表點。
  - 差距超過 300 公尺才修正，並在 coordNote 寫來源。
  - 查不到就保留官方座標，寫「官方座標（未能核對）」。

## 二、對話（dialogue）寫作規則（會直接送進語音合成）

- **長度**：6～9 句，每句 15～70 字，全段約 250～420 字（60～90 秒）。
- **標點**：只用全形「，。！？、：」，可用「」引號。
  - 不要 emoji、括號、「～」「…」「/」「#」。
  - 英文只允許「Allan」「YouBike」，其他縮寫改成中文。
- **數字**：年份寫「1910年」，也可加「日治明治43年」。數字用阿拉伯數字。
- **互動感**：
  - 阿拉蕾提問、驚訝、吐槽；Allan 解說、講冷笑話、給參觀建議。至少要有一個笑點或比喻。
  - 開場要有變化，不要每段都說「大家好」。
  - 同一區相鄰的廟宇、宅第，每段的笑點和角度要不同。
- **結尾**：最後一句給聽眾一個到現場要做的小任務，例如找一個細節、拍一張照。

## 三、時光地圖（eras.json）

`{"eras": [...7 個...], "qingCity": null 或物件}`，時期 id 與順序固定：

| id | 名稱 | 年代 |
|---|---|---|
| `dutch` | 荷蘭時期 | 1624–1662 |
| `zheng` | 明鄭時期 | 1661–1683 |
| `qing` | 清朝 | 1683–1895 |
| `japan` | 日治時期 | 1895–1945 |
| `early-roc` | 民國初年 | 1945–1950年代 |
| `roc60` | 民國60年前後 | 約1963–1981 |
| `now` | 現在 | 1982–今 |

每個時期的欄位：

- **基本**：`id`、`name`、`range`、`cityName`（當時的地名或行政名）、`title`、`summary`（150～300 字）、`population`（沒有可靠數字就留空）。
- **events**：`[{year, text}]`，4～8 則。
- **landmarks**：`[{name, lat, lng, note, approx}]`，5～8 個。座標用 WGS84；`approx: true` 表示推定位置。
- **view**：`{lat, lng, zoom}`，該時期地圖的初始畫面。
- **dialogue**：8～10 句。規則同第二節。
- **quiz**：2 題。
- **sources**：`[{title, url}]`。

`qingCity`（清代城池推定範圍）只有在證據足夠時才做，格式參考 `chiayi-city/data/eras.json`：

- **欄位**：`name`、`represents`、`outline`、`gates`、`batteries`、`perimeterMeters`、`method`、`confidence`、`sources`。
- **outline**：`[lat, lng]` 點的陣列。
- **gates**：要有名稱、座標和 `modernSpot`（今天的位置）。
- 證據不夠就填 `null`。

## 四、無形文化資產與古物（ich-*.json）

`{"items": [...], "venues": [...]}`，格式與語氣參考 `chiayi-county/data/ich.json`、`tainan-city/data/ich.json`。

- **items**：
  - **基本**：`id`（例：`ich-xigang-xiang`、`ich-a-nanguan`）、`name`、`type`、`holder`、`registered`（YYYY-MM-DD）、`url`（國家文化資產網頁面）。
  - **type**：`民俗 | 傳統表演藝術 | 傳統工藝 | 保存技術 | 口述傳統 | 傳統知識與實踐`。
  - **holder**：保存者或保存團體名稱，只寫名稱，不寫地址。
  - **summary**：25 字內。
  - **intro**：150～290 字。
  - **whereToSee**：在哪裡、什麼時候看得到。農曆日期、幾年一科都照實寫，不確定就請讀者看廟方公告。
  - **venueId**：展示點 id。沒有固定公開地點就填空字串。
  - **dialogue**：6～9 句。
  - **quiz**：1～2 題。
- **venues**：
  - **基本**：`id`（不同 agent 用不同前綴，例如民俗 `venue-f-`、工藝古物 `venue-a-`）、`name`、`address`（公開場所才寫門牌）、`lat`、`lng`（查證不到就填 null）。
  - **relatedSiteId**：和有形文資是同一個地方時，填 `sites_base.json` 的 id，否則填空字串。
  - **ichIds**：在這裡看得到的項目。
  - **antiquities**：`[{name, level, registered, note}]`，level 是一般古物、重要古物或國寶。
- **合併**：同一項目的國家級和縣市級紀錄要合併。`registered` 取最早的日期，`url` 用國家級。
- 收在庫房、目前不公開或位置不明的古物不要放進展示點，在回報裡列出。
