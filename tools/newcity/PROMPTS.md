# 內容 agent 的指示範本

把 `<縣市>`、`<slug>`、`<N>` 換成實際值後交給 agent。工作檔都在 `/tmp/newcity/<slug>/`。

## 用量上限：要分批派

帳號有 5 小時的用量上限。臺南一次派了 13 個 agent，碰到上限後停了好幾個小時。

- **建議**：一批最多派 5～6 個，等這批完成再派下一批。
- **順序**：先派景點分組，再派時光地圖、民俗、工藝與古物。
- **碰到上限**：agent 會停下來。等額度恢復後，用 SendMessage 請同一個 agent「繼續，並盡量減少網路查詢」，不要重派新的，已做的會白費。

## 0. 縣市補充規格（先由主 session 寫好，存成 `/tmp/newcity/<slug>/SPEC_CITY.md`）

```markdown
# <縣市>篇：補充規格（搭配 tools/newcity/SPEC.md）

1. 行政區：<列出行政區>。介紹與 openNote 要帶到所在行政區。
2. 交通：可提 <臺鐵站、高鐵站、捷運、輕軌、公車、YouBike>，不可捏造班次。
3. themes 固定清單（選 1～3 個）：<依縣市特色列 15～22 個，例：城垣砲臺、宗教信仰、宅第家族、日式建築、公共建築、產業遺產、糖業鐵道、鐵道交通、港口海關、水利設施、眷村聚落、軍事遺構、教育運動、藝術文化、市場商業、考古原住民、紀念地景、墓葬碑碣、職務宿舍、客家文化>
4. 重點：<國定古蹟與代表性景點，請寫得較豐富>
5. 特別注意：<這個縣市的敏感議題、重複名稱、需要合併的紀錄等>
```

## 1. 景點分組（每份約 25 處，一個 agent 一份）

```text
請為文化資產導覽網站「Allan Lo 和你逛文化」撰寫 <縣市> 的景點內容（繁體中文、台灣用語）。
1. 先完整閱讀並遵守：/home/user/Cultural_Heritage/tools/newcity/SPEC.md 與 /tmp/newcity/<slug>/SPEC_CITY.md。
2. 輸入：/tmp/newcity/<slug>/part<N>.json（<數量> 處）。texts 欄位是文化資產局的官方說明，是主要依據；
   可少量查證 zh.wikipedia.org 與 *.gov.tw（會限流，請節制）。不可捏造。
3. 輸出：依相同順序寫成 JSON 陣列，存到 /tmp/newcity/<slug>/out/content-part<N>.json。
4. 自我檢查：python3 /home/user/Cultural_Heritage/tools/newcity/validate.py sites <輸出檔> --base /tmp/newcity/<slug>/sites_base.json
   直到沒有錯誤（「提醒」要逐一確認）。
5. 完成後簡短回報：檔案路徑、筆數、修正了哪些座標與原因、哪些事實因無法查證而沒寫。不要貼出 JSON 內容。
網路請求的 User-Agent 只能用 AllanLoCultureSite/1.0 (https://github.com/allanloplus/Cultural_Heritage)，不可放任何 Email；Nominatim 每次至少間隔 5 秒。
```

## 2. 時光地圖

```text
請為「Allan Lo 和你逛文化」撰寫 <縣市> 的「時光地圖」內容（繁體中文、台灣用語）。
1. 先閱讀 /home/user/Cultural_Heritage/tools/newcity/SPEC.md 第二、三節與 /tmp/newcity/<slug>/SPEC_CITY.md。
2. 參考格式與語氣：/home/user/Cultural_Heritage/tainan-city/data/eras.json、chiayi-city/data/eras.json（含 qingCity 範例）。
3. 7 個時期 dutch、zheng、qing、japan、early-roc、roc60、now 都要寫，順序固定。重點：<各時期這個縣市的重點，例：
   高雄：打狗、鳳山縣舊城、1908 年打狗港築港、哈瑪星、1920 年改名高雄、1979 年升格直轄市、2010 年縣市合併……請一一查證>。
4. 每件事都要用可靠來源查證（zh.wikipedia、*.gov.tw、中研院）。地標座標用真實 WGS84（Nominatim，至少間隔 5 秒）。
5. qingCity：若有足夠證據（例如鳳山縣舊城、鳳山新城的城門與城牆遺跡）可做，否則填 null。
6. 輸出 {"eras":[...],"qingCity":...} 到 /tmp/newcity/<slug>/out/eras.json，
   用 python3 /home/user/Cultural_Heritage/tools/newcity/validate.py eras <輸出檔> 檢查到沒有錯誤。
7. 簡短回報：路徑、是否產生 qingCity、哪些事實沒寫。不要貼出 JSON。
User-Agent 規定同上，不可放 Email。
```

## 3. 民俗

```text
請為「Allan Lo 和你逛文化」撰寫 <縣市> 的「民俗」類無形文化資產（繁體中文、台灣用語）。
1. 閱讀 /home/user/Cultural_Heritage/tools/newcity/SPEC.md（第二、四節），格式與語氣參考 tainan-city/data/ich.json。
2. 輸入：/tmp/newcity/cache/boch/5.1.json，只取 addresses 的 cityName 是 <縣市> 的紀錄；
   同一項民俗的國家級（重要民俗）與縣市級紀錄要合併。也可參考 /tmp/newcity/<slug>/wiki_rows.json 的民俗段落。
3. 展示點是舉行民俗的公開廟宇或場所，id 用 venue-f- 開頭；座標用 Nominatim（間隔 ≥5 秒）或維基百科查證，查不到填 null。
   若和有形文資是同一個地方，relatedSiteId 填 /tmp/newcity/<slug>/sites_base.json 的 id。
4. 尊重祭典禁忌；不公開私人地址；不捏造日期（很多祭典依農曆或幾年一科，要寫清楚）。
5. 輸出 /tmp/newcity/<slug>/out/ich-folk.json，用 validate.py ich 檢查到沒有錯誤。
6. 簡短回報：路徑、項目與展示點數量、合併了哪些、沒放進去的及原因。不要貼出 JSON。
User-Agent 規定同上，不可放 Email。
```

## 4. 傳統表演藝術、傳統工藝、保存技術、古物

```text
請為「Allan Lo 和你逛文化」撰寫 <縣市> 的傳統表演藝術、傳統工藝、保存技術與古物（繁體中文、台灣用語），不要包含民俗（另一位同事負責）。
1. 閱讀 /home/user/Cultural_Heritage/tools/newcity/SPEC.md（第二、四節），格式與語氣參考 tainan-city/data/ich.json。
2. 輸入（篩選 <縣市>）：/tmp/newcity/cache/boch/4.1.json（表演藝術）、4.2.json（工藝）、5.2.json（口述傳統）、5.3.json（傳統知識與實踐）、
   6.1.json（古物，用 belongCity 或 govInstitutionName 篩選）、/tmp/newcity/<slug>/wiki_rows.json；
   保存技術及保存者可查 https://nchdb.boch.gov.tw/data/api。
3. item id 用 ich-a- 開頭；展示點（收藏古物的博物館、廟宇，或看得到這些技藝的地方）id 用 venue-a- 開頭，座標查證方式同上。
   同一項目或同一保存者的國家級與縣市級紀錄要合併。
4. 不公開任何保存者的住家地址、電話、身分證字號，只寫到區或里；已過世的保存者照官方紀錄說明。
   收在庫房、不公開或位置不明的古物不要放進展示點，在回報中列出。
5. 輸出 /tmp/newcity/<slug>/out/ich-arts.json，用 validate.py ich 檢查到沒有錯誤。
6. 簡短回報：路徑、各類數量、合併了哪些、沒放進去的及原因。不要貼出 JSON。
User-Agent 規定同上，不可放 Email。
```
