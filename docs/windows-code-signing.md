# Windows Code Signing és SmartScreen terv

## Cél

A Project Maker telepítő legyen hitelesen azonosítható, módosítás ellen védett és professzionálisan terjeszthető Windows felhasználóknak.

Fontos: nem lehet garantálni, hogy semmilyen védelmi rendszer soha nem fog jelezni. A cél a valós kockázat csökkentése, a kiadói reputáció építése és az ellenőrizhető, aláírt release folyamat.

## Jelenlegi státusz

`v0.1.2` MVP installer:

- Authenticode státusz: `NotSigned`
- SHA256: `9A287BF78B3D86E56F588EC9A5B61A1DC5C139F21DE375D168EFDCAB8D2F3758`

Ez azt jelenti, hogy SmartScreen/Defender figyelmeztetés előfordulhat. Széles körű terjesztés előtt aláírt release szükséges.

## Mit old meg a kódtanúsítvány?

- Igazolja a kiadói identitást.
- Bizonyítja, hogy a fájl nem módosult az aláírás óta.
- Segít a SmartScreen kiadói reputáció felépítésében.

## Mit nem garantál?

- Nem garantál azonnali SmartScreen bypass-t.
- Nem garantálja, hogy egy frissen kiadott fájl hash-e már ismert és reputációval rendelkezik.
- Nem helyettesíti a tiszta buildet, dependency ellenőrzést, malware scan-t és megbízható release folyamatot.

## Ajánlott terjesztési utak

### 1. Microsoft Store

A legbiztosabb végfelhasználói út, mert a Store-on keresztül telepített appot Microsoft újra aláírja, és normál esetben nincs SmartScreen warning.

### 2. Microsoft Artifact Signing / Trusted Signing

Ajánlott nem-Store terjesztéshez, különösen GitHub Actions vagy Azure DevOps CI/CD esetén.

Előnyök:

- Microsoft által kezelt signing szolgáltatás.
- Nem kell saját hardver tokennel vagy exportálható PFX-szel dolgozni.
- CI/CD-be illeszthető.

Korlát:

- Sikeres identitásvalidáció kell.
- SmartScreen reputáció így is idővel épül.

### 3. OV/EV code signing tanúsítvány

OV vagy EV code signing certificate is használható, ha megbízható CA-tól származik.

Korlát:

- A modern Windows SmartScreen viselkedésben az EV certificate sem garantál automatikus első letöltéses warning mentességet.
- A kulcskezelés jellemzően HSM/token alapú, nem egyszerű PFX fájl.

## Release checklist

1. `pnpm checkpoint`
2. `pnpm tauri:build`
3. Installer és app executable aláírása.
4. Aláírás ellenőrzése:

```powershell
Get-AuthenticodeSignature ".\Project Maker_0.1.1_x64-setup.exe"
```

5. SHA256 checksum generálása:

```powershell
Get-FileHash -Algorithm SHA256 ".\Project Maker_0.1.1_x64-setup.exe"
```

6. Release assetek feltöltése:

- aláírt `.exe`
- `.sha256`
- release notes

7. Ellenőrzés tiszta Windows gépen:

- letöltés GitHub Releasesből
- telepítés
- app indítás
- új projekt mentés
- PDF/Excel export
- uninstall

## Microsoft/Defender false positive kezelés

Ha Defender vagy SmartScreen továbbra is jelez:

1. Ellenőrizni kell, hogy az `.exe` tényleg aláírt és a signature valid.
2. Ellenőrizni kell, hogy a release asset nem módosult aláírás után.
3. Ellenőrizni kell dependency auditot és malware scan eredményt.
4. Enterprise/internal környezetben IT admin küldheti be a fájlt Microsoft Security Intelligence review-ra.
5. Külső publikus terjesztésnél a reputáció tiszta letöltésekkel és futásokkal épül.

## Felhasználói kommunikáció

Publikus release oldalra mindig kerüljön:

- verziószám
- publisher név
- SHA256 hash
- aláírási státusz
- ismert biztonsági megjegyzés
- kizárólagos letöltési forrás: GitHub Releases vagy Microsoft Store
