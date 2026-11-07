// Russian encounter names and routes from Путь Миледи. Map images: Game Checklists.
const regions = [
  {
    "name": "Замогилье",
    "index": 0,
    "areas": [
      {
        "name": "Юг",
        "bosses": [
          {
            "id": "soldier-of-godrick-cave-of-knowledge",
            "name": "Солдат Годрика",
            "location": "Пещера знаний под Плавучим кладбищем",
            "note": "Заключительный бой в обучающей пещере.",
            "type": "Стартовый",
            "maps": [
              {
                "file": "limgrave/site-of-grace-location-cave-of-knowledge.webp",
                "source": "soldier-of-godrick"
              }
            ]
          },
          {
            "id": "tree-sentinel-church-of-elleh",
            "name": "Страж Древа",
            "location": "Дорога между благодатью «Первый шаг» и Храмом Элле",
            "maps": [
              {
                "file": "limgrave/boss-tree-sentinel-limgrave.webp",
                "source": "tree-sentinel-limgrave"
              }
            ]
          },
          {
            "id": "demi-human-chiefs-coastal-cave",
            "name": "Два предводителя полулюдей",
            "location": "Прибрежная пещера",
            "maps": [
              {
                "file": "limgrave/site-of-grace-location-coastal-cave.webp",
                "source": "demi-human-chief-duo"
              }
            ]
          },
          {
            "id": "erdtree-burial-watchdog-stormfoot-catacombs",
            "name": "Цербер кладбища Древа Эрд",
            "location": "Катакомбы под скалой",
            "maps": [
              {
                "file": "limgrave/site-of-grace-location-stormfoot-catacombs.webp",
                "source": "erdtree-burial-watchdog-limgrave"
              }
            ]
          },
          {
            "id": "beastman-of-farum-azula-groveside-cave",
            "name": "Зверочеловек из Фарум-Азулы",
            "location": "Лесная пещера",
            "maps": [
              {
                "file": "limgrave/site-of-grace-location-groveside-cave.webp",
                "source": "beastman-of-farum-azula"
              }
            ]
          },
          {
            "id": "bloodhound-knight-darriwil-forlorn-hound-evergaol",
            "name": "Рыцарь-ищейка Дарривил",
            "location": "Узилище одинокой ищейки, к югу от озера Эгхила",
            "note": "Ориентир: благодать «Южный берег озера».",
            "maps": [
              {
                "file": "limgrave/boss-bloodhound-knight-darriwill.webp",
                "source": "bloodhound-knight-darriwill"
              }
            ]
          },
          {
            "id": "ulcerated-tree-spirit-fringefolk-heros-grave",
            "name": "Изъязвлённый древесный дух",
            "location": "Могила героя окраин, за печатью бесов у Плавучего кладбища",
            "note": "Ориентир: благодать «Плавучее кладбище».",
            "maps": [
              {
                "file": "limgrave/site-of-grace-location-stranded-graveyard.webp",
                "source": "ulcerated-tree-spirit-limgrave"
              }
            ]
          }
        ]
      },
      {
        "name": "Озеро Эгхила",
        "bosses": [
          {
            "id": "stonedigger-troll-limgrave-tunnels",
            "name": "Тролль-камнекоп",
            "location": "Туннель Замогилья, северо-западный берег озера Эгхила",
            "maps": [
              {
                "file": "limgrave/site-of-grace-location-limgrave-tunnels.webp",
                "source": "stonedigger-troll-limgrave"
              }
            ]
          },
          {
            "id": "mad-pumpkin-head-waypoint-ruins",
            "name": "Тыквоголовый безумец",
            "location": "Подвал Руин поселения, к востоку от озера Эгхила",
            "note": "Ориентир: благодать «Южный берег озера».",
            "maps": [
              {
                "file": "limgrave/boss-mad-pumpkin-head-limgrave.webp",
                "source": "mad-pumpkin-head"
              }
            ]
          },
          {
            "id": "patches-murkwater-cave",
            "name": "Лоскутик",
            "location": "Грязная пещера, в ущелье к северу от озера Эгхила",
            "note": "Лоскутик сдаётся при низком здоровье. Для отметки победы достаточно завершить бой.",
            "maps": [
              {
                "file": "limgrave/site-of-grace-location-murkwater-cave.webp",
                "source": "patches"
              }
            ]
          },
          {
            "id": "grave-warden-duelist-murkwater-catacombs",
            "name": "Дуэлянт, хранитель могил",
            "location": "Грязные катакомбы, северный конец ущелья за Грязной пещерой",
            "maps": [
              {
                "file": "limgrave/site-of-grace-location-murkwater-catacombs.webp",
                "source": "grave-warden-duelist-limgrave"
              }
            ]
          },
          {
            "id": "flying-dragon-agheel-agheel-lake",
            "name": "Эгхил, крылатый дракон",
            "location": "Озеро Эгхила, у сожжённых драконом руин",
            "note": "Ориентир: благодать «Северный берег озера».",
            "maps": [
              {
                "file": "limgrave/boss-agheel.webp",
                "source": "flying-dragon-agheel"
              }
            ]
          },
          {
            "id": "nights-cavalry-agheel-lake-north",
            "name": "Ночной всадник",
            "location": "Мост к юго-востоку от благодати «Северный берег озера Эгхила»",
            "night": true,
            "maps": [
              {
                "file": "limgrave/boss-night-cavalry-limgrave.webp",
                "source": "nights-cavalry-limgrave"
              }
            ]
          }
        ]
      },
      {
        "name": "Север и восток",
        "bosses": [
          {
            "id": "guardian-golem-highroad-cave",
            "name": "Страж-голем",
            "location": "Пещера под дорогой, у подножия ущелья к северу от Моста Святых",
            "maps": [
              {
                "file": "stormhill/site-of-grace-location-highroad-cave.webp",
                "source": "guardian-golem"
              }
            ]
          },
          {
            "id": "black-knife-assassin-deathtouched-catacombs",
            "name": "Убийца из Чёрных ножей",
            "location": "Помертвелые катакомбы, западнее Моста Святых",
            "maps": [
              {
                "file": "stormhill/site-of-grace-location-deathtouched-catacombs.webp",
                "source": "black-knife-assassin-stormhill"
              }
            ]
          },
          {
            "id": "tibia-mariner-summonwater-village",
            "name": "Лодочник Тибия",
            "location": "Затопленная Деревня у вод призыва, северо-восток Замогилья",
            "note": "Ориентир: благодать «Окраины деревни у вод призыва».",
            "maps": [
              {
                "file": "stormhill/boss-tibia-mariner-stormhill.webp",
                "source": "tibia-mariner-stormhill"
              }
            ]
          },
          {
            "id": "crucible-knight-stormhill-evergaol",
            "name": "Рыцарь Горнила",
            "location": "Узилище на Грозовом холме, к югу от Лачуги на Грозовом холме",
            "note": "Ориентир: благодать «Лачуга на Грозовом холме».",
            "maps": [
              {
                "file": "stormhill/boss-crucible-knight.webp",
                "source": "crucible-knight"
              }
            ]
          },
          {
            "id": "deathbird-stormhill",
            "name": "Птица смерти",
            "location": "Каменные руины к юго-востоку от Лачуги воителя, Грозовой холм",
            "note": "Ориентир: благодать «Лачуга воителя».",
            "night": true,
            "maps": [
              {
                "file": "stormhill/boss-deathbird-stormhill.webp",
                "source": "deathbird-stormhill"
              }
            ]
          },
          {
            "id": "bell-bearing-hunter-warmasters-shack",
            "name": "Охотник за колокольными сферами",
            "location": "Лачуга воителя на Грозовом холме",
            "night": true,
            "maps": [
              {
                "file": "stormhill/site-of-grace-location-warmaster-shack.webp",
                "source": "bell-bearing-hunter-stormhill"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Замок Грозовой Завесы",
    "index": 1,
    "areas": [
      {
        "name": "Часовня ожидания",
        "bosses": [
          {
            "id": "grafted-scion-chapel-of-anticipation",
            "name": "Приращённый отпрыск",
            "location": "Часовня ожидания, начальный остров у Грозовой Завесы",
            "note": "К часовне можно вернуться через портал «Обрыв ожидания» в Четырёх колокольнях Лиурнии. Ориентир: благодать «Четыре колокольни».",
            "type": "Стартовый",
            "maps": [
              {
                "file": "stormveil-castle/boss-grafted-scion.webp",
                "source": "grafted-scion"
              }
            ]
          }
        ]
      },
      {
        "name": "Замок",
        "bosses": [
          {
            "id": "margit-stormveil-castle",
            "name": "Маргит, Ужасное Знамение",
            "location": "Мост от благодати «Туннель замка», перед входом в Грозовую Завесу",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "stormveil-castle/site-of-grace-location-margit-the-fell-omen.webp",
                "source": "margit-the-fell-omen"
              }
            ]
          },
          {
            "id": "godrick-stormveil-castle",
            "name": "Годрик Сторукий",
            "location": "Внутренний двор замка Грозовой Завесы за благодатью «Изолированная камера»",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "stormveil-castle/site-of-grace-location-godrick-the-grafted.webp",
                "source": "godrick-the-grafted"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Плачущий полуостров",
    "index": 2,
    "areas": [
      {
        "name": "Север и восток",
        "bosses": [
          {
            "id": "runebear-earthbore-cave",
            "name": "Медведь рун",
            "location": "Подземная пещера на севере полуострова",
            "maps": [
              {
                "file": "weeping-peninsula/site-of-grace-location-earthbore-cave.webp",
                "source": "runebear"
              }
            ]
          },
          {
            "id": "scaly-misbegotten-morne-tunnel",
            "name": "Чешуйчатый бастард",
            "location": "Туннель Морна, в овраге в центральной части полуострова",
            "maps": [
              {
                "file": "weeping-peninsula/site-of-grace-location-morne-tunnel.webp",
                "source": "scaly-misbegotten"
              }
            ]
          },
          {
            "id": "erdtree-burial-watchdog-impalers-catacombs",
            "name": "Цербер кладбища Древа Эрд",
            "location": "Катакомбы Колосажателя, у обрыва на северо-востоке полуострова",
            "maps": [
              {
                "file": "weeping-peninsula/site-of-grace-location-impaler-catacombs.webp",
                "source": "erdtree-burial-watchdog-weeping-peninsula"
              }
            ]
          }
        ]
      },
      {
        "name": "Запад",
        "bosses": [
          {
            "id": "cemetery-shade-tombsward-catacombs",
            "name": "Тень кладбища",
            "location": "Ведущие в гробницу катакомбы, к югу от храма Паломничества",
            "maps": [
              {
                "file": "weeping-peninsula/site-of-grace-location-tombsward-catacombs.webp",
                "source": "cemetery-shade-weeping-peninsula"
              }
            ]
          },
          {
            "id": "miranda-tombsward-cave",
            "name": "Миранда Смертоцвет",
            "location": "Ведущая к гробнице пещера, к юго-западу от Малого Древа Эрд",
            "maps": [
              {
                "file": "weeping-peninsula/site-of-grace-location-tombsward-cave.webp",
                "source": "miranda-the-blighted-bloom"
              }
            ]
          },
          {
            "id": "erdtree-avatar-weeping-minor-erdtree",
            "name": "Воплощение Древа Эрд",
            "location": "Малое Древо Эрд в западной половине полуострова, к югу от храма Паломничества",
            "note": "Ориентир: благодать «Храм паломничества».",
            "maps": [
              {
                "file": "weeping-peninsula/boss-erdtree-avatar-weeping.webp",
                "source": "erdtree-avatar-weeping-peninsula"
              }
            ]
          },
          {
            "id": "ancient-hero-of-zamor-weeping-evergaol",
            "name": "Древний герой Замора",
            "location": "Плачущее узилище, к востоку от Четвёртого храма Марики",
            "note": "Ориентир: благодать «Четвёртый храм Марики».",
            "maps": [
              {
                "file": "weeping-peninsula/boss-ancient-hero-of-zamor.webp",
                "source": "ancient-hero-of-zamor-weeping-peninsula"
              }
            ]
          }
        ]
      },
      {
        "name": "Замок Морн",
        "bosses": [
          {
            "id": "nights-cavalry-castle-morne-rampart",
            "name": "Ночной всадник",
            "location": "Дорога у благодати «Бастион замка Морн»",
            "night": true,
            "maps": [
              {
                "file": "weeping-peninsula/boss-night-cavalry-weeping.webp",
                "source": "nights-cavalry-weeping-peninsula"
              }
            ]
          },
          {
            "id": "deathbird-castle-morne-rampart",
            "name": "Птица смерти",
            "location": "Скалы к западу от дороги за проломом в бастионе замка Морн",
            "note": "Ориентир: благодать «Бастион замка Морн».",
            "night": true,
            "maps": [
              {
                "file": "weeping-peninsula/boss-deathbird-weeping.webp",
                "source": "deathbird-weeping-peninsula"
              }
            ]
          },
          {
            "id": "leonine-misbegotten-morne-moangrave",
            "name": "Бастард Леонин",
            "location": "Побережье за замком Морн, арена «Воющая могила Морна»",
            "note": "Ориентир: благодать «Окрестности бастиона тюрьмы».",
            "maps": [
              {
                "file": "weeping-peninsula/site-of-grace-location-morne-moangrave.webp",
                "source": "leonine-misbegotten"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Озёрная Лиурния",
    "index": 3,
    "areas": [
      {
        "name": "Юг",
        "bosses": [
          {
            "id": "adan-malefactors-evergaol",
            "name": "Адан, вор огня",
            "location": "Узилище лиходея на плато в южной Лиурнии",
            "note": "Ориентир: благодать «Берег озера Лиурнии».",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/boss-adan-thief-of-fire.webp",
                "source": "adan-thief-of-fire"
              }
            ]
          },
          {
            "id": "bloodhound-knight-lakeside-crystal-cave",
            "name": "Рыцарь-ищейка",
            "location": "Кристальная береговая пещера, южный берег озера",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/site-of-grace-location-lakeside-crystal-cave.webp",
                "source": "bloodhound-knight"
              }
            ]
          },
          {
            "id": "cleanrot-knight-stillwater-cave",
            "name": "Рыцарь чистой гнили",
            "location": "Пещера тихого омута, под скалами на юге озера",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/site-of-grace-location-liurnia-lake-shore.webp",
                "source": "cleanrot-knight"
              }
            ]
          },
          {
            "id": "erdtree-avatar-converted-tower",
            "name": "Воплощение Древа Эрд",
            "location": "Малое Древо Эрд к северо-западу от Изменённой башни, юго-запад Лиурнии",
            "note": "Ориентир: благодать «Изменённая башня».",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/boss-erdtree-avatar-west-liurnia.webp",
                "source": "erdtree-avatar-west-liurnia"
              }
            ]
          },
          {
            "id": "omenkiller-village-of-the-albinaurics",
            "name": "Убийца знамений",
            "location": "Деревня альбиноров под скальным плато, за мостом в деревне",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/boss-omenkiller.webp",
                "source": "omenkiller"
              }
            ]
          },
          {
            "id": "deathbird-scenic-isle",
            "name": "Птица смерти",
            "location": "Скалы к северу от благодати «Живописный остров»",
            "night": true,
            "maps": [
              {
                "file": "liurnia-of-the-lakes/boss-deathbird-liurnia.webp",
                "source": "deathbird-liurnia"
              }
            ]
          },
          {
            "id": "alecto-ringleaders-evergaol",
            "name": "Алекто, главарь Чёрных ножей",
            "location": "Узилище главаря на северо-западе плато Алтаря лунного света",
            "note": "Плато открывается в конце задания Ренни. Ориентир: благодать «Алтарь лунного света».",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/boss-alecto-black-knife-ringleader.webp",
                "source": "alecto-black-knife-ringleader"
              }
            ]
          },
          {
            "id": "glintstone-dragon-adula-moonlight-altar",
            "name": "Адула, дракон блестящих камней",
            "location": "Алтарь лунного света, перед Собором Мануса Целеса",
            "note": "Первая встреча у башен Трёх сестёр заканчивается отлётом дракона. Победа засчитывается у собора.",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/boss-glintstone-dragon-azula2.webp",
                "source": "glintstone-dragon-adula-2",
                "label": "Алтарь лунного света"
              },
              {
                "file": "liurnia-of-the-lakes/boss-glintstone-dragon-azula.webp",
                "source": "glintstone-dragon-adula-1",
                "label": "Три сестры",
                "location": "Первая встреча у Башни Ренни. Дракон улетает во время боя."
              }
            ]
          }
        ]
      },
      {
        "name": "Восток",
        "bosses": [
          {
            "id": "erdtree-burial-watchdog-cliffbottom-catacombs",
            "name": "Цербер кладбища Древа Эрд",
            "location": "Катакомбы под утёсом, восточный берег",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/site-of-grace-location-cliffbottom-catacombs.webp",
                "source": "erdtree-burial-watchdog-liurnia"
              }
            ]
          },
          {
            "id": "nights-cavalry-gate-town-bridge",
            "name": "Ночной всадник",
            "location": "Дорога к юго-востоку от благодати «Мост предместья»",
            "night": true,
            "maps": [
              {
                "file": "liurnia-of-the-lakes/boss-night-cavalry-liurnia.webp",
                "source": "nights-cavalry-liurnia"
              }
            ]
          },
          {
            "id": "bell-bearing-hunter-church-of-vows",
            "name": "Охотник за колокольными сферами",
            "location": "Внутри Храма клятв, восточный берег Лиурнии",
            "note": "Ориентир: благодать «Храм клятв».",
            "night": true,
            "maps": [
              {
                "file": "liurnia-of-the-lakes/boss-bell-bearing-hunter-liurnia.webp",
                "source": "bell-bearing-hunter-liurnia"
              }
            ]
          },
          {
            "id": "crystalian-raya-lucaria-crystal-tunnel",
            "name": "Кристалиец",
            "location": "Кристальный туннель Райи Лукарии, северо-восточный берег озера",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/site-of-grace-location-raya-lucaria-crystal-tunnel.webp",
                "source": "crystalian"
              }
            ]
          },
          {
            "id": "erdtree-avatar-mausoleum-compound",
            "name": "Воплощение Древа Эрд",
            "location": "Малое Древо Эрд на холме у Территории мавзолея и руин дворца Ульд",
            "note": "Ориентир: благодать «Территория мавзолея».",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/boss-erdtree-avatar-east-liurnia.webp",
                "source": "erdtree-avatar-east-liurnia"
              }
            ]
          },
          {
            "id": "tibia-mariner-artists-shack",
            "name": "Лодочник Тибия",
            "location": "Низина к югу от Лачуги художника, возле Карианского читального зала",
            "note": "Ориентир: благодать «Лачуга художника».",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/boss-tibia-mariner-liurnia.webp",
                "source": "tibia-mariner-liurnia"
              }
            ]
          }
        ]
      },
      {
        "name": "Центр и Академия",
        "bosses": [
          {
            "id": "crystalians-academy-crystal-cave",
            "name": "Два кристалийца",
            "location": "Кристальная пещера академии, под западным утёсом Академии Райи Лукарии",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/site-of-grace-location-academy-crystal-cave.webp",
                "source": "crystalian-duo-liurnia"
              }
            ]
          },
          {
            "id": "death-rite-bird-gate-town-north",
            "name": "Погребальная птица",
            "location": "Затопленные руины к юго-западу от благодати «Север предместья»",
            "night": true,
            "maps": [
              {
                "file": "liurnia-of-the-lakes/boss-death-rite-bird-liurnia.webp",
                "source": "death-rite-bird-liurnia"
              }
            ]
          },
          {
            "id": "glintstone-dragon-smarag-temple-quarter",
            "name": "Смараг, дракон блестящих камней",
            "location": "В озере к северу от Жилых помещений храма",
            "note": "Дракон охраняет один из волшебных ключей Академии. Ориентир: благодать «Жилые помещения храма».",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/boss-glintstone-dragon-smarag.webp",
                "source": "glintstone-dragon-smarag"
              }
            ]
          },
          {
            "id": "red-wolf-of-radagon-raya-lucaria",
            "name": "Алый волк Радагона",
            "location": "Зал прений Академии Райи Лукарии",
            "note": "Ориентир: благодать «Классная комната школы».",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "raya-lucaria-academy/boss-red-wolf-of-radagon.webp",
                "source": "red-wolf-of-radagon"
              }
            ]
          },
          {
            "id": "rennala-raya-lucaria",
            "name": "Королева Реннала Полнолунная",
            "location": "Великая библиотека Академии Райи Лукарии, наверху лифта за двором",
            "note": "Ориентир: благодать «Зал для прений».",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "raya-lucaria-academy/site-of-grace-location-raya-lucaria-grand-library.webp",
                "source": "rennala-queen-of-the-full-moon"
              }
            ]
          }
        ]
      },
      {
        "name": "Запад",
        "bosses": [
          {
            "id": "spiritcaller-snail-roads-end-catacombs",
            "name": "Улитка-призывательница духов",
            "location": "Катакомбы у Тупика, западный берег Лиурнии",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/site-of-grace-location-road-end-catacombs.webp",
                "source": "spirit-caller-snail-liurnia"
              }
            ]
          },
          {
            "id": "bols-cuckoos-evergaol",
            "name": "Болс, карианский рыцарь",
            "location": "Узилище Кукушки, севернее Лачуги мстителя",
            "note": "Ориентир: благодать «Лачуга мстителя».",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/boss-bols-carian-knight.webp",
                "source": "bols-carian-knight"
              }
            ]
          }
        ]
      },
      {
        "name": "Север",
        "bosses": [
          {
            "id": "black-knife-assassin-black-knife-catacombs",
            "name": "Убийца из Чёрных ножей",
            "location": "Катакомбы Чёрного ножа, за иллюзорной стеной на верхнем уровне",
            "note": "Поднимитесь на одной из падающих гильотин, чтобы попасть на верхний уровень.",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/site-of-grace-location-black-knife-catacombs.webp",
                "source": "black-knife-assassin-liurnia"
              }
            ]
          },
          {
            "id": "cemetery-shade-black-knife-catacombs",
            "name": "Тень кладбища",
            "location": "Катакомбы Чёрного ножа, за основной дверью босса",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/site-of-grace-location-black-knife-catacombs.webp",
                "source": "cemetery-shade-liurnia"
              }
            ]
          },
          {
            "id": "nights-cavalry-bellum-highway",
            "name": "Ночной всадник",
            "location": "Беллумский тракт между восточными воротами Райи Лукарии и Храмом Беллума",
            "note": "Ориентир: благодать «Восточные ворота Райи Лукарии».",
            "night": true,
            "maps": [
              {
                "file": "liurnia-of-the-lakes/boss-night-cavalry-bellum.webp",
                "source": "nights-cavalry-bellum-highway"
              }
            ]
          },
          {
            "id": "onyx-lord-royal-grave-evergaol",
            "name": "Ониксовый повелитель",
            "location": "Узилище королевской могилы, к востоку от благодати «За поместьем Карии»",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/boss-onyx-lord-liurnia.webp",
                "source": "onyx-lord-liurnia"
              }
            ]
          },
          {
            "id": "magma-wyrm-makar-ruin-strewn-precipice",
            "name": "Магмовый змей Макар",
            "location": "Усыпанный руинами обрыв, арена на выходе из ущелья к плато Альтус",
            "note": "Ориентир: благодать «Возвышение у обрыва с руинами».",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/site-of-grace-location-magma-wyrm-makar.webp",
                "source": "magma-wyrm-makar"
              }
            ]
          },
          {
            "id": "royal-knight-loretta-caria-manor",
            "name": "Лоретта, королевский рыцарь",
            "location": "Королевские лунные земли, верхняя часть Поместья Карии",
            "note": "Ориентир: благодать «Верхний ярус поместья».",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/site-of-grace-location-royal-moongazing-grounds.webp",
                "source": "royal-knight-loretta"
              }
            ]
          },
          {
            "id": "royal-revenant-kingsrealm-ruins",
            "name": "Королевский призрак",
            "location": "Подвал Руин королевских владений, южнее благодати «Дорога к поместью»",
            "note": "Вход в подвал скрыт иллюзорным полом.",
            "maps": [
              {
                "file": "liurnia-of-the-lakes/boss-royal-revenant.webp",
                "source": "royal-revenant"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Звёздные пустоши",
    "index": 4,
    "areas": [
      {
        "name": "Запад",
        "bosses": [
          {
            "id": "magma-wyrm-gael-tunnel",
            "name": "Магмовый змей",
            "location": "Туннель Гаэля на границе Замогилья и Звёздных пустошей",
            "maps": [
              {
                "file": "caelid/site-of-grace-location-gael-tunnel.webp",
                "source": "magma-wyrm-caelid"
              }
            ]
          },
          {
            "id": "erdtree-burial-watchdogs-minor-erdtree-catacombs",
            "name": "Два цербера кладбища Древа Эрд",
            "location": "Катакомбы малого Древа Эрд, у подножия дерева рядом с Тлеющим храмом",
            "maps": [
              {
                "file": "caelid/site-of-grace-location-minor-erdtree-catacombs.webp",
                "source": "erdtree-burial-watchdog-duo"
              }
            ]
          },
          {
            "id": "frenzied-duelist-gaol-cave",
            "name": "Яростный дуэлянт",
            "location": "Тюремная пещера, на западной стороне гнилостного болота у Форта Гаэль",
            "maps": [
              {
                "file": "caelid/site-of-grace-location-gaol-cave.webp",
                "source": "frenzied-duelist"
              }
            ]
          },
          {
            "id": "mad-pumpkin-heads-caelem-ruins",
            "name": "Два тыквоголовых безумца",
            "location": "Подвал в восточной части Руин Калема",
            "note": "Ориентир: благодать «Руины Калема».",
            "maps": [
              {
                "file": "caelid/boss-mad-pumpkin-head-duo.webp",
                "source": "mad-pumpkin-head-duo"
              }
            ]
          },
          {
            "id": "putrid-avatar-smoldering-church-minor-erdtree",
            "name": "Гнилостное воплощение",
            "location": "Малое Древо Эрд в западных Звёздных пустошах, на склоне у Тлеющего храма",
            "note": "Ориентир: благодать «Тлеющий храм».",
            "maps": [
              {
                "file": "caelid/boss-putrid-avatar-caelid.webp",
                "source": "putrid-avatar-caelid"
              }
            ]
          },
          {
            "id": "cleanrot-knights-abandoned-cave",
            "name": "Два рыцаря чистой гнили",
            "location": "Заброшенная пещера, через ветвь над ущельем к востоку от Тлеющей стены",
            "maps": [
              {
                "file": "caelid/site-of-grace-location-abandoned-cave.webp",
                "source": "cleanrot-knight-duo"
              }
            ]
          }
        ]
      },
      {
        "name": "Болото и Селлия",
        "bosses": [
          {
            "id": "fallingstar-beast-sellia-crystal-tunnel",
            "name": "Зверь Падающей звезды",
            "location": "Кристальный туннель Селлии, севернее болота Эония",
            "maps": [
              {
                "file": "caelid/site-of-grace-location-sellia-crystal-tunnel.webp",
                "source": "fallingstar-beast-caelid"
              }
            ]
          },
          {
            "id": "putrid-crystalians-sellia-hideaway",
            "name": "Три гнилостных кристалийца",
            "location": "Убежище в Селлии, за иллюзорной скалой на кладбище к северо-востоку от Храма чумы",
            "maps": [
              {
                "file": "caelid/site-of-grace-location-sellia-hideaway.webp",
                "source": "putrid-crystalian-trio"
              }
            ]
          },
          {
            "id": "nox-monk-and-swordstress-sellia",
            "name": "Монах-нокс и Мечница-нокс",
            "location": "Арена за запечатанными воротами Селлии, города магии",
            "note": "Чтобы снять печать, зажгите огни на трёх башнях. Ориентир: благодать «Закоулки Селлии».",
            "maps": [
              {
                "file": "caelid/site-of-grace-location-chair-crypt-of-sellia.webp",
                "source": "nox-duo"
              }
            ]
          },
          {
            "id": "commander-oneil-heart-of-aeonia",
            "name": "Командир О'Нил",
            "location": "Болото Эония, у благодати «Сердце Эонии»",
            "maps": [
              {
                "file": "caelid/site-of-grace-location-inner-aeonia.webp",
                "source": "commander-oneill"
              }
            ]
          },
          {
            "id": "nights-cavalry-southern-aeonia-swamp-bank",
            "name": "Ночной всадник",
            "location": "Тракт к югу от благодати «Южная отмель болота Эония»",
            "night": true,
            "maps": [
              {
                "file": "caelid/boss-night-cavalry-caelid.webp",
                "source": "nights-cavalry-caelid"
              }
            ]
          },
          {
            "id": "death-rite-bird-southern-aeonia-swamp-bank",
            "name": "Погребальная птица",
            "location": "Обрыв к юго-западу от благодати «Южная отмель болота Эония»",
            "night": true,
            "maps": [
              {
                "file": "caelid/boss-death-rite-bird-caelid.webp",
                "source": "death-rite-bird-caelid"
              }
            ]
          }
        ]
      },
      {
        "name": "Юг и Воющие дюны",
        "bosses": [
          {
            "id": "cemetery-shade-caelid-catacombs",
            "name": "Тень кладбища",
            "location": "Катакомбы Звёздных пустошей, к югу от Собора драконьего причастия",
            "maps": [
              {
                "file": "caelid/site-of-grace-location-caelid-catacombs.webp",
                "source": "cemetery-shade-caelid"
              }
            ]
          },
          {
            "id": "decaying-ekzykes-caelid-highway-south",
            "name": "Гниющий Экзикес",
            "location": "Дорога к Собору драконьего причастия, юго-восточнее благодати «Южный тракт Звёздных пустошей»",
            "maps": [
              {
                "file": "caelid/boss-decaying-ekzykes.webp",
                "source": "decaying-ekzykes"
              }
            ]
          },
          {
            "id": "crucible-knight-and-misbegotten-warrior-redmane-castle",
            "name": "Рыцарь Горнила и Воин-бастард",
            "location": "Главная площадь Замка Рыжей Гривы",
            "note": "Встреча доступна до фестиваля Радана или после его завершения и разговора с Джерреном. Ориентир: благодать «Покои вне замка».",
            "maps": [
              {
                "file": "caelid/site-of-grace-location-redmane-castle-plaza.webp",
                "source": "crucible-knight-misbegotten-warrior"
              }
            ]
          },
          {
            "id": "starscourge-radahn-wailing-dunes",
            "name": "Радан Бич Звёзд",
            "location": "Воющие дюны, через портал за Замком Рыжей Гривы",
            "note": "Вход открывается во время фестиваля Радана. Ориентир: благодать «Покои вне замка».",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "caelid/site-of-grace-location-starscourge-radahn.webp",
                "source": "starscourge-radahn"
              }
            ]
          },
          {
            "id": "putrid-tree-spirit-war-dead-catacombs",
            "name": "Гнилостный древесный дух",
            "location": "Катакомбы мёртвых воинов в дальнем северо-восточном углу Воющих дюн",
            "maps": [
              {
                "file": "caelid/site-of-grace-location-war-dead-catacombs.webp",
                "source": "putrid-tree-spirit-caelid"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Драконий курган",
    "index": 5,
    "areas": [
      {
        "name": "Запад",
        "bosses": [
          {
            "id": "godskin-apostle-divine-tower-of-caelid",
            "name": "Апостол божественной кожи",
            "location": "Подвал Священной башни Звёздных пустошей",
            "note": "Ориентир: благодать «Священная башня Звёздных пустошей: подвал».",
            "maps": [
              {
                "file": "dragonbarrow/site-of-grace-location-divine-tower-of-caelid-basement.webp",
                "source": "godskin-apostle-dragonbarrow"
              }
            ]
          },
          {
            "id": "battlemage-hugues-sellia-evergaol",
            "name": "Гуго, боевой маг",
            "location": "Узилище Селлии, к югу от благодати «Запад Драконьего кургана»",
            "maps": [
              {
                "file": "dragonbarrow/boss-battlemage-hughes.webp",
                "source": "battlemage-hugues"
              }
            ]
          },
          {
            "id": "bell-bearing-hunter-isolated-merchants-shack",
            "name": "Охотник за колокольными сферами",
            "location": "Лачуга торговца-затворника, запад Драконьего кургана",
            "night": true,
            "maps": [
              {
                "file": "dragonbarrow/site-of-grace-location-isolated-merchant-shack-caelid.webp",
                "source": "bell-bearing-hunter-dragonbarrow"
              }
            ]
          }
        ]
      },
      {
        "name": "Восток",
        "bosses": [
          {
            "id": "beastmen-of-farum-azula-dragonbarrow-cave",
            "name": "Два зверочеловека из Фарум-Азулы",
            "location": "Пещера Драконьего кургана, восточнее местного Малого Древа Эрд",
            "maps": [
              {
                "file": "dragonbarrow/site-of-grace-location-dragonbarrow-cave.webp",
                "source": "beastman-of-farum-azula-duo"
              }
            ]
          },
          {
            "id": "black-blade-kindred-bestial-sanctum",
            "name": "Родич Чёрного Клинка",
            "location": "Перед входом в Звериное прибежище, северо-восток Драконьего кургана",
            "maps": [
              {
                "file": "dragonbarrow/boss-black-blade-kindred-dragonbarrow.webp",
                "source": "black-blade-kindred-dragonbarrow"
              }
            ]
          },
          {
            "id": "flying-dragon-greyll-farum-greatbridge",
            "name": "Греил, крылатый дракон",
            "location": "Великий мост Фарума к югу от Звериного прибежища",
            "maps": [
              {
                "file": "dragonbarrow/boss-flying-dragon-greyll.webp",
                "source": "flying-dragon-greyll"
              }
            ]
          },
          {
            "id": "putrid-avatar-dragonbarrow-minor-erdtree",
            "name": "Гнилостное воплощение",
            "location": "Малое Древо Эрд на востоке Драконьего кургана, западнее Пещеры Драконьего кургана",
            "note": "Ориентир: благодать «Развилка Драконьего кургана».",
            "maps": [
              {
                "file": "dragonbarrow/boss-putrid-avatar-dragonbarrow.webp",
                "source": "putrid-avatar-dragonbarrow"
              }
            ]
          },
          {
            "id": "nights-cavalry-lennes-rise",
            "name": "Ночной всадник",
            "location": "Малый мост севернее Башни Ленне, к востоку от Великого моста Фарума",
            "note": "Ориентир: благодать «Башня Ленне».",
            "night": true,
            "maps": [
              {
                "file": "dragonbarrow/boss-night-cavalry-dragonbarrow.webp",
                "source": "nights-cavalry-dragonbarrow"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Плато Альтус",
    "index": 6,
    "areas": [
      {
        "name": "Запад",
        "bosses": [
          {
            "id": "necromancer-garris-sages-cave",
            "name": "Некромант Гаррис",
            "location": "Пещера мудреца, отдельная арена в конце одного из скрытых проходов",
            "maps": [
              {
                "file": "altus-plateau/site-of-grace-location-sage-cave.webp",
                "source": "necromancer-garris"
              }
            ]
          },
          {
            "id": "black-knife-assassin-sages-cave",
            "name": "Убийца из Чёрных ножей",
            "location": "Пещера мудреца, отдельная арена с невидимым убийцей",
            "maps": [
              {
                "file": "altus-plateau/site-of-grace-location-sage-cave.webp",
                "source": "black-knife-assassin-altus-plateau"
              }
            ]
          },
          {
            "id": "perfumer-tricia-and-misbegotten-warrior-unsightly-catacombs",
            "name": "Парфюмерша Триша и Воин-бастард",
            "location": "Отвратительные катакомбы, запад плато рядом с Руинами парфюмера",
            "maps": [
              {
                "file": "altus-plateau/site-of-grace-location-unsightly-catacombs.webp",
                "source": "perfumer-tricia-misbegotten-warrior"
              }
            ]
          },
          {
            "id": "erdtree-burial-watchdog-wyndham-catacombs",
            "name": "Цербер кладбища Древа Эрд",
            "location": "Катакомбы Виндхэма, вход в скале над одноимёнными руинами",
            "maps": [
              {
                "file": "altus-plateau/site-of-grace-location-wyndham-catacombs.webp",
                "source": "erdtree-burial-watchdog-altus-plateau"
              }
            ]
          },
          {
            "id": "demi-human-queen-gilika-lux-ruins",
            "name": "Королева полулюдей Гилика",
            "location": "Подвал верхней части Руин Люкса",
            "note": "Ориентир: благодать «Плато Альтус».",
            "maps": [
              {
                "file": "altus-plateau/boss-demi-human-queen-gilika.webp",
                "source": "demi-human-queen-gilika"
              }
            ]
          },
          {
            "id": "tibia-mariner-wyndham-ruins",
            "name": "Лодочник Тибия",
            "location": "Затопленные Руины Виндхэма, к северу от холма с Древом Эрд",
            "note": "Ориентир: благодать «Холм с видом на Древо Эрд».",
            "maps": [
              {
                "file": "altus-plateau/boss-tibia-mariner-altus.webp",
                "source": "tibia-mariner-altus-plateau"
              }
            ]
          },
          {
            "id": "godefroy-golden-lineage-evergaol",
            "name": "Годфрой Сторукий",
            "location": "Узилище золотой династии, на уступе юго-восточнее Великого подъёмника Дектуса",
            "note": "Ориентир: благодать «Плато Альтус».",
            "maps": [
              {
                "file": "altus-plateau/boss-godefroy-the-grafted.webp",
                "source": "godefroy-the-grafted"
              }
            ]
          }
        ]
      },
      {
        "name": "Центр",
        "bosses": [
          {
            "id": "crystalians-altus-tunnel",
            "name": "Два кристалийца",
            "location": "Туннель Альтуса, к югу от Малого Древа Эрд в центре плато",
            "maps": [
              {
                "file": "altus-plateau/site-of-grace-location-altus-tunnel.webp",
                "source": "crystalian-duo-altus-plateau"
              }
            ]
          },
          {
            "id": "black-knife-assassin-sainted-heros-grave",
            "name": "Убийца из Чёрных ножей",
            "location": "Снаружи, перед входом в Могилу героя-святого",
            "note": "Ориентир: благодать «Тропа со стороны бастиона».",
            "maps": [
              {
                "file": "altus-plateau/boss-black-knife-assassin-sainted-hero-grave.webp",
                "source": "black-knife-assassin-sainted-heros-grave"
              }
            ]
          },
          {
            "id": "ancient-hero-of-zamor-sainted-heros-grave",
            "name": "Древний герой Замора",
            "location": "Могила героя-святого, в глубине подземелья",
            "maps": [
              {
                "file": "altus-plateau/site-of-grace-location-sainted-hero-grave.webp",
                "source": "ancient-hero-of-zamor-altus-plateau"
              }
            ]
          },
          {
            "id": "ancient-dragon-lansseax-rampartside-path",
            "name": "Древний дракон Лансеакс",
            "location": "Плато севернее благодати «Тропа со стороны бастиона»",
            "note": "Первая встреча у Брошенного гроба заканчивается отлётом дракона. Здесь проходит заключительный бой.",
            "maps": [
              {
                "file": "altus-plateau/boss-ancient-dragon-lansseax.webp",
                "source": "ancient-dragon-lansseax-2",
                "label": "Тропа со стороны бастиона"
              },
              {
                "file": "altus-plateau/boss-ancient-dragon-lansseax1.webp",
                "source": "ancient-dragon-lansseax-1",
                "label": "Брошенный гроб",
                "location": "Первая встреча у благодати «Брошенный гроб». Дракон улетает во время боя."
              }
            ]
          },
          {
            "id": "fallingstar-beast-altus-crater",
            "name": "Зверь Падающей звезды",
            "location": "Кратер к юго-востоку от благодати «Распутье тракта Альтуса», южнее ворот столицы",
            "maps": [
              {
                "file": "altus-plateau/boss-fallingstar-beast.webp",
                "source": "fallingstar-beast-altus-plateau"
              }
            ]
          },
          {
            "id": "wormface-altus-minor-erdtree",
            "name": "Червемордый",
            "location": "Малое Древо Эрд в центре плато Альтус, у леса к югу от благодати «Дорога беззакония»",
            "maps": [
              {
                "file": "altus-plateau/boss-wormface.webp",
                "source": "wormface"
              }
            ]
          },
          {
            "id": "nights-cavalry-altus-highway-junction",
            "name": "Ночной всадник",
            "location": "Дорога к северу от благодати «Распутье тракта Альтуса»",
            "night": true,
            "maps": [
              {
                "file": "altus-plateau/boss-night-cavalry-altus.webp",
                "source": "nights-cavalry-altus-plateau"
              }
            ]
          }
        ]
      },
      {
        "name": "Север",
        "bosses": [
          {
            "id": "stonedigger-troll-old-altus-tunnel",
            "name": "Тролль-камнекоп",
            "location": "Старый туннель Альтуса, у подножия скал к югу от Сумрачного замка",
            "maps": [
              {
                "file": "altus-plateau/site-of-grace-location-old-altus-tunnel.webp",
                "source": "stonedigger-troll-altus-plateau"
              }
            ]
          },
          {
            "id": "sanguine-noble-writheblood-ruins",
            "name": "Кровавый аристократ",
            "location": "Подвал Кровавых руин, к востоку от Моста беззакония",
            "note": "Ориентир: благодать «Мост беззакония».",
            "maps": [
              {
                "file": "altus-plateau/boss-sanguine-noble.webp",
                "source": "sanguine-noble"
              }
            ]
          },
          {
            "id": "godskin-apostle-dominula",
            "name": "Апостол божественной кожи",
            "location": "Доминула, деревня ветряной мельницы, на вершине холма",
            "maps": [
              {
                "file": "altus-plateau/site-of-grace-location-windmill-heights.webp",
                "source": "godskin-apostle-altus-plateau"
              }
            ]
          },
          {
            "id": "elemer-of-the-briar-shaded-castle",
            "name": "Элемер из Шипов",
            "location": "Зал за внутренними воротами Сумрачного замка",
            "note": "Ориентир: благодать «Внутренние врата Сумрачного замка».",
            "maps": [
              {
                "file": "altus-plateau/site-of-grace-location-castellan-hall.webp",
                "source": "elemer-of-the-briar"
              }
            ]
          }
        ]
      },
      {
        "name": "У стены столицы",
        "bosses": [
          {
            "id": "omenkiller-and-miranda-perfumers-grotto",
            "name": "Убийца знамений и Миранда Смертоцвет",
            "location": "Грот парфюмера, внизу у внешней стены столицы",
            "maps": [
              {
                "file": "altus-plateau/site-of-grace-location-perfmuer-grotto.webp",
                "source": "omenkiller-miranda-the-blighted-bloom"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Окраины столицы",
    "index": 7,
    "areas": [
      {
        "name": "Юг и запад",
        "bosses": [
          {
            "id": "tree-sentinels-outer-wall-phantom-tree",
            "name": "Два Стража Древа",
            "location": "Главные внешние ворота Лейнделла перед благодатью «Призрачное дерево внешней стены»",
            "maps": [
              {
                "file": "altus-plateau/boss-tree-sentinel-duo.webp",
                "source": "tree-sentinel-duo"
              }
            ]
          },
          {
            "id": "onyx-lord-sealed-tunnel",
            "name": "Ониксовый повелитель",
            "location": "Запечатанный туннель, в низине у южной стороны внешней стены Лейнделла",
            "maps": [
              {
                "file": "altus-plateau/site-of-grace-location-sealed-tunnel.webp",
                "source": "onyx-lord-altus-plateau"
              }
            ]
          }
        ]
      },
      {
        "name": "Север и восток",
        "bosses": [
          {
            "id": "grave-warden-duelist-auriza-side-tomb",
            "name": "Дуэлянт, хранитель могил",
            "location": "Боковая гробница Аурицы, в овраге под северо-восточным входом в столицу",
            "maps": [
              {
                "file": "altus-plateau/site-of-grace-location-auriza-side-tomb.webp",
                "source": "grave-warden-duelist-altus-plateau"
              }
            ]
          },
          {
            "id": "crucible-knights-auriza-heros-grave",
            "name": "Рыцарь Горнила и Рыцарь Горнила Ордовис",
            "location": "Могила героя Аурицы, в овраге под северо-восточным входом в столицу",
            "maps": [
              {
                "file": "altus-plateau/site-of-grace-location-auriza-hero-grave.webp",
                "source": "crucible-knight-crucible-knight-ordovis"
              }
            ]
          },
          {
            "id": "draconic-tree-sentinel-capital-rampart",
            "name": "Драконий Страж Древа",
            "location": "Мост к северо-восточному входу в Лейнделл, перед благодатью «Бастион столицы»",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "altus-plateau/boss-draconic-tree-sentinel-altus.webp",
                "source": "draconic-tree-sentinel-altus-plateau"
              }
            ]
          },
          {
            "id": "deathbird-hermit-merchants-shack",
            "name": "Птица смерти",
            "location": "Скалы к востоку от Лачуги торговца-отшельника, на окраинах Лейнделла",
            "note": "Ориентир: благодать «Лачуга торговца-отшельника».",
            "night": true,
            "maps": [
              {
                "file": "altus-plateau/boss-deathbird-leyndell.webp",
                "source": "deathbird-altus-plateau"
              }
            ]
          },
          {
            "id": "bell-bearing-hunter-hermit-merchants-shack",
            "name": "Охотник за колокольными сферами",
            "location": "Лачуга торговца-отшельника, северная часть окраин столицы",
            "night": true,
            "maps": [
              {
                "file": "altus-plateau/site-of-grace-location-hermit-merchant-shack.webp",
                "source": "bell-bearing-hunter-altus-plateau"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Вулкан Гельмир",
    "index": 8,
    "areas": [
      {
        "name": "Западный склон",
        "bosses": [
          {
            "id": "kindred-of-rot-seethewater-cave",
            "name": "Два родича гнили",
            "location": "Пещера Кипящей реки, в овраге к югу от Форта Лайед",
            "maps": [
              {
                "file": "volcano-manor/site-of-grace-location-seethewater-cave.webp",
                "source": "kindred-of-rot-duo"
              }
            ]
          },
          {
            "id": "magma-wyrm-fort-laiedd",
            "name": "Магмовый змей",
            "location": "Лавовое озеро к югу от Форта Лайед и благодати «Конец Кипящей реки»",
            "maps": [
              {
                "file": "volcano-manor/boss-magma-wyrm-volcano-manor.webp",
                "source": "magma-wyrm-volcano-manor"
              }
            ]
          }
        ]
      },
      {
        "name": "Вершина и восток",
        "bosses": [
          {
            "id": "demi-human-queen-margot-volcano-cave",
            "name": "Королева полулюдей Марго",
            "location": "Вулканическая пещера на северном склоне Гельмира",
            "maps": [
              {
                "file": "volcano-manor/site-of-grace-location-volcano-cave.webp",
                "source": "demi-human-queen-margot"
              }
            ]
          },
          {
            "id": "red-wolf-of-the-champion-gelmir-heros-grave",
            "name": "Алый волк чемпиона",
            "location": "Могила героя Гельмира, под горным лагерем",
            "maps": [
              {
                "file": "volcano-manor/site-of-grace-location-gelmir-hero-grave.webp",
                "source": "red-wolf-of-the-champion"
              }
            ]
          },
          {
            "id": "full-grown-fallingstar-beast-ninth-mt-gelmir-campsite",
            "name": "Взрослый зверь Падающей звезды",
            "location": "Кратер над Девятым лагерем вулкана Гельмир, наверху лестницы или духовного источника",
            "note": "Ориентир: благодать «Девятый лагерь вулкана Гельмир».",
            "maps": [
              {
                "file": "volcano-manor/boss-full-grown-fallingstar-beast.webp",
                "source": "full-grown-fallingstar-beast"
              }
            ]
          },
          {
            "id": "demi-human-queen-maggie-hermit-village",
            "name": "Королева полулюдей Мэгги",
            "location": "Деревня отшельников, у северо-восточного выхода к Первобытному чародею Азуру",
            "note": "Ориентир: благодать «Лачуга мастера».",
            "maps": [
              {
                "file": "volcano-manor/boss-demi-human-queen-maggie.webp",
                "source": "demi-human-queen-maggie"
              }
            ]
          },
          {
            "id": "ulcerated-tree-spirit-gelmir-minor-erdtree",
            "name": "Изъязвлённый древесный дух",
            "location": "Малое Древо Эрд у Дороги беззакония, на склоне под Вулкановым поместьем",
            "note": "Ориентир: благодать «Дорога беззакония».",
            "maps": [
              {
                "file": "volcano-manor/boss-ulcerated-tree-spirit-volcano-manor.webp",
                "source": "ulcerated-tree-spirit-volcano-manor"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Вулканово поместье",
    "index": 9,
    "areas": [
      {
        "name": "Вулканово поместье",
        "bosses": [
          {
            "id": "abductor-virgins-subterranean-inquisition-chamber",
            "name": "Две девы-похитительницы",
            "location": "Подземная комната инквизиции, арена за лавовыми пещерами",
            "note": "Чтобы попасть в эту часть поместья, дайте деве-похитительнице убить героя захватом у подножия водяного колеса Академии Райи Лукарии.",
            "maps": [
              {
                "file": "volcano-manor/site-of-grace-location-abductor-virgin.webp",
                "source": "abductor-virgin-duo"
              }
            ]
          },
          {
            "id": "godskin-noble-temple-of-eiglay",
            "name": "Аристократ божественной кожи",
            "location": "Храм Игли, за подъёмным мостом в тюремном городе Вулканова поместья",
            "note": "Ориентир: благодать «Гостиная».",
            "maps": [
              {
                "file": "volcano-manor/site-of-grace-location-temple-of-eiglay.webp",
                "source": "godskin-noble-volcano-manor"
              }
            ]
          },
          {
            "id": "rykard-audience-pathway",
            "name": "Рикард, богохульный владыка",
            "location": "Арена за благодатью «Тропа для аудиенции» в Вулкановом поместье",
            "note": "В первой фазе вы сражаетесь со Змеем-пожирателем богов.",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "volcano-manor/site-of-grace-location-rykard-lord-of-blasphemy.webp",
                "source": "rykard-lord-of-blashpemy"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Лейнделл, столица королевства",
    "index": 10,
    "areas": [
      {
        "name": "Столица",
        "bosses": [
          {
            "id": "godfrey-golden-shade-erdtree-sanctuary",
            "name": "Годфри, первый повелитель Элдена (золотая тень)",
            "location": "Святилище Древа Эрд, вверх по корням от западного бастиона столицы",
            "note": "Ориентир: благодать «Западный бастион столицы».",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "leyndell/site-of-grace-location-erdtree-santcuary.webp",
                "source": "godfrey-first-elden-lord-golden"
              }
            ]
          },
          {
            "id": "morgott-elden-throne",
            "name": "Морготт, король знамений",
            "location": "Трон Элдена, выше Покоя королевы",
            "note": "Ориентир: благодать «Покои королевы».",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "leyndell/site-of-grace-location-queen-bedchamber.webp",
                "source": "morgott-the-omen-king"
              }
            ]
          },
          {
            "id": "fell-twins-divine-tower-of-east-altus",
            "name": "Два ужасных близнеца",
            "location": "Мост к Священной башне Восточного Альтуса, от верхней площадки подъёмника в Запретные земли",
            "maps": [
              {
                "file": "leyndell/boss-fell-twin-duo.webp",
                "source": "fell-twin-duo"
              }
            ]
          }
        ]
      },
      {
        "name": "Подземелье",
        "bosses": [
          {
            "id": "esgar-leyndell-catacombs",
            "name": "Жрец крови Эсгар",
            "location": "Катакомбы Лейнделла под Подземельем отчуждения, вход внизу у гигантских омаров",
            "maps": [
              {
                "file": "leyndell/site-of-grace-location-leyndell-catacombs.webp",
                "source": "esgar-priest-of-blood"
              }
            ]
          },
          {
            "id": "mohg-cathedral-of-the-forsaken",
            "name": "Мог, Знамение",
            "location": "Собор отверженных, в глубине Подземелья отчуждения",
            "note": "Ориентир: благодать «Отверженные глубины».",
            "maps": [
              {
                "file": "leyndell/site-of-grace-location-forsaken-depths.webp",
                "source": "mohg-the-omen"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Запретные земли",
    "index": 11,
    "areas": [
      {
        "name": "Запретные земли",
        "bosses": [
          {
            "id": "nights-cavalry-forbidden-lands",
            "name": "Ночной всадник",
            "location": "Тропа недалеко от благодати «Запретные земли»",
            "night": true,
            "maps": [
              {
                "file": "mountaintops-of-the-giants/boss-night-cavalry-forbidden-lands.webp",
                "source": "nights-cavalry-forbidden-lands"
              }
            ]
          },
          {
            "id": "black-blade-kindred-grand-lift-of-rold",
            "name": "Родич Чёрного Клинка",
            "location": "Подход к Большому подъёмнику Рольда со стороны Запретных земель",
            "note": "Ориентир: благодать «Запретные земли».",
            "maps": [
              {
                "file": "mountaintops-of-the-giants/boss-black-blade-kindred-forbidden-lands.webp",
                "source": "black-blade-kindred-forbidden-lands"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Вершины великанов",
    "index": 12,
    "areas": [
      {
        "name": "Восток и юг",
        "bosses": [
          {
            "id": "ancient-hero-of-zamor-giant-conquering-heros-grave",
            "name": "Древний герой Замора",
            "location": "Могила героя, победителя великанов, на уступе к западу от благодати «Могильный камень великанов»",
            "maps": [
              {
                "file": "mountaintops-of-the-giants/site-of-grace-location-giant-conquering-hero-grave.webp",
                "source": "ancient-hero-of-zamor-mountaintops"
              }
            ]
          },
          {
            "id": "spiritcaller-snail-spiritcaller-cave",
            "name": "Улитка-призывательница духов",
            "location": "Пещера призывателя душ, на западном берегу Ледяного озера",
            "note": "Улитка появляется после последовательных боёв с Апостолом и Аристократом божественной кожи.",
            "maps": [
              {
                "file": "mountaintops-of-the-giants/site-of-grace-location-spiritcaller-cave.webp",
                "source": "spirit-caller-snail-mountaintops"
              }
            ]
          },
          {
            "id": "borealis-freezing-lake",
            "name": "Борелис Леденящий Туман",
            "location": "Посреди Ледяного озера, в тумане",
            "note": "Ориентир: благодать «Ледяное озеро».",
            "maps": [
              {
                "file": "mountaintops-of-the-giants/boss-borealis-the-freezing-fog.webp",
                "source": "borealis-the-freezing-fog"
              }
            ]
          },
          {
            "id": "roundtable-knight-vyke-lord-contenders-evergaol",
            "name": "Вик, рыцарь Круглого стола",
            "location": "Узилище соперника владыки, на склоне западнее Первого храма Марики",
            "note": "Ориентир: благодать «Первый храм Марики».",
            "maps": [
              {
                "file": "mountaintops-of-the-giants/boss-vyke-knight-of-the-roundtable.webp",
                "source": "vyke-knight-of-the-roundtable"
              }
            ]
          },
          {
            "id": "fire-giant-flame-peak",
            "name": "Огненный великан",
            "location": "Пылающая вершина, за цепями у подножия Кузницы великанов",
            "note": "Ориентир: благодать «Подножие кузницы».",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "mountaintops-of-the-giants/site-of-grace-location-fire-giant.webp",
                "source": "fire-giant"
              }
            ]
          }
        ]
      },
      {
        "name": "Север и запад",
        "bosses": [
          {
            "id": "ulcerated-tree-spirit-giants-mountaintop-catacombs",
            "name": "Изъязвлённый древесный дух",
            "location": "Катакомбы на Вершине великанов, вход под подъёмом к длинному мосту с големом",
            "maps": [
              {
                "file": "mountaintops-of-the-giants/site-of-grace-location-giants-mountaintop-catacombs.webp",
                "source": "ulcerated-tree-spirit-mountaintops"
              }
            ]
          },
          {
            "id": "erdtree-avatar-mountaintops-minor-erdtree",
            "name": "Воплощение Древа Эрд",
            "location": "Малое Древо Эрд через мост к югу от благодати «Возвышение у руин снежной долины»",
            "maps": [
              {
                "file": "mountaintops-of-the-giants/boss-erdtree-avatar-mountaintops.webp",
                "source": "erdtree-avatar-mountaintops"
              }
            ]
          },
          {
            "id": "death-rite-bird-mountaintops-snow-valley",
            "name": "Погребальная птица",
            "location": "Плато к западу от благодати «Возвышение у руин снежной долины», над дорогой к Замку Сол",
            "note": "Эта Погребальная птица появляется и днём.",
            "maps": [
              {
                "file": "mountaintops-of-the-giants/boss-death-rite-bird-mountaintops.webp",
                "source": "death-rite-bird-mountaintops"
              }
            ]
          },
          {
            "id": "commander-niall-castle-sol",
            "name": "Командир Найлл",
            "location": "Крыша Замка Сол, за Храмом затмения",
            "note": "Ориентир: благодать «Храм затмения».",
            "maps": [
              {
                "file": "mountaintops-of-the-giants/boss-commander-niall.webp",
                "source": "commander-niall"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Священное заснеженное поле",
    "index": 13,
    "areas": [
      {
        "name": "Юг и центр",
        "bosses": [
          {
            "id": "stray-mimic-tear-hidden-path-to-the-haligtree",
            "name": "Блуждающая Ложная Слеза",
            "location": "Тайный путь к Святому Древу, скрытый нижний ярус за невидимым мостом",
            "maps": [
              {
                "file": "consecrated-snowfield/boss-stray-mimic-tear.webp",
                "source": "stray-mimic-tear"
              }
            ]
          },
          {
            "id": "astel-stars-of-darkness-yelough-anix-tunnel",
            "name": "Астель Звёзды Тьмы",
            "location": "Туннель жёлтого аникса, у руин на западе заснеженного поля",
            "maps": [
              {
                "file": "consecrated-snowfield/site-of-grace-location-yelough-anix-tunnel.webp",
                "source": "astel-stars-of-darkness"
              }
            ]
          },
          {
            "id": "nights-cavalry-duo-consecrated-snowfield",
            "name": "Два Ночных всадника",
            "location": "Караван рядом с благодатью «Внутренняя часть священного поля»",
            "night": true,
            "maps": [
              {
                "file": "consecrated-snowfield/boss-night-cavalry-duo.webp",
                "source": "nights-cavalry-duo"
              }
            ]
          }
        ]
      },
      {
        "name": "Север и восток",
        "bosses": [
          {
            "id": "putrid-grave-warden-duelist-consecrated-snowfield-catacombs",
            "name": "Гнилостный дуэлянт, хранитель могил",
            "location": "Катакомбы под священным полем, в восточной части заснеженного поля",
            "maps": [
              {
                "file": "consecrated-snowfield/site-of-grace-location-consecrated-snowfield-catacombs.webp",
                "source": "putrid-grave-warden-duelist"
              }
            ]
          },
          {
            "id": "misbegotten-crusader-cave-of-the-forlorn",
            "name": "Крестоносец-бастард",
            "location": "Пещера забытых на северном берегу замёрзшей реки",
            "maps": [
              {
                "file": "consecrated-snowfield/site-of-grace-location-cave-of-the-forlorn.webp",
                "source": "misbegotten-crusader"
              }
            ]
          },
          {
            "id": "great-wyrm-theodorix-consecrated-snowfield",
            "name": "Великий змей Теодорикс",
            "location": "Восточный конец замёрзшей реки, за входом в Пещеру забытых",
            "note": "Ориентир: благодать «Пещера забытых».",
            "maps": [
              {
                "file": "consecrated-snowfield/boss-magma-wyrm-theodorix.webp",
                "source": "great-wyrm-theodorix"
              }
            ]
          },
          {
            "id": "putrid-avatar-consecrated-snowfield-minor-erdtree",
            "name": "Гнилостное воплощение",
            "location": "Малое Древо Эрд далеко к востоку от Ордины, на краю поля",
            "note": "Ориентир: благодать «Ордина, литургический город».",
            "maps": [
              {
                "file": "consecrated-snowfield/boss-putrid-avatar-consecrated-snowfield.webp",
                "source": "putrid-avatar-consecrated-snowfield"
              }
            ]
          },
          {
            "id": "death-rite-bird-apostate-derelict",
            "name": "Погребальная птица",
            "location": "Северо-западный конец замёрзшей реки, к юго-востоку от Руин вероотступников",
            "note": "Ориентир: благодать «Руины вероотступников».",
            "night": true,
            "maps": [
              {
                "file": "consecrated-snowfield/boss-death-rite-bird-consecrated-snowfield.webp",
                "source": "death-rite-bird-consecrated-snowfield"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Святое Древо Микеллы",
    "index": 14,
    "areas": [
      {
        "name": "Святое Древо Микеллы",
        "bosses": [
          {
            "id": "loretta-haligtree-promenade",
            "name": "Лоретта, рыцарь Святого Древа",
            "location": "Арена на нижней площадке города Святого Древа, перед спуском в Эльфаэль",
            "note": "Ориентир: благодать «Променад Святого Древа».",
            "maps": [
              {
                "file": "miquella-s-haligtree/boss-loretta-knight-of-the-haligtree.webp",
                "source": "loretta-knight-of-the-haligtree"
              }
            ]
          },
          {
            "id": "malenia-haligtree-roots",
            "name": "Маления, Клинок Микеллы",
            "location": "Эльфаэль, арена за благодатью «Корни Святого Древа»",
            "note": "Вторая фаза — Маления, богиня гнили.",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "miquella-s-haligtree/site-of-grace-location-malenia-goddess-of-rot.webp",
                "source": "malenia-blade-of-miquella"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Река Сиофра",
    "index": 15,
    "areas": [
      {
        "name": "Река Сиофра",
        "bosses": [
          {
            "id": "dragonkin-soldier-siofra-river",
            "name": "Драконий солдат",
            "location": "Верхний бассейн Сиофры. Портал на сломанной колонне к югу от Леса последователей ведёт к арене",
            "note": "Ориентир: благодать «Лес последователей».",
            "maps": [
              {
                "file": "siofra-river/boss-dragonkin-soldier-siofra-river.webp",
                "source": "dragonkin-soldier-siofra-river"
              }
            ]
          },
          {
            "id": "ancestor-spirit-siofra-hallowhorn-grounds",
            "name": "Дух предка",
            "location": "Земли святого рога у Набережной Сиофры",
            "note": "Зажгите восемь огней в нижней части Сиофры и коснитесь останков. Ориентир: благодать «Набережная Сиофры».",
            "maps": [
              {
                "file": "siofra-river/boss-ancestor-spirit.webp",
                "source": "ancestor-spirit"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Нокрон, Вечный город",
    "index": 16,
    "areas": [
      {
        "name": "Нокрон, Вечный город",
        "bosses": [
          {
            "id": "mimic-tear-nokron",
            "name": "Ложная Слеза",
            "location": "Нокрон, арена перед длинным мостом к Лесу предков",
            "note": "Ориентир: благодать «Священная земля Ночи».",
            "maps": [
              {
                "file": "siofra-river/site-of-grace-location-mimic-tear.webp",
                "source": "mimic-tear"
              }
            ]
          },
          {
            "id": "regal-ancestor-spirit-nokron-hallowhorn-grounds",
            "name": "Дух величавого предка",
            "location": "Земли святого рога рядом с Лесом предков в Нокроне",
            "note": "Зажгите шесть огней в Нокроне и коснитесь останков. Ориентир: благодать «Лес предков».",
            "maps": [
              {
                "file": "siofra-river/boss-regal-ancestor-spirit.webp",
                "source": "regal-ancestor-spirit"
              }
            ]
          },
          {
            "id": "valiant-gargoyles-siofra-aqueduct",
            "name": "Две отважные горгульи",
            "location": "Акведук Сиофры под Нокроном, площадка у водопада",
            "note": "Ориентир: благодать «Скалы со стороны акведука».",
            "maps": [
              {
                "file": "siofra-river/boss-valiant-gargoyles-duo.webp",
                "source": "valiant-gargoyle-duo"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Дворец Могвинов",
    "index": 17,
    "areas": [
      {
        "name": "Дворец Могвинов",
        "bosses": [
          {
            "id": "mohg-mohgwyn-dynasty-mausoleum",
            "name": "Мог Повелитель Крови",
            "location": "Мавзолей династии Могвинов, арена наверху за благодатью «Центр мавзолея династии»",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "mohgwyn-palace/site-of-grace-location-cocoon-of-the-empyrean.webp",
                "source": "mohg-lord-of-blood"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Река Ансель",
    "index": 18,
    "areas": [
      {
        "name": "Нижнее течение",
        "bosses": [
          {
            "id": "dragonkin-soldier-of-nokstella-ainsel-river",
            "name": "Драконий солдат Нокстеллы",
            "location": "Нижнее течение Анселя, грот за руинами дворца Уль",
            "note": "Ориентир: благодать «Нижний поток реки Ансель».",
            "maps": [
              {
                "file": "ainsel-river/site-of-grace-location-dragonkin-soldier-of-nokstella.webp",
                "source": "dragonkin-soldier-of-nokstella"
              }
            ]
          }
        ]
      },
      {
        "name": "Озеро Гнили",
        "bosses": [
          {
            "id": "dragonkin-soldier-lake-of-rot",
            "name": "Драконий солдат",
            "location": "Озеро Гнили, в озере к юго-востоку от благодати на берегу",
            "maps": [
              {
                "file": "ainsel-river/boss-dragonkin-soldier-lake-of-rot.webp",
                "source": "dragonkin-soldier-lake-of-rot"
              }
            ]
          },
          {
            "id": "astel-naturalborn-of-the-void-grand-cloister",
            "name": "Астель, Рождённый Бездной",
            "location": "Пещера за Великим клуатром. Вход через гроб у водопада гнили",
            "note": "Ориентир: благодать «Великий клуатр».",
            "maps": [
              {
                "file": "ainsel-river/site-of-grace-location-astel-naturalborn-of-the-void.webp",
                "source": "astel-naturalborn-of-the-void"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Низовье Глубокого Корня",
    "index": 19,
    "areas": [
      {
        "name": "Низовье Глубокого Корня",
        "bosses": [
          {
            "id": "crucible-knight-siluria-deeproot-depths",
            "name": "Рыцарь Горнила Силурия",
            "location": "У подножия большого дерева к западу от Безымянного Вечного города",
            "note": "Ориентир: благодать «Безымянный Вечный город».",
            "maps": [
              {
                "file": "deeproot-depths/boss-crucible-knight-siluria.webp",
                "source": "crucible-knight-siluria"
              }
            ]
          },
          {
            "id": "fias-champions-prince-of-deaths-throne",
            "name": "Герои Фии",
            "location": "Арена у Трона принца Смерти, за благодатью «Вдоль корней»",
            "note": "Три волны противников в рамках одного боя.",
            "maps": [
              {
                "file": "deeproot-depths/site-of-grace-location-prince-of-death-throne.webp",
                "source": "fias-champions"
              }
            ]
          },
          {
            "id": "lichdragon-fortissax-deathbed-dream",
            "name": "Дракон-лич Фортисакс",
            "location": "Сон Фии у Трона принца Смерти",
            "note": "Продвиньте задание Фии, чтобы получить доступ к её сну. Ориентир: благодать «Трон принца Смерти».",
            "maps": [
              {
                "file": "deeproot-depths/site-of-grace-location-prince-of-death-throne.webp",
                "source": "lichdragon-fortissax"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Сокрушённый Фарум-Азула",
    "index": 20,
    "areas": [
      {
        "name": "Сокрушённый Фарум-Азула",
        "bosses": [
          {
            "id": "godskin-duo-dragon-temple",
            "name": "Двое из божественной кожи",
            "location": "Алтарь драконьего храма",
            "note": "Ориентир: благодать «Драконий храм».",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "crumbling-farum-azula/site-of-grace-location-dragon-temple-altar.webp",
                "source": "godskin-duo"
              }
            ]
          },
          {
            "id": "dragonlord-placidusax-beside-the-great-bridge",
            "name": "Владыка драконов Пласидусакс",
            "location": "Плавающие каменные уступы ниже подъёма к Великому мосту",
            "note": "Спуститесь с обрыва на обломки и лягте в свободной нише. Ориентир: благодать «Окрестности великого моста».",
            "maps": [
              {
                "file": "crumbling-farum-azula/site-of-grace-location-dragonlord-placidusax.webp",
                "source": "dragonlord-placidusax"
              }
            ]
          },
          {
            "id": "maliketh-beside-the-great-bridge",
            "name": "Маликет Чёрный Клинок",
            "location": "Круглая арена за Великим мостом, выше благодати «Окрестности великого моста»",
            "note": "В первой фазе вы сражаетесь со Священником-зверем.",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "crumbling-farum-azula/site-of-grace-location-maliketh-the-black-blade.webp",
                "source": "beast-clergyman-maliketh-the-black-blade"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Лейнделл, столица пепла",
    "index": 21,
    "areas": [
      {
        "name": "Лейнделл, столица пепла",
        "bosses": [
          {
            "id": "sir-gideon-ofnir-erdtree-sanctuary",
            "name": "Сэр Гидеон Офнир Всеведущий",
            "location": "Святилище Древа Эрд в столице пепла",
            "note": "Ориентир: благодать «Лейнделл, столица пепла».",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "leyndell/site-of-grace-location-erdtree-santcuary.webp",
                "source": "sir-gideon-ofnir-the-all-knowing"
              }
            ]
          },
          {
            "id": "godfrey-hoarah-loux-elden-throne",
            "name": "Годфри, первый повелитель Элдена / Хоара Лукс",
            "location": "Трон Элдена в столице пепла",
            "note": "Вторая фаза — Хоара Лукс. Ориентир: благодать «Покои королевы».",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "leyndell/site-of-grace-location-queen-bedchamber.webp",
                "source": "godfrey-first-elden-lord-hoarah-loux-warrior"
              }
            ]
          },
          {
            "id": "radagon-and-elden-beast-erdtree",
            "name": "Радагон из Золотого порядка и Зверь Элдена",
            "location": "Внутри Древа Эрд, за золотой преградой у Трона Элдена",
            "note": "Радагон и Зверь Элдена идут подряд в рамках одной победы. Ориентир: благодать «Трон Элдена».",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "leyndell/site-of-grace-location-elden-throne.webp",
                "source": "radagon-of-the-golden-order-elden-beast"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Равнина Надгробий",
    "index": 22,
    "areas": [
      {
        "name": "Запад и Белурат",
        "bosses": [
          {
            "id": "dlc-ghostflame-dragon-gravesite-plain",
            "name": "Дракон смерти",
            "location": "Озеро к западу от благодати «Великий мост, север», западнее Заброшенной деревни ослабевших.",
            "note": "Здесь дракон лежит посреди мелководья.",
            "maps": [
              {
                "file": "gravesite-plain/boss-ghostflame-dragon-belurat.webp",
                "source": "ghostflame-dragon-belurat"
              }
            ]
          },
          {
            "id": "dlc-knight-of-the-solitary-gaol-western-mausoleum",
            "name": "Рыцарь Одиночной тюрьмы",
            "location": "Безымянный западный мавзолей к северо-западу от благодати «Равнина Надгробий».",
            "maps": [
              {
                "file": "gravesite-plain/boss-knight-of-the-solitary-gaol.webp",
                "source": "knight-of-the-solitary-gaol"
              }
            ]
          },
          {
            "id": "dlc-demi-human-swordmaster-onze-belurat-gaol",
            "name": "Мечник-получеловек Онзе",
            "location": "Конец Тюрьмы в Белурате. Вход в тюрьму к западу от озера с Драконом смерти.",
            "note": "Ориентир: благодать «Тюрьма в Белурате».",
            "maps": [
              {
                "file": "gravesite-plain/site-of-grace-location-belurat-gaol.webp",
                "source": "demi-human-swordmaster-onze"
              }
            ]
          },
          {
            "id": "dlc-divine-beast-dancing-lion-belurat",
            "name": "Священный танцующий лев",
            "location": "Белурат, поселение у башни. Арена на вершине Белурата, сразу за благодатью «Передняя сторона сцены».",
            "note": "За победу даётся воспоминание.",
            "maps": [
              {
                "file": "gravesite-plain/site-of-grace-location-theatre-of-the-divine-beast.webp",
                "source": "divine-beast-dancing-lion-belurat"
              }
            ]
          }
        ]
      },
      {
        "name": "Север и река Эллак",
        "bosses": [
          {
            "id": "dlc-death-knight-fog-rift-catacombs",
            "name": "Рыцарь Смерти",
            "location": "Катакомбы туманного разлома, последняя камера. Вход в ущелье к северо-западу от передней стороны замка Энсис.",
            "note": "Этот рыцарь с парными топорами.",
            "maps": [
              {
                "file": "gravesite-plain/site-of-grace-location-fog-rift-catacombs.webp",
                "source": "death-knight-fog-rift-catacombs"
              }
            ]
          },
          {
            "id": "dlc-black-knight-garrew-fog-rift-fort",
            "name": "Чёрный рыцарь Гэрью",
            "location": "Южная часть Форта в туманном разломе. Спуск к форту со скал возле благодати «Теневой Альтус, запад».",
            "maps": [
              {
                "file": "scadu-altus/boss-black-knight-garrew.webp",
                "source": "black-knight-garrew"
              }
            ]
          },
          {
            "id": "dlc-chief-bloodfiend-rivermouth-cave",
            "name": "Вождь кровопускателей",
            "location": "Пещера у речного устья, финальная камера. Вход у северного конца реки Эллак.",
            "maps": [
              {
                "file": "gravesite-plain/site-of-grace-location-rivermouth-cave.webp",
                "source": "chief-bloodfiend"
              }
            ]
          },
          {
            "id": "dlc-red-bear-northern-mausoleum",
            "name": "Красный медведь",
            "location": "Безымянный северный мавзолей, на возвышенности к юго-западу от благодати «Привал у древних руин».",
            "note": "Подъём на плато через духовный источник.",
            "maps": [
              {
                "file": "ancient-ruins/boss-red-bear.webp",
                "source": "red-bear"
              }
            ]
          }
        ]
      },
      {
        "name": "Восток и замок Энсис",
        "bosses": [
          {
            "id": "dlc-rellana-twin-moon-knight-castle-ensis",
            "name": "Реллана, Рыцарь Двойной Луны",
            "location": "Замок Энсис, за благодатью «Хозяйские покои замка».",
            "note": "Охраняет прямой выход на Теневой Альтус.",
            "maps": [
              {
                "file": "scadu-altus/site-of-grace-location-ensis-moongazing-grounds.webp",
                "source": "rellana-twin-moon-knight"
              }
            ]
          },
          {
            "id": "dlc-ancient-dragon-man-dragons-pit",
            "name": "Древний человек-дракон",
            "location": "Драконья яма, арена за глубоким провалом в конце пещеры.",
            "note": "Победа открывает выход к Зубатой горе.",
            "maps": [
              {
                "file": "gravesite-plain/site-of-grace-location-dragon-pit.webp",
                "source": "ancient-dragon-man"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Теневой Альтус",
    "index": 23,
    "areas": [
      {
        "name": "Руины Мурта и юг",
        "bosses": [
          {
            "id": "dlc-dryleaf-dane-moorth-ruins",
            "name": "Дейн Сухой Лист",
            "location": "Руины Мурта, рядом с одноимённой благодатью.",
            "note": "Используйте перед Дейном жест «Пусть победит лучший» (May the Best Win). Жест лежит рядом с посланием у благодати «Крест у дороги».",
            "maps": [
              {
                "file": "scadu-altus/site-of-grace-location-moorth-ruins.webp",
                "source": "dryleaf-dane"
              }
            ]
          },
          {
            "id": "dlc-ghostflame-dragon-scadu-altus",
            "name": "Дракон смерти",
            "location": "К югу от Руин Мурта, на поле перед Фортом порицания.",
            "note": "Дракон сражается с солдатами Мессмера. Ориентир: благодать «Тракт Мурта, юг».",
            "maps": [
              {
                "file": "scadu-altus/boss-ghostflame-dragon-scadu-altus.webp",
                "source": "ghostflame-dragon-scadu-altus"
              }
            ]
          },
          {
            "id": "dlc-black-knight-edredd-fort-of-reprimand",
            "name": "Чёрный рыцарь Эдред",
            "location": "Форт порицания, верхнее помещение на пути к выходу за форт.",
            "maps": [
              {
                "file": "scadu-altus/boss-black-knight-edredd.webp",
                "source": "black-knight-edredd"
              }
            ]
          },
          {
            "id": "dlc-ralva-the-great-red-bear-scadu-altus",
            "name": "Великий красный медведь Ральва",
            "location": "Лесное озеро к северо-востоку от Руин Мурта, к востоку от Пристанища Теней.",
            "note": "Ориентир: благодать «Крест у дороги».",
            "maps": [
              {
                "file": "scadu-altus/boss-ralva-the-great-red-bear.webp",
                "source": "ralva-the-great-red-bear"
              }
            ]
          }
        ]
      },
      {
        "name": "Деревня Бонни и собор",
        "bosses": [
          {
            "id": "dlc-curseblade-labirith-bonny-gaol",
            "name": "Лабирит, проклятый клинок",
            "location": "Тюрьма в Бонни, нижняя камера. Вход в тюрьму за южным мостом от Деревни Бонни.",
            "maps": [
              {
                "file": "scadu-altus/site-of-grace-location-bonny-goal.webp",
                "source": "curseblade-labirith"
              }
            ]
          },
          {
            "id": "dlc-metyr-mother-of-fingers-manus-metyr",
            "name": "Матерь Пальцев Метир",
            "location": "Под собором Манус Метир, в Руинах обители пальцев Миир. Последний колокол переносит на арену.",
            "note": "Нужно продвинуть задание Имира, позвонив в колокола в руинах Рии и Део. Ориентир: благодать «Собор Манус Метир».",
            "maps": [
              {
                "file": "scadu-altus/site-of-grace-location-cathedral-of-manus-metyr.webp",
                "source": "metyr-mother-of-fingers"
              }
            ]
          },
          {
            "id": "dlc-count-ymir-mother-of-fingers-manus-metyr",
            "name": "Граф Имир, матерь Пальцев",
            "location": "Собор Манус Метир, главный зал, у трона Имира.",
            "note": "Вернитесь после победы над Метир. Бою с Имиром предшествует встреча с Йоланой.",
            "maps": [
              {
                "file": "scadu-altus/site-of-grace-location-cathedral-of-manus-metyr.webp",
                "source": "count-ymir-mother-of-fingers"
              }
            ]
          }
        ]
      },
      {
        "name": "Пристанище Теней",
        "bosses": [
          {
            "id": "dlc-golden-hippopotamus-shadow-keep",
            "name": "Золотой гиппопотам",
            "location": "Пристанище Теней, двор сразу за главными воротами.",
            "note": "Этот бой открывает прямой путь через главный вход. В замок также ведёт церковный округ. Ориентир: благодать «Главные ворота Пристанища Теней».",
            "maps": [
              {
                "file": "shadow-keep/site-of-grace-location-main-gate-plaza.webp",
                "source": "golden-hippopotamus"
              }
            ]
          },
          {
            "id": "dlc-messmer-the-impaler-shadow-keep",
            "name": "Мессмер Колосажатель",
            "location": "Верх Хранилища образцов в Пристанище Теней, за благодатью «Вход в тёмные покои».",
            "note": "Две фазы в одном бою. Победа даёт огонь для открытия Энир-Илим.",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "shadow-keep/site-of-grace-location-messmer-dark-chamber.webp",
                "source": "messmer-the-impaler"
              }
            ]
          }
        ]
      },
      {
        "name": "Река Аскетов",
        "bosses": [
          {
            "id": "dlc-rakshasa-eastern-mausoleum",
            "name": "Ракшаса",
            "location": "Безымянный восточный мавзолей. Спуститесь по выступам возле благодати «Нижний поток реки Аскетов», затем идите вверх по руслу.",
            "maps": [
              {
                "file": "recluses-river/boss-rakshasa.webp",
                "source": "rakshasa"
              }
            ]
          },
          {
            "id": "dlc-jori-elder-inquisitor-darklight-catacombs",
            "name": "Главный инквизитор Йори",
            "location": "Сумрачные катакомбы, последняя камера. Вход на кладбище ниже реки Аскетов.",
            "note": "После боя открывается проход в Лес бездны.",
            "maps": [
              {
                "file": "recluses-river/site-of-grace-location-forsaken-graveyard.webp",
                "source": "jori-elden-inquisitor"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Лазурное побережье",
    "index": 24,
    "areas": [
      {
        "name": "Побережье",
        "bosses": [
          {
            "id": "dlc-ghostflame-dragon-cerulean-coast",
            "name": "Дракон смерти",
            "location": "Равнина с голубыми цветами к югу от благодати «Лазурное побережье».",
            "maps": [
              {
                "file": "cerulean-coast/boss-ghostflame-dragon-cerulean-coast.webp",
                "source": "ghostflame-dragon-cerulean-coast"
              }
            ]
          },
          {
            "id": "dlc-dancer-of-ranah-southern-mausoleum",
            "name": "Танцовщица Ранаха",
            "location": "Безымянный южный мавзолей на острове у западного берега Лазурного побережья. К острову ведёт тоннель под берегом.",
            "note": "Ориентир: благодать «Лазурное побережье, запад».",
            "maps": [
              {
                "file": "cerulean-coast/dancer-of-ranah-location.webp",
                "source": "dancer-of-ranah"
              }
            ]
          },
          {
            "id": "dlc-demi-human-queen-marigga-cerulean-coast",
            "name": "Королева полулюдей Маригга",
            "location": "Пляж к северо-западу от благодати «Лазурное побережье, запад», за проходом вдоль скал.",
            "maps": [
              {
                "file": "cerulean-coast/boss-demi-human-queen-marigga.webp",
                "source": "demi-human-queen-marigga"
              }
            ]
          },
          {
            "id": "dlc-putrescent-knight-stone-coffin-fissure",
            "name": "Гниющий рыцарь",
            "location": "Разлом в каменном саркофаге на южной оконечности побережья. За последней благодатью спрыгните с головы каменной статуи.",
            "note": "Проход в разлом открывается после того, как спадают чары великой руны Микеллы.",
            "maps": [
              {
                "file": "cerulean-coast/site-of-grace-location-garden-of-deep-purple.webp",
                "source": "putrescent-knight"
              }
            ]
          }
        ]
      },
      {
        "name": "Тайная могила Харо",
        "bosses": [
          {
            "id": "dlc-death-rite-bird-charos-hidden-grave",
            "name": "Погребальная птица",
            "location": "Тайная могила Харо. Затопленное кладбище к северу от одноимённой благодати.",
            "note": "В этой локации птица встречается и днём, и ночью.",
            "maps": [
              {
                "file": "charo-s-hidden-grave/boss-death-rite-bird-charo-hidden-grave.webp",
                "source": "death-rite-bird-charos-hidden-grave"
              }
            ]
          },
          {
            "id": "dlc-lamenter-lamenters-gaol",
            "name": "Плакальщик",
            "location": "Тюрьма плакальщика, последняя камера. Путь ко входу идёт через кладбище Тайной могилы Харо.",
            "maps": [
              {
                "file": "charo-s-hidden-grave/site-of-grace-location-lamenter-gaol.webp",
                "source": "lamenter"
              }
            ]
          },
          {
            "id": "dlc-tibia-mariner-charos-hidden-grave",
            "name": "Лодочник Тибия",
            "location": "Тайная могила Харо, мелководье к юго-западу от благодати «Великий алтарь драконьего причастия».",
            "maps": [
              {
                "file": "charo-s-hidden-grave/boss-tibia-mariner-charo-hidden-grave.webp",
                "source": "tibia-mariner-charos-hidden-grave"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Зубатая гора",
    "index": 25,
    "areas": [
      {
        "name": "Подножие",
        "bosses": [
          {
            "id": "dlc-jagged-peak-drake-dragons-pit-terminus",
            "name": "Дракон зубатой горы",
            "location": "Котловина сразу за дальним выходом из Драконьей ямы.",
            "note": "Одиночная встреча. Здесь дорога раздваивается к горе и Великому алтарю драконьего причастия. Ориентир: благодать «Выход из Драконьей ямы».",
            "maps": [
              {
                "file": "jagged-peak/boss-jagged-peak-drake.webp",
                "source": "jagged-peak-drake"
              }
            ]
          },
          {
            "id": "dlc-jagged-peak-drakes-duo",
            "name": "Два дракона зубатой горы",
            "location": "Котловина выше благодати «Подножие зубатой горы», к юго-востоку от неё.",
            "note": "Драконы уже сражаются друг с другом. Встреча учитывается один раз.",
            "maps": [
              {
                "file": "jagged-peak/boss-jagged-peak-drake-duo.webp",
                "source": "jagged-peak-drake-duo"
              }
            ]
          }
        ]
      },
      {
        "name": "Склон и вершина",
        "bosses": [
          {
            "id": "dlc-ancient-dragon-senessax-jagged-peak",
            "name": "Древний дракон Сенессакс",
            "location": "Большая затопленная пещера на подъёме от «Подножия зубатой горы» к благодати «Склон зубатой горы».",
            "maps": [
              {
                "file": "jagged-peak/boss-ancient-dragon-senessax.webp",
                "source": "ancient-dragon-senessax"
              }
            ]
          },
          {
            "id": "dlc-bayle-the-dread-jagged-peak-summit",
            "name": "Бейл Ужасный",
            "location": "Кратер за благодатью «Вершина зубатой горы», в конце подъёма по горе.",
            "maps": [
              {
                "file": "jagged-peak/site-of-grace-location-rest-of-the-dread-dragon.webp",
                "source": "bayle-the-dread"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Прибежище Рауха",
    "index": 26,
    "areas": [
      {
        "name": "Прибежище Рауха",
        "bosses": [
          {
            "id": "dlc-rugalea-the-great-red-bear-rauh-base",
            "name": "Великий красный медведь Ругали",
            "location": "Лесная часть ущелья, рядом с благодатью «Север ущелья», по пути к Катакомбам под Скорпионовой рекой.",
            "maps": [
              {
                "file": "ancient-ruins/boss-rulagea-the-great-bear.webp",
                "source": "rugalea-the-great-bear"
              }
            ]
          },
          {
            "id": "dlc-death-knight-scorpion-river-catacombs",
            "name": "Рыцарь Смерти",
            "location": "Катакомбы под Скорпионовой рекой, последняя камера. Вход в конце реки к северо-западу от Руин города-храма.",
            "note": "Этот рыцарь с длинным топором.",
            "maps": [
              {
                "file": "ancient-ruins/site-of-grace-location-scorpion-river-catacombs.webp",
                "source": "death-knight-scorpion-river-catacombs"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Руины древней обители Рауха",
    "index": 27,
    "areas": [
      {
        "name": "Руины древней обители Рауха",
        "bosses": [
          {
            "id": "dlc-divine-beast-dancing-lion-ancient-ruins-of-rauh",
            "name": "Священный танцующий лев",
            "location": "Нижняя площадка к востоку от благодати «Древние руины, главная лестница». На арену можно спуститься по вершинам колонн.",
            "note": "Этот вариант призывает василисков.",
            "maps": [
              {
                "file": "ancient-ruins/boss-divine-beast-dancing-lion-ancient-ruins.webp",
                "source": "divine-beast-dancing-lion-ancient-ruins"
              }
            ]
          },
          {
            "id": "dlc-romina-saint-of-the-bud-church-of-the-bud",
            "name": "Ромина, Святая Цветочных Бутонов",
            "location": "Храм Цветочных бутонов на западе руин, за благодатью «Храм Цветочных бутонов, главный вход».",
            "note": "За ареной находится запечатывающее древо на пути в Энир-Илим.",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "ancient-ruins/site-of-grace-location-church-of-the-bud.webp",
                "source": "romina-saint-of-the-bud"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Вид на Древо Упадка",
    "index": 28,
    "areas": [
      {
        "name": "Пристанище Теней",
        "bosses": [
          {
            "id": "dlc-commander-gaius-shadow-keep-back-gate",
            "name": "Командующий Гай",
            "location": "Открытое поле за задними воротами Пристанища Теней. Путь к воротам проходит через верхние уровни Хранилища образцов.",
            "note": "Ориентир: благодать «Пристанище Теней, задние ворота».",
            "maps": [
              {
                "file": "shadow-keep/boss-commander-gaius.webp",
                "source": "commander-gaius"
              }
            ]
          },
          {
            "id": "dlc-scadutree-avatar-scadutree-base",
            "name": "Воплощение Древа Упадка",
            "location": "Затопленная арена у подножия Древа Упадка за благодатью «Святилище почитателей Древа». Путь идёт из осушенного церковного округа Пристанища Теней.",
            "note": "Три фазы одного боя.",
            "maps": [
              {
                "file": "shadow-keep/site-of-grace-location-tree-worship-sanctum.webp",
                "source": "scadutree-avatar"
              }
            ]
          }
        ]
      },
      {
        "name": "Внутренние земли",
        "bosses": [
          {
            "id": "dlc-tree-sentinel-hinterland",
            "name": "Страж Древа",
            "location": "Западный страж на дороге между благодатями «Внутренние земли» и «Мост внутренних земель», ближе к первой.",
            "note": "Примените жест «О матерь» у статуи Марики рядом с задними воротами Пристанища Теней, чтобы открыть путь.",
            "maps": [
              {
                "file": "shadow-keep/boss-tree-sentinel-hinterland1.webp",
                "source": "tree-sentinel-hinterland-1"
              }
            ]
          },
          {
            "id": "dlc-tree-sentinel-hinterland-bridge",
            "name": "Страж Древа",
            "location": "Восточный страж на дороге между благодатями «Внутренние земли» и «Мост внутренних земель», ближе к мосту.",
            "note": "У двух стражей отдельные победы.",
            "maps": [
              {
                "file": "shadow-keep/boss-tree-sentinel-hinterland2.webp",
                "source": "tree-sentinel-hinterland-2"
              }
            ]
          },
          {
            "id": "dlc-fallingstar-beast-fingerstone-hill",
            "name": "Зверь Падающей звезды",
            "location": "Кратер у благодати «Холм каменных пальцев», на подходе к Руинам обители пальцев Део.",
            "maps": [
              {
                "file": "shadow-keep/boss-fallingstar-beast-hinterland.webp",
                "source": "fallingstar-beast-hinterland"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Лес бездны",
    "index": 29,
    "areas": [
      {
        "name": "Лес бездны",
        "bosses": [
          {
            "id": "dlc-midra-lord-of-frenzied-flame-midras-manse",
            "name": "Мидра, Владыка Яростного Пламени",
            "location": "Поместье Мидры на юго-западе Леса бездны. Арена в соседнем зале от благодати «Комната на втором этаже».",
            "maps": [
              {
                "file": "abyssal-woods/site-of-grace-location-midra-library.webp",
                "source": "midra-lord-of-the-frenzied-flame"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Энир-Илим",
    "index": 30,
    "areas": [
      {
        "name": "Энир-Илим",
        "bosses": [
          {
            "id": "dlc-promised-consort-radahn-divine-gate",
            "name": "Будущий консорт Радан",
            "location": "Энир-Илим, арена за благодатью «Внешняя лестница божественных врат».",
            "note": "Финальный бой дополнения. Обе фазы учитываются как одна победа.",
            "type": "Сюжетный",
            "maps": [
              {
                "file": "enir-ilim/site-of-grace-location-gate-of-divinity.webp",
                "source": "promised-consort-radahn"
              }
            ]
          }
        ]
      }
    ]
  }
];

export const bossRegions = regions.map(region => ({ ...region, bosses: region.areas.flatMap(area => area.bosses) }));
export const bossById = new Map(bossRegions.flatMap(region => region.bosses.map(boss => [boss.id, boss])));
