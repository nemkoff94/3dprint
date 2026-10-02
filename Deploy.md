# Deploy 3delo на VPS (Node.js + Nginx + SSL)

Ниже пошаговая инструкция для деплоя проекта на Ubuntu VPS с реальным доменом.

## 1. Что должно быть заранее

1. У вас есть VPS с Ubuntu (рекомендуется 22.04/24.04).
2. Есть домен, который вы контролируете.
3. Проект уже запушен в GitHub.
4. На локальной машине все изменения закоммичены (`git status` чистый).

## 2. Настройка DNS домена

У регистратора домена добавьте записи:

1. `A` запись для `@` -> IP вашего VPS.
2. `A` запись для `www` -> IP вашего VPS (по желанию).
3. Если используете IPv6: `AAAA` записи для `@` и `www`.

Проверьте, что домен резолвится:

```bash
dig +short your-domain.com
dig +short www.your-domain.com
```

## 3. Подключение к VPS и базовая подготовка

```bash
ssh root@YOUR_VPS_IP
```

Обновите пакеты:

```bash
apt update && apt upgrade -y
```

Создайте пользователя для деплоя (если еще нет):

```bash
adduser deployer
usermod -aG sudo deployer
```

Дальше работайте под этим пользователем:

```bash
su - deployer
```

## 4. Установка Node.js, Git, Nginx

### Вариант A (NodeSource, Node 20 LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx
```

Проверка:

```bash
node -v
npm -v
git --version
nginx -v
```

## 5. Клонирование проекта из GitHub

Перейдите в домашнюю папку:

```bash
cd ~
```

Клонируйте репозиторий:

```bash
git clone git@github.com:YOUR_GITHUB_USERNAME/YOUR_REPO.git 3dprint
cd 3dprint
```

Если репозиторий публичный, можно HTTPS:

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO.git 3dprint
cd 3dprint
```

Установите зависимости:

```bash
npm ci
```

## 6. Создание .env для production

В корне проекта создайте файл `.env`:

```bash
nano .env
```

Пример содержимого:

```env
NODE_ENV=production
PORT=3000
SESSION_SECRET=CHANGE_THIS_TO_LONG_RANDOM_SECRET
DB_PATH=data/3delo.sqlite
ADMIN_EMAIL=admin@your-domain.com
ADMIN_LOGIN=admin@your-domain.com
ADMIN_PASSWORD=CHANGE_THIS_ADMIN_PASSWORD
```

Важно для этого проекта:

1. Логин админки берется из `ADMIN_LOGIN` (или `ADMIN_EMAIL`).
2. Пароль админки берется из `ADMIN_PASSWORD`.
3. В production должен быть `NODE_ENV=production`, чтобы cookie сессии были `secure`.

Сгенерировать хороший `SESSION_SECRET` можно так:

```bash
openssl rand -base64 48
```

## 7. Первый запуск и проверка приложения

Запустите вручную:

```bash
npm start
```

Проверьте локально на VPS:

```bash
curl -I http://127.0.0.1:3000
```

Если все ок, остановите процесс (`Ctrl+C`) и настройте автозапуск через `systemd`.

## 8. Автозапуск через systemd

Создайте unit-файл:

```bash
sudo nano /etc/systemd/system/3delo.service
```

Содержимое:

```ini
[Unit]
Description=3Delo Node.js app
After=network.target

[Service]
Type=simple
User=deployer
WorkingDirectory=/home/deployer/3dprint
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

# Безопасные лимиты
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Примените и запустите:

```bash
sudo systemctl daemon-reload
sudo systemctl enable 3delo
sudo systemctl start 3delo
sudo systemctl status 3delo --no-pager
```

Логи:

```bash
journalctl -u 3delo -f
```

## 9. Настройка Nginx (домен + reverse proxy)

Создайте конфиг сайта:

```bash
sudo nano /etc/nginx/sites-available/3delo
```

Вставьте:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Активируйте сайт:

```bash
sudo ln -s /etc/nginx/sites-available/3delo /etc/nginx/sites-enabled/3delo
```

(Опционально) отключите дефолтный сайт:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

Проверка и перезапуск nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 10. SSL через Let's Encrypt (Certbot)

Установите Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Выпустите сертификат и автоматически включите HTTPS:

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Проверка автообновления сертификатов:

```bash
sudo systemctl status certbot.timer --no-pager
sudo certbot renew --dry-run
```

После этого сайт должен открываться по `https://your-domain.com`.

## 11. Firewall (рекомендуется)

Если используете UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 12. Как обновлять проект после каждого git push

На VPS:

```bash
cd ~/3dprint
git pull
npm ci
sudo systemctl restart 3delo
sudo systemctl status 3delo --no-pager
```

Проверка после релиза:

```bash
curl -I https://your-domain.com
```

## 13. Бэкап SQLite перед обновлениями

Проект использует SQLite (`data/3delo.sqlite`), поэтому перед крупными изменениями делайте бэкап:

```bash
cd ~/3dprint
mkdir -p backups
cp data/3delo.sqlite backups/3delo-$(date +%F-%H%M).sqlite
```

## 14. Частые проблемы

1. `502 Bad Gateway` в nginx:
- Приложение не запущено: `sudo systemctl status 3delo`
- Ошибки в приложении: `journalctl -u 3delo -n 200 --no-pager`

2. Не работает логин в админку:
- Проверьте `ADMIN_LOGIN`/`ADMIN_EMAIL` и `ADMIN_PASSWORD` в `.env`
- После изменения `.env` перезапустите сервис: `sudo systemctl restart 3delo`

3. Certbot не может выпустить сертификат:
- Домен не указывает на VPS
- Порт 80 закрыт firewall-ом
- Nginx конфиг с ошибкой (`sudo nginx -t`)

## 15. Мини-чеклист готовности

1. `https://your-domain.com` открывается.
2. `sudo systemctl status 3delo` -> `active (running)`.
3. `sudo nginx -t` -> `syntax is ok`.
4. `sudo certbot renew --dry-run` проходит.
5. В админку можно войти с переменными из `.env`.
