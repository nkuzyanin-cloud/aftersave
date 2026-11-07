
# AFTERSAVE 0.5 в Cloudflare

Worker отдаёт личную библиотеку, достижения и интервалы автоучёта только после входа. Steam-ключ остаётся в Cloudflare. Постеры, иконки, условия и доли игроков берутся из публичных данных Steam. Если Steam не возвращает отдельное поле, приложение покажет доступную информацию.

## Обновить Worker

1. Распакуйте комплект и откройте PowerShell в папке с `wrangler.toml`. Для команд нужен Node.js с npm.
2. В Cloudflare откройте **Workers & Pages → aftersave-steam → Settings → Variables and Secrets**. Оставьте `STEAM_API_KEY`. Убедитесь, что установлен `STEAM_ID` с вашим SteamID64. Добавьте секрет `AFTERSAVE_PASSWORD` со случайным паролем длиной от 24 символов. Это отдельный пароль AFTERSAVE.
3. Выполните `npx wrangler@latest login` и авторизуйтесь в аккаунте с этим Worker. Если хотите автоучёт времени, настройте D1 ниже перед развёртыванием. Если нужен только арт и достижения, сразу выполните `npx wrangler@latest deploy --keep-vars`.
4. Откройте `https://aftersave-steam.n-kuzyanin.workers.dev/health`. Ответ нового Worker содержит `"version":5`. В AFTERSAVE откройте **Профиль → значок Steam → Защищённое подключение**, введите пароль и синхронизируйте. На вкладке «Достижения» нажмите **Обновить**, чтобы заменить старый кэш.

`wrangler.toml` добавляет ограничения частоты запросов. Существующие секреты сохраняются при развёртывании. Приложение держит сеанс в памяти до перезагрузки страницы или истечения часа. Защищённое подключение заменяет режим публичного Worker.

## Автоучёт времени Steam

Steam отдаёт общее число минут и иногда время последнего запуска. Worker каждые 15 минут опрашивает библиотеку и сохраняет обнаруженный прирост по каждой игре. AFTERSAVE может быть закрыт. Дата обнаружения может отставать от момента игры, особенно после офлайн-игры или позднего обновления счётчика Steam. Интервалы не означают точное время старта и остановки. Старые сессии не восстанавливаются. Ручные сессии остаются отдельными, и приложение не суммирует их с автоучётом.

В той же папке, после входа через Wrangler:

1. Создайте базу командой `npx wrangler@latest d1 create aftersave-activity`. Скопируйте показанный `database_id`.
2. Добавьте в конец `wrangler.toml` следующий блок. Подставьте ID своей базы.

~~~toml
[[d1_databases]]
binding = "STEAM_ACTIVITY"
database_name = "aftersave-activity"
database_id = "ВСТАВЬТЕ_ID_БАЗЫ"

[triggers]
crons = ["*/15 * * * *"]
~~~

3. Создайте таблицы и разверните Worker.

~~~powershell
npx wrangler@latest d1 execute aftersave-activity --remote --file=./activity.sql
npx wrangler@latest deploy --keep-vars
~~~

4. Первый опрос запомнит исходные счётчики. Сыграйте и дождитесь, пока Steam обновит минуты, затем дождитесь очередного опроса. После синхронизации в AFTERSAVE новый интервал появится в профиле и во вкладке **Сессии → Автоучёт Steam**. В D1 интервалы хранятся 90 дней. В приложении загружаются до 3000 последних интервалов.

[Секреты Worker](https://developers.cloudflare.com/workers/configuration/secrets/) · [Создание базы D1](https://developers.cloudflare.com/d1/get-started/) · [Расписание Worker](https://developers.cloudflare.com/workers/configuration/cron-triggers/) · [Steam Web API](https://partner.steamgames.com/doc/webapi/IPlayerService)
