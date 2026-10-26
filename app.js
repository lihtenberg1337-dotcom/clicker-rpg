        /* --- СЦЕНАРИЙ И ЛОГИКА (JAVASCRIPT) --- */

        // === JS: ДИНАМИЧЕСКАЯ ГЕНЕРАЦИЯ ЛУТА (каталога itemDatabase больше нет) ===
        const LOOT_SLOTS = ['weapon', 'tool', 'artifact'];

        // База по слотам: имя, род (для склонения качества), иконка и стат, который усиливает бонус
        const SLOT_BASE = {
            weapon:   { base: 'Гладиус',  gender: 'm', icon: '🗡️', field: 'gpcMultiplier',  desc: 'силе клика' },
            tool:     { base: 'Кирка',    gender: 'f', icon: '⛏️', field: 'gpsMultiplier',   desc: 'пассивному доходу' },
            artifact: { base: 'Талисман', gender: 'm', icon: '💎', field: 'chestMultiplier', desc: 'золоту из сундуков' }
        };

        // Качество: 70% обычное / 25% редкое / 5% эпическое + множитель к бонусу
        const LOOT_RARITY = [
            { key: 'common', chance: 0.70, mult: 1,   m: 'Обычный',   f: 'Обычная',  label: 'Обычное' },
            { key: 'rare',   chance: 0.25, mult: 1.5, m: 'Редкий',    f: 'Редкая',   label: 'Редкое' },
            { key: 'epic',   chance: 0.05, mult: 2.5, m: 'Эпический', f: 'Эпическая', label: 'Эпическое' }
        ];

        // Три слота экипировки (порядок отображения в «Профиле»)
        const EQUIP_SLOTS = [
            { key: 'weapon',   label: 'Оружие',    icon: '⚔️' },
            { key: 'tool',     label: 'Инструмент', icon: '🛠️' },
            { key: 'artifact', label: 'Артефакт',   icon: '🔮' }
        ];

        const SLOT_LABEL = { weapon: 'Оружие', tool: 'Инструмент', artifact: 'Артефакт' };
        const SLOT_COLOR = { weapon: '#3b82f6', tool: '#22c55e', artifact: '#a855f7' };

        // === JS: МАТЕМАТИКА ЦЕН (каталоги апгрейдов) ===
        // Цена = Math.floor(basePrice * priceMultiplier^текущийУровень)
        function upgradeEntry(kind, key) {
            return kind === 'click' ? gameState.clickUpgrades[key] : gameState.passiveBuildings[key];
        }

        function upgradePrice(kind, key) {
            const u = upgradeEntry(kind, key);
            if (!u) return Infinity;
            const lvl = kind === 'click' ? u.level : u.count;
            return Math.floor(u.basePrice * Math.pow(u.priceMultiplier, lvl));
        }

        // Компактный формат для крупных чисел (12.5k / 1.4M)
        function fmtNum(n) {
            if (n >= 1e6) return (Math.floor(n) / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
            if (n >= 1e4) return (Math.floor(n) / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
            return String(Math.round(n * 100) / 100);   // дробные статы после талантов
        }

        // === JS: ТИТУЛЫ (множитель Золотого Сундука) ===
        const TITLES = [
            { name: 'Новичок',  mult: 1,  need: 0,       note: 'Стартовый ранг' },
            { name: 'Ученик',   mult: 2,  need: 10000,   note: 'Требуется: 10,000 золота всего добыто' },
            { name: 'Искатель', mult: 5,  need: 100000,  note: 'Требуется: 100,000 золота всего добыто' },
            { name: 'Маг',      mult: 15, need: 1000000, note: 'Требуется: 1,000,000 золота всего добыто' }
        ];

        // Индекс титула по суммарно добытому золоту
        function titleIndexFor(total) {
            let idx = 0;
            for (let i = 0; i < TITLES.length; i++) if ((total || 0) >= TITLES[i].need) idx = i;
            return idx;
        }

        // Текущий титул (поле gameState.currentTitle обновляет checkTitleUp)
        function currentTitle() {
            return TITLES[gameState.currentTitle] || TITLES[0];
        }

        // === JS: АВТО-ПОВЫШЕНИЕ ТИТУЛА (вызывается из addGold) ===
        function checkTitleUp() {
            const next = titleIndexFor(gameState.totalGoldEarned);
            if (next > (gameState.currentTitle || 0)) {
                gameState.currentTitle = next;
                showTitleToast(TITLES[next].name);
                updateUI();    // мгновенно обновляем HUD и вкладку «Профиль»
                saveGame();
            }
        }

        // Красивое уведомление о новом титуле
        function showTitleToast(name) {
            dropLoot({ name, rarity: 'epic' }, `Ваш титул повышен до: ${name}!`, 'Новый титул');
            document.getElementById('loot-name').style.color = '#ffaa00';   // титул — золотом
        }

        // Начисление золота: копим суммарный доход и проверяем порог титула
        function addGold(amount) {
            gameState.gold += amount;
            if (amount > 0) {
                gameState.totalGoldEarned = (gameState.totalGoldEarned || 0) + amount;
                checkTitleUp();
            }
        }        // Глобальное состояние игры (с заделом под RPG параметры)
        // === JS: КАТАЛОГИ МАГАЗИНА — единый источник правды ===
        const DEFAULT_CLICK_UPGRADES = {
            click_power_1: { name: "Заточка оружия",         level: 0, basePrice: 10,    priceMultiplier: 1.12, bonusPerLevel: 1 },
            click_power_2: { name: "Тяжелая рукоять",        level: 0, basePrice: 150,   priceMultiplier: 1.14, bonusPerLevel: 5 },
            click_power_3: { name: "Зачарованное лезвие",    level: 0, basePrice: 1500,  priceMultiplier: 1.16, bonusPerLevel: 25 },
            click_power_4: { name: "Ртутный сплав",          level: 0, basePrice: 12000, priceMultiplier: 1.18, bonusPerLevel: 150 }
        };

        const DEFAULT_PASSIVE_BUILDINGS = {
            auto_clicker: { name: "Призрачный кликер",       count: 0, basePrice: 50,     priceMultiplier: 1.15, gpsPerUnit: 1 },
            miner:        { name: "Шахтер-гном",             count: 0, basePrice: 400,    priceMultiplier: 1.15, gpsPerUnit: 8 },
            alchemist:    { name: "Алхимическая лаборатория", count: 0, basePrice: 3000,   priceMultiplier: 1.15, gpsPerUnit: 47 },
            monument:     { name: "Древний монумент",        count: 0, basePrice: 22000,  priceMultiplier: 1.16, gpsPerUnit: 260 },
            factory:      { name: "Магическая фабрика",      count: 0, basePrice: 140000, priceMultiplier: 1.17, gpsPerUnit: 1400 }
        };

        function cloneCatalog(defs) {
            return Object.fromEntries(Object.entries(defs).map(([k, v]) => [k, { ...v }]));
        }

        // Сливаем сохранённый каталог с дефолтом: недостающие позиции/поля всегда на месте
        function mergeCatalog(defs, saved) {
            const out = cloneCatalog(defs);
            Object.entries(saved || {}).forEach(([k, v]) => { if (out[k]) out[k] = { ...out[k], ...(v || {}) }; });
            return out;
        }

        // === JS: ДЕРЕВО ТАЛАНТОВ — пул прокачки ===
        const DEFAULT_TALENTS = {
            warrior_1:   { name: "Острый клинок",   level: 0, maxLevel: 3, description: "+10% к силе клика (GPC) за уровень", cost: 1, type: "click" },
            alchemist_1: { name: "Густые растворы", level: 0, maxLevel: 3, description: "+5% к пассивному доходу (GPS) за уровень", cost: 1, type: "passive" },
            scout_1:     { name: "Чутье на золото", level: 0, maxLevel: 3, description: "+15% к золоту из Золотых сундуков", cost: 1, type: "chest" }
        };

        // Ветки дерева: три вертикальные колонки во вкладке «Профиль»
        const TALENT_BRANCHES = [
            { key: 'warrior_1',   title: 'Ветка Воина',    icon: '⚔️' },
            { key: 'alchemist_1', title: 'Ветка Алхимика', icon: '⚗️' },
            { key: 'scout_1',     title: 'Ветка Искателя', icon: '🧭' }
        ];

        let gameState = {
            gold: 0,

            // === JS: Активные апгрейды (Клик) — линейка «Боевые навыки» ===
            clickUpgrades: cloneCatalog(DEFAULT_CLICK_UPGRADES),

            // === JS: Пассивные постройки — линейка «Ресурсы» ===
            passiveBuildings: cloneCatalog(DEFAULT_PASSIVE_BUILDINGS),

            // === JS: Дерево талантов ===
            talentPoints: 3,        // 3 очка на старте (для теста)
            talents: cloneCatalog(DEFAULT_TALENTS),

            // === JS: Криты — база 0%, бонусы даёт оружие в слоте ===
            critChance: 0,        // база строго 0% на старте
            critMultiplier: 5,    // множитель крита (x5)

            // === JS: Три слота экипировки (динамический лут, объекты предметов) ===
            equipment: {
                weapon: null,     // слот оружия (клики, криты)
                tool: null,       // слот инструмента (пассивный доход)
                artifact: null    // слот артефакта (сундуки, удача)
            },

            // === JS: ТОРГОВАЯ ГИЛЬДИЯ — торговые экспедиции (караваны) ===
            caravan: {
                isActive: false,
                timeLeft: 0,
                duration: 300,        // 5 минут в секундах
                rewardMultiplier: 1   // зависит от открытых лицензий
            },

            // === JS: Титул — множитель награды Золотого Сундука ===
            totalGoldEarned: 0,    // суммарно заработанное золото за всё время
            currentTitle: 0,       // индекс титула в TITLES (авто-повышение)

            // === JS: Босс для Подземелья ===
            bosses: [
                { name: "Огненный Демон",   img: "images/demon.png",  hp: 50,   reward: 25 },
                { name: "Древний Дракон",   img: "images/dragon.png", hp: 180,  reward: 90 },
                { name: "Глубинный Кракен", img: "images/kraken.png", hp: 500,  reward: 250 },
                { name: "Король-Лич",       img: "images/lich.png",   hp: 1200, reward: 600 }
            ],

            // === JS: Прогресс и версия схемы ===
            playerLvl: 1,          // уровень игрока (награда в данже = lvl * 50)
            saveVersion: 7,        // версия схемы (7 — динамический лут + караваны)

            // === JS: Подземелье ===
            isInDungeon: false,     // внутри подземелья?
            dungeonCombo: [],       // правильная комбинация стрелок
            playerCombo: [],        // введённая игроком комбинация
            dungeonTimer: 4,        // остаток времени на ввод (сек)
            dungeonCooldown: 0,     // откат входа (сек), 30 после выхода
            dungeonStage: "puzzle", // "puzzle" | "secret"
            secretBossHp: 0,        // HP Секретного Босса в данже
            secretBossMaxHp: 0
        };

        // Загрузка сохранений из localStorage при старте
        function loadGame() {
            const savedData = localStorage.getItem('fantasy_clicker_save');
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);
                    gameState = { ...gameState, ...parsed };
                    // каталоги магазина всегда полные (новые позиции появляются и в старых сейвах)
                    gameState.clickUpgrades = mergeCatalog(DEFAULT_CLICK_UPGRADES, gameState.clickUpgrades);
                    gameState.passiveBuildings = mergeCatalog(DEFAULT_PASSIVE_BUILDINGS, gameState.passiveBuildings);
                    gameState.talents = mergeCatalog(DEFAULT_TALENTS, gameState.talents);
                    const sv = parsed.saveVersion || 1;
                    if (sv < 3) migrateEconomy();       // новая математика: золото и титул
                    if (sv < 4) migrateShop();          // каталоги магазина, криты в оружии
                    if (sv < 5) migrateTitles();        // поля титула и новые пороги
                    if (sv < 7) migrateEquipment();     // статичный каталог удалён, караваны
                } catch (e) {
                    console.error("Ошибка загрузки сохранений", e);
                }
            }
            updateUI();
        }

        // Сохранение прогресса
        function saveGame() {
            localStorage.setItem('fantasy_clicker_save', JSON.stringify(gameState));
        }

        // === JS: ЭКИПИРОВКА (3 слота, в слотах лежат сгенерированные объекты) ===
        function equippedItem(slot) {
            const it = gameState.equipment[slot];
            return (it && typeof it === 'object') ? it : null;
        }

        // Процентный бонус надетого предмета в слоте (0, если слот пуст)
        function equipBonus(field, slot) {
            const it = equippedItem(slot);
            return it && typeof it[field] === 'number' ? it[field] : 0;
        }

        // Красивая подпись бонуса: «+25% Клик», «+5% Крит» …
        function itemBonusText(it) {
            if (!it) return '';
            const parts = [];
            if (it.gpcMultiplier)   parts.push(`+${Math.round(it.gpcMultiplier * 100)}% Клик`);
            if (it.critChanceBonus) parts.push(`+${Math.round(it.critChanceBonus * 100)}% Крит`);
            if (it.gpsMultiplier)   parts.push(`+${Math.round(it.gpsMultiplier * 100)}% GPS`);
            if (it.chestMultiplier) parts.push(`+${Math.round(it.chestMultiplier * 100)}% Сундуки`);
            if (it.chestSpawnBonus) parts.push(`+${Math.round(it.chestSpawnBonus * 100)}% Частота сундуков`);
            return parts.join(', ');
        }

        // === JS: БОНУСЫ ТАЛАНТОВ (множители к итоговым статам) ===
        const TALENT_COEF = { click: 0.10, passive: 0.05, chest: 0.15 };

        function talentMult(type) {
            const t = Object.values(gameState.talents || {}).find(x => x.type === type);
            return t ? 1 + t.level * (TALENT_COEF[type] || 0) : 1;
        }

        // Итоговый GPC = (база + апгрейды) × (1 + таланты Воина) × (1 + множитель оружия)
        function totalClickPower() {
            let power = 1;
            Object.values(gameState.clickUpgrades).forEach(u => { power += u.level * u.bonusPerLevel; });
            power *= talentMult('click');
            power *= 1 + equipBonus('gpcMultiplier', 'weapon');
            return Math.round(power * 100) / 100;
        }

        // Итоговый GPS = (сумма зданий) × (1 + таланты Алхимика) × (1 + множитель инструмента)
        function totalGps() {
            let gps = 0;
            Object.values(gameState.passiveBuildings).forEach(b => { gps += b.count * b.gpsPerUnit; });
            gps *= talentMult('passive');
            gps *= 1 + equipBonus('gpsMultiplier', 'tool');
            return Math.round(gps * 100) / 100;
        }

        // Крит: база 0% + бонусы оружия в слоте (Кинжал +5%, Рапира +10%)
        function totalCritChance() {
            return Math.min(1, (gameState.critChance || 0) + equipBonus('critChanceBonus', 'weapon'));
        }

        // Миграция на динамический лут: статичный каталог удалён, старые id в слотах чистим
        function migrateEquipment() {
            const old = gameState.equipment || {};
            gameState.equipment = {
                weapon:   (old.weapon && typeof old.weapon === 'object') ? old.weapon : null,
                tool:     (old.tool && typeof old.tool === 'object') ? old.tool : null,
                artifact: (old.artifact && typeof old.artifact === 'object') ? old.artifact : null
            };
            delete gameState.inventory;    // старые рюкзаки и пулы больше не нужны
            delete gameState.equipped;
            delete gameState.itemsPool;
            if (!gameState.caravan) {
                gameState.caravan = { isActive: false, timeLeft: 0, duration: 300, rewardMultiplier: 1 };
            }
            gameState.saveVersion = 7;
        }

        // Миграция экономики под новую математику (выполняется один раз)
        function migrateEconomy() {
            gameState.critMultiplier = 5;
            gameState.totalGoldEarned = Math.max(gameState.totalGoldEarned || 0, Math.floor(gameState.gold));
            gameState.saveVersion = 3;
        }

        // Миграция на каталоги магазина: старые поля уходят, криты — только в оружии
        function migrateShop() {
            // «Заточка оружия» наследует старый уровень клика (стартовал с 1)
            if (gameState.clickUpgrades && gameState.clickUpgrades.click_power_1) {
                gameState.clickUpgrades.click_power_1.level = Math.max(0, (gameState.clickLevel || 1) - 1);
            }
            // «Призрачный кликер» наследует старых наёмников
            if (gameState.passiveBuildings && gameState.passiveBuildings.auto_clicker) {
                gameState.passiveBuildings.auto_clicker.count = Math.max(0, gameState.autoLevel || 0);
            }

            ['clickPower', 'clickLevel', 'clickUpgradeCost', 'passiveIncome', 'autoLevel',
             'autoUpgradeCost', 'amuletLvl', 'amuletCost'].forEach(k => delete gameState[k]);

            gameState.critChance = 0;              // «Острый глаз» убран из магазина
            if (!gameState.equipment) gameState.equipment = { weapon: null };
            gameState.saveVersion = 4;
        }

        // Миграция полей титула: goldEarned -> totalGoldEarned, новые пороги 10k/100k/1M
        function migrateTitles() {
            const total = Math.max(gameState.totalGoldEarned || 0, gameState.goldEarned || 0);
            delete gameState.goldEarned;
            gameState.totalGoldEarned = total;
            gameState.currentTitle = titleIndexFor(total);   // без уведомления при загрузке
            gameState.saveVersion = 5;
        }

        function calcDamage() {
            const isCrit = Math.random() < totalCritChance();
            const power = totalClickPower();
            return { isCrit, dmg: isCrit ? Math.floor(power * gameState.critMultiplier) : power };
        }

        // Обновление интерфейса
        function updateUI() {
            document.getElementById('gold-count').innerText = `${Math.floor(gameState.gold)} 💰`;
            document.getElementById('gps-count').innerText = `Пассивный доход: ${fmtNum(totalGps())}/сек`;
            document.getElementById('gpc-count').innerText =
                `За клик: ${totalClickPower()} · Крит: ${Math.round(totalCritChance() * 100)}% (×${gameState.critMultiplier})`;

            // Текущий титул (множитель Золотого Сундука)
            const title = currentTitle();
            document.getElementById('title-count').innerText = `⚜ Титул: ${title.name} (×${title.mult})`;

            // === Боссовые HP/имя на главной больше не рисуем (только в Подземелье) ===

            // === Магазин: две линейки апгрейдов рендерятся из каталогов ===
            renderShop();

            // === Слоты экипировки (Профиль + угловой хинт HUD) ===
            renderEquipment();

            // Надетое снаряжение (строка над магазином)
            const worn = EQUIP_SLOTS
                .filter(s => gameState.equipment[s.key])
                .map(s => `${s.icon} ${gameState.equipment[s.key].name}`);
            document.getElementById('stat-bonus').innerText =
                worn.length ? `Надето: ${worn.join(' · ')}` : 'Слоты экипировки пусты';

            // === Вкладки и три зоны HUD (ПК / мобилки) ===
            syncLayout();

            // === Каталог предметов (правая вкладка) ===
            renderItemsCatalog();

            // === Вкладка «Профиль» и дерево талантов ===
            renderProfile();
            renderTalents();

            // === Вкладка «Торговая Гильдия» (караван) ===
            renderGuild();

            // === Подземелье: монета скрывается, открывается экран головоломки ===
            document.getElementById('coin-target').classList.toggle('hidden', gameState.isInDungeon);
            document.getElementById('chest-target').classList.toggle('hidden', gameState.isInDungeon || !chestVisible);
            document.getElementById('dungeon-screen').classList.toggle('hidden', !gameState.isInDungeon);
            document.getElementById('puzzle-view').classList.toggle('hidden', gameState.dungeonStage !== 'puzzle');
            document.getElementById('secret-boss').classList.toggle('hidden', gameState.dungeonStage !== 'secret');

            if (gameState.isInDungeon && gameState.dungeonStage === 'puzzle' && gameState.dungeonCombo.length) {
                document.getElementById('puzzle-target').innerHTML = gameState.dungeonCombo
                    .map((d, i) => `<span class="arrow ${i < gameState.playerCombo.length ? 'ok' : 'pending'}">${ARROWS[d]}</span>`)
                    .join('');
            }

            if (gameState.isInDungeon && gameState.dungeonStage === 'secret') {
                const sMax = Math.max(1, gameState.secretBossMaxHp);
                const sCur = Math.max(0, gameState.secretBossHp);
                document.getElementById('secret-hp-fill').style.width = `${(sCur / sMax) * 100}%`;
                document.getElementById('secret-hp-text').innerText = `${Math.ceil(sCur)} / ${gameState.secretBossMaxHp} HP`;
            }

            // Кнопка входа в подземелье + откат 30 секунд
            const enterBtn = document.getElementById('enter-dungeon-btn');
            const cd = Math.ceil(gameState.dungeonCooldown);
            enterBtn.disabled = gameState.isInDungeon || cd > 0;
            enterBtn.innerText = cd > 0 ? `Перезарядка: ${cd}с` : 'Войти в Подземелье';
            document.getElementById('dungeon-cool').innerText =
                gameState.isInDungeon ? 'Ты внутри подземелья' :
                cd > 0 ? `Откат входа: ${cd}с` : 'Готово к входу (раз в 30 секунд)';
        }

        // Эффект вылетающих цифр урона/добычи
        function createFloatingText(x, y, text, isCrit = false, sign = '-') {
            const clickZone = document.getElementById('click-zone');
            const el = document.createElement('div');
            el.className = isCrit ? 'floating-text crit' : 'floating-text';
            el.innerText = isCrit ? `${sign}${text} КРИТ!` : `${sign}${text}`;
            
            // Позиционирование относительно зоны клика
            const rect = clickZone.getBoundingClientRect();
            el.style.left = `${x - rect.left - 20}px`;
            el.style.top = `${y - rect.top - 20}px`;
            
            clickZone.appendChild(el);
            setTimeout(() => el.remove(), isCrit ? 760 : 600);
        }

        // === JS: ЗОЛОТАЯ МОНЕТА (главная цель) ===
        // Золотые искры при клике
        function playCoinSparks(host = document.getElementById('coin-target'), total = 8) {
            const coin = host;
            for (let i = 0; i < total; i++) {
                const spark = document.createElement('span');
                spark.className = 'coin-spark';
                const angle = (Math.PI * 2 * i) / total + (Math.random() - 0.5) * 0.6;
                const dist = 46 + Math.random() * 48;
                spark.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
                spark.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
                coin.appendChild(spark);
                setTimeout(() => spark.remove(), 660);
            }
        }

        // Клик по монете: сразу золото (база + экипировка, крит × множитель)
        document.getElementById('coin-target').addEventListener('click', (e) => {
            const { isCrit, dmg } = calcDamage();

            addGold(dmg);
            createFloatingText(e.clientX, e.clientY, dmg, isCrit, '+');
            playCoinSparks();

            updateUI();
            saveGame();
        });

        // === JS: Логика боссов (ТОЛЬКО внутри Подземелья) ===
        // Эффект удара: класс вешается при клике и сразу снимается
        function playHitEffect(imgId = 'secret-boss-img') {
            const img = document.getElementById(imgId);
            img.classList.remove('hit-effect');
            void img.offsetWidth;            // форсируем рестарт анимации
            img.classList.add('hit-effect');
            setTimeout(() => img.classList.remove('hit-effect'), 180);
        }

        // === JS: РЕНДЕР МАГАЗИНА (каталоги -> «Боевые навыки» / «Ресурсы») ===
        function renderShop() {
            const sig = JSON.stringify([gameState.clickUpgrades, gameState.passiveBuildings]);
            if (sig !== lastShopSig) {
                document.getElementById('click-upgrades-list').innerHTML =
                    Object.entries(gameState.clickUpgrades).map(([key, u]) => `
                    <div class="upgrade-item">
                        <div class="upgrade-info">
                            <h4>${u.name} <span class="upg-lvl">ур. ${u.level}</span></h4>
                            <p>+${u.bonusPerLevel} к клику${u.level ? ` · всего +${u.level * u.bonusPerLevel}` : ''}</p>
                        </div>
                        <button class="upgrade-btn" data-buy="click:${key}">Цена: ${fmtNum(upgradePrice('click', key))}</button>
                    </div>`).join('');

                document.getElementById('passive-buildings-list').innerHTML =
                    Object.entries(gameState.passiveBuildings).map(([key, b]) => `
                    <div class="upgrade-item">
                        <div class="upgrade-info">
                            <h4>${b.name} <span class="upg-lvl">×${b.count}</span></h4>
                            <p>+${b.gpsPerUnit} GPS/сек${b.count ? ` · всего +${b.count * b.gpsPerUnit}` : ''}</p>
                        </div>
                        <button class="upgrade-btn" data-buy="passive:${key}">Цена: ${fmtNum(upgradePrice('passive', key))}</button>
                    </div>`).join('');
                lastShopSig = sig;
            }

            // цены и доступность обновляем каждый кадр (золото меняется)
            document.querySelectorAll('[data-buy]').forEach(btn => {
                const [kind, key] = btn.dataset.buy.split(':');
                const price = upgradePrice(kind, key);
                btn.innerText = `Цена: ${fmtNum(price)}`;
                btn.disabled = gameState.gold < price;
            });
        }

        // Покупка апгрейда/постройки (делегирование по data-buy)
        function buyUpgrade(kind, key) {
            const u = upgradeEntry(kind, key);
            if (!u) return;
            const cost = upgradePrice(kind, key);
            if (gameState.gold < cost) return;

            gameState.gold -= cost;
            if (kind === 'click') u.level += 1; else u.count += 1;
            updateUI();
            saveGame();
        }

        function onShopBuy(e) {
            const btn = e.target.closest('[data-buy]');
            if (!btn) return;
            const [kind, key] = btn.dataset.buy.split(':');
            buyUpgrade(kind, key);
        }

        document.getElementById('click-upgrades-list').addEventListener('click', onShopBuy);
        document.getElementById('passive-buildings-list').addEventListener('click', onShopBuy);

        // === JS: ВКЛАДКА «ПРОФИЛЬ» (статистика + таблица титулов) ===
        function renderProfile() {
            const title = currentTitle();
            // точное число: разделители разрядов, до 2 знаков после точки
            const num = n => {
                const s = String(Math.round(n * 100) / 100);
                const [i, d] = s.split('.');
                return i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (d ? '.' + d : '');
            };

            document.getElementById('profile-title-name').innerText = title.name;
            document.getElementById('profile-title-mult').innerText = `Множитель сундуков: x${title.mult}`;
            document.getElementById('profile-gpc').innerText = num(totalClickPower());
            document.getElementById('profile-crit').innerText = `${Math.round(totalCritChance() * 100)}% (x${gameState.critMultiplier})`;
            document.getElementById('profile-gps').innerText = `${num(totalGps())}/сек`;
            document.getElementById('profile-total').innerText = num(Math.floor(gameState.totalGoldEarned || 0));

            // Таблица титулов перестраивается только при смене титула/порога
            const achieved = titleIndexFor(gameState.totalGoldEarned);
            const sig = `${gameState.currentTitle}:${achieved}`;
            if (sig === lastTitlesSig) return;
            lastTitlesSig = sig;

            document.getElementById('titles-table').innerHTML = TITLES.map((t, i) => `
                <div class="title-row${i === gameState.currentTitle ? ' current' : ''}${i <= achieved ? ' achieved' : ''}">
                    <span class="t-name">${t.name}</span>
                    <span class="t-mult">Множитель сундуков: x${t.mult}</span>
                    <span class="t-need">${t.note}</span>
                </div>`).join('');
        }

        // === JS: ДЕРЕВО ТАЛАНТОВ (рендер + покупка) ===
        function renderTalents() {
            document.getElementById('talent-points').innerText = gameState.talentPoints;

            const sig = JSON.stringify([gameState.talentPoints, gameState.talents]);
            if (sig === lastTalentSig) return;
            lastTalentSig = sig;

            document.getElementById('talent-columns').innerHTML = TALENT_BRANCHES.map(br => {
                const t = gameState.talents[br.key];
                if (!t) return '';
                const maxed = t.level >= t.maxLevel;
                const poor = gameState.talentPoints < t.cost;
                const off = maxed || poor;
                return `<div class="talent-branch">
                    <div class="branch-title">${br.icon} ${br.title}</div>
                    <button class="talent-btn${maxed ? ' maxed' : ''}" data-talent="${br.key}"${off ? ' disabled' : ''}>
                        <span class="tb-name">${t.name}</span>
                        <span class="tb-level">${t.level}/${t.maxLevel}</span>
                        <span class="tb-desc">${t.description}</span>
                        <span class="tb-cost">Стоимость: ${t.cost} очк.</span>
                    </button>
                </div>`;
            }).join('');
        }

        // Покупка таланта: проверка очков и максимума, списание, перерасчёт HUD
        function buyTalent(talentKey) {
            const t = gameState.talents[talentKey];
            if (!t) return false;
            if (t.level >= t.maxLevel) return false;
            if (gameState.talentPoints < t.cost) return false;

            gameState.talentPoints -= t.cost;
            t.level += 1;
            updateUI();     // полный перерасчёт: HUD, профиль, дерево, сундуки
            saveGame();
            return true;
        }

        // Клик по таланту (делегирование по data-talent)
        document.getElementById('talent-columns').addEventListener('click', e => {
            const btn = e.target.closest('[data-talent]');
            if (!btn) return;
            buyTalent(btn.dataset.talent);
        });

        // === JS: СЛОТЫ ЭКИПИРОВКИ (вкладка «Профиль» + хинт HUD) ===
        function renderEquipment() {
            const sig = JSON.stringify(gameState.equipment);
            if (sig !== lastEquipSig) {
                document.getElementById('equip-slots').innerHTML = EQUIP_SLOTS.map(s => {
                    const it = equippedItem(s.key);
                    return `<div class="equip-slot${it ? ' filled slot-' + s.key : ''}">
                        <span class="es-label">${s.icon} ${s.label}</span>
                        <span class="es-value">${it ? `${it.name} [${itemBonusText(it)}]` : 'Пусто'}</span>
                    </div>`;
                }).join('');
                lastEquipSig = sig;
            }

            // угловой хинт HUD — по оружию в слоте
            const w = equippedItem('weapon');
            const hint = document.getElementById('equip-hint');
            hint.classList.toggle('hidden', !w);
            if (w) hint.innerText = `Оружие: ${w.name} [${itemBonusText(w)}]`;
        }

        // === JS: ДИНАМИЧЕСКИЙ ДРОП С БОССА (вызывать при смерти босса) ===
        // 10% шанс: предмет генерируется процедурно — слот, качество, бонус от тира босса
        function generateBossLoot(bossLevel) {
            if (Math.random() >= 0.10) return false;      // кубик 10%

            const tier = Math.max(1, Math.floor(bossLevel) || 1);

            // 1) слот — случайный
            const slot = LOOT_SLOTS[Math.floor(Math.random() * LOOT_SLOTS.length)];

            // 2) качество — Обычное 70% / Редкое 25% / Эпическое 5%
            const roll = Math.random();
            let acc = 0, rarity = LOOT_RARITY[0];
            for (const r of LOOT_RARITY) {
                acc += r.chance;
                if (roll < acc) { rarity = r; break; }
            }

            // 3) бонус = 5% за тир босса × множитель качества (x1.5 / x2.5)
            const bonus = Math.round(tier * 0.05 * rarity.mult * 1000) / 1000;
            const base = SLOT_BASE[slot];
            const word = base.gender === 'f' ? rarity.f : rarity.m;
            const item = {
                name: `${word} ${base.base} (Тир ${tier})`,
                slot,
                rarity: rarity.key,
                rarityLabel: rarity.label,
                tier,
                bonus,
                icon: base.icon,
                [base.field]: bonus,                 // gpcMultiplier | gpsMultiplier | chestMultiplier
                description: `+${Math.round(bonus * 100)}% к ${base.desc}`
            };

            // 4) авто-экипировка: старый предмет заменяется, только если бонус нового выше
            const old = equippedItem(slot);
            if (!old || bonus > (old.bonus || 0)) {
                gameState.equipment[slot] = item;
                dropLoot(item, `${SLOT_LABEL[slot]} · ${item.description} · ${rarity.label}`);
            } else {
                dropLoot(item, `Надетое сильнее: ${old.name} [${itemBonusText(old)}]`, 'Предмет не заменил снаряжение');
            }
            updateUI();
            saveGame();
            return item;
        }

        // === JS: КАТАЛОГ ПРЕДМЕТОВ (сетка в правой вкладке) ===
        function renderItemsCatalog() {
            const box = document.getElementById('inventory-grid');
            const sig = JSON.stringify(gameState.equipment);
            if (sig === lastInvSig) return;      // не перерисовываем без изменений
            lastInvSig = sig;

            // Каталога больше нет — показываем только то, что реально надето
            const drops = EQUIP_SLOTS
                .map(s => ({ s, it: gameState.equipment[s.key] }))
                .filter(x => x.it);

            if (!drops.length) {
                box.innerHTML = '<div class="inv-empty"><span class="empty-icon">🎒</span>' +
                    'Рюкзак пуст — добычай лут из боссов в Подземелье</div>';
                return;
            }

            box.innerHTML = drops.map(({ s, it }) => {
                const short = (itemBonusText(it).split(', ')[0]) || it.description;
                return `<div class="inventory-slot rarity-${it.rarity || 'common'} equipped slot-${s.key}" title="${it.name} · ${it.description}">
                    <span class="slot-icon">${it.icon || s.icon}</span>
                    <span class="slot-bonus">${short}</span>
                    <span class="slot-tag on">Надето</span>
                </div>`;
            }).join('');
        }

        // === JS: ПОДЗЕМЕЛЬЕ ===
        const ARROWS = { L: '←', U: '↑', R: '→', D: '↓' };
        const DUNGEON_TIME_MS = 4000;     // время на ввод комбинации
        const DUNGEON_COOLDOWN = 30;      // откат входа (сек)
        let dungeonDeadline = 0;
        let dungeonInterval = null;
        let activeTab = 'sec-gear';
        let lastInvSig = '';
        let lastShopSig = '';
        let lastEquipSig = '';
        let lastTitlesSig = '';
        let lastTalentSig = '';

        function setPuzzleStatus(msg, cls) {
            const el = document.getElementById('puzzle-status');
            el.innerText = msg;
            el.className = 'puzzle-status' + (cls ? ' ' + cls : '');
        }

        function stopDungeonTick() {
            if (dungeonInterval) { clearInterval(dungeonInterval); dungeonInterval = null; }
        }

        function startDungeonTick() {
            stopDungeonTick();
            const fill = document.getElementById('puzzle-timer-fill');
            dungeonInterval = setInterval(() => {
                const left = Math.max(0, dungeonDeadline - Date.now());
                gameState.dungeonTimer = left / 1000;
                fill.style.width = `${(left / DUNGEON_TIME_MS) * 100}%`;
                setPuzzleStatus(`Осталось ${(left / 1000).toFixed(1)}с`, '');
                if (left <= 0) dungeonFail('Время вышло — замок заблокирован!');
            }, 50);
        }

        // Вход в подземелье (откат 30 секунд)
        function startDungeon() {
            if (gameState.isInDungeon || gameState.dungeonCooldown > 0) return;
            const dirs = ['L', 'U', 'R', 'D'];
            gameState.dungeonCombo = Array.from({ length: 4 },
                () => dirs[Math.floor(Math.random() * dirs.length)]);
            gameState.playerCombo = [];
            gameState.dungeonTimer = DUNGEON_TIME_MS / 1000;
            gameState.dungeonStage = 'puzzle';
            gameState.isInDungeon = true;
            dungeonDeadline = Date.now() + DUNGEON_TIME_MS;
            setPuzzleStatus('Повтори комбинацию!', '');
            startDungeonTick();
            updateUI();
            saveGame();
        }

        // Ввод стрелки игроком
        function onArrow(dir) {
            if (!gameState.isInDungeon || gameState.dungeonStage !== 'puzzle') return;
            const i = gameState.playerCombo.length;
            if (gameState.dungeonCombo[i] !== dir) {
                dungeonFail('Замок заблокирован! Неверная стрелка.');
                return;
            }
            gameState.playerCombo.push(dir);
            updateUI();                       // подсветка введённых стрелок
            if (gameState.playerCombo.length === gameState.dungeonCombo.length) dungeonSuccess();
        }

        // Успех: золото, потом кубик 10% на Секретного Босса
        function dungeonSuccess() {
            stopDungeonTick();
            const reward = gameState.playerLvl * 50;
            addGold(reward);
            setPuzzleStatus(`Взломано! +${reward} золота`, 'ok');
            updateUI();
            saveGame();
            setTimeout(() => {
                if (Math.random() < 0.10) spawnSecretBoss();
                else exitDungeon();
            }, 900);
        }

        // Провал: без награды выбрасывает из данжа
        function dungeonFail(msg) {
            stopDungeonTick();
            setPuzzleStatus(msg, 'fail');
            setTimeout(exitDungeon, 1200);
        }

        // Секретный Босс: Король-Лич с x2 HP
        function spawnSecretBoss() {
            const lich = gameState.bosses[gameState.bosses.length - 1];
            gameState.secretBossMaxHp = Math.floor(lich.hp * 2);
            gameState.secretBossHp = gameState.secretBossMaxHp;
            gameState.dungeonStage = 'secret';
            const screen = document.getElementById('dungeon-screen');
            screen.classList.remove('shake');
            void screen.offsetWidth;
            screen.classList.add('shake');
            setTimeout(() => screen.classList.remove('shake'), 520);
            updateUI();
            saveGame();
        }

        // Клик по Секретному Боссу
        document.getElementById('secret-boss-img').addEventListener('click', (e) => {
            if (!gameState.isInDungeon || gameState.dungeonStage !== 'secret') return;
            const { isCrit, dmg } = calcDamage();
            gameState.secretBossHp -= dmg;
            createFloatingText(e.clientX, e.clientY, dmg, isCrit);
            playHitEffect('secret-boss-img');
            if (gameState.secretBossHp <= 0) defeatSecretBoss();
            updateUI();
            saveGame();
        });

        // Победа над Личем: кубик 10% на процедурный предмет (тир = уровень игрока)
        function defeatSecretBoss() {
            let msg = 'Лич повержен!';
            const drop = generateBossLoot(gameState.playerLvl);
            if (drop) msg = `Лич повержен! Выпал ${drop.name}!`;
            setPuzzleStatus(msg, 'ok');
            updateUI();
            saveGame();
            setTimeout(exitDungeon, 1500);
        }

        // Сочное уведомление о луте (descOverride — свой текст, headerOverride — заголовок тоста)
        function dropLoot(item, descOverride, headerOverride) {
            const toast = document.getElementById('loot-toast');
            toast.querySelector('.loot-title').innerText = headerOverride || 'Найдено в Подземелье';
            document.getElementById('loot-name').innerText = item.name;
            document.getElementById('loot-name').style.color = (item.slot && SLOT_COLOR[item.slot]) || '#ffaa00';
            document.getElementById('loot-desc').innerText = descOverride ||
                `${(item.slot && SLOT_LABEL[item.slot]) || 'Предмет'} · ${item.description || ''}`;
            toast.classList.remove('hidden', 'show');
            void toast.offsetWidth;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                toast.classList.add('hidden');
            }, 2600);
        }

        // Выход из подземелья + откат 30 секунд
        function exitDungeon() {
            stopDungeonTick();
            gameState.isInDungeon = false;
            gameState.dungeonStage = 'puzzle';
            gameState.dungeonCombo = [];
            gameState.playerCombo = [];
            gameState.dungeonTimer = 0;
            gameState.dungeonCooldown = DUNGEON_COOLDOWN;
            setPuzzleStatus('', '');
            updateUI();
            saveGame();
        }

        // === JS: Адаптивный HUD (ПК — три зоны сразу, мобилки — вкладки) ===
        const DESKTOP_MIN_WIDTH = 769;   // всё, что шире — десктопная раскладка

        function isDesktop() {
            return window.innerWidth >= DESKTOP_MIN_WIDTH;
        }

        // Синхронизация видимости зон и страниц вкладок под ширину экрана
        function syncLayout() {
            const desk = isDesktop();

            document.querySelectorAll('.tab-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.tab === activeTab));

            if (desk) {
                // ПК: вкладки ничего не скрывают — видны все три зоны
                document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('hidden'));
                document.getElementById('left-panel').classList.remove('hidden');
                document.getElementById('right-panel').classList.remove('hidden');
                return;
            }

            // Мобилки: активна только выбранная страница/зона
            document.querySelectorAll('.tab-page').forEach(p =>
                p.classList.toggle('hidden', p.id !== activeTab));
            document.getElementById('left-panel').classList.toggle('hidden', activeTab !== 'sec-gear');
            document.getElementById('right-panel').classList.toggle('hidden',
                activeTab !== 'sec-inventory' && activeTab !== 'sec-dungeon');
        }

        // Переключение вкладок
        function switchTab(tabId) {
            activeTab = tabId;

            // Проверка ширины экрана: на ПК скрытие вкладок не применяется
            if (window.innerWidth >= DESKTOP_MIN_WIDTH) {
                document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('hidden'));
                document.getElementById('left-panel').classList.remove('hidden');
                document.getElementById('right-panel').classList.remove('hidden');
            }

            updateUI();   // внутри — syncLayout() с учётом текущей ширины
        }

        // Вкладки нижней панели
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // Пересборка раскладки при смене ширины окна (мобилка <-> ПК)
        window.addEventListener('resize', () => syncLayout());

        // Кнопки стрелок головоломки
        document.querySelectorAll('.arrow-btn').forEach(btn => {
            btn.addEventListener('click', () => onArrow(btn.dataset.dir));
        });

        // Вход в подземелье
        document.getElementById('enter-dungeon-btn').addEventListener('click', startDungeon);

        // === JS: МАГАЗИН — две под-вкладки (Боевые навыки / Ресурсы) ===
        document.querySelectorAll('.shop-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.shop-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
                document.querySelectorAll('.shop-page').forEach(p =>
                    p.classList.toggle('hidden', p.id !== btn.dataset.shop));
            });
        });

        // === JS: ЗОЛОТОЙ СУНДУК ===
        const CHEST_SPAWN_MS = 30000;   // тестовый интервал (боевой — 120000)
        let chestVisible = false;

        // Появление в случайной точке арены (только на главной)
        function spawnChest() {
            if (gameState.isInDungeon) return;
            const zone = document.getElementById('click-zone');
            const chest = document.getElementById('chest-target');
            const size = chest.offsetWidth || 76;
            chest.style.left = `${Math.random() * Math.max(0, zone.clientWidth - size)}px`;
            chest.style.top = `${Math.random() * Math.max(0, zone.clientHeight - size)}px`;
            chestVisible = true;
            chest.classList.remove('hidden');
            void chest.offsetWidth;          // форсируем рестарт анимации появления
        }

        // Интервал появления сундука: артефакт повышает частоту (+10% -> интервал короче)
        function chestIntervalMs() {
            const bonus = equipBonus('chestSpawnBonus', 'artifact');
            return Math.max(5000, Math.round(CHEST_SPAWN_MS / (1 + bonus)));
        }

        function scheduleChest() {
            setTimeout(() => { spawnChest(); scheduleChest(); }, chestIntervalMs());
        }

        // Клик по сундуку: (GPS * 60, либо базовые 50) × множитель титула
        document.getElementById('chest-target').addEventListener('click', (e) => {
            const title = currentTitle();
            const gps = totalGps();
            const base = gps > 0 ? gps * 60 : 50;
            const reward = Math.floor(base * title.mult * talentMult('chest') * (1 + equipBonus('chestMultiplier', 'artifact')));

            addGold(reward);
            createFloatingText(e.clientX, e.clientY, reward, false, '+');
            playCoinSparks(document.getElementById('chest-target'), 10);

            chestVisible = false;
            document.getElementById('chest-target').classList.add('hidden');
            updateUI();
            saveGame();
        });

        scheduleChest();   // первый сундук — через CHEST_SPAWN_MS

        // === JS: ТОРГОВАЯ ГИЛЬДИЯ (караваны) ===
        // Отправка: требуется секундный пассивный доход (GPS > 0)
        function sendCaravan() {
            const c = gameState.caravan;
            if (c.isActive || totalGps() <= 0) return;
            c.isActive = true;
            c.timeLeft = c.duration;
            updateUI();
            saveGame();
        }

        // Возвращение: куш = (GPS × 300 сек) × множитель лицензий
        function completeCaravan() {
            const c = gameState.caravan;
            c.isActive = false;
            c.timeLeft = 0;
            const reward = Math.floor(totalGps() * c.duration * c.rewardMultiplier);
            addGold(reward);
            dropLoot({ name: 'Караван вернулся' },
                `Торговый путь принёс: ${fmtNum(reward)} 💰`, 'Торговая Гильдия');
            updateUI();
            saveGame();
        }

        // Рендер вкладки: кнопка отправки, таймер обратного отсчёта, множитель лицензий
        function renderGuild() {
            const c = gameState.caravan;
            const btn = document.getElementById('send-caravan-btn');
            const timer = document.getElementById('caravan-timer');
            if (!btn || !timer) return;

            document.getElementById('caravan-mult').innerText =
                `Множитель лицензий: ×${c.rewardMultiplier}`;

            if (c.isActive) {
                btn.disabled = true;
                btn.innerText = 'Караван в пути…';
                timer.classList.add('busy');
                const m = Math.floor(c.timeLeft / 60);
                const s = Math.max(0, Math.ceil(c.timeLeft - m * 60));
                timer.innerText = `Возвращение через: ${m}:${String(s).padStart(2, '0')}`;
            } else {
                const gpsOk = totalGps() > 0;
                btn.disabled = !gpsOk;
                btn.innerText = 'Отправить Караван (5 мин)';
                timer.classList.remove('busy');
                timer.innerText = gpsOk
                    ? `Ожидаемая награда: ${fmtNum(totalGps() * c.duration * c.rewardMultiplier)} 💰`
                    : 'Нужен пассивный доход (GPS > 0), чтобы отправить караван';
            }
        }

        document.getElementById('send-caravan-btn').addEventListener('click', sendCaravan);

        // Таймер пассивного дохода + откат данжа (каждые 100мс для плавности)
        setInterval(() => {
            if (totalGps() > 0) {
                addGold(totalGps() / 10);   // плавные тики: 0.1 от GPS каждые 100мс
                updateUI();
            }
            if (gameState.dungeonCooldown > 0 && !gameState.isInDungeon) {
                gameState.dungeonCooldown = Math.max(0, gameState.dungeonCooldown - 0.1);
                updateUI();
            }
            // Караван: время пути идёт от общего игрового таймера (0.1 сек за тик)
            if (gameState.caravan.isActive) {
                gameState.caravan.timeLeft = Math.max(0, gameState.caravan.timeLeft - 0.1);
                if (gameState.caravan.timeLeft <= 0) completeCaravan();
                updateUI();
            }
        }, 100);
// Автосохранение каждые 10 секунд
setInterval(saveGame, 10000);
// Инициализация игры
loadGame();

// === JS: МОДАЛКА ОТЗЫВА (Google Форма) ===
// Открытие/закрытие только переключают display — игровой цикл и
// плавный пассивный доход продолжают работать на заднем плане
function openFeedbackModal() {
    document.getElementById('feedbackModal').style.display = 'block';
    document.getElementById('feedback-overlay').style.display = 'block';
}

function closeFeedbackModal() {
    document.getElementById('feedbackModal').style.display = 'none';
    document.getElementById('feedback-overlay').style.display = 'none';
}

document.getElementById('feedback-btn').addEventListener('click', openFeedbackModal);
document.getElementById('feedback-close').addEventListener('click', closeFeedbackModal);
