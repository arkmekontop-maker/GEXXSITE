# ATHAR

Deutschsprachige Lernplattform mit salafitisch-atharitischem Schwerpunkt. Das bestehende GitHub-Projekt wird weiterverwendet.

## Was enthalten ist

- Neues responsives Design mit heller und dunkler Ansicht, mobilen Menüs und Tastaturbedienung.
- Zwölf Hadithe, sechs Qur’an-Themen, fünf Gelehrtenprofile, sechs Kurzlektionen in drei Lernpfaden und sechs Bibliothekszugänge.
- Themen- und Sammlungfilter, globale Suche, Merkliste mit Export und lokaler Lernfortschritt.
- Drei Gesprächsräume. Ohne Server ausdrücklich lokal; mit Server gemeinsame Nachrichten, Registrierung, Sitzungen, Echtzeitaktualisierung, Lösch- und Meldefunktion.
- Frühere lokale Beiträge aus `athar-posts` bleiben im lokalen Gesprächsraum einsehbar. Die frühere Demo-Anmeldung wird niemals als echte Serversitzung übernommen.

## Statische Website

Die vier Dateien `index.html`, `styles.css`, `content.js` und `app.js` gemeinsam auf das bestehende Webhosting übertragen. Die Lernfunktionen benötigen keinen Server. Auch auf statischem Hosting bleiben Nachrichten lokal; eine erfolgreiche GitHub-Aktualisierung ist keine Bereitstellung auf einem IONOS-VPS. GitHub Pages war bei der Projektprüfung nicht aktiviert.

## Lokal starten

Node.js 24 oder neuer erforderlich. Es werden keine npm-Pakete benötigt.

```bash
npm test
npm start
```

Anschließend `http://127.0.0.1:3000` öffnen. Das Node-Modul `node:sqlite` kann eine experimentelle Warnung ausgeben. Die Daten liegen in `data/athar.sqlite`. Diese Daten und `.env` nicht in Git committen.

## Auf einem VPS mit HTTPS starten

Voraussetzungen: Docker mit Compose, eine eigene Domain mit DNS auf den VPS und freie Ports 80/443. Die folgende Konfiguration übernimmt diese Ports; einen vorhandenen Webserver zuerst in die eigene Hosting-Konfiguration einplanen. Es wurde kein VPS verbunden oder verändert.

1. Repository auf dem VPS klonen oder aktualisieren.
2. Eine `.env` im Projektordner mit der eigenen Domain anlegen:

   ```dotenv
   ATHAR_DOMAIN=deine-eigene-domain.de
   ADMIN_USERNAME=
   ```

3. Starten:

   ```bash
   docker compose up -d --build
   docker compose logs --tail=60
   ```

Caddy richtet HTTPS für die konfigurierte Domain ein. Node ist nur intern erreichbar. Die Anwendung braucht `PUBLIC_ORIGIN` exakt passend zum Browser-Ursprung, ohne abschließenden Schrägstrich. HTTPS setzt sichere Sitzungscookies. `TRUST_PROXY=1` nur hinter dem eigenen Reverse-Proxy verwenden; den Node-Port dabei nicht öffentlich freigeben.

## Administration aktivieren

1. Zuerst ein eigenes Konto auf der laufenden Website registrieren.
2. Den existierenden Benutzernamen in `.env` als `ADMIN_USERNAME` eintragen.
3. `docker compose up -d --force-recreate athar` ausführen.

Beim Start wird ausschließlich ein bereits existierendes Konto mit diesem Namen zum Administrator. Es gibt kein vorgegebenes Passwort und keine automatische Vergabe von Adminrechten an die erste Registrierung. Im Profil erscheint die Liste gemeldeter Nachrichten. Administratoren können Nachrichten löschen. Das Entfernen der Umgebungsvariable entzieht bereits vergebene Rechte nicht; dafür die Rolle des betroffenen Kontos gezielt in der Datenbank zurücksetzen.

## Daten, Betrieb und Grenzen

Passwörter werden mit individuellem Salt und scrypt gehasht, Sitzungstokens nur als Hash gespeichert. Schreibzugriffe prüfen den Ursprung. Nachrichten werden als Text dargestellt. Registrierung, Anmeldeversuche und Nachrichten sind begrenzt. SQLite speichert Konten, Sitzungen, Nachrichten und Meldungen dauerhaft. Die 100 neuesten Nachrichten eines Raums werden angezeigt; ältere bleiben in der Datenbank. Kontolöschung entfernt das Konto, seine Sitzungen, Nachrichten und Meldungen.

Dies ist eine funktionale Grundlage für eine kleine Community, kein ausfallsicherer Großplattformbetrieb. Passwort-Wiederherstellung, E-Mail-Verifikation, umfassende Moderationsabläufe, geräteübergreifende Merklisten und automatische Backups sind nicht enthalten. Betreiber- und Kontaktangaben müssen vor dem öffentlichen Betrieb ergänzt werden. Meldungen werden nur gespeichert, nicht automatisch an jemanden versandt.

Für ein konsistentes Backup den Dienst kurz stoppen und das Docker-Volume `athar-data` sichern. Nicht nur die laufende SQLite-Hauptdatei ohne ihre WAL-Dateien kopieren. Vor größeren Änderungen eine Wiederherstellung des Backups in einer getrennten Umgebung prüfen.

## Quellen und Redaktion

Quellenlinks stehen direkt an den Einträgen in `content.js`. Quran.com und Sunnah.com dienen zum Nachlesen des vollständigen Texts. Verwendete Gelehrtenarchive: `binbaz.org.sa`, `binothaimeen.net`, `al-albany.com`, `al-badr.net` und `al-abbaad.com`. Die deutschen Einführungen sind redaktionelle Zusammenfassungen, keine autorisierten Gesamtübersetzungen oder Fatwas. Keine Verbindung oder Empfehlung durch die genannten Archive wird behauptet.

## Prüfung

`npm test` prüft Serverfunktionen einschließlich Zugangsschutz, Herkunftsprüfung, Nachrichtenspeicherung, Kontolöschung und Moderation. Syntax und statische Inhaltsverweise werden zusätzlich geprüft. Eine visuelle Prüfung in einem Browser war in der Arbeitsumgebung nicht verfügbar.
