# Makon — yotoqxona boshqaruvi

O‘zbek tilidagi, telefonga mos ishlaydigan demo. A va B blokda 14 tadan, C blokda 18 ta xona; har xonada 4 ta o‘rin — jami 184 ta o‘rin.

## Ishga tushirish

Python 3 o‘rnatilgan kompyuterda shu papkada:

```powershell
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Brauzerda http://127.0.0.1:8000 ni oching. `index.html`ni bevosita ochish o‘rniga HTTP serverdan foydalaning: dastur ES modullar bilan ishlaydi.

## Nimalar ishlaydi

- Boshqaruv: tushum, qolgan qarz, xarajat, foyda, bandlik va yaqin to‘lovlar.
- Sana filtri: oxirgi 30 kun, shu oy, o‘tgan oy, shu yil va istalgan sana oralig‘i.
- Xonalar va bo‘sh joylar: bloklar, xonalardagi 4 o‘rin, bo‘sh o‘ringa bola qo‘shish.
- Bolalar: ism, familiya, telefon, xona, kelgan sana, holat, qidiruv, to‘lov tarixi va ketgan deb belgilash.
- Qarzdorlar: to‘liq yoki qisman to‘lov qabul qilish.
- Xarajatlar: kommunal, soliq va boshqa xarajatlarni kiritish.

Har 30 kunlik davr kelgan sanadan boshlanadi va 800 000 so‘m hisoblanadi. Dastlabki to‘lov kelgan kuni. Keyingi davrga 5 kun qolganda eslatma ko‘rinadi. Qisman to‘lov qarzni kamaytiradi; qoldiq keyingi davrga o‘tadi. To‘lov sanasi billing sanasini o‘zgartirmaydi. Avans navbatdagi davrni qoplaydi. Bola ketganda band o‘rin bo‘shaydi, yangi davr hisoblanmaydi, oldingi qarz va to‘lov tarixi saqlanadi. Boshlangan davr uchun avtomatik kunlik qayta hisoblash yoki qaytarish mavjud emas.

Tushum va xarajatlar tanlangan sanalar bo‘yicha, qolgan qarz va bandlik esa bugungi holat bo‘yicha ko‘rsatiladi. Sana Asia/Tashkent vaqt mintaqasida hisoblanadi.

## Demo ma’lumotlari

Dastlab 151 ta namunaviy bola, 33 ta bo‘sh o‘rin, 17 ta qarzdor va 24 ta yaqin to‘lov bor. Namuna sanalari birinchi ochilgan kunga moslanadi. Ismlar va telefonlar demo uchun yaratilgan.

Ma’lumotlar `localStorage`da **faqat shu brauzerda** saqlanadi. Boshqa telefon yoki brauzer bilan sinxronlash yo‘q. Brauzer ma’lumotlarini tozalash demo yozuvlarini ham o‘chiradi. `DEMO` tugmasi orqali namunaviy holatga qaytish mumkin; tasdiqlash so‘raladi. Bu server bazasi yoki ko‘p foydalanuvchili ishlab chiqarish tizimi emas.

Telefon brauzeri menyusidan “Bosh ekranga qo‘shish” orqali bosh ekranda yorliq yaratiladi. Alohida APK yoki iOS paketi yaratilmagan.

## Tekshirish

Node.js 20+ bilan:

```powershell
npm.cmd install
npm.cmd test
npm.cmd run check
```

14 ta hisob-kitob testi va DOM bilan integratsiya tekshiruvlari (jami 24 ta test) o‘tdi: 25/30-kun chegaralari, qisman va oldindan to‘lov, xonaning sig‘imi, chiqib ketish, tarix, sanalar hamda ekranlardagi amallar. `linkedom` faqat test uchun kerak; demo tashqi JavaScript kutubxonalarisiz ishlaydi. Brauzer ulanishi mavjud bo‘lmagani sababli avtomatik vizual QA bajarilmadi.
