xmm = {
  app: {
    version: '0.24.9',
  },

  token: null,
  adresseBarPage: 0,
  currentPage: 0,

  debug: function(msg) {
    console.log(msg);
  },

  alert: function(msg, timeout) {
    if (typeof alertTimeout !== 'undefined') clearTimeout(alertTimeout);
    var alert_y = $(window).height() / 2 - $('#alert').height() / 2;
    $('#alertWrapper').css('top', alert_y);
    $('#alert')
      .html(msg)
      .show();
    if (timeout > 0)
      alertTO = setTimeout(function() {
        $('#alert').fadeOut({
          complete: function() {
            $(this).html('');
          },
        });
      }, timeout * 1000);
    xmm.playSound('error');
  },

  error: function(msg) {
    xmm.playSound('error');
    $('#ui').fadeOut();
    xmm.playSound('error');
    xmm.debug('Error: ' + msg);
    xmm.alert('<span class="error">' + msg + '</span>', 0);
  },

  start: function() {
    xmm.debug('Starting XMM Client v' + xmm.app.version);

    // Get current page from url
    xmm.addressBarPage = window.location.pathname.replace('/', '');

    // Check websockets & localstorage availability
    if (!Modernizr.websockets || !Modernizr.localstorage) {
      xmm.error(
        'Your browser seems to be obsolete.<br>Please update to <a href="http://www.browsehappy.com" target="_blank">the last version</a>.'
      );
    } else xmm.debug('Modernizr: Browser has websockets & localstorage');

    // Tooltip
    $('[title]').tooltipster();

    // Placeholder on input for touch devices
    $('html.touch #input').attr('placeholder', 'Touch here to write');

    // Blinking cursor
    setInterval(function() {
      $('.current .cursor').toggleClass('invisible');
    }, 600);

    xmm.connect();
  },

  connect: function() {
    xmm.token = xmm.getToken();

    xmm.socket = io();

    // Ask if last version, if so server will answer "uptodate"
    xmm.socket.emit('version', xmm.app.version);

    xmm.socket.on('disconnect', function() {
      // window.location.reload();
      throw 'Disconnected!';
    });

    xmm.socket.on('_error', function(msg) {
      xmm.error(msg);
    });

    xmm.socket.on('alert', function(msg) {
      xmm.alert(msg, 3);
    });

    xmm.socket.on('error', function(msg) {
      xmm.alert(msg);
    });

    xmm.socket.on('uptodate', function() {
      $('#app_version').text(' ' + xmm.app.version);

      xmm.socket.emit('handshake', xmm.token);
      xmm.socket.on('connected', function() {
        $('#alert').hide();
        $('#ui').fadeIn();

        // Ask for pages
        xmm.socket.emit('getPages', localStorage.pages_updated);
        xmm.socket.on('pages', function(pages) {
          xmm.debug('Received ' + pages.length + ' pages');
          localStorage.pages = JSON.stringify(pages);
          localStorage.pages_updated = new Date();
          xmm.renderPages(pages);
          if (xmm.addressBarPage) xmm.goToPage(xmm.addressBarPage);
          else xmm.socket.emit('route');
        });

        // Received route
        xmm.socket.on('route', function(route) {
          xmm.goToPage(route);
        });

        // Received monkey count
        xmm.socket.on('monkeys', function(monkeys) {
          var total = 0;
          $.each(monkeys, function(index, page) {
            if (xmm.currentPage == page.id) {
              $('#page_monkeys').text(page.count);
            }
            total += page.count;
          });
          $('#x').text(total / 1000000);
          $('#total_monkeys').text(total);
        });

        // Received page infos
        xmm.socket.on('page', function(res) {
          $('#next_page').attr('data-goto', res.next);
          $('#prev_page').attr('data-goto', res.prev);
          $('#theme').html(
            'Current theme: &laquo; ' +
              res.page.theme +
              ' &raquo; (for another <span id="theme_words">' +
              res.page.theme_words +
              '</span> word' +
              xmm.s(res.page.theme_words) +
              ')'
          );
        });

        // Received input preview
        xmm.socket.on('say', function(data) {
          var input_id = 'input_' + data.page + '_' + data.monkey;

          // If input is empty, remove span
          if (data.input === '') {
            $('#' + input_id).remove();
          }

          // If span does not exist, create it
          else if ($('#' + input_id).length === 0) {
            $('#page_' + data.page + ' .inputs').append(
              ' <span id="' +
                input_id +
                '" class="saying">' +
                data.input +
                '</span>'
            );
            if (data.monkey == xmm.token)
              $('#' + input_id).addClass('my_input');
          }

          // Else update it
          else {
            $('#' + input_id).html(data.input); // Else update span
          }
        });

        // Received page update
        xmm.socket.on('write', function(data) {
          // Update page version and last monkey
          $('#page_' + data.page.id)
            .attr('data-version', data.page.version)
            .attr('data-last_monkey', data.monkey);

          // Update page content with new input
          $('#page_' + data.page.id + ' .page_content').append(data.input);

          // Remove all current inputs
          $('#page_' + data.page.id + ' .saying').fadeOut({
            complete: function() {
              $(this).remove();
            },
          });

          // Update theme & word count
          $('#theme').html(
            'Current theme: &laquo; ' +
              data.page.theme +
              ' &raquo; (for another <span id="theme_words">' +
              data.page.theme_words +
              '</span> word' +
              xmm.s(data.page.theme_words) +
              ')'
          );

          // If current page
          if (xmm.currentPage == data.page.id) {
            if ($('#input').val() === '')
              $('#input').attr('data-version', data.page.version); // update input version only if input is empty
            xmm.playSound('key');
          }
          xmm.updateUserRight();
        });

        xmm.loadEvents();
      });
    });
  },

  loadEvents: function() {
    // Mouse navigation
    $('.goto.event')
      .click(function() {
        var new_page = $(this).attr('data-goto');
        if (new_page == 'route') send({ method: 'get', type: 'route' });
        else if (new_page !== 0) {
          xmm.goToPage(new_page);
        }
      })
      .removeClass('event');

    // Keyboard navigation
    $('input')
      .bind('keyup.ctrl_k', function() {
        var next = $('#next_page').attr('data-goto');
        if (next) xmm.goToPage(next);
      })
      .bind('keydown.ctrl_j', function() {
        var prev = $('#prev_page').attr('data-goto');
        if (prev) xmm.goToPage(prev);
      })
      .bind('keydown.ctrl_h', function() {
        xmm.socket.emit('route');
      });

    // Touch navigation
    $('html.touch').swipe({
      swipeRight: function() {
        var prev = $('#prev_page').attr('data-goto');
        if (prev) xmm.goToPage(prev);
      },
      swipeLeft: function() {
        var next = $('#next_page').attr('data-goto');
        if (next) xmm.goToPage(next);
      },
    });

    // User input
    $('#input.event')
      .keyup(function(e) {
        if ($('#input').val() === '') {
          // if input is emptied, update input version
          $('#invite').text('Write the next word:');
          $('#input').attr(
            'data-version',
            $('.page.current').attr('data-version')
          );
        } else if (e.keyCode == 13) {
          // enter key & field not empty : write (send input for good)
          $('#invite').slideUp();
          xmm.socket.emit('write', {
            input: $('#input').val(),
            page: xmm.currentPage,
            version: $('#input').attr('data-version'),
          });
          $('#input').val('');
        } else if (e.keyCode == 32) {
          // Space bar
          $('#invite').text('Now, press enter to send your word.');
        }

        // Say : input may be empty, key is not enter, ctrl or cmd
        if (e.keyCode != 13 && e.keyCode != 17 && e.keyCode != 91) {
          xmm.socket.emit('say', {
            input: $('#input').val(),
            page_id: xmm.currentPage,
          });
        }
      })
      .removeClass('event');

    // Show/close text sharer
    $('#pages').mouseup(function(e) {
      var selection = window.getSelection();
      if (selection != '') {
        $('#sharer').slideDown();
        $('#excerpt').text(selection);
        $(document).scrollTop($('#sharer').offset().top);
      }
    });
    $('#close').click(function(e) {
      $('#sharer').slideUp();
    });

    // Share on Twitter
    $('#twitter').click(function(e) {
      var page_id = $('#page').attr('data-id'),
        text =
          '"' +
          $('#excerpt').val() +
          '" #xmm http://monkeys.nokto.net/' +
          xmm.currentPage,
        url =
          'https://twitter.com/intent/tweet?status=' + encodeURIComponent(text);
      window.open(url, 'Share on Twitter', 'width=640,height=300');
    });

    console.log('Event loaded');
  },

  goToPage: function(id) {
    if (id == xmm.currentPage) return;
    if (id && id != 0) {
      xmm.debug('Going from page ' + xmm.currentPage + ' to page ' + id + '.');

      // Update address bar & navigation
      window.history.pushState(null, 'xmm', '/' + id);
      $('#current_page').text(id);

      // Notify server
      xmm.socket.emit('move', {
        from: '' + xmm.currentPage + '',
        to: '' + id + '',
      });

      // Hide current page & show new one
      $('.page.current')
        .removeClass('current')
        .hide();
      $('#page_' + id)
        .addClass('current')
        .show();

      $('#input')
        .val('')
        .attr('data-version', $('#page_' + id).attr('data-version')); // Empty input and set version
      xmm.scrollToInput();
      xmm.updateUserRight(); // Can user Write
      xmm.currentPage = id;
    } else {
      xmm.socket.emit('route');
    }
  },

  renderPages: function(pages) {
    for (key in pages) {
      p = pages[key];
      html =
        '<article id="page_' +
        p.id +
        '" class="page hidden" data-id="' +
        p.id +
        '" data-version="' +
        p.version +
        '" data-last_monkey="' +
        p.last_player +
        '">' +
        '<p><span class="page_content">' +
        p.content +
        '</span><span class="cursor"> _</span></p>' +
        '<p class="inputs"></p>' +
        '</article>';
      if ($('#page_' + p.id).length) {
        $('#page_' + p.id).replaceWith(html);
      } else {
        $('#pages').append(html);
      }
    }
  },

  getToken: function() {
    if (!localStorage['token']) {
      var token = '';
      var chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      for (var i = 0; i < 32; i++)
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      localStorage['token'] = token;
      xmm.debug('Generating new token: ' + token);
    } else xmm.debug('Retrieving token: ' + localStorage['token']);
    return localStorage['token'];
  },

  scrollToInput: function() {
    var scroll = new SmoothScroll();
    scroll.animateScroll(
      document.querySelector('#input'),
      document.querySelector('#input'),
      {
        speed: 500,
        speedAsDuration: true,
        offset: 250,
        updateURL: false,
        easing: 'easeOutQuint',
        callbackAfter: function() {
          $('#input').focus();
        },
      }
    );
  },

  // Can user write ?
  updateUserRight: function() {
    if (xmm.token != $('.page.current').attr('data-last_monkey')) {
      $('.current .cursor').addClass('yourturn');
      $('#favicon').attr('href', '/images/monkey1.png');
      $('#logo_image').attr('src', '/images/monkey1.png');
    } else {
      $('.current .cursor').removeClass('yourturn');
      $('#favicon').attr('href', '/images/monkey0.png');
      $('#logo_image').attr('src', '/images/monkey0.png');
    }
  },

  // Play sound
  playSound: function(sound, mute) {
    if (mute) $('#' + sound)[0].volume = 0;
    else $('#' + sound)[0].volume = 1;
    $('#' + sound)[0].play();
  },

  // Plural
  s: function(i) {
    if (i > 1) return 's';
    else return '';
  },
};

xmm.start();
