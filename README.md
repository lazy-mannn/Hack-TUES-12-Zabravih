# SmeeHive

IoT система за интелигентно наблюдение на пчелни кошери в реално време. Устройства ESP32-S3, монтирани в кошерите, записват сензорни данни (температура, влажност, CO2) и аудио, което се анализира от ML модел базиран на YAMNet за засичане на присъствието на майката пчела.

## За проекта

Проектът включва:
- Django REST API бекенд, хостван с Gunicorn и Nginx
- Next.js фронтенд с интерактивно табло (графики, циферблати, шестоъгълна мрежа от кошери)
- ESP32-S3 фърмуер, събиращ температура, влажност, CO2 и аудио
- YAMNet ML модел за засичане на майката пчела от аудио записи
- PostgreSQL база данни за съхранение на измервания и метаданни
- BLE provisioning за конфигурация на WiFi credentials директно от устройството

### Как работи

1. ESP32-S3 устройството в кошера събира сензорни данни и записва 10-секунден аудио клип
2. Данните се изпращат към Django API чрез HTTPS multipart POST
3. Django стартира YAMNet ML модел, който анализира аудиото и определя статуса на майката (QNP / QPNA / QPR / QPO)
4. Резултатите се съхраняват в PostgreSQL и се визуализират в Next.js таблото
5. Пчеларят вижда графики за здравето на кошера и статус на майката в реално време

## Изградено с

<p align="left">
  <a href="https://www.djangoproject.com/" target="_blank"><img src="https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white" /></a>
  <a href="https://www.django-rest-framework.org/" target="_blank"><img src="https://img.shields.io/badge/Django%20REST-ff1709?style=for-the-badge&logo=django&logoColor=white" /></a>
  <a href="https://nextjs.org/" target="_blank"><img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" /></a>
  <a href="https://react.dev/" target="_blank"><img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" /></a>
  <a href="https://www.typescriptlang.org/" target="_blank"><img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" /></a>
  <a href="https://tailwindcss.com/" target="_blank"><img src="https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" /></a>
  <a href="https://www.tensorflow.org/" target="_blank"><img src="https://img.shields.io/badge/TensorFlow-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white" /></a>
  <a href="https://www.postgresql.org/" target="_blank"><img src="https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white" /></a>
  <a href="https://gunicorn.org/" target="_blank"><img src="https://img.shields.io/badge/Gunicorn-499848?style=for-the-badge&logo=python&logoColor=white" /></a>
  <a href="https://nginx.org/" target="_blank"><img src="https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white" /></a>
  <a href="https://platformio.org/" target="_blank"><img src="https://img.shields.io/badge/PlatformIO-FF7F00?style=for-the-badge&logo=platformio&logoColor=white" /></a>
  <a href="https://www.espressif.com/en/products/socs/esp32-s3" target="_blank"><img src="https://img.shields.io/badge/ESP32--S3-E7352C?style=for-the-badge&logo=espressif&logoColor=white" /></a>
</p>

## Архитектура

![architecture](architecture.png)

## Отбор

- [Iliya Iliev](https://github.com/lazy-mannn)
- [Alexander Grigorov](https://github.com/Mr-TopG)
- [Alexander Beshev](https://github.com/MrBeshev)
- [Antoan Tsonkov](https://github.com/smookie77)
- [Nevena Dimitrova](https://github.com/nevena331)
