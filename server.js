var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var strftime = require('strftime');
var validator = require('validator');
var Sequelize = require('sequelize');

var version = '0.24.4';

if (typeof process.env.PORT === 'undefined') {
  console.error('PORT env variable must be defined (see README)');
  process.exit();
}

if (typeof process.env.DB === 'undefined') {
  console.error('DB env variable must be defined (see README)');
  process.exit();
}

var sequelize = new Sequelize(process.env.DB, { logging: false });

sequelize
  .authenticate()
  .then(function() {
    var config = sequelize.connectionManager.config;
    console.log(
      'sequelize-heroku: Connected to ' +
        config.host +
        ' as ' +
        config.username +
        '.'
    );

    // Start web server
    http.listen(process.env.PORT, function() {
      log('Web server listening on port ' + process.env.PORT);
    });
  })
  .catch(function(err) {
    var config = sequelize.connectionManager.config;
    console.log(
      'Sequelize: Error connecting ' +
        config.host +
        ' as ' +
        config.user +
        ': ' +
        err
    );
  });

// Page entity schema
var Pages = sequelize.define('Page', {
  content: Sequelize.TEXT,
  last_player: Sequelize.STRING,
  version: Sequelize.INTEGER,
  timestamp: Sequelize.BIGINT,
  theme: Sequelize.STRING,
  theme_words: Sequelize.INTEGER,
});

// Monkey entity schema
var Monkeys = sequelize.define('Monkey', {
  online: Sequelize.BOOLEAN,
  token: Sequelize.STRING,
  ip: Sequelize.STRING,
  seen: Sequelize.DATE,
});

// Input entity schema
var Inputs = sequelize.define('Input', {
  monkey_token: Sequelize.STRING,
  page_version: Sequelize.INTEGER,
  content: Sequelize.STRING,
  status: Sequelize.BOOLEAN,
});

// Relations
Pages.hasMany(Monkeys);
Monkeys.belongsTo(Pages);

Pages.hasMany(Inputs);
Inputs.belongsTo(Pages);

Monkeys.hasMany(Inputs);
Inputs.belongsTo(Monkeys);

// Sync schemas
sequelize
  .sync()
  .then(function() {
    log('Sequelize: Database schema synced !');

    // Resetting online count
    log('Resetting monkey count to 0...');
    sequelize.query(
      'UPDATE `Monkeys` SET `online` = 0, `PageId` = NULL WHERE `online` = 1 OR `PageId` IS NOT NULL'
    );
  })
  .catch(function(err) {
    log('Sequelize: An error occurred while creating the table:', err);
  });

// Assets
app.use(express.static(__dirname + '/client/assets'));
app.use(express.static(__dirname + '/client/libs'));

// Other pages
app.get('/:num', function(req, res) {
  res.sendFile(__dirname + '/client/index.html');
});

// Home page
app.get('/', function(req, res) {
  res.sendFile(__dirname + '/client/index.html');
});

// Socket connect
io.on('connection', function(socket) {
  log('New user from: ' + socket.handshake.address);

  // Check version
  socket.on('version', function(local_version) {
    if (local_version == version) {
      socket.emit('uptodate');
    } else {
      socket.emit(
        '_error',
        'Your client (v' +
          local_version +
          ') is obsolete, a new version of this app (v' +
          version +
          ') is available. Please refresh the page.'
      );
    }
  });

  // Handshake
  socket.on('handshake', function(token) {
    log('Handshake with token: ' + token);

    // Look for  monkey with this token
    Monkeys.findOne({ where: { token: token } }).then(function(monkey) {
      // No monkey, create one
      if (!monkey) {
        // Insert new monkey with this token
        monkey = Monkeys.build({
          token: token,
          ip: socket.handshake.address,
          online: false,
          seen: new Date(),
        });

        monkey
          .save()
          .then(function(err) {
            log('Created new monkey (#' + monkey.id + ') with token: ' + token);
            connected(socket, monkey);
          })
          .catch(function(err) {
            throw err;
          });
      }

      // Else update monkey seen
      else {
        log('Retrieved a monkey with token: ' + token);

        monkey.online = true;
        monkey.seen = new Date();
        monkey.save();

        connected(socket, monkey);
      }
    });
  });
});

function connected(socket, monkey) {
  socket.emit('connected');

  socket.on('disconnect', function() {
    log('Monkey #' + monkey.id + ' disconnected.');

    monkey.online = false;
    monkey.setPage(null);
    monkey.save().then(function() {
      updateCount(socket);
    });
  });

  // Get route
  socket.on('route', function() {
    log('Monkey #' + monkey.id + ' asked for route.');

    Pages.findAndCountAll({
      attributes: ['id', 'createdAt'],
      include: [Monkeys],
      order: ['createdAt'],
    }).then(function(result) {
      var pages = result.rows,
        route,
        rule;

      if (result.count) {
        // Page occupation
        var total = 0,
          count = 0,
          key,
          page,
          ideal = [],
          crowded = [],
          empty = [],
          blank = [];
        for (key in pages) {
          page = pages[key];
          count = page.Monkeys.length;
          if (count >= 4) crowded.push(page.id);
          if (count === 0) empty.push(page.id);
          if (count < 4) ideal.push(page.id);
          total++;
        }

        // Router rules
        if (crowded.length == total) {
          // All pages are crowded, create a new one
          rule = 'all page crowded, creating a new one';
        } else if (empty.length == total) {
          // All pages are empty, go to page 1
          route = pages[0].id;
          rule = 'all pages empty';
        } else if (ideal.length) {
          // If there is at least one ideal page, go there
          route = ideal[0];
          rule = 'ideal page';
        }
      }

      if (!route) {
        Pages.create({
          content: ' ',
          version: 0,
          timestamp: 0,
          theme: ' ',
          theme_words: 1,
        }).then(function(page) {
          route = page.id;
          if (!rule) {
            rule = 'no rule set, creating a new page';
          }

          // Send route to monkey
          socket.emit('route', route);
          log(
            'Monkey #' +
              monkey.id +
              ' routed to page ' +
              route +
              ' according to rule: ' +
              rule +
              '.'
          );
        });
      } else {
        // Send route to monkey
        socket.emit('route', route);
        log(
          'Monkey #' +
            monkey.id +
            ' routed to page ' +
            route +
            ' according to rule: ' +
            rule +
            '.'
        );
      }
    });
  });

  // Get pages
  socket.on('getPages', function(date) {
    log('Monkey #' + monkey.id + ' asked for pages updated after ' + date);

    Pages.findAndCountAll().then(function(result) {
      socket.emit('pages', result.rows);
    });
  });

  // Monkey changing page
  socket.on('move', function(move) {
    Pages.findOne({ where: { id: move.to } }).then(function(page) {
      // If page not found, send monkey to home
      if (!page) {
        socket.emit('route');
      } else {
        monkey.setPage(page).then(function() {
          updateCount(socket);

          var res = { page: page };

          sequelize
            .query(
              'SELECT MIN(`id`) AS `next` FROM `pages` WHERE `id` > ' +
                page.id +
                ' LIMIT 1'
            )
            .then(function(result) {
              if (result[0][0].next) res.next = result[0][0].next;

              sequelize
                .query(
                  'SELECT MAX(`id`) AS `prev` FROM `pages` WHERE `id` < ' +
                    page.id +
                    ' LIMIT 1'
                )
                .then(function(result) {
                  if (result[0][0].prev) res.prev = result[0][0].prev;

                  log(
                    'Monkey #' +
                      monkey.id +
                      ' moved from ' +
                      move.from +
                      ' to ' +
                      move.to +
                      '.'
                  );
                  socket.emit('page', res);
                });
            });
        });
      }
    });
  });

  // Monkey saying
  socket.on('say', function(data) {
    input = formatInput(data.input);

    /* 		log("Monkey saying '"+data.input+"'"); */

    var response = { page: data.page_id, monkey: monkey.token, input: input };

    socket.broadcast.emit('say', response);
    socket.emit('say', response);
  });

  // Monkey writing
  socket.on('write', function(data) {
    var input = formatInput(data.input);

    Pages.findOne({ where: { id: data.page } }).then(function(page) {
      console.log(page.last_player + '/' + monkey.token);

      // Check input for forbidden signs
      var m = /\/|\\|\||@|#|\[|]|{|}|\^|http|www|\.com|\.fr|\.net/.exec(
        data.input
      );

      // Check input
      if (data.input.length > 30) {
        socket.emit(
          'alert',
          'You may not enter a word longer than 30 characters.'
        );
        io.sockets.emit('say', {
          page: page.id,
          monkey: monkey.token,
          input: '',
        });
        log(
          'Monkey #' +
            monkey.id +
            "'s input (" +
            input +
            ') is longer than 30 chars.'
        );
      } else if (m) {
        socket.emit(
          'alert',
          'Your input contains forbidden characters (' + m[0] + ').'
        );
        io.sockets.emit('say', {
          page: page.id,
          monkey: monkey.token,
          input: '',
        });
        log(
          'Monkey #' +
            monkey.id +
            "'s input (" +
            data.input +
            ') contains forbidden chars:' +
            m[0]
        );
      } else if (page.version != data.version) {
        socket.emit(
          'alert',
          'Too slow ! Someone has sent something since you start typing. You should check it and try again.'
        );
        io.sockets.emit('say', {
          page: page.id,
          monkey: monkey.token,
          input: '',
        });
        log('Monkey #' + monkey.id + "' was too slow.");
      } else if (page.last_player == monkey.token) {
        socket.emit(
          'alert',
          'Too quick ! You wrote the last word of this page. You have to wait until someone else enters something.'
        );
        io.sockets.emit('say', {
          page: page.id,
          monkey: monkey.token,
          input: '',
        });
        log('Monkey #' + monkey.id + "' was too quick.");
      } else {
        // Increment page version
        page.version++;

        // Update theme word count
        page.theme_words -= input.split(' ').length - 1;

        // Changing theme if no more word
        if (page.theme_words < 1) {
          page.theme_words = 30; // Get the counter back to 30;
          var words = page.content.split(' '); // Get an array with words from page content

          var themes = [];
          for (var w in words) {
            words[w] = validator.blacklist(words[w], '.!?,;::*"'); // Delete punctuation signs
            if (words[w].length >= 5) themes.push(words[w]); // Keep only words with 5 letters or more
          }

          page.theme = themes[Math.floor(Math.random() * themes.length)]; // Choose a random word from array

          log(
            'Changing theme to "' + page.theme + '" on page ' + page.id + '.'
          );
        }
        delete page.content;

        // Create new input
        Inputs.create({
          monkey_token: monkey.token,
          page_version: page.version,
          content: input,
        }).then(function(input) {
          // Update page content
          page.content += input.content;
          page.last_player = monkey.token;
          page.save().then(function() {
            var response = {
              page: page,
              monkey: monkey.token,
              input: input.content,
            };

            socket.broadcast.emit('write', response);
            socket.emit('write', response);

            log(
              'Monkey #' +
                monkey.id +
                " wrote '" +
                input.content +
                "' on page " +
                page.id +
                '.'
            );
          });
        });
      }
    });
  });
}

// Broadcast monkey count to all monkeys
function updateCount(socket) {
  log('Updating monkey count...');

  Pages.findAll({ attributes: ['id'], include: [Monkeys] })
    .then(function(res) {
      var page,
        online = [];
      for (var key in res) {
        page = res[key];
        online.push({ id: page.id, count: page.Monkeys.length });
      }

      socket.emit('monkeys', online);
      socket.broadcast.emit('monkeys', online);
    })
    .error(function(err) {
      log('Error while counting monkeys: ' + err);
    });
}

// Input format
function formatInput(input) {
  // Trim input
  input = input.trim();

  // Escape HTML characters
  input = validator.escape(input);

  // Add space unless 1st character is . , - or _
  if (!/^\.|^,|^-|^_/.test(input)) {
    input = ' ' + input;
  }

  // Remove 1st character if _
  if (/^_/.test(input)) {
    input = input.substr(1);
  }

  return input;
}

function log(log) {
  console.log(strftime('%e %b %H:%M:%S').trim() + ' - ' + log);
}
