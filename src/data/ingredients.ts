import type { Ingredient, IngredientCategory, Lang } from '../types';

/**
 * Ingredients commonly found in typical Japanese supermarkets
 * (Aeon, Life, Seiyu, Gyomu Super). Prices are typical 2026 regular prices
 * (tax-inclusive, approximate) for one pack.
 *
 * Row format: [id, ja, en, priceYen, packAmount, unit, gramsPerPiece?]
 * gramsPerPiece is used by cost estimation when a recipe gives g/ml for an
 * item sold by the piece, or pieces for an item sold by weight.
 */
type Row = [string, string, string, number, number, Ingredient['unit'], number?];

const VEGETABLE: Row[] = [
  ['moyashi', 'もやし', 'Bean sprouts', 40, 200, 'g'],
  ['cabbage', 'キャベツ', 'Cabbage', 250, 1, 'piece', 1200],
  ['cabbage_half', 'キャベツ（1/2玉）', 'Cabbage (half)', 150, 600, 'g'],
  ['onion', '玉ねぎ', 'Onion', 298, 3, 'piece', 200],
  ['carrot', '人参', 'Carrot', 198, 3, 'piece', 150],
  ['potato', 'じゃがいも', 'Potato', 298, 4, 'piece', 130],
  ['sweet_potato', 'さつまいも', 'Sweet potato', 198, 1, 'piece', 250],
  ['taro', '里芋', 'Taro', 298, 400, 'g', 50],
  ['daikon', '大根', 'Daikon radish', 198, 1, 'piece', 1000],
  ['daikon_half', '大根（1/2本）', 'Daikon radish (half)', 120, 500, 'g'],
  ['hakusai', '白菜（1/4株）', 'Napa cabbage (quarter)', 150, 600, 'g'],
  ['negi', '長ねぎ', 'Japanese leek (negi)', 198, 2, 'piece', 100],
  ['green_onion', '小ねぎ', 'Green onion', 128, 100, 'g'],
  ['nira', 'ニラ', 'Garlic chives (nira)', 128, 100, 'g'],
  ['spinach', 'ほうれん草', 'Spinach', 198, 200, 'g'],
  ['komatsuna', '小松菜', 'Komatsuna', 148, 200, 'g'],
  ['mizuna', '水菜', 'Mizuna', 128, 150, 'g'],
  ['chingensai', 'チンゲン菜', 'Bok choy', 148, 2, 'piece', 100],
  ['lettuce', 'レタス', 'Lettuce', 198, 1, 'piece', 400],
  ['broccoli', 'ブロッコリー', 'Broccoli', 248, 1, 'piece', 250],
  ['cucumber', 'きゅうり', 'Cucumber', 178, 3, 'piece', 100],
  ['tomato', 'トマト', 'Tomato', 298, 3, 'piece', 150],
  ['cherry_tomato', 'ミニトマト', 'Cherry tomatoes', 248, 200, 'g', 12],
  ['eggplant', 'なす', 'Eggplant', 198, 3, 'piece', 80],
  ['green_pepper', 'ピーマン', 'Green pepper', 158, 5, 'piece', 35],
  ['paprika', 'パプリカ', 'Bell pepper (paprika)', 158, 1, 'piece', 150],
  ['kabocha', 'かぼちゃ（1/4個）', 'Kabocha squash (quarter)', 198, 400, 'g'],
  ['zucchini', 'ズッキーニ', 'Zucchini', 158, 1, 'piece', 200],
  ['okra', 'オクラ', 'Okra', 158, 100, 'g', 10],
  ['gobo', 'ごぼう', 'Burdock root', 198, 1, 'piece', 150],
  ['renkon', 'れんこん', 'Lotus root', 298, 200, 'g'],
  ['corn', 'とうもろこし', 'Corn on the cob', 198, 1, 'piece', 300],
  ['edamame', '枝豆', 'Edamame', 298, 250, 'g'],
  ['snow_peas', '絹さや', 'Snow peas', 158, 50, 'g'],
  ['green_beans', 'いんげん', 'Green beans', 198, 100, 'g'],
  ['asparagus', 'アスパラガス', 'Asparagus', 298, 100, 'g', 20],
  ['shiso', '大葉', 'Shiso leaves', 98, 10, 'piece', 1],
  ['myoga', 'みょうが', 'Myoga ginger', 198, 3, 'piece', 15],
  ['ginger', '生姜', 'Ginger', 158, 100, 'g', 20],
  ['garlic', 'にんにく', 'Garlic', 198, 1, 'piece', 50],
  ['kaiware', 'かいわれ大根', 'Daikon sprouts', 68, 1, 'piece', 50],
  ['toumyou', '豆苗', 'Pea shoots (toumyou)', 98, 1, 'piece', 100],
  ['celery', 'セロリ', 'Celery', 158, 1, 'piece', 100],
  ['avocado', 'アボカド', 'Avocado', 158, 1, 'piece', 150],
  ['shungiku', '春菊', 'Garland chrysanthemum', 198, 150, 'g'],
  ['lemon', 'レモン', 'Lemon', 128, 1, 'piece', 100],
  ['banana', 'バナナ', 'Banana', 198, 4, 'piece', 100],
  ['apple', 'りんご', 'Apple', 198, 1, 'piece', 300],
];

const MUSHROOM: Row[] = [
  ['shimeji', 'しめじ', 'Shimeji mushrooms', 98, 100, 'g'],
  ['enoki', 'えのき', 'Enoki mushrooms', 88, 200, 'g'],
  ['maitake', '舞茸', 'Maitake mushrooms', 128, 100, 'g'],
  ['shiitake', '生しいたけ', 'Shiitake mushrooms', 198, 6, 'piece', 15],
  ['eringi', 'エリンギ', 'King oyster mushrooms', 128, 100, 'g'],
  ['nameko', 'なめこ', 'Nameko mushrooms', 98, 100, 'g'],
  ['mushroom', 'マッシュルーム', 'Button mushrooms', 198, 100, 'g', 15],
  ['dried_shiitake', '干ししいたけ', 'Dried shiitake', 398, 30, 'g', 3],
];

const MEAT: Row[] = [
  ['chicken_breast', '鶏むね肉', 'Chicken breast', 400, 400, 'g'],
  ['chicken_thigh', '鶏もも肉', 'Chicken thigh', 548, 400, 'g'],
  ['chicken_tender', '鶏ささみ', 'Chicken tenderloin', 398, 300, 'g', 50],
  ['chicken_wing', '手羽元', 'Chicken drumettes', 398, 500, 'g', 60],
  ['chicken_tebasaki', '手羽先', 'Chicken wings', 398, 400, 'g', 55],
  ['chicken_minced', '鶏ひき肉', 'Ground chicken', 298, 250, 'g'],
  ['chicken_liver', '鶏レバー', 'Chicken liver', 198, 250, 'g'],
  ['chicken_gizzard', '砂肝', 'Chicken gizzard', 248, 200, 'g'],
  ['pork_koma', '豚こま切れ肉', 'Pork scraps (koma)', 398, 300, 'g'],
  ['pork_bara', '豚バラ薄切り', 'Sliced pork belly', 498, 250, 'g'],
  ['pork_loin', '豚ロース薄切り', 'Sliced pork loin', 448, 250, 'g'],
  ['pork_shoulder', '豚肩ロース（ブロック）', 'Pork shoulder (block)', 598, 300, 'g'],
  ['pork_tonkatsu', '豚ロース（とんかつ用）', 'Pork loin cutlet', 498, 2, 'piece', 120],
  ['pork_minced', '豚ひき肉', 'Ground pork', 348, 250, 'g'],
  ['mixed_minced', '合いびき肉', 'Ground beef & pork', 398, 250, 'g'],
  ['beef_koma', '牛こま切れ肉', 'Beef scraps (koma)', 548, 250, 'g'],
  ['beef_sliced', '牛バラ薄切り', 'Sliced beef belly', 598, 200, 'g'],
  ['ham', 'ロースハム', 'Sliced ham', 198, 4, 'piece', 10],
  ['bacon', 'ベーコン', 'Bacon', 248, 80, 'g', 10],
  ['sausage', 'ウインナー', 'Wiener sausages', 298, 180, 'g', 20],
  ['salami', 'サラミ', 'Salami', 248, 60, 'g'],
  ['frozen_karaage', '冷凍唐揚げ', 'Frozen fried chicken', 498, 500, 'g', 25],
];

const SEAFOOD: Row[] = [
  ['salmon', '生鮭（切り身）', 'Salmon fillet', 398, 2, 'piece', 80],
  ['salted_salmon', '塩鮭（切り身）', 'Salted salmon fillet', 398, 3, 'piece', 70],
  ['saba', 'さば（切り身）', 'Mackerel fillet', 298, 2, 'piece', 80],
  ['aji', 'あじ（開き）', 'Horse mackerel (butterflied)', 298, 2, 'piece', 80],
  ['sanma', 'さんま', 'Pacific saury', 198, 1, 'piece', 130],
  ['buri', 'ぶり（切り身）', 'Yellowtail fillet', 498, 2, 'piece', 90],
  ['tara', 'たら（切り身）', 'Cod fillet', 398, 2, 'piece', 80],
  ['maguro', 'まぐろ（刺身用）', 'Tuna sashimi', 498, 100, 'g'],
  ['katsuo', 'かつおのたたき', 'Seared bonito', 498, 200, 'g'],
  ['shrimp_frozen', '冷凍むきえび', 'Frozen peeled shrimp', 498, 200, 'g', 8],
  ['squid', 'いか', 'Squid', 398, 1, 'piece', 250],
  ['asari', 'あさり', 'Manila clams', 398, 250, 'g'],
  ['shirasu', 'しらす', 'Whitebait (shirasu)', 298, 50, 'g'],
  ['tarako', 'たらこ', 'Cod roe', 398, 60, 'g', 30],
  ['mentaiko', '明太子', 'Spicy cod roe', 498, 80, 'g', 40],
  ['chikuwa', 'ちくわ', 'Chikuwa fish cake', 98, 5, 'piece', 25],
  ['kamaboko', 'かまぼこ', 'Kamaboko fish cake', 198, 1, 'piece', 150],
  ['satsuma_age', 'さつま揚げ', 'Fried fish cake', 198, 5, 'piece', 30],
  ['hanpen', 'はんぺん', 'Hanpen fish cake', 128, 1, 'piece', 100],
  ['kanikama', 'カニカマ', 'Imitation crab', 128, 6, 'piece', 12],
  ['tuna_can', 'ツナ缶', 'Canned tuna', 148, 70, 'g'],
  ['saba_can', 'さば水煮缶', 'Canned mackerel', 198, 190, 'g'],
  ['saba_miso_can', 'さば味噌煮缶', 'Canned mackerel in miso', 198, 190, 'g'],
  ['sardine_can', 'いわし缶', 'Canned sardines', 168, 100, 'g'],
  ['wakame_dried', '乾燥わかめ', 'Dried wakame', 198, 30, 'g'],
  ['hijiki', '乾燥ひじき', 'Dried hijiki', 198, 30, 'g'],
  ['nori', '焼きのり', 'Toasted nori', 398, 10, 'piece', 3],
  ['kizami_nori', 'きざみのり', 'Shredded nori', 198, 10, 'g'],
  ['katsuobushi', 'かつお節', 'Bonito flakes', 248, 20, 'g'],
  ['kombu', '昆布', 'Kombu', 298, 50, 'g'],
  ['sakura_ebi', '桜えび', 'Dried sakura shrimp', 298, 10, 'g'],
  ['mozuku', 'もずく酢', 'Mozuku seaweed', 128, 3, 'piece', 70],
];

const EGG_DAIRY: Row[] = [
  ['egg', '卵', 'Egg', 268, 10, 'piece', 60],
  ['quail_egg', 'うずらの卵（水煮）', 'Boiled quail eggs', 128, 10, 'piece', 10],
  ['milk', '牛乳', 'Milk', 248, 1000, 'ml'],
  ['butter', 'バター', 'Butter', 448, 200, 'g'],
  ['margarine', 'マーガリン', 'Margarine', 248, 300, 'g'],
  ['yogurt', 'プレーンヨーグルト', 'Plain yogurt', 178, 400, 'g'],
  ['sliced_cheese', 'スライスチーズ', 'Sliced cheese', 228, 7, 'piece', 18],
  ['pizza_cheese', 'ピザ用チーズ', 'Shredded cheese', 398, 200, 'g'],
  ['cream_cheese', 'クリームチーズ', 'Cream cheese', 298, 200, 'g'],
  ['powdered_cheese', '粉チーズ', 'Grated parmesan', 398, 80, 'g'],
  ['processed_cheese', '6Pチーズ', 'Processed cheese wedges', 248, 6, 'piece', 16],
  ['fresh_cream', '生クリーム', 'Fresh cream', 298, 200, 'ml'],
];

const TOFU_SOY: Row[] = [
  ['tofu_momen', '木綿豆腐', 'Firm tofu', 68, 300, 'g'],
  ['tofu_kinu', '絹ごし豆腐', 'Silken tofu', 68, 300, 'g'],
  ['tofu_mini', '豆腐（3個パック）', 'Tofu (3 mini packs)', 98, 3, 'piece', 150],
  ['natto', '納豆', 'Natto', 98, 3, 'piece', 45],
  ['atsuage', '厚揚げ', 'Thick fried tofu', 98, 2, 'piece', 130],
  ['aburaage', '油揚げ', 'Thin fried tofu', 98, 3, 'piece', 25],
  ['ganmodoki', 'がんもどき', 'Ganmodoki', 128, 4, 'piece', 30],
  ['koya_tofu', '高野豆腐', 'Freeze-dried tofu', 198, 6, 'piece', 16],
  ['soy_milk', '豆乳', 'Soy milk', 228, 1000, 'ml'],
  ['okara', 'おから', 'Okara', 98, 300, 'g'],
  ['soybeans_boiled', '大豆水煮', 'Boiled soybeans', 128, 120, 'g'],
  ['chickpeas', 'ひよこ豆（水煮）', 'Boiled chickpeas', 148, 110, 'g'],
  ['yuba', '湯葉', 'Tofu skin (yuba)', 298, 100, 'g'],
];

const GRAIN_NOODLE: Row[] = [
  ['rice', '米', 'Rice', 3980, 5000, 'g'],
  ['packed_rice', 'パックご飯', 'Microwave rice', 498, 3, 'piece', 200],
  ['frozen_udon', '冷凍うどん', 'Frozen udon', 248, 5, 'piece', 200],
  ['boiled_udon', 'ゆでうどん', 'Boiled udon', 38, 1, 'piece', 200],
  ['soba_dried', '乾麺そば', 'Dried soba', 198, 270, 'g'],
  ['somen', 'そうめん', 'Somen noodles', 198, 300, 'g'],
  ['spaghetti', 'スパゲッティ', 'Spaghetti', 298, 600, 'g'],
  ['macaroni', 'マカロニ', 'Macaroni', 148, 150, 'g'],
  ['yakisoba', '焼きそば麺（3食）', 'Yakisoba noodles (3 servings)', 158, 3, 'piece', 150],
  ['ramen_fresh', '生ラーメン（2食）', 'Fresh ramen (2 servings)', 198, 2, 'piece', 120],
  ['instant_ramen', '袋麺（5食）', 'Instant ramen (5-pack)', 498, 5, 'piece', 100],
  ['harusame', '春雨', 'Glass noodles', 158, 100, 'g'],
  ['bread', '食パン', 'Sliced bread', 178, 6, 'piece', 60],
  ['roll_bread', 'ロールパン', 'Bread rolls', 178, 6, 'piece', 30],
  ['flour', '薄力粉', 'Flour', 228, 1000, 'g'],
  ['katakuriko', '片栗粉', 'Potato starch', 198, 400, 'g'],
  ['panko', 'パン粉', 'Panko breadcrumbs', 128, 200, 'g'],
  ['tempura_flour', '天ぷら粉', 'Tempura flour', 198, 450, 'g'],
  ['okonomiyaki_flour', 'お好み焼き粉', 'Okonomiyaki flour', 248, 500, 'g'],
  ['hotcake_mix', 'ホットケーキミックス', 'Pancake mix', 298, 600, 'g'],
  ['mochi', '切り餅', 'Rice cakes (mochi)', 598, 1000, 'g', 50],
  ['oatmeal', 'オートミール', 'Oatmeal', 398, 300, 'g'],
  ['gyoza_skin', '餃子の皮', 'Gyoza wrappers', 98, 24, 'piece', 6],
  ['wonton_skin', 'ワンタンの皮', 'Wonton wrappers', 98, 30, 'piece', 4],
  ['tortilla', 'トルティーヤ', 'Tortillas', 298, 6, 'piece', 40],
  ['frozen_pizza_dough', 'ピザクラスト', 'Pizza crust', 298, 2, 'piece', 100],
];

const SEASONING: Row[] = [
  ['soy_sauce', '醤油', 'Soy sauce', 298, 1000, 'ml'],
  ['salt', '塩', 'Salt', 128, 1000, 'g'],
  ['sugar', '砂糖', 'Sugar', 248, 1000, 'g'],
  ['mirin', 'みりん', 'Mirin', 298, 1000, 'ml'],
  ['sake', '料理酒', 'Cooking sake', 248, 1000, 'ml'],
  ['miso', '味噌', 'Miso', 348, 750, 'g'],
  ['vinegar', '酢', 'Rice vinegar', 198, 500, 'ml'],
  ['salad_oil', 'サラダ油', 'Vegetable oil', 398, 1000, 'ml'],
  ['sesame_oil', 'ごま油', 'Sesame oil', 348, 300, 'ml'],
  ['olive_oil', 'オリーブオイル', 'Olive oil', 598, 400, 'ml'],
  ['dashi_granules', '和風だし（顆粒）', 'Dashi granules', 348, 120, 'g'],
  ['chicken_stock', '鶏がらスープの素', 'Chicken stock powder', 298, 120, 'g'],
  ['consomme', 'コンソメ', 'Consomme cubes', 248, 21, 'piece', 5],
  ['pepper', 'こしょう', 'Black pepper', 198, 50, 'g'],
  ['salt_pepper', '塩こしょう', 'Salt & pepper mix', 158, 250, 'g'],
  ['mayonnaise', 'マヨネーズ', 'Mayonnaise', 298, 450, 'g'],
  ['ketchup', 'ケチャップ', 'Ketchup', 248, 500, 'g'],
  ['mentsuyu', 'めんつゆ', 'Noodle soup base (mentsuyu)', 348, 1000, 'ml'],
  ['ponzu', 'ポン酢', 'Ponzu', 278, 360, 'ml'],
  ['sauce_chuno', '中濃ソース', 'Tonkatsu-style sauce', 248, 500, 'ml'],
  ['worcestershire', 'ウスターソース', 'Worcestershire sauce', 248, 500, 'ml'],
  ['oyster_sauce', 'オイスターソース', 'Oyster sauce', 298, 220, 'g'],
  ['tobanjan', '豆板醤', 'Chili bean paste (doubanjiang)', 248, 90, 'g'],
  ['tianmianjiang', '甜麺醤', 'Sweet bean sauce', 248, 90, 'g'],
  ['gochujang', 'コチュジャン', 'Gochujang', 298, 170, 'g'],
  ['tube_ginger', 'チューブ生姜', 'Ginger paste (tube)', 148, 40, 'g'],
  ['tube_garlic', 'チューブにんにく', 'Garlic paste (tube)', 148, 40, 'g'],
  ['tube_wasabi', 'チューブわさび', 'Wasabi paste (tube)', 148, 43, 'g'],
  ['karashi', 'チューブからし', 'Mustard paste (tube)', 148, 43, 'g'],
  ['ichimi', '一味唐辛子', 'Chili flakes (ichimi)', 148, 15, 'g'],
  ['shichimi', '七味唐辛子', 'Seven-spice (shichimi)', 148, 15, 'g'],
  ['sesame_seeds', '白いりごま', 'Toasted sesame seeds', 148, 80, 'g'],
  ['curry_roux', 'カレールウ', 'Curry roux', 248, 200, 'g'],
  ['curry_powder', 'カレー粉', 'Curry powder', 248, 35, 'g'],
  ['stew_roux', 'シチュールウ', 'Cream stew roux', 248, 180, 'g'],
  ['yakiniku_sauce', '焼肉のたれ', 'Yakiniku sauce', 298, 400, 'g'],
  ['sukiyaki_sauce', 'すき焼きのたれ', 'Sukiyaki sauce', 298, 500, 'ml'],
  ['shio_koji', '塩麹', 'Salt koji', 298, 200, 'g'],
  ['honey', 'はちみつ', 'Honey', 498, 300, 'g'],
  ['tomato_can', 'カットトマト缶', 'Canned chopped tomatoes', 128, 400, 'g'],
  ['tomato_paste', 'トマトペースト', 'Tomato paste', 198, 18, 'g'],
  ['shiro_dashi', '白だし', 'Shiro dashi', 398, 500, 'ml'],
  ['ume_paste', '練り梅', 'Plum paste', 198, 40, 'g'],
  ['umeboshi', '梅干し', 'Pickled plum (umeboshi)', 398, 10, 'piece', 10],
  ['kimchi', 'キムチ', 'Kimchi', 248, 300, 'g'],
  ['tenkasu', '天かす', 'Tempura bits (tenkasu)', 98, 60, 'g'],
  ['aonori', '青のり', 'Green laver flakes', 198, 3, 'g'],
  ['furikake', 'ふりかけ', 'Furikake', 158, 30, 'g'],
  ['dried_basil', '乾燥バジル', 'Dried basil', 198, 5, 'g'],
  ['chili_pepper', '赤唐辛子', 'Dried red chili', 148, 10, 'g'],
  ['mapo_tofu_mix', '麻婆豆腐の素', 'Mapo tofu sauce mix', 198, 3, 'piece', 50],
  ['ramen_soup', 'ラーメンスープ', 'Ramen soup base', 198, 3, 'piece', 40],
];

const OTHER: Row[] = [
  ['konnyaku', 'こんにゃく', 'Konjac', 98, 250, 'g'],
  ['shirataki', 'しらたき', 'Shirataki noodles', 98, 200, 'g'],
  ['frozen_mixed_veg', '冷凍ミックスベジタブル', 'Frozen mixed vegetables', 198, 300, 'g'],
  ['frozen_spinach', '冷凍ほうれん草', 'Frozen spinach', 198, 250, 'g'],
  ['frozen_broccoli', '冷凍ブロッコリー', 'Frozen broccoli', 248, 300, 'g'],
  ['frozen_gyoza', '冷凍餃子', 'Frozen gyoza', 298, 12, 'piece', 20],
  ['frozen_edamame', '冷凍枝豆', 'Frozen edamame', 248, 400, 'g'],
  ['frozen_kabocha', '冷凍かぼちゃ', 'Frozen kabocha', 198, 400, 'g'],
  ['frozen_seafood_mix', '冷凍シーフードミックス', 'Frozen seafood mix', 498, 300, 'g'],
  ['corn_can', 'コーン缶', 'Canned corn', 128, 190, 'g'],
  ['nabe_soup', '鍋つゆ', 'Hot pot soup base', 298, 750, 'ml'],
  ['menma', 'メンマ', 'Seasoned bamboo shoots', 158, 100, 'g'],
  ['bamboo_shoot', 'たけのこ水煮', 'Boiled bamboo shoots', 198, 150, 'g'],
  ['zha_cai', 'ザーサイ', 'Pickled mustard tuber', 128, 100, 'g'],
  ['takuan', 'たくあん', 'Pickled daikon (takuan)', 158, 200, 'g'],
  ['beni_shoga', '紅しょうが', 'Pickled red ginger', 98, 60, 'g'],
  ['kiriboshi_daikon', '切り干し大根', 'Dried shredded daikon', 158, 50, 'g'],
  ['fu', '麩', 'Wheat gluten (fu)', 128, 30, 'g'],
  ['agedama', '揚げ玉', 'Fried tempura crumbs', 98, 60, 'g'],
  ['tomato_juice', 'トマトジュース', 'Tomato juice', 198, 900, 'ml'],
  ['coconut_milk', 'ココナッツミルク', 'Coconut milk', 248, 400, 'ml'],
  ['walnuts', 'くるみ', 'Walnuts', 398, 100, 'g'],
  ['peanuts', 'ピーナッツ', 'Peanuts', 248, 100, 'g'],
  ['raisins', 'レーズン', 'Raisins', 248, 150, 'g'],
  ['mixed_beans', 'ミックスビーンズ', 'Mixed beans', 148, 110, 'g'],
  ['seaweed_salad', '海藻サラダ', 'Seaweed salad mix', 198, 10, 'g'],
  ['tsukemono_ume', 'しば漬け', 'Shibazuke pickles', 158, 100, 'g'],
  ['kinako', 'きな粉', 'Roasted soybean flour', 148, 100, 'g'],
  ['anko', 'つぶあん', 'Sweet red bean paste', 248, 300, 'g'],
  ['gelatin', 'ゼラチン', 'Gelatin powder', 198, 25, 'g'],
  ['jam', 'いちごジャム', 'Strawberry jam', 248, 300, 'g'],
];

const PANTRY = new Set<string>([
  'soy_sauce', 'salt', 'sugar', 'mirin', 'sake', 'miso', 'vinegar', 'salad_oil', 'sesame_oil',
  'olive_oil', 'dashi_granules', 'chicken_stock', 'consomme', 'pepper', 'salt_pepper',
  'mayonnaise', 'ketchup', 'mentsuyu', 'ponzu', 'sauce_chuno', 'worcestershire',
  'oyster_sauce', 'tube_ginger', 'tube_garlic', 'tube_wasabi', 'karashi', 'ichimi', 'shichimi',
  'sesame_seeds', 'katakuriko', 'flour', 'rice',
]);

const GROUPS: [IngredientCategory, Row[]][] = [
  ['vegetable', VEGETABLE],
  ['mushroom', MUSHROOM],
  ['meat', MEAT],
  ['seafood', SEAFOOD],
  ['egg_dairy', EGG_DAIRY],
  ['tofu_soy', TOFU_SOY],
  ['grain_noodle', GRAIN_NOODLE],
  ['seasoning', SEASONING],
  ['other', OTHER],
];

const gramsPerPiece: Record<string, number> = {};

export const INGREDIENTS: Ingredient[] = GROUPS.flatMap(([category, rows]) =>
  rows.map(([id, ja, en, priceYen, packAmount, unit, gpp]) => {
    if (gpp !== undefined) gramsPerPiece[id] = gpp;
    const ing: Ingredient = { id, ja, en, category, priceYen, packAmount, unit };
    if (PANTRY.has(id)) ing.pantry = true;
    return ing;
  }),
);

export const INGREDIENT_MAP: Record<string, Ingredient> = Object.fromEntries(
  INGREDIENTS.map((i) => [i.id, i]),
);

export const INGREDIENT_IDS: string[] = INGREDIENTS.map((i) => i.id);

export const PANTRY_IDS: string[] = INGREDIENTS.filter((i) => i.pantry).map((i) => i.id);

/** Approximate weight (g) of one piece of this ingredient, if known. */
export function getGramsPerPiece(id: string): number | undefined {
  return gramsPerPiece[id];
}

export function getIngredientName(id: string, lang: Lang): string {
  const ing = INGREDIENT_MAP[id];
  if (!ing) return id;
  return lang === 'ja' ? ing.ja : ing.en;
}
