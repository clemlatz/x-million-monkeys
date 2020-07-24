# X Million Monkeys

X Million Monkeys is a massively multiplayer online creative writing game, created in less than 48 hours during the HTML5 Game Jam back in july 2014 by [@AlexisMoroz](https://twitter.com/AlexisMoroz) (game design) and [@ClementBourgoin](https://twitter.com/ClementBourgoin) (code). The game jam theme was "Once Upon A Time".

Demo: https://xmm.iwazaru.fr/

## Run using docker

Attach MySQL database with `--env DB=mysql://user:pass@host/base` or with a `.env` file.

```console
docker run -d -p 3300:8080 \
  --env-file=.env \
  --restart=unless-stopped \
  --name xmm \
  iwazaru/x-million-monkeys
```

## Run locally from source

1. Install node & yarn
2. Install node & bower dependencies: `yarn`
3. Create config file: `mv config.js.example config.js`
4. Edit `config.js` to add database credentials
5. Start app: `PORT=3000 DB=mysql://user:pass@host/base yarn start`

## Build docker image from source

```console
docker build -t iwazaru/x-million-monkeys:latest .
```

## Changelog

### 0.24.6 (26/11/2019)

- Updated sequelize dependency to fix security flaw

### 0.24.5 (29/07/2019)

- Allowed to run in a Docker container
- Allowed to use any MySQL database
- Fixed non-capitalized table name in SQL query

### 0.24.4 (18/07/2019)

- Fixed getting ordered pages (Sequelize v5 breaking change)
- Removed unused dependencies
- Upgraded outdated dependencies
- Fixed navigating pages

### 0.24.3 (18/07/2019)

- Upgraded dependencies to fix multiple security flaws

### 0.24.2 (07/02/2015)

- Added link to GitHub repository

### 0.24.1 (30/12/2014)

- added ClearDB MySQL support
- route to oldest page by default
- various bug fixes and memory optimizations

### 0.24 (29/12/2014)

- new router rule: create a new page if all are crowded (>= 4 monkeys)
- disabled touch navigation on non-touch devices
- fixed share on twitter box
- revamped database transaction
- revamped config management
- added postgresql support
- added bower support

### 0.23.2 (04/11/2014)

- fixed monkey count in log

### 0.23.1 (29/10/2014)

- comma bug fixed

### 0.23 (29/10/2014)

- node.js revamp

### 0.22.2 (12/07/2014)

- negative word count bug fixed

### 0.22.1 (12/07/2014)

- removed ponctuation characters from random theme
- 5-letters or more words for random theme
- plurals
- character to stick input to the previous one

### 0.22 (07/07/2014)

- random page theme generator
- admin commands (reload, theme, broadcast)

### 0.21.3 (06/07/2014)

- server-crashing bug fix

### 0.21.1 (07/06/2014)

- various bug fixes

### 0.21 (06/06/2014)

- real time input preview
- added ‘.fr’, ‘.com’ & ‘.net’ to forbiddent input list

### 0.20.5 (06/06/2014)

- page -1 bug fixed
- monkey is not destroyed on client disconnection if there is still monkeys for this client

### 0.20.4 (04/06/2014)

- scroll to input when changing page
- added swipe threshold
- key stroke sound now only plays for current page update
- getting « too slow » for other pages update fixed

### 0.20.3 (03/06/2014)

- home button fix
- better alerts
- smartphone width fixed
- iOS sound fixed
- touch devices : swipe to change page

### 0.20.2 (01/06/2014)

- « Page 7 » server bug workaround for the client

### 0.20.1 (01/06/2014)

- « Everyone keeps writing on my page » bug fix

### 0.20 (01/06/2014)

- websocket (real-time updates)
- new invite/tutorial

### 0.19.6 (25/05/2014)

- input history fix (again)

### 0.19.5 (25/05/2014)

- input history fix

### 0.19.4 (25/05/2014)

- input history
- b&w Twitter & Facebook logo
- Twitter logo links to #xmm tweets
- new tweet model
- iphone bottom margin fixed
- gzip compression

### 0.19.3 (23/05/2014)

- Facebook button fix

### 0.19.2

- Facebook button fix

### 0.19.1

- Facebook button
- Twitter icon

### 0.19 (22/05/2014)

- highlight system
- share on Twitter
- browser wide-highlight bug fixed
- new forbidden character : ^

### 0.18 (21/05/2014)

- new router rules
- new duplicate protection
- text selection bug
- do not add space before characters . , and -
- do not add space and character before character \_
- forbidden characters : /\|@#[]{} http www

### 0.17.2 (19/05/2014)

- new server

### 0.17.1 (15/05/2014)

- navigation quickfix

### 0.17 (15/05/2014)

- navigation shortcut : Ctrl+H (home page)
- page change bug fixed
- shorts tooltip
- in-page logo with link to homepage
- 30 characters limit and spaces allowed
- total player count in title and footer

### 0.16 (14/05/2014)

- navigation shortcut : Ctrl+J (previous page) / Ctrl+K (next page)

### 0.15

- ajax navigation
- new router rules
- page stats fade in when filled

### 0.14

- server stats
- page navigation
- open graph elements

### 0.13

- pages system and router
- dynamic favicon
- cosmetic adjustments
- scroll to page bottom on load
- pull interval maximum to 5 second

### 0.12

- correct font for input field
- fade to black top and bottom

### 0.11

- not updated text (span) bug fix

### 0.10

- update mechanism
- 34 character limit
- break-word
- accents fixed
- apostrophe fixed

### 0.9

- various bug fixes

### 0.8

- change word / letter mode

### 0.7

- word mode
- touch here to write

### 0.6

- messages d’erreurs intégré
- géré la perte de connexion
- autocapitalisation off (iOS)
- curseur clignotant rouge
- viré le « are » et remplacer par text, centré
- sons intégrés
