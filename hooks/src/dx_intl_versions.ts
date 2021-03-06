const versions: Array<Array<string | [string, number]>> = [
  [
    'コネクト',
    'Love or Lies',
    'jelly',
    '美しく燃える森',
    'Love You',
    'come again',
    'Future',
    'ウッーウッーウマウマ(ﾟ∀ﾟ)',
    'NIGHT OF FIRE',
    'マトリョシカ',
    'パンダヒーロー',
    'ワールズエンド・ダンスホール',
    'メランコリック',
    'ZIGG-ZAGG',
    'ルカルカ★ナイトフィーバー',
    'メグメグ☆ファイアーエンドレスナイト',
    '教えて!! 魔法のLyric',
    'Reach For The Stars',
    'City Escape: Act1',
    'Rooftop Run: Act1',
    'Urban Crusher [Remix]',
    'Catch The Future',
    'Crush On You',
    'Sun Dance',
    'In Chaos',
    'Beat Of Mind',
    'JACKY [Remix]',
    '天国と地獄',
    'きみのためなら死ねる',
    '源平大戦絵巻テーマソング',
    '怪盗Rのテーマ',
    'マリアをはげませ',
    'SHOW TIME',
    '檄！帝国華撃団(改)',
    'Sweets×Sweets',
    '虹と太陽',
    'Color My World',
    'True Love Song',
    '炭★坑★節',
    'ネコ日和。',
    'BaBan!! －甘い罠－',
    'オレンジの夏',
    'ジングルベル'
  ],
  [
    'ゴーゴー幽霊船',
    '39',
    '腐れ外道とチョコレゐト',
    'スイートマジック',
    'Sweetiex2',
    'Tell Your World',
    'おちゃめ機能',
    'BAD∞END∞NIGHT',
    'ロミオとシンデレラ',
    'ダンシング☆サムライ',
    'デコボコ体操第二',
    'Space Harrier Main Theme [Reborn]',
    'Quartet Theme [Reborn]',
    'Sky High [Reborn]',
    'Like the Wind [Reborn]',
    'YA･DA･YO [Reborn]',
    'Natural Flow',
    '超絶！Superlative',
    '采配の刻 Power of order',
    'DO RORO DERODERO ON DO RORO',
    '御旗のもとに',
    '地上の戦士',
    'We Gonna Party',
    'Lionheart',
    'Acceleration',
    'FEEL ALIVE',
    'Streak',
    'Spin me harder',
    'Turn around',
    ['Link', 5],
    'Black Out',
    'Fragrance',
    'Nerverakes',
    'Sprintrances',
    "air's gravity",
    'Night Fly',
    'Feel My Fire',
    'Starlight Disco',
    'maimaiちゃんのテーマ',
    'ソーラン☆節',
    '犬日和。',
    'Endless World',
    'ぴぴぱぷぅ！',
    '炎歌 -ほむらうた-',
    "泣き虫O'clock"
  ],
  [
    '君の知らない物語',
    'いーあるふぁんくらぶ',
    '脳漿炸裂ガール',
    'カゲロウデイズ',
    '夜咄ディセイブ',
    '裏表ラバーズ',
    'ローリンガール',
    'モザイクロール',
    '弱虫モンブラン',
    'セツナトリップ',
    '放課後ストライド',
    'I ♥',
    'イアイア★ナイトオブデザイア',
    'トルコ行進曲 - オワタ＼(^o^)／',
    '天ノ弱',
    'ぽっぴっぽー',
    'Nyan Cat EX',
    'Bad Apple!! feat nomico',
    'チルノのパーフェクトさんすう教室',
    '魔理沙は大変なものを盗んでいきました',
    'Grip & Break down !!',
    'しゅわスパ大作戦☆',
    '全人類ノ非想天則',
    'ウサテイ',
    'Help me, ERINNNNNN!!',
    'ナイト・オブ・ナイツ',
    'Save This World νMIX',
    'Living Universe',
    'Ignite Infinity',
    '時空を超えて久しぶり！',
    'Her Dream Is To Be A Fantastic Sorceress',
    'awake',
    'Terminal Storm',
    'Mysterious Destiny',
    'Riders Of The Light',
    'Burning Hearts ～炎のANGEL～',
    'ココロスキャンのうた',
    '円舞曲、君に',
    '神室雪月花',
    'KONNANじゃないっ！',
    'セガサターン起動音[H.][Remix]',
    'DADDY MULK -Groove remix-',
    'Garakuta Doll Play',
    'Blew Moon',
    'Death Scythe',
    'LUCIA',
    "JUMPIN' JUMPIN'",
    "L'épilogue",
    'BREAK YOU!!',
    '記憶、記録',
    'Beat of getting entangled',
    'Cosmic Train',
    'Get Happy',
    'System “Z”',
    'Pixel Voyage',
    'maiム・maiム feat.週刊少年マガジン',
    'みんなのマイマイマー',
    'Backyun! －悪い女－'
  ],
  [
    'バラライカ',
    'POP STAR',
    'YATTA!',
    'からくりピエロ',
    '二息歩行',
    'リリリリ★バーニングナイト',
    '深海少女',
    'M.S.S.Planet',
    "magician's operation",
    'ハロ／ハワユ',
    '林檎華憐歌',
    '患部で止まってすぐ溶ける～狂気の優曇華院',
    'お嫁にしなさいっ！',
    'Endless, Sleepless Night',
    '幻想のサテライト',
    '待チ人ハ来ズ。',
    'sweet little sister',
    '神々の祈り',
    'エピクロスの虹はもう見えない',
    'シアワセうさぎ',
    '最速最高シャッターガール',
    'Jack-the-Ripper◆',
    'DRAGONLADY',
    'Live & Learn',
    'Back 2 Back',
    'Windy Hill -Zone 1',
    'キズナの物語',
    'コトバ・カラフル',
    'かせげ！ジャリンコヒーロー',
    "Outlaw's Lullaby",
    'Brand-new Japanesque',
    '鼓動',
    'レッツゴー!陰陽師',
    'オパ! オパ! RACER -GMT mashup-',
    '電車で電車でOPA!OPA!OPA! -GMT mashup-',
    'リッジでリッジでGO!GO!GO! -GMT mashup-',
    '電車で電車でGO!GO!GO!GC! -GMT remix-',
    'RIDGE RACER STEPS -GMT remix-',
    'ファンタジーゾーン OPA-OPA! -GMT remix-',
    '言ノ葉カルマ',
    'MYTHOS',
    'Life Feels Good',
    'CYCLES',
    'Heartbeats',
    'End of Twilight',
    'Monochrome Rainbow',
    '火炎地獄',
    'Danza zandA',
    'タカハせ！名人マン',
    'ぐるぐるWASH！コインランドリー・ディスコ'
  ],
  [
    'アンハッピーリフレイン',
    '毒占欲',
    'おこちゃま戦争',
    'shake it!',
    'Heart Beats',
    '不毛！',
    'One Step Ahead',
    ['Link', 2],
    '究極焼肉レストラン！お燐の地獄亭！',
    'Cosmic Magic Shooter',
    '明星ロケット',
    '緋色のDance',
    'FLOWER',
    'Scars of FAUNA',
    'きたさいたま2000',
    'Ignis Danse',
    'Got more raves？',
    'FUJIN Rumble',
    'B.B.K.K.B.K.K.',
    'The Great Journey',
    'Caliburne ～Story of the Legendary sword～',
    'Dragoon',
    'oboro',
    'Dreampainter',
    'MIRROR of MAGIC',
    'BETTER CHOICE',
    'planet dancer',
    'ピーマンたべたら',
    'おても☆Yan',
    'VERTeX'
  ],
  [
    '若い力 -SEGA HARD GIRLS MIX-',
    'ウミユリ海底譚',
    '六兆年と一夜物語',
    'ストリーミングハート',
    'ロストワンの号哭',
    '赤心性：カマトト荒療治',
    'みくみくにしてあげる♪【してやんよ】',
    'どうしてこうなった',
    'デッドレッドガールズ',
    '東方スイーツ！～鬼畜姉妹と受難メイド～',
    'キャプテン・ムラサのケツアンカー',
    '響縁',
    'ケロ⑨destiny',
    '四次元跳躍機関',
    'ってゐ！ ～えいえんてゐVer～',
    'Yet Another ”drizzly rain”',
    '最終鬼畜妹・一部声',
    'L9',
    'Our Fighting',
    '悪戯',
    'Axeria',
    'ガラテアの螺旋',
    'Oshama Scramble!',
    'Aiolos',
    'LANCE',
    'D✪N’T  ST✪P  R✪CKIN’',
    'ナミダと流星',
    'welcome to maimai!! with マイマイマー',
    'Change Our MIRAI！'
  ],
  [
    'かくしん的☆めたまるふぉ～ぜっ！',
    'ラブリー☆えんじぇる!!',
    'HIMITSUスパーク',
    '厨病激発ボーイ',
    '頓珍漢の宴',
    'ありふれたせかいせいふく',
    '+♂',
    '初音ミクの消失',
    'イノコリ先生',
    '物凄い勢いでけーねが物凄いうた',
    '囲い無き世は一期の月影',
    '蒼空に舞え、墨染の桜',
    'フラグメンツ -T.V. maimai edit-',
    '橙の幻想郷音頭',
    '願いを呼ぶ季節',
    'YU-MU',
    '少女幻葬戦慄曲 ～ Necro Fantasia',
    'Jimang Shot',
    '東方妖々夢 ～the maximum moving about～',
    'Party 4U ”holy nite mix”',
    'オモイヨシノ',
    'Garden Of The Dragon',
    'After Burner',
    '言ノ葉遊戯',
    'りばーぶ',
    'Revive The Rave',
    'GEMINI -M-',
    'スリップフリップ',
    '7thSense',
    'Glorious Crown',
    'FEEL the BEATS',
    'アージェントシンメトリー',
    'Counselor',
    '閃鋼のブリューナク',
    '幾四音-Ixion-'
  ],
  [
    'シュガーソングとビターステップ',
    'セハガガガンバッちゃう！！',
    'fake!fake!',
    '夏祭り',
    'パーフェクト生命',
    'キミノヨゾラ哨戒班',
    '恋愛裁判',
    'Mr. Wonderland',
    'やめろ！聴くな！',
    'ECHO',
    '東京リアルワールド',
    '木彫り鯰と右肩ゾンビ',
    '月に叢雲華に風',
    'ひれ伏せ愚民どもっ！',
    'No Routine',
    '儚きもの人間',
    'エテルニタス・ルドロジー',
    'METATRON',
    '終わりなき物語',
    '洗脳',
    'Barbed Eye',
    'AMAZING MIGHTYYYY!!!!',
    'CITRUS MONSTER',
    'Hyper Active',
    'Jumble Rumble',
    'Nitrous Fury',
    'Contrapasso -paradiso-',
    'connecting with you',
    '高気圧ねこロック',
    'Prophesy One',
    '無敵We are one!!',
    'ハート・ビート',
    'brilliant better',
    'Infantoon Fantasy',
    'Invitation'
  ],
  [
    'きらっせ☆ウッド村ファーム',
    'ポップミュージックは僕のもの',
    'チュルリラ・チュルリラ・ダッダッダ！',
    'だんだん早くなる',
    'ゴーストルール',
    '吉原ラメント',
    '生きてるおばけは生きている',
    '踊れオーケストラ',
    'ネトゲ廃人シュプレヒコール',
    'StargazeR',
    'すーぱーぬこになりたい',
    '色は匂へど散りぬるを',
    'taboo tears you up',
    'Starlight Vision',
    '幽闇に目醒めしは',
    'Club Ibuki in Break All',
    'Scream out! -maimai SONIC WASHER Edit-',
    'Phantasm Brigade',
    '夜明けまであと３秒',
    'conflict',
    'GOODMEN',
    'Sakura Fubuki',
    'STAIRWAY TO GENERATION',
    'Last Brave ～ Go to zero',
    '空威張りビヘイビア',
    '分からない',
    'いっしそう電☆舞舞神拳！',
    'Panopticon',
    '四月の雨',
    'ねぇ、壊れタ人形ハ何処へ棄テらレるノ？',
    'Imitation:Loud Lounge',
    'HERA',
    'Selector',
    '天火明命',
    'Lividi',
    'Our Wrenally',
    'ドキドキDREAM!!!',
    'フォルテシモBELL',
    'DETARAME ROCK&ROLL THEORY',
    '私の中の幻想的世界観及びその顕現を想起させたある現実での出来事に関する一考察',
    'その群青が愛しかったようだった',
    'The wheel to the right'
  ],
  [
    '前前前世',
    '真・ハンサム体操でズンドコホイ',
    'GET!! 夢&DREAM',
    '日本の米は世界一',
    'エイリアンエイリアン',
    '白ゆき',
    'リンカーネイション',
    'フラジール',
    'ラブチーノ',
    '幸せになれる隠しコマンドがあるらしい',
    '名探偵連続殺人事件',
    'ARROW',
    'ヘルシーエンド',
    'ないせんのうた',
    'バッド・ダンス・ホール',
    '華鳥風月',
    '宿題が終わらないっ！',
    'オーディエンスを沸かす程度の能力 feat.タイツォン',
    'チルノのパーフェクトさんすう教室　⑨周年バージョン',
    'Starlight Dance Floor',
    '妖精村の月誕祭 ～Lunate Elf',
    'Calamity Fortune',
    'GO BACK 2 YOUR RAVE',
    '人里に下ったアタイがいつの間にか社畜になっていた件',
    'Maxi',
    'KISS CANDY FLAVOR',
    '天国と地獄 -言ノ葉リンネ-',
    '相思創愛',
    'デスパレイト',
    'Moon of Noon',
    'Ultranova',
    '曖昧mind',
    'Limit Break',
    'オトヒメモリー☆ウタゲーション',
    '夢花火',
    'KING is BACK!!',
    'ユビキリ',
    '猛進ソリストライフ！',
    'My Dearest Song',
    '光線チューニング',
    '心象蜃気楼'
  ],
  [
    'ミラクル・ショッピング',
    'REVIVER オルタンシア・サーガ -蒼の騎士団- オリジナルVer.',
    'ダンスロボットダンス',
    '拝啓ドッペルゲンガー',
    '人生リセットボタン',
    'バレリーコ',
    'アウターサイエンス',
    '砂の惑星 feat. HATSUNE MIKU',
    'ドーナツホール',
    'アンノウン・マザーグース',
    'フリィダム ロリィタ',
    'しねばいいのに',
    'キレキャリオン',
    'ドクハク',
    'アルカリレットウセイ',
    '共感覚おばけ',
    'ナンセンス文学',
    'シャルル',
    'WARNING×WARNING×WARNING',
    '泡沫、哀のまほろば',
    'Doll Judgment',
    '永遠のメロディ',
    'もうみんなしねばいいのに',
    '天狗の落とし文 feat. ｙｔｒ',
    '疾走あんさんぶる',
    'Credits',
    'MilK',
    '麒麟',
    '咲キ誇レ常世ノ華',
    'Excalibur ～Revived resolution～',
    'Justified',
    'Mare Maris',
    'Candy Tall Woman',
    'Kinda Way',
    'Signature',
    'Magical Flavor',
    'SPILL OVER COLORS',
    'Still',
    'SPICY SWINGY STYLE',
    'Bang Babang Bang!!!',
    'Tic Tac DREAMIN’',
    '猫祭り',
    'TRUST',
    'エンドマークに希望と涙を添えて'
  ],
  [
    'にめんせい☆ウラオモテライフ！',
    'うまるん体操',
    'にじよめちゃん体操第一億',
    'Rodeo Machine',
    'Arrival of Tears',
    'ジンギスカン',
    '彗星ハネムーン',
    'Seyana. ～何でも言うことを聞いてくれるアカネチャン～',
    'インビジブル',
    'フィクサー',
    '妄想感傷代償連盟',
    'ヒビカセ',
    'このピアノでお前を8759632145回ぶん殴る',
    '初音ミクの激唱',
    'はやくそれになりたい！',
    'Ievan Polkka',
    'おねがいダーリン',
    'CYBER Sparks',
    'LOVE EAST',
    '進捗どうですか？',
    'アマノジャクリバース feat. ｙｔｒ',
    'INFINITE WORLD',
    'みんなの',
    'サドマミホリック',
    '進め！イッスン軍団 -Rebellion of the Dwarfs-',
    'ENERGY SYNERGY MATRIX',
    'FREEDOM DiVE (tpz Overcute Remix)',
    'Brain Power',
    'ULTRA B+K',
    "Let's Go Away",
    'Conquista Ciela',
    'Fist Bump',
    'SILENT BLUE',
    '花と、雪と、ドラムンベース。',
    'Ragnarok',
    'larva',
    'keep hopping',
    'FestivaLight',
    'Session High⤴',
    'あねぺったん',
    'なるとなぎのパーフェクトロックンロール教室',
    'Help me, あーりん！',
    'World Vanquisher',
    'Xevel',
    'We Gonna Journey',
    'My First Phone',
    '怒槌'
  ],
  [
    'ネ！コ！',
    'SHINY DAYS',
    'only my railgun',
    'ラブって♡ジュエリー♪えんじぇる☆ブレイク！！',
    'true my heart -Lovable mix-',
    '敗北の少年',
    '命ばっかり',
    'ロキ',
    "WORLD'S END UMBRELLA",
    '結ンデ開イテ羅刹ト骸',
    'ヒバナ',
    'ワンダーラスト',
    '終点',
    'ナイトメア☆パーティーナイト',
    'ロールプレイングゲーム',
    '立ち入り禁止',
    'お気に召すまま',
    'Money Money',
    'ネクロファンタジア～Arr.Demetori',
    '【東方ニコカラ】秘神マターラ feat.魂音泉【IOSYS】',
    '不思議の国のクリスマス',
    'White Traveling Girl',
    '隠然',
    'クレイジークレイジーダンサーズ',
    '最終鬼畜妹フランドール・S',
    'Imperishable Night 2006 (2016 Refine)',
    '極圏',
    'セイクリッド　ルイン',
    'Scarlet Lance',
    'End Time',
    'Altale',
    'L4TS:2018 (feat. あひる & KTA)',
    'B.M.S.',
    '魔法少女になるしかねぇ',
    'EVERGREEN',
    'Good Bye, Mr. Jack',
    '雷切-RAIKIRI-',
    'FFT',
    'Alea jacta est!',
    'PANDORA PARADOXXX',
    'the EmpErroR',
    'QZKago Requiem',
    'Schwarzschild',
    'ENJOY POLIS',
    'Believe the Rainbow',
    '奏者はただ背中と提琴で語るのみ',
    'イロトリドリのメロディ',
    '-OutsideR:RequieM-',
    'TiamaT:F minor',
    'Kattobi KEIKYU Rider'
  ],
  [
    'LOSER',
    'U.S.A.',
    '新宝島',
    'HOT LIMIT',
    'シュガーソングとビターステップ',
    'かくしん的☆めたまるふぉ～ぜっ！',
    'デビル☆アイドル',
    'だれかの心臓になれたなら',
    'グリーンライツ・セレナーデ',
    'METEOR',
    'だからパンを焼いたんだ',
    '太陽系デスコ',
    'アカリがやってきたぞっ',
    '幾望の月',
    'イカサマライフゲイム',
    '六兆年と一夜物語',
    'サヨナラチェーンソー',
    '39みゅーじっく！',
    'いーあるふぁんくらぶ',
    '脳漿炸裂ガール',
    'アディショナルメモリー',
    '39',
    'ジャガーノート',
    'メルティランドナイトメア',
    'メルト',
    'デンパラダイム',
    '骸骨楽団とリリア',
    '星屑ユートピア',
    'アマツキツネ',
    'Strobe♡Girl',
    'quiet room',
    'CocktaiL',
    'アウトサイダー',
    'シャルル',
    'WARNING×WARNING×WARNING',
    '月に叢雲華に風',
    'チルノのパーフェクトさんすう教室　⑨周年バージョン',
    '患部で止まってすぐ溶ける～狂気の優曇華院',
    'げきオコスティックファイナリアリティぷんぷんマスタースパーク',
    'Scream out! -maimai SONIC WASHER Edit-',
    '幻想のサテライト',
    'ナイト・オブ・ナイツ (Cranky Remix)',
    'Little "Sister" Bitch',
    'Yakumo >>JOINT STRUGGLE (2019 Update)',
    'Calamity Fortune',
    'プナイプナイせんそう',
    'Halcyon',
    'サンバランド',
    'Destr0yer',
    'ENERGY SYNERGY MATRIX',
    'conflict',
    'Secret Sleuth',
    'BLACK ROSE',
    'アポカリプスに反逆の焔を焚べろ',
    'TEmPTaTiON',
    'Now or Never',
    '福宿音屋魂音泉',
    'キリキリ舞Mine',
    '一か罰',
    '♡マイマイマイラブ♡',
    'Blows Up Everything',
    'TwisteD! XD',
    '魔ジョ狩リ',
    'Technicians High',
    'Scarlet Wings',
    'STEREOSCAPE',
    'Crazy Circle',
    'バーチャルダム　ネーション',
    'MAXRAGE',
    'P-qoq',
    '超常マイマイン',
    'でらっくmaimai♪てんてこまい!',
    'Oshama Scramble!',
    'STARTLINER',
    'Jump!! Jump!! Jump!!',
    'Titania',
    'Change Our MIRAI！',
    'Agitation！',
    '管弦楽組曲 第3番 ニ長調「第2曲（G線上のアリア）」BWV.1068-2',
    '玩具狂奏曲 -終焉-',
    'BOKUTO',
    '立川浄穢捕物帳'
  ],
  [
    'だから僕は音楽を辞めた',
    '馬と鹿',
    'いつかいい感じにアレしよう',
    'ラブ・ドラマティック feat. 伊原六花',
    '青空のラプソディ',
    'ハム太郎とっとこうた',
    '六厘歌',
    '君の知らない物語',
    'コネクト',
    'Catch the Wave',
    'バイオレンストリガー',
    'クレイジー・ビート',
    'グラーヴェ',
    'KILLER B',
    'アンドロイドガール',
    'スロウダウナー',
    'ビターチョコデコレーション',
    'スターリースカイ☆パレード',
    '全力ハッピーライフ',
    'wheel',
    'Drive Your Fire',
    'Oath Act',
    'Witches night',
    'ソリッド',
    'Bad Apple!! feat.nomico (REDALiCE Remix)',
    'Entrance',
    'Lunar Mare',
    'Saika',
    'CHAOS',
    'Maboroshi',
    'アトロポスと最果の探究者',
    'energy trixxx',
    'NULCTRL',
    'Black Lair',
    'ワードワードワード',
    'ヤミツキ',
    '渦状銀河のシンフォニエッタ',
    'GRÄNDIR',
    '封焔の135秒',
    'Ututu',
    '共鳴',
    'My My My',
    'Stardust Memories',
    'ブレインジャックシンドローム',
    'シエルブルーマルシェ',
    'Flashkick',
    'STEEL TRANSONIC',
    'Valsqotch',
    'UniTas',
    'モ°ルモ°ル',
    'ここからはじまるプロローグ。',
    '絡めトリック利己ライザー',
    '宛城、炎上！！',
    'BATTLE NO.1',
    'ウマイネームイズうまみちゃん',
    'すーぱーぬこになれんかった',
    'アスヘノBRAVE',
    '深海シティアンダーグラウンド',
    '表裏一体',
    'CHOCOLATE BOMB!!!!',
    'はちみつアドベンチャー',
    'popcorn',
    '最強 the サマータイム!!!!!',
    'UTAKATA',
    'タテマエと本心の大乱闘'
  ]
]

export default versions
