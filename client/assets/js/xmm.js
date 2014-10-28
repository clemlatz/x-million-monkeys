xmm = {
	app: {
		version: 0.23
	},
	
	currentPage: 0,
	
	debug: function(msg) {
		console.log(msg);
	},
	
	error: function(msg) {
		alert(msg);
	},
	
	start: function() {
		xmm.debug('Starting XMM Client v'+xmm.app.version);
		
		// Check websockets & localstorage availability
		if (!Modernizr.websockets || !Modernizr.localstorage)
		{
			xmm.error('Your browser seems to be obsolete.<br>Please update to <a href="http://www.browsehappy.com" target="_blank">the last version</a>.');
		}
		else xmm.debug('Modernizr: Browser has websockets & localstorage');
		
		// Get pages from localStorage
		if (localStorage['pages'])
		{
			var localPages = JSON.parse(localStorage['pages']);
			xmm.debug('Loaded '+localPages.length+' pages from local storage.');
			xmm.renderPages(localPages);
/* 			xmm.goToPage(1); */
		}
		
		xmm.connect();
	},
	
	connect: function() {
		
		var token = xmm.getToken();
		
		socket = io();
		
		xmm.socket = socket;
		
		xmm.socket.emit('version', xmm.app.version);
		
		xmm.socket.on('alert', function(msg) {
			xmm.error(msg);
		});
		
		xmm.socket.on('uptodate', function() {
		
			$('#app_version').text(' '+xmm.app.version);
			
			xmm.socket.emit('handshake', token);
			xmm.socket.on('connected', function() {
				
				$('#alert').hide();
				$('#ui').fadeIn();
				
				xmm.socket.emit('getPages', localStorage['pages_updated']);
				xmm.socket.on('pages', function(pages) {
					xmm.debug('Received '+pages.length+' pages');
					localStorage['pages'] = JSON.stringify(pages);
					localStorage['pages_updated'] = new Date();
					xmm.renderPages(pages);
					xmm.goToPage(1);
				});
				
				xmm.socket.on('monkeys', function(monkeys) {
				
					console.log('monkey count');
				
					var total = 0;
					for (key in monkeys)
					{
						console.log(xmm.currentPage);
						if (xmm.currentPage == monkeys[key].page_id)
						{
							$('#page_monkeys').text(monkeys[key].count);
						}
						total += monkeys[key].count;
					}
					$('#x').text(total / 1000000);
					$('#total_monkeys').text(total);
					
				});
				
			});
			
		});
		
		
	},
	
	loadEvents: function() {
		
		
		
	},
	
	goToPage: function(id) {
		if (id && id != 0)
		{
			xmm.debug("Going from page "+xmm.currentPage+" to page "+id+".");
		
			// Update address bar & navigation
			window.history.pushState(null, "xmm", '/'+id);
			$('#current_page').text(id);
			
			// Notify server
			xmm.socket.emit('move', { from: ""+xmm.currentPage+"", to: ""+id+"" });
			
			// Hide current page & show new one
			$('.page.current').removeClass('current').hide();
			$('#page_'+id).addClass('current').show();
			
			$('#input').val('').attr('data-version', $('#page_'+id).attr('data-version')); // Empty input and set version
/* 			socket.emit('say',{ input: '', page_id: ""+page_id+"" }); // Clear input preview from other clients */
/* 			scrollToInput(); */
/* 			updateUserRight(); // Can user Write  */
			xmm.currentPage = id;
		}
	},
	
	renderPages: function(pages) {
		
		for (key in pages)
		{
			p = pages[key];
			html = '<article id="page_'+p.page_id+'" class="page hidden" data-id="'+p.page_id+'" data-version="'+p.page_version+'" data-last_monkey="'+p.page_last_player+'">' +
								'<p><span class="page_content">'+p.page_content+'</span><span class="cursor"> _</span></p>' +
								'<p class="inputs"></p>' +
							'</article>';
			if ($('#page_'+p.page_id).length)
			{
				$('#page_'+p.page_id).replaceWith(html);
			}
			else
			{
				$('#pages').append(html);
			}
		}
		
	},
	
	getToken: function() {
		
		if (!localStorage['token'])
		{
			var token = "";
			var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";	
			for (var i=0; i<32; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
			localStorage['token'] = token;
			xmm.debug('Generating new token: '+token);
		}
		else xmm.debug('Retrieving token: '+localStorage['token']);
		return localStorage['token'];
		
	},
	
}

xmm.start();