(function() {
	
	app_version = '0.5';
	
	page_id = 0;
	sound = 0; // Sound initialized ?
	stop = 0; // Force quit
	
	debugging = true;
	
	// Check for websockets support
	if (!Modernizr.websockets || !Modernizr.localstorage)
	{
		_error('Your browser seems to be obsolete.<br>Please update to <a href="http://www.browsehappy.com" target="_blank">the last version</a>.', 1);
	}
	
	// Get token if not set
	if (document.cookie.indexOf("monkey_token") == -1)
	{
		token = "";
		var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";	
		for (var i=0; i<32; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
		setcookie('monkey_token', token, 365);
	}
	else token = getcookie('monkey_token');
	
	// Set current page from url
	default_page = window.location.pathname.replace('/','');
	
	// Show input field placeholder on touch devices
	$('html.touch #input').attr('placeholder', 'Touch here to write');
	
	var socket = io();
	
	// Load ui
	$('#alert').hide();
	$('#ui').fadeIn();
	
	// Ask for pages on load
	socket.emit('getPages');
	socket.on('pages', function(pages) {
		
		$('#pages').html(''); // Delete previous pages
		
		var pages_html = '';
		for (key in pages)
		{
			p = pages[key];
			pages_html += '<article id="page_'+p.page_id+'" class="page hidden" data-id="'+p.page_id+'" data-version="'+p.page_version+'" data-last_monkey="'+p.page_last_player+'">' +
								'<p><span class="page_content">'+p.page_content+'</span><span class="cursor"> _</span></p>' +
								'<p class="inputs"></p>' +
							'</article>';
		}
		$('#pages').append(pages_html);
		goToPage(1);
		
		// If page is defined in url, go to page, else ask for route
		/*
if (default_page) goToPage(default_page);
		else send({ method: 'get', type: 'route' });
*/
	});
	
	// Connect to the server
	/*
function connect() {
		_alert('Connecting...');
		
		var socket = io();
		
		socket.emit('get', 'pages');
		
		// Connection successful
		websocket.onopen = function(e)
		{ 
			debug('Connected!');
			
			$('#alert').hide();
			$('#ui').fadeIn();
			
			// Ask for content
			send({ method: 'get', type: 'pages' });
			
		}
	
		// Connection error
		websocket.onerror = function(e)
		{
			_error('Server seems to be unavailable.');
		}
	
		// Connection close
		websocket.onclose = function(e)
		{
			if (!stop) // If not manual quit, try to reconnect
			{
				_error('Connection lost. Will try to reconnect in <span id="countdown">5</span>...');
				reconnect(5);
			}
			
		}
		
		// Message received
		websocket.onmessage = function(e)
		{
			
			var d = JSON.parse(e.data);
			if (d.header.type != 'pages') debug('Received: '+e.data);
			else debug('Received pages');
			
			// Check app version
			if (d.header.version != app_version)
			{
				_alert('A new version is available ('+d.header.version+').<br>Please reload the page.', 0);
				debug('Client ('+app_version+') is obsolete. Current version: '+d.header.version);
				$('#ui').hide();
				d.header.type = null;
			} else $('#app_version').text(' '+app_version);
			
			// Message types
			if(d.header.type == 'alert') // Throw alert
			{
				_alert(d.body.alert, 3);
			}
			else if(d.header.type == 'monkeys') // Update user count
			{
				if (page_id)
				{
					var stats = d.body.pages[page_id]+' of '+d.body.total+' monkey'+s(d.body.total)+' on page '+page_id,
						millions = d.body.total / 1000000;
					$('#x').text(millions);
					$('#footer_stats').text(stats);
					$('#footer').fadeIn();
				}
			}
			else if(d.header.type == 'pages') // Hydrate all pages
			{
				$('#pages').html(''); // Delete previous pages
				
				localStorage.setItem('pages', JSON.stringify(d.body.pages));
				
				for(i = 0; i < d.body.count; i++)
				{
					var p = d.body.pages[i];
					if (typeof p !== 'undefined')
					{
						// Get data from localStorage
						//var l = localStorage.getItem('page_');
						
						var page = '<article id="page_'+p.page_id+'" class="page hidden" data-id="'+p.page_id+'" data-version="'+p.page_version+'" data-last_monkey="'+p.page_last_player+'">' +
										'<p><span class="page_content">'+p.page_content+'</span><span class="cursor"> _</span></p>' +
										'<p class="inputs"></p>' +
									'</article>';
						$('#pages').append(page);
					}
				}
				
				// If page is defined in url, go to page, else ask for route
				if (default_page) goToPage(default_page);
				else send({ method: 'get', type: 'route' });
				
			}
			else if(d.header.type == 'route') // Route to page
			{
				goToPage(d.body.page_id);
			}
			else if(d.header.type == 'pageInfos') // Get next and prev pages
			{
				$('#next_page').attr('data-goto', d.body.nextPage);
				$('#prev_page').attr('data-goto', d.body.prevPage);
				$('#theme').html('Current theme: &laquo; '+d.body.theme+' &raquo; (for another <span id="theme_words">'+d.body.words+'</span> word'+s(d.body.words)+')');
			}
			else if(d.header.type == 'say') // A monkey is writing
			{
				
				var input_id = 'input_'+d.body.page_id+'_'+d.body.monkey;
				if (d.body.input == '') $('#'+input_id).remove(); // If input is empty, remove span
				else if ($('#'+input_id).length == 0) // If span does not exist, create it
				{
					$('#page_'+d.body.page_id+' .inputs').append(' <span id="'+input_id+'" class="saying">'+d.body.input+'</span>');
					if (d.body.monkey == token) $('#'+input_id).addClass('my_input');
				}
				else $('#'+input_id).html(d.body.input); // Else update span
				
				if (page_id == d.body.page_id && !isHidden()) // If current page and page visible
				{
					//playSound('key'); // play key stroke page
				}
			}
			else if(d.header.type == 'write') // Page updated
			{
				// Update page version and last monkey
				$('#page_'+d.body.page_id).attr('data-version', d.body.page_version).attr('data-last_monkey', d.body.monkey);
				
				// Update page content with new input
				$('#page_'+d.body.page_id+' .page_content').append(d.body.input);
				
				// Remove all current inputs
				$('#page_'+d.body.page_id+' .saying').fadeOut({
					complete: function() { $(this).remove(); }
				});
				
				// Update theme word count
				$('#theme').html('Current theme: &laquo; '+d.body.page_theme+' &raquo; (for another <span id="theme_words">'+d.body.page_theme_words+'</span> words)');
				
				if (page_id == d.body.page_id) // If current page
				{
					if ($('#input').val() == '') $('#input').attr('data-version', d.body.page_version); // update input version only if empty
					playSound('key'); // play key stroke page
				}
				updateUserRight();
			}
			else
			{
				debug('Unknown message type: '+d.header.type);
			}
			
		};
	}
	connect();
*/
	
	
	$(window).load(function() {
		
		// Tooltip
		$('[title]').tooltipster();
		
		// Blinking cursor
		setInterval( function() { $('.current .cursor').visibilityToggle(); }, 600);
		
		// Mouse navigation
		$('.goto').click( function() {
			var new_page = $(this).attr('data-goto');
			if (new_page == 'route') send({ method: 'get', type: 'route' });
			else if (new_page != 0) {
				console.log(new_page);
				goToPage(new_page);
			}
		});
		
		// Keyboard navigation
		$(document).bind('keydown', 'Ctrl+j', function() {
			var new_page = $('#prev_page').attr('data-goto');
			if (new_page) goToPage(new_page);
		}).bind('keydown', 'Ctrl+k', function() {
			var new_page = $('#next_page').attr('data-goto');
			if (new_page) goToPage(new_page);
		}).bind('keydown', 'Ctrl+h', function() {
			send({ method: 'get', type: 'route' });
		});
		
		// Touch navigation
		$(document).swipe({
			swipeRight:function() {
				var new_page = $('#prev_page').attr('data-goto');
				if (new_page != 0) goToPage(new_page);
			},
			swipeLeft:function() {
				var new_page = $('#next_page').attr('data-goto');
				if (new_page != 0) goToPage(new_page);
			}
		});
		
		
		// User input
		$('#input').keyup( function(e) {
			
			if ($('#input').val() == '') // if input is emptied, update input version
			{
				$('#invite').text('Write the next word :');
				$('#input').attr('data-version', $('.page.current').attr('data-version'));
			}
			else if (e.keyCode == 13) // enter key & field not empty : write (send input for good)
			{
				$('#invite').slideUp();
				send({ method: 'post', type: 'write', value: { input: ""+$('#input').val()+"", page_id: ""+page_id+"", input_version: ""+$('#input').attr('data-version')+"" } });
				$('#input').val('');
			}
			else if (e.keyCode == 32) // Space bar
			{
				$('#invite').text('Now, press enter to send your word.');
			}
			
			// Say : input may be empty, key is not enter, ctrl or cmd
			if (e.keyCode != 13 && e.keyCode != 17 && e.keyCode != 91)
			{
				send({ method: 'post', type: 'say', value: { input: ""+$('#input').val()+"", page_id: ""+page_id+"" } });
			}
		
		});
		
		// Show/close text sharer
		$('#pages').mouseup(function(e) {
			var selection = window.getSelection();
			if (selection != '') {
				$('#sharer').slideDown();
				$('#excerpt').text(selection);
				$(document).scrollTop($('#sharer').offset().top);
			}
		});
		$('#close').click( function(e) {
			$('#sharer').slideUp();
		});
		
		// Share on Twitter
		$('#twitter').click( function(e) {
			var page_id = $('#page').attr('data-id'),
				text = '"'+$('#excerpt').val()+'" #xmm '+xmm_app+page_id,
				url = 'https://twitter.com/intent/tweet?status='+encodeURIComponent(text);
			window.open(url, 'Share on Twitter', 'width=640,height=300')
		});
		
		$('#alert').click( function() {
			$(this).html('').hide();
		});
		
		// If document is clicked (unless footer, sharer) and text no selection, give focus to input
		$(document).click( function(e) {
			if (!sound) { playSound('key', 1); sound = 1; } // Initialize sound for iOS
			if (!$(e.target).is('#sharer *') && window.getSelection() == '')
			{
				scrollToInput();
				$('#sharer').slideUp();
			}
		});
		
	});
	
	/* FUNCTIONS */
	
	// Plural
	function s(i) {
		if (i > 1) return 's';
		else return '';
	}
	
	// Scroll to input
	function scrollToInput() {
		smoothScroll.animateScroll(null, '#input', {
			speed: 500,
			offset: 250,
			easing: 'easeOutQuint',
			callbackAfter: function() { $('#input').focus(); }
		});
	}
	
	// Go to page
	function goToPage(id)
	{
		if (id && id != 0)
		{
			window.history.pushState(null, "xmm", '/'+id);
			//window.scrollTo(0, 0);
			$('.page.current').removeClass('current').hide();
			$('#page_'+id).addClass('current').show();
			page_id = id;
			$('#input').val('').attr('data-version', $('#page_'+id).attr('data-version')); // Empty input and set version
			send({ method: 'post', type: 'say', value: { input: '', page_id: ""+page_id+"" } }); // Clear input preview from other clients
			scrollToInput();
			updateUserRight(); // Can user Write 
			send({ method: 'post', type: 'move', value: { from: ""+page_id+"", to: ""+id+"" } }); // Notify server
		}
		//else send({ method: 'get', type: 'route' });
	}
	
	// Can user write ?
	function updateUserRight()
	{
		if (token != $('.page.current').attr('data-last_monkey'))
		{
			$('.current .cursor').addClass('yourturn');
			$('#favicon').attr('href','/assets/images/monkey1.png');
			$('#logo_image').attr('src','/assets/images/monkey1.png');
		}
		else
		{
			$('.current .cursor').removeClass('yourturn');
			$('#favicon').attr('href','/assets/images/monkey0.png');
			$('#logo_image').attr('src','/assets/images/monkey0.png');
		}
	}
	
	// Play sound
	function playSound(sound, mute) {
		if (mute) $('#'+sound)[0].volume = 0;
		else $('#'+sound)[0].volume = 1;
		$('#'+sound)[0].play();
	}
	
	// Send message to the server
	function send(message)
	{
		if (!stop)
		{
			message.token = token;
			message = JSON.stringify(message);
			websocket.send(message);
			debug('Sent: '+JSON.stringify(message));//code
		}
	}
	
	// Reconnect after countdown
	function reconnect(countdown) {
		$('#countdown').text(countdown);
		countdown -= 1;
		if (countdown >= 0) setTimeout(function() { reconnect(countdown); }, 1000);
		else connect();
	}
	
	// Error
	function _error(error, timeout)
	{
		$('#ui').fadeOut();
		playSound('error');
		debug('Error: '+error);
		_alert('<span class="error">'+error+'</span>', timeout);
	}
	
	// Show error message
	function _alert(alert, timeout)
	{
		if (typeof alertTO !== 'undefined') clearTimeout(alertTO);
		var alert_y = $(window).height() / 2 - $('#alert').height() / 2;
		$('#alertWrapper').css('top', alert_y);
		$('#ui')
		$('#alert').html(alert).show();
		if (timeout > 0) alertTO = setTimeout( function() { $('#alert').fadeOut({ complete: function() { $(this).html(''); } }); }, timeout * 1000);
	}
	
	// Debug
	function debug(message)
	{
		if (debugging) console.log(message);
	}
	
	// Set cookie
	function setcookie(name, value, days)
	{
		var expire = new Date();
		expire.setDate(expire.getDate()+days);
		document.cookie=name+'='+escape(value)+';expires='+expire.toGMTString();
		return true;
	}
	
	// Get cookie
	function getcookie(name)
	{
		if(document.cookie.length>0)
		{
			start=document.cookie.indexOf(name+"=");
			pos = start+name.length+1;
			if(start!=0)
			{
				start=document.cookie.indexOf("; "+name+"=");
				pos = start+name.length+3;
			}
			if(start!=-1)
			{ 
				start=pos;
				end=document.cookie.indexOf(";",start);
				if(end==-1)
				{
					end=document.cookie.length;
				}
				return unescape(document.cookie.substring(start,end));
			} 
		}
		return '';
	}
	
	// Page hidden 
	function isHidden() {
		var prop = getHiddenProp();
		if (!prop) return false;
		
		return document[prop];
	}
	function getHiddenProp(){
		var prefixes = ['webkit','moz','ms','o'];
		
		// if 'hidden' is natively supported just return it
		if ('hidden' in document) return 'hidden';
		
		// otherwise loop over all the known prefixes until we find one
		for (var i = 0; i < prefixes.length; i++){
			if ((prefixes[i] + 'Hidden') in document) 
				return prefixes[i] + 'Hidden';
		}
	
		// otherwise it's not supported
		return null;
	}
	
	// Cursor visibility toggle
	jQuery.fn.visibilityToggle = function() {
		return this.css('visibility', function(i, visibility) {
			return (visibility == 'visible') ? 'hidden' : 'visible';
		});
	};
	
})();