/* 全站縣市清單（入口頁的卡片與地圖、入口頁功能表、各縣市頁的「切換縣市」選單共用）
 * 新增縣市：在這裡加一筆並設 on: true，建立同名資料夾即可。img 為相對於網站根目錄的路徑。
 * tip（選填）：入口頁地圖標籤優先擺放的方向（"left"、"right"、"top"、"bottom"）。標籤會自動避開其他標籤與標記，放不下時先隱藏，放大地圖或滑鼠移到紅點上才出現。
 * mapLabel（選填）：入口頁地圖上的短名稱，例如連江縣用「馬祖」；沒填就用 name。
 * label（選填）：卡片、地圖標籤與選單顯示的名稱，例如「連江縣（馬祖）」；name 維持官方縣名，用來分地區。
 * site（選填）：縣市資料夾放在哪個網站。沒填＝第一網站（Cultural_Heritage，本 repo）；2＝第二網站（Cultural_Heritage2）。
 *   第二網站的縣市：img 寫相對於第二網站根目錄的路徑（例如 "taipei-city/img/xxx.webp"），連結與照片會自動加上第二網站的網址。
 *   兩個網站的網域不同（第一網站用自訂網域），各縣市的護照與紀錄存在各自網站的瀏覽器儲存空間。
 *   tools/ 的 Python 工具也讀這個欄位，決定縣市資料夾在哪個 repo（見 tools/sites.py）。 */
(function (root) {
  "use strict";
  var CITIES = [
    { slug: "chiayi-city", name: "嘉義市", nick: "桃城・木都・畫都", lat: 23.4805, lng: 120.4525, on: true,
      img: "chiayi-city/img/beimen-0.webp", credit: "北門驛／勤岸，CC BY-SA 3.0",
      desc: "54 處有形文化資產、16 項無形文化資產，阿里山林業鐵道從這裡出發。" },
    { slug: "chiayi-county", name: "嘉義縣", nick: "山海之間：新港・朴子・阿里山", lat: 23.50, lng: 120.40, on: true,
      img: "chiayi-county/img/fengtian-temple-0.webp", credit: "新港奉天宮／Peellden，CC BY-SA 3.0",
      desc: "60 處有形文化資產、23 項無形文化資產，從布袋海岸到阿里山森林鐵道。" },
    { slug: "yunlin-county", name: "雲林縣", nick: "媽祖・糖廠・布袋戲：北港・虎尾・西螺", lat: 23.70, lng: 120.43, on: true,
      img: "yunlin-county/img/beigang-chaotiangong-0.webp", credit: "北港朝天宮／K44965，CC BY-SA 3.0",
      desc: "124 處有形文化資產：北港朝天宮、西螺大橋、虎尾糖廠與上百處日式建築；目前沒有 YouBike。" },
    { slug: "tainan-city", name: "臺南市", nick: "府城四百年：赤崁・安平・鹽水", lat: 23.00, lng: 120.20, on: true,
      img: "tainan-city/img/zhongxi-kongzimiao-0.webp", credit: "臺南孔子廟／王彥翔，CC BY-SA 3.0",
      desc: "246 處有形文化資產、99 項無形文化資產：赤崁樓、孔子廟、安平古堡、億載金城等 21 處國定古蹟，府城與安平可騎 YouBike 串遊。" },
    { slug: "kaohsiung-city", name: "高雄市", nick: "打狗到港都：哈瑪星・左營舊城・美濃", lat: 22.62, lng: 120.30, on: true,
      img: "kaohsiung-city/img/gushan-dagouyingguoling-0.webp", credit: "打狗英國領事館官邸／WEI, WAN-CHEN（魏琬臻），CC BY-SA 4.0",
      desc: "132 處有形文化資產、44 項無形文化資產：打狗英國領事館、旗後礮臺、鳳山縣舊城、鳳山龍山寺等 7 處國定古蹟，哈瑪星與鹽埕可騎 YouBike 串遊。" },
    { slug: "pingtung-county", name: "屏東縣", nick: "阿猴・六堆・恆春半島", lat: 22.55, lng: 120.55, on: true,
      img: "pingtung-county/img/hengchun-gucheng-0.webp", credit: "恆春古城／Orion tw，CC BY-SA 3.0",
      desc: "114 處有形文化資產、63 項無形文化資產：恆春古城、鵝鑾鼻燈塔、魯凱族好茶舊社、下淡水溪鐵橋 4 處國定古蹟，還有六堆客家庄與排灣族石板屋聚落。" },
    { slug: "taitung-county", name: "臺東縣", nick: "後山：史前遺址・縱谷・綠島蘭嶼", lat: 22.80, lng: 121.15, on: true,
      img: "taitung-county/img/taidong-jiuzhanjiguancheku-0.webp", credit: "臺東舊站機關車庫／Pbdragonwang，CC BY-SA 3.0",
      desc: "60 處有形文化資產、22 項無形文化資產：卑南、八仙洞、都蘭考古遺址，日治移民村、鐵道與糖廠，還有綠島人權文化園區與蘭嶼部落。" },
    { slug: "kinmen-county", name: "金門縣", nick: "浯島：閩南古厝・僑鄉洋樓・戰地史蹟", lat: 24.44, lng: 118.33, on: true,
      img: "kinmen-county/img/jincheng-wentaibaota-0.webp", credit: "文臺寶塔／寺人孟子，CC BY-SA 4.0",
      desc: "251 處有形文化資產：文臺寶塔、邱良功母節孝坊、瓊林蔡氏祠堂等 10 處國定古蹟，153 處閩南古厝與僑鄉洋樓，還有古寧頭、八二三砲戰的坑道與碉堡；可開上金門大橋到烈嶼。" },
    { slug: "yilan-county", name: "宜蘭縣", nick: "蘭陽：噶瑪蘭・泰雅・林業・日式宿舍", lat: 24.75, lng: 121.75, tip: "left", on: true,
      img: "yilan-county/img/yilan-shezhijinianguan-0.webp", credit: "宜蘭設治紀念館／大三可，CC BY-SA 4.0",
      desc: "144 處有形文化資產：宜蘭設治紀念館、頭城老街、舊草嶺隧道、羅東林場與太平山林業遺產、漢本與丸山考古遺址，宜蘭市區的日式宿舍與二戰飛機掩體；另有本地歌仔、北管、頭城搶孤等無形文化資產。" },
    { slug: "hualien-county", name: "花蓮縣", nick: "洄瀾：阿美・太魯閣・縱谷移民村・林業糖業", lat: 23.85, lng: 121.5, on: true,
      img: "hualien-county/img/guangfu-tangchangzhitang-0.webp", credit: "花蓮糖廠製糖工場／lienyuan lee，CC BY 3.0",
      desc: "99 處有形文化資產：跨縣市國定古蹟八通關古道東端（玉里）、吉安慶修院、松園別館、將軍府、林田山林業聚落、花蓮糖廠、太巴塱祖屋與舞鶴遺址；另有阿美族豐年祭、大庄夜祭、紋面傳統、噶瑪蘭族香蕉絲織布等無形文化資產。" },
    { slug: "lienchiang-county", name: "連江縣", label: "連江縣（馬祖）", mapLabel: "馬祖", nick: "馬祖列島：閩東石頭屋・燈塔・戰地坑道", lat: 26.16, lng: 119.95, on: true,
      img: "lienchiang-county/img/beigan-qinbijuluojianzhu-0.webp", credit: "北竿芹壁聚落／張雅倫，CC BY-SA 4.0",
      desc: "15 處有形文化資產：東犬、東湧兩座國定古蹟燈塔，明代大埔石刻，芹壁、津沙、大浦的閩東石頭屋聚落，馬祖戰地文化景觀的坑道與據點，八千多年前的亮島人；另有擺暝、鼓板樂與馬祖老酒文化。搭交通船跳島逛四鄉五島。" },
    { slug: "penghu-county", name: "澎湖縣", nick: "菊島：媽祖廟・礮臺・咕咾石古厝・石滬", lat: 23.57, lng: 119.58, tip: "left", on: true,
      img: "penghu-county/img/magong-tianhougong-0.webp", credit: "澎湖天后宮／舟集 Boattoad，CC BY-SA 4.0",
      desc: "90 處有形文化資產：澎湖天后宮、媽宮古城、風櫃尾荷蘭城堡、西嶼東臺與西臺、西嶼燈塔等 9 處國定古蹟，咕咾石古厝、望安花宅聚落、七美雙心石滬與吉貝石滬群；另有踏涼傘、澎湖褒歌、上元乞龜等無形文化資產。騎上跨海大橋、搭船跳島逛菊島。" },
    { slug: "keelung-city", name: "基隆市", nick: "雨港：西荷城堡・砲台要塞・築港與鐵道", lat: 25.13, lng: 121.74, tip: "right", on: true,
      img: "keelung-city/img/zhongzheng-ershawanpaotai-0.webp", credit: "二沙灣砲台／Bigmorr，CC BY-SA 3.0",
      desc: "51 處有形文化資產：二沙灣、槓仔寮、大武崙三座砲台與外海的彭佳嶼燈塔 4 處國定古蹟，和平島的西班牙城堡與諸聖教堂遺構、清法戰爭紀念園區、獅球嶺與劉銘傳隧道、基隆築港與要塞司令部；另有鷄籠中元祭、和平島王爺海上遊江等無形文化資產。" },
    { slug: "nantou-county", name: "南投縣", nick: "臺灣的心臟：省府・書院・集集線・日月潭・部落", lat: 23.84, lng: 120.98, site: 2, on: true,
      img: "nantou-county/img/jiji-huochezhan-0.webp", credit: "集集火車站／Takoradee，CC BY 2.5",
      desc: "73 處有形文化資產：國定古蹟八通關古道、臺灣省政府與中興新村、藍田書院、登瀛書院、集集火車站與車埕、頭社古日潭浮田、大馬璘遺址與 Sbayan 泰雅民族起源地；另有邵族祖靈祭、布農族八部合音、賽德克族織布、竹編與漆工藝等 28 項無形文化資產。" },
    { slug: "changhua-county", name: "彰化縣", nick: "半線與鹿港：孔廟・龍山寺・扇形車庫・八卦山", lat: 24.07, lng: 120.54, site: 2, on: true,
      img: "changhua-county/img/zhanghua-baguashandafu-0.webp", credit: "八卦山大佛／Zairon，CC BY-SA 4.0",
      desc: "172 處有形文化資產：國定古蹟彰化孔子廟、元清觀、聖王廟、扇形車庫、鹿港龍山寺、鹿港天后宮、道東書院、益源大厝，還有鹿港老街與隘門、八卦山、八堡圳、西螺大橋北段；另有南瑤媽笨港進香、北管、錫工藝、粧佛等無形文化資產。" },
    { slug: "taichung-city", name: "臺中市", nick: "大墩：州廳・東海教堂・霧峰林家・舊山線", lat: 24.14, lng: 120.68, site: 2, on: true,
      img: "taichung-city/img/xi-zhouting-0.webp", credit: "臺中州廳／Ludahai，CC BY-SA 3.0",
      desc: "195 處有形文化資產：國定古蹟臺中州廳、臺中火車站、路思義教堂、霧峰林家，還有臺中公園湖心亭與大北門、萬和宮、摘星山莊、筱雲山莊、舊山線泰安車站、海線日南與追分車站；另有大甲媽祖遶境進香、南管戲曲、漆工藝、大甲鐵壺等 37 項無形文化資產。" },
    { slug: "hsinchu-city", name: "新竹市", nick: "風城竹塹：迎曦門・州廳・城隍廟・玻璃", lat: 24.80, lng: 120.97, tip: "left", site: 2, on: true,
      img: "hsinchu-city/img/dong-zhuqianchengyingxi-0.webp", credit: "竹塹城迎曦門／寺人孟子，CC BY-SA 4.0",
      desc: "77 處有形文化資產：國定古蹟新竹火車站、竹塹城迎曦門、新竹州廳、鄭用錫墓與進士第，還有新竹都城隍廟、長和宮、新竹市役所、新竹州圖書館、有樂館、新竹公園一帶與香山車站；另有竹塹中元城隍祭典、北管、玻璃傳統技藝等 12 項無形文化資產。" },
    { slug: "hsinchu-county", name: "新竹縣", nick: "客家庄與山城：義民廟・北埔金廣福・內灣・賽夏與泰雅", lat: 24.70, lng: 121.12, tip: "right", site: 2, on: true,
      img: "hsinchu-county/img/beipu-jinguangfugongguan-0.webp", credit: "金廣福公館／Ckfhouse，CC BY-SA 4.0",
      desc: "78 處有形文化資產：國定古蹟北埔金廣福公館，還有新埔褒忠亭義民廟與家廟群、北埔慈天宮與姜阿新洋樓、竹北采田福地與六張犁問禮堂、關西太和宮與東安古橋、竹東車站、內灣派出所、尖石 TAPUNG 古堡；另有賽夏族 paSta'ay、義民節祭典、客家八音等 13 項無形文化資產。" },
    { slug: "taoyuan-city", name: "桃園市", nick: "桃仔園：大溪老街・神社・客家庄・泰雅部落", lat: 24.99, lng: 121.20, tip: "top", site: 2, on: true,
      img: "taoyuan-city/img/daxi-litengfangguzhai-0.webp", credit: "李騰芳古宅／Outlookxp，CC BY-SA 4.0",
      desc: "145 處有形文化資產：國定古蹟李騰芳古宅與觀音白沙岬燈塔，大溪老街牌樓店屋、大溪公會堂與武德殿、桃園忠烈祠（原桃園神社）、桃園景福宮、新屋范姜古厝、中壢燃藜第、馬祖新村、角板山與溪口吊橋，還有桃園三層地區陂圳與土牛溝；另有大溪普濟堂關聖帝君聖誕慶典、客家八音、泰雅族口述傳統與織布等 26 項無形文化資產。" },
    { slug: "miaoli-county", name: "苗栗縣", nick: "山城與海線：舊山線・客家庄・白沙屯媽祖・賽夏族", lat: 24.49, lng: 120.95, tip: "left", site: 2, on: true,
      img: "miaoli-county/img/sanyi-yutengpingduanqiao-0.webp", credit: "龍騰斷橋（魚藤坪斷橋）／Encino at Chinese Wikipedia，公有領域",
      desc: "89 處有形文化資產：國定古蹟後龍鄭崇和墓，舊山線勝興車站、龍騰斷橋與內社川、魚藤坪、大安溪鐵橋，還有中港慈裕宮、苗栗文昌祠、出磺坑、南庄郵便局、通霄神社、海線談文與大山車站、後龍外埔石滬群；另有賽夏族 paSta'ay、白沙屯媽祖進香、客家八音、三義木雕等 25 項無形文化資產。" },
    { slug: "new-taipei-city", name: "新北市", nick: "淡水・九份金瓜石・平溪・三峽鶯歌：環繞臺北的山海", lat: 25.24, lng: 121.58, tip: "top", site: 2, on: true,
      img: "new-taipei-city/img/danshui-hongmaocheng-0.webp", credit: "淡水紅毛城／Asimonlee at English Wikipedia，CC BY-SA 3.0",
      desc: "184 處有形文化資產：淡水紅毛城、滬尾礮臺、理學堂大書院、鄞山寺、新莊廣福宮、林本源園邸、蘆洲李宅 7 處國定古蹟，九份金瓜石礦山與太子賓館、平溪菁桐車站、三峽長福巖、鶯歌石、十三行遺址、樂生療養院、景美人權園區；另有平溪天燈、北管、布袋戲、歌仔戲、鶯歌陶藝等 47 項無形文化資產。" },
    { slug: "", name: "臺北市", nick: "大稻埕・艋舺", lat: 25.05, lng: 121.51, site: 2 }
  ];
  /* 各網站的正式網址。兩個網站都用自訂網域（各 repo 的 CNAME）；改網域時改這裡（tools/sites.py 也讀這一行，請保持一行寫完）。
     第一網站自己的縣市仍用相對路徑，行為與以前相同。本機預覽（tools/serve.py）時改用 /Cultural_Heritage/、/Cultural_Heritage2/ */
  var SITES = { 1: "https://cultural.123hi.org/", 2: "https://cultural2.123hi.org/" };
  if (root.location && /^(localhost|127\.0\.0\.1)$/.test(root.location.hostname)) SITES = { 1: "/Cultural_Heritage/", 2: "/Cultural_Heritage2/" };
  /* 放第二網站的縣市（含尚未列在上面的）：清單裡沒寫 site 的縣市依這一行決定。tools/sites.py 也讀這一行與上面的 site 欄位，請保持一行寫完 */
  var SITE2 = ["臺北市", "新北市", "桃園市", "新竹市", "新竹縣", "苗栗縣", "臺中市", "彰化縣", "南投縣"];
  CITIES.forEach(function (c) { if (!c.site) c.site = SITE2.indexOf(c.name) >= 0 ? 2 : 1; });
  /* 縣市頁網址與代表照片。base：從目前頁面回到第一網站根目錄的路徑（入口頁 ""、第一網站縣市頁 "../"、第二網站縣市頁為第一網站的網址） */
  function href(c, base) { return (c.site > 1 ? SITES[c.site] : base || "") + c.slug + "/"; }
  function imgSrc(c, base) { return (c.site > 1 ? SITES[c.site] : base || "") + c.img; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var open = CITIES.filter(function (c) { return c.on; });
  var soon = CITIES.filter(function (c) { return !c.on; });

  /* 依地區分組（縣市一多，單欄清單會超出畫面） */
  var REGIONS = [
    ["北部", ["臺北市", "新北市", "基隆市", "桃園市", "新竹市", "新竹縣", "宜蘭縣"]],
    ["中部", ["苗栗縣", "臺中市", "彰化縣", "南投縣", "雲林縣"]],
    ["南部", ["嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣"]],
    ["東部", ["花蓮縣", "臺東縣"]],
    ["離島", ["澎湖縣", "金門縣", "連江縣"]]
  ];
  function grouped() {
    var used = {};
    var out = REGIONS.map(function (r) {
      var cs = r[1].map(function (n) { return open.filter(function (c) { return c.name === n; })[0]; }).filter(Boolean);
      cs.forEach(function (c) { used[c.slug] = 1; });
      return [r[0], cs];
    });
    var rest = open.filter(function (c) { return !used[c.slug]; });
    if (rest.length) out.push(["其他", rest]);
    return out.filter(function (r) { return r[1].length; });
  }

  /* 縣市頁與入口頁：切換縣市選單（base 為回到網站根目錄的相對路徑，例如 "../"；入口頁 current 為空字串） */
  function cityMenu(el, current, base) {
    if (!el) return;
    el.innerHTML = '<p class="cm-title">' + (current ? "切換縣市" : "選擇縣市") + '（已開放 ' + open.length + ' 個）</p>' +
      grouped().map(function (r) {
        return '<div class="cm-reg"><p class="cm-rname">' + r[0] + '</p><div class="cm-list">' + r[1].map(function (c) {
          var on = c.slug === current;
          return '<a href="' + href(c, base) + '" title="' + esc(c.nick) + '"' + (on ? ' aria-current="page"' : "") + '>' + esc(c.label || c.name) + (on ? '<span>目前</span>' : "") + '</a>';
        }).join("") + '</div></div>';
      }).join("") +
      (soon.length ? '<p class="cm-soon">籌備中：' + soon.map(function (c) { return esc(c.name); }).join("、") + '</p>' : "") +
      (current ? '<a class="cm-home" href="' + base + '">回全站首頁（全部縣市）</a>' : "");
  }

  /* 入口頁：右上角功能表（縣市地圖＋選擇縣市下拉選單） */
  function portalNav(el) {
    if (!el) return;
    el.classList.add("portal-nav");
    el.innerHTML = '<a href="#cities">縣市地圖</a><details class="city-switch portal-switch"><summary>選擇縣市<span class="caret" aria-hidden="true">▾</span></summary><div class="city-menu"></div></details>';
    cityMenu(el.querySelector(".city-menu"), "", "");
  }

  /* 點選單外面時收起 */
  if (root.document) root.document.addEventListener("click", function (e) {
    var d = root.document.querySelector("details.city-switch[open]");
    if (d && !d.contains(e.target)) d.removeAttribute("open");
  });

  root.SiteCities = { list: CITIES, open: open, soon: soon, grouped: grouped, cityMenu: cityMenu, portalNav: portalNav, esc: esc, sites: SITES, href: href, imgSrc: imgSrc };
})(this);
