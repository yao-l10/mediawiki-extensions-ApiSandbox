$( document ).ready( function() {
	var content = $( '#api-sandbox-content' );
	if ( !content.length ) {
		return;
	}
	content.show();	

	var action = $( '#api-sandbox-action' );
	var prop = $( '#api-sandbox-prop' );
	var propRow = $( '#api-sandbox-prop-row' );
	var help = $( '#api-sandbox-help' );
	var further = $( '#api-sandbox-further-inputs' );
	var submit = $( '#api-sandbox-submit' );
	var requestUrl = $( '#api-sandbox-url' );
	var requestPost = $( '#api-sandbox-post' );
	var output = $( '#api-sandbox-output' );
	var postRow = $( '#api-sandbox-post-row' );
	var actionCache = [];
	var propCache = [];
	var namespaces = [];
	var currentInfo = {};
	var apiPhp = mw.config.get( 'wgServer' ) + mw.config.get( 'wgScriptPath' ) + '/api' + mw.config.get( 'wgScriptExtension' );

	// load namespaces
	$.getJSON( apiPhp,
		{ format: 'json', action: 'query', meta: 'siteinfo', siprop: 'namespaces' },
		function( data ) {
			if ( isset( data.query ) && isset( data.query.namespaces ) ) {
				for ( var id in data.query.namespaces ) {
					if ( id < 0 ) {
						continue;
					}
					var ns = data.query.namespaces[id]['*'];
					if ( ns == '' ) {
						ns = mw.msg( 'apisb-ns-main' );
					}
					namespaces.push( { key: id, value: ns } );
				}
			} else {
				showLoadError( further, 'apisb-namespaces-error' );
			}
		}
	);

	action.change( updateBasics );
	prop.change( updateBasics );

	submit.click( function() {
		var url = apiPhp + '?action=' + action.val();
		if ( action.val() == 'query' ) {
			url += '&prop=' + prop.val();
		}
		url += '&format=json'; // @todo:
		var params = '';
		for ( var i = 0; i < currentInfo.parameters.length; i++ ) {
			var param = currentInfo.parameters[i];
			var name = currentInfo.prefix + param.name;
			var value = $( '#param-' + name ).val();
			if ( param.value == ''
				&& ( param.type != 'boolean' && param.type != 'bool' )
				&& !isset( param.required ) )
			{
				value = null;
			}
			if ( typeof value != 'undefined' ) {
				params += '&' + name + '=' + encodeURIComponent( value );
			}
		}
		showLoading( output );
		if ( isset( currentInfo.mustbeposted ) ) {
			requestUrl.val( url );
			requestPost.val( params );
			postRow.show();
		} else {
			requestUrl.val( url + params );
			postRow.hide();
		}
		url = url.replace( /(&format=[^&]+)/, '$1fm' );
		var data = {
			url: url,
			data: params,
			dataType: 'text',
			type: isset( currentInfo.mustbeposted ) ? 'POST' : 'GET',
			success: function( data ) {
				data = data.match( /<pre>[\s\S]*<\/pre>/ )[0];
				output.html( data );
			},
			error: function( jqXHR, textStatus, errorThrown ) {
				output.text( 'FAIL' );
			}
		};
		$.ajax( data );
	});

	/**
	 * Shamelessly borrowed from PHP
	 */
	function isset( x ) {
		return typeof x != 'undefined';
	}

	function showLoading( element ) {
		element.html( mw.msg( 'apisb-loading' ) ); // @todo:
	}

	function showLoadError( element, message ) {
		element.html( mw.html.element( 'span', { 'class': 'error' }, mw.msg( message ) ) );
	}

	function parseParamInfo( data ) {
		further.text( '' );
		if ( !isset( data.paraminfo ) 
			|| ( !isset( data.paraminfo.modules ) && !isset( data.paraminfo.querymodules ) )
			)
		{
			showLoadError( further, 'apisb-load-error' );
			return;
		}
		if ( isset( data.paraminfo.modules ) ) {
			actionCache[data.paraminfo.modules[0].name] = data.paraminfo.modules[0];
			createInputs( actionCache[data.paraminfo.modules[0].name] );
		} else {
			propCache[data.paraminfo.querymodules[0].name] = data.paraminfo.querymodules[0];
			createInputs( propCache[data.paraminfo.querymodules[0].name] );
		}
		submit.removeAttr( 'disabled' );
	}

	function getQueryInfo( action, prop ) {
		var isQuery = action == 'query';
		if ( action == '-' || ( isQuery && prop == '-' ) ) {
			submit.attr( 'disabled', 'disabled' );
			return;
		}
		var cached;
		if ( isQuery ) {
			cached = propCache[prop];
		} else {
			cached = actionCache[action];
		}
		if ( typeof cached != 'object' ) { // stupid FF adds watch() everywhere
			showLoading( further );
			var data = {
				format: 'json',
				action: 'paraminfo'
			};
			if (isQuery ) {
				data.querymodules = prop;
			} else {
				data.modules = action;
			}
			submit.attr( 'disabled', 'disabled' );
			$.getJSON(
				mw.config.get( 'wgScriptPath' ) + '/api' + mw.config.get( 'wgScriptExtension' ),
				data,
				parseParamInfo
			);
		} else {
			submit.removeAttr( 'disabled' );
			createInputs( cached );
		}
	}

	function smartEscape( s ) {
		s = mw.html.escape( s );
		if ( s.indexOf( '\n ' ) >= 0 ) {
			s = s.replace( /^(.*?)((?:\n\s+\*?[^\n]*)+)(.*?)$/m, '$1<ul>$2</ul>$3' );
			s = s.replace( /\n\s+\*?([^\n]*)/g, '\n<li>$1</li>' );
		}
		s = s.replace( /\n(?!<)/, '\n<br/>' );
		return s;
	}

	function createInputs( info ) {
		currentInfo = info;
		help.html( smartEscape( info.description ) );
		var s = '<table class="api-sandbox-options">\n<tbody>';
		for ( var i = 0; i < info.parameters.length; i++ ) {
			var param = info.parameters[i];
			var name = info.prefix + param.name;

			s += '<tr><td class="api-sandbox-label"><label for="param-' + name + '">' + name + '=</label></td>'
				+ '<td class="api-sandbox-value">' + input( param, name )
				+ '</td><td>' + smartEscape( param.description ) + '</td></tr>';
		}
		s += '\n</tbody>\n</table>\n';
		further.html( s );
	}

	function input( param, name ) {
		var s;
		var value = '';
		switch ( param.type ) {
			case 'limit':
				value = 10;
			case 'user':
			case 'timestamp':
			case 'integer':
			case 'string':
				s = '<input class="api-sandbox-input" id="param-' + name + '" value="' + value + '"/>';
				break;
			case 'bool':
			case 'boolean':
				s = '<input id="param-' + name + '" type="checkbox"/>';
				break;
			case 'namespace':
				param.type = namespaces;
			default:
				if ( typeof param.type == 'object' ) {
					var id = 'param-' + name;
					var attributes = { 'id': id };
					if ( isset( param.multi ) ) {
						attributes.multiple = 'multiple';
						s = select( param.type, attributes, false );
					} else {
						s = select( param.type, attributes, true );
					}
				} else {
                    s = mw.html.element( 'code', [], mw.msg( 'parentheses', param.type ) );
                }
		}
		return s;
	}

	function select( values, attributes, selected ) {
		attributes['class'] = 'api-sandbox-input';
		if ( isset( attributes.multiple ) ) {
			attributes['size'] = values.length.toString();
		}
		var s = '';
		if ( typeof selected != 'array' ) {
			if ( selected ) {
				s += mw.html.element( 'option', { value: '', selected: 'selected' }, mw.msg( 'apisb-select-value' ) );
			}
			selected = [];
		}
		for ( var i = 0; i < values.length; i++ ) {
			var value = typeof values[i] == 'object' ? values[i].key : values[i];
			var face = typeof values[i] == 'object' ? values[i].value : values[i];
			var attrs = { 'value': value };
			if ( $.inArray( value, selected ) >= 0 ) {
				attrs.selected = 'selected';
			}
			s += '\n' + mw.html.element( 'option', attrs, face );
		}
		s = mw.html.element( 'select', attributes, new mw.html.Raw( s ) );
		return s;
	}
	
	function updateBasics() {
		var a = action.val();
		var p = prop.val();
		var isQuery = a == 'query';
		if ( isQuery ) {
			propRow.show();
		} else {
			propRow.hide();
		}
		further.text( '' );
		help.text( '' );
		getQueryInfo( a, p );
	}

});