(function(root){

	var pushstate = !!(window.history && history.pushState);
	var debug = false;

	function OSMMap(id,options){

		if(!options) options = {};
		this.log = new Logger({'id':'OSMMap','logging':options.logging});
		if(!document.getElementById(id)){
			this.log.error('No DOM element exists '+id);
			return this;
		}

		baseMaps = {};
		if(options.baseMaps) baseMaps = options.baseMaps;
		else{
			// Default maps
			baseMaps['Greyscale'] = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
				attribution: 'Tiles: &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
				subdomains: 'abcd',
				maxZoom: 19
			});
			baseMaps['Open Street Map'] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
			});
			baseMaps['CartoDB Voyager (no labels)'] = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
				attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
				subdomains: 'abcd',
				maxZoom: 19
			});
			baseMaps['CartoDB Voyager'] = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
				attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
				subdomains: 'abcd',
				maxZoom: 19
			});
		}
		this.selectedBaseMap = "CartoDB Voyager";

		this.show = options.show||{};
		
		this.map = L.map(id,{'layers':[baseMaps[this.selectedBaseMap]],'scrollWheelZoom':true,'editable': true,'zoomControl': false});
		this.collection = {};
		this.tooltip = L.DomUtil.get('tooltip');
		this.events = {};
		this.layers = {};


		this.setBaseMap = function(id){
			this.log.message('changeBaseMap',id,baseMaps);
			if(baseMaps[id]){
				this.map.removeLayer(baseMaps[this.selectedBaseMap]);
				this.map.addLayer(baseMaps[id]);
				this.selectedBaseMap = id;
			}
		};
		this.getBaseMaps = function(){
			var l = [];
			for(var id in baseMaps){
				l.push(this.getBaseMap(id));
			}
			return l;
		}
		this.getBaseMap = function(id){
			if(!id) id = this.selectedBaseMap;
			return {'id':id,'url':baseMaps[this.selectedBaseMap]._url};
		}

		this.map.attributionControl.setPrefix('Map').setPosition('bottomleft');

		if(this.show.zoom){
			// Add zoom control with options
			L.control.zoom({
				 position:'topleft',
				 'zoomInText': getIcon('zoomin','black'),
				 'zoomOutText': getIcon('zoomout','black')
			}).addTo(this.map);
		}

		var icon = L.Icon.extend({
			options: {
				shadowUrl: '/resources/images/marker-shadow.png',
				iconSize:     [3, 41], // size of the icon
				shadowSize:   [41, 41], // size of the shadow
				iconAnchor:   [12.5, 41], // point of the icon which will correspond to marker's location
				shadowAnchor: [12.5, 41],  // the same for the shadow
				popupAnchor:  [0, -41] // point from which the popup should open relative to the iconAnchor
			}
		});

		function makeMarker(icon,colour){
			return L.divIcon({
				'className': '',
				'html':	getIcon(icon,colour),
				'iconSize':	 [32, 42],
				'popupAnchor': [0, -41]
			});
		}

		var tiler = new Tiler();
		var _obj = this;

		function getGeoJSONTile(url,a,tileid){
			_obj.log.message('Getting data for ('+a+') '+tileid+' from '+url);
			var headers;
			return fetch(url,{'method':'GET'})
			.then(response => {
				headers = response.headers;
				if(!response.ok) throw new Error('Request Failed'); 
				return response.json();
			})
			.then(json => {
				var i,el,lat,lon,id,tags,tag,t,name,update;
				update = (new Date(headers.get('Last-Modified'))).toISOString();

				// Store a copy of the response
				_obj.layers[a].nodegetter.tiles[tileid].data = json;
				_obj.layers[a].nodegetter.tiles[tileid].id = [];

				// Update the time stamp
				_obj.layers[a].nodegetter.tiles[tileid].lastupdate = update;

				_obj.log.message('Got results from geojson',json.features.length);

				for(i = 0; i < json.features.length; i++){
					el = json.features[i];
					lat = el.geometry.coordinates[1];
					lon = el.geometry.coordinates[0];
					id = 'OSM-'+el.properties.osm_id;
					_obj.layers[a].nodegetter.tiles[tileid].id.push(id);

					// If we don't have this node we build a basic structure for it
					if(!_obj.layers[a].nodes[id]){
						_obj.layers[a].nodes[id] = {'id':el.properties.osm_id,'props':{},'popup':'','changedtags':[],'lastupdate':update};
					}

					if(typeof lon==="number" && typeof lat==="number"){

						// Add the coordinates
						_obj.layers[a].nodes[id].lat = lat;
						_obj.layers[a].nodes[id].lon = lon;

						// Add the properties
						_obj.layers[a].nodes[id].props = {'OSMID':id};
						for(p in el.properties){
							if(p == "tag"){
								for(t in el.properties.tag){
									_obj.layers[a].nodes[id].props[t] = el.properties.tag[t]||"";
								}
							}else{
								if(p != "osm_id"){
									_obj.layers[a].nodes[id].props[p] = el.properties[p];
								}
							}
						}
					}
				}	
			}).catch(error => {
				_obj.log.error('Failed to load '+url);
				_obj.layers[id].nodegetter.tiles[tileid].data = {};
				_obj.layers[id].nodegetter.tiles[tileid].id = [];

				// Update the time stamp
				_obj.layers[id].nodegetter.tiles[tileid].lastupdate = (new Date()).toISOString();
			});
		}

		this.getNodesFromGeoJSON = function(a,options,callback){
			
			this.log.message('getNodesFromGeoJSON',a,this.layers[a]);
			var b,tiles,qs,i,t,id,promises;

			if(!a || !this.layers[a]){
				this.log.error('Layer '+a+' isn\'t registered');
				return this;
			}
			if(!this.layers[a].nodegetter) this.layers[a].nodegetter = {'tiles':{}};
			if(!this.layers[a].nodes) this.layers[a].nodes = {};
			if(!this.layers[a].nodegroup) this.layers[a].nodegroup = {};

			options = {};
			if(!options.title) options.title = "Node";
			if(!this.map){
				console.error('No map object exists');
				return this;
			}

			// Get the map bounds (with padding)
			b = this.map.getBounds();//.pad(2 * Math.sqrt(2) / 2);

			// Get the tile definitions
			tiles = tiler.xyz(b,12);
			
			promises = [];
			
			for(t = 0; t < tiles.length; t++){
				id = tiles[t].z+'/'+tiles[t].x+'/'+tiles[t].y;
				if(!this.layers[a].nodegetter.tiles[id]){
					this.layers[a].nodegetter.tiles[id] = {'url':(this.layers[a].options.src.replace(/\{z\}/g,tiles[t].z).replace(/\{x\}/g,tiles[t].x).replace(/\{y\}/g,tiles[t].y))};
					
					// If we haven't already downloaded the data
					if(!this.layers[a].nodegetter.tiles[id].data) promises.push(getGeoJSONTile(this.layers[a].nodegetter.tiles[id].url,a,id));
				}
			}

			if(promises.length > 0){
				promises.map(p => p.catch(e => e));
				Promise.all(promises).then(responses => {
					var newstr,newest,id,d;
					newest = new Date('2000-01-01T00:00Z');
					newstr = '';
					for(id in this.layers[a].nodegetter.tiles){
						if(this.layers[a].nodegetter.tiles[id].lastupdate){
							d = new Date(this.layers[a].nodegetter.tiles[id].lastupdate);
							if(d > newest){ newest = d; newstr = this.layers[a].nodegetter.tiles[id].lastupdate; }
						}
					}
					this.map.attributionControl.setPrefix("Data updated: "+newstr);

					// Now update the marker group
					this.buildPins(options);

					// Trigger any callback
					if(typeof callback==="function") callback.call(options['this']||this,{'a':a,'b':b});
				});
			}else{
				// Trigger any callback
				if(typeof callback==="function") callback.call(options['this']||this,{'a':a,'b':b});
			}
			return this;
		}
		
		this.buildPins = function(options){
			
			var obj,id,lid,t,str,markerList,color,customicon,nodes,taglist,p,m,marker,tempmark;

			lid = this.selectedLayer;

			this.log.message('buildPins',this.layers[lid]);


			if(!options) options = {};
			options = extendObject(options,this.layers[lid].options);

			marker = options.marker;
			
			// Loop over markers building them as necessary
			for(m in this.layers[lid].options.markers){
				if(this.layers[lid].options.markers[m] && !this.layers[lid].options.markers[m].icon){
					if(!this.layers[lid].options.markers[m].color) this.layers[lid].options.markers[m].color = (options.color||'white');
					this.layers[lid].options.markers[m].icon = makeMarker(this.layers[lid].options.markers[m].svg||'marker',this.layers[lid].options.markers[m].background);
				}
			}


			obj = this;

			// Define the custom background colour for the group
			color = "white";
			if(options.color) color = options.color;

			if(this.layers[lid].options.markers[marker] && this.layers[lid].options.markers[marker].color) color = this.layers[lid].options.markers[marker].color;

			nodes = L.markerClusterGroup({
				chunkedLoading: true,
				maxClusterRadius: 60,
				iconCreateFunction: function (cluster) {
					var pins = cluster.getAllChildMarkers();
					var colours = {};
					for(var i = 0; i < pins.length; i++){
						if(!colours[pins[i].properties.background]) colours[pins[i].properties.background] = 0;
						colours[pins[i].properties.background]++;
					}
					var grad = "";
					// The number of colours
					var n = 0;
					var p = 0;
					var f = Math.sqrt(2);
					var ordered = Object.keys(colours).sort(function(a,b){return colours[a]-colours[b]});
					for(var i = ordered.length-1; i >= 0; i--){
						c = ordered[i];
						if(grad) grad += ', ';
						grad += c+' '+Math.round(p)+'%';
						p += (100*colours[c]/pins.length)/f;
						grad += ' '+Math.round(p)+'%';
					}
					return L.divIcon({ html: '<div class="marker-group" style="background:radial-gradient(circle at center, '+grad+');color:white">'+pins.length+'</div>', className: '',iconSize: L.point(40, 40) });
				},
				// Disable all of the defaults:
				spiderfyOnMaxZoom: true,
				showCoverageOnHover: false,
				zoomToBoundsOnClick: true
			});

			// Build marker list
			markerList = [];

			// Remove the previous cluster group
			if(this.layers[lid].nodegroup) this.map.removeLayer(this.layers[lid].nodegroup);

			for(id in this.layers[lid].nodes){
				if(this.layers[lid].nodes[id] && typeof this.layers[lid].nodes[id].lon==="number" && typeof this.layers[lid].nodes[id].lat==="number"){

					popup = {};

					if(typeof options.popup==="function"){

						popup = options.popup.call(this,this.layers[lid].nodes[id]);

					}else{

						str = '';
						if(typeof this.layers[lid].nodes[id].props[t]!=="undefined"){
							for(t in options.tags){
								if(options.tags[t] && options.tags[t].title) str += (str.length > 0 ? '<br />':'')+'<strong>'+options.tags[t].title+'</strong>: '+(this.layers[lid].nodes[id].props[t]);
							}
						}
						// Add a title if one is provided
						popup = {'label':'<h3>'+(options.title||"Node")+'</h3>'+(str ? '<p>'+str+'</p>':''),'options':{'icon':marker}};

					}

					if(this.layers[lid].options.markers[popup.options.icon]){
						tempmark = L.marker([this.layers[lid].nodes[id].lat,this.layers[lid].nodes[id].lon],{icon: this.layers[lid].options.markers[popup.options.icon].icon}).on('popupopen', function(e){
							obj.trigger('popupopen',e);
						}).on('popupclose',function(e){
							obj.trigger('popupclose',e);
						});
					}else{
						tempmark = L.marker([this.layers[lid].nodes[id].lat,this.layers[lid].nodes[id].lon]).on('popupopen', function(e){
							obj.trigger('popupopen',e);
						}).on('popupclose',function(e){
							obj.trigger('popupclose',e);
						});						
					}
					tempmark.osmid = id;
					if(!tempmark.properties) tempmark.properties = {};
					tempmark.properties.background = (this.layers[lid].options.markers[popup.options.icon] ? this.layers[lid].options.markers[popup.options.icon].background : "black");
					tempmark.properties.color = (this.layers[lid].options.markers[popup.options.icon] ? this.layers[lid].options.markers[popup.options.icon].color : "red");
					tempmark.bindPopup(popup.label,popup.options);
					markerList.push(tempmark);
				}else{
					this.log.warning('Unable to add node: '+id);
				}
			}

			// Add all the markers we've just made
			nodes.addLayers(markerList);
			this.map.addLayer(nodes);

			// Save a copy of the cluster group
			this.layers[lid].nodegroup = nodes;
		}
		this.getNodes = function(a,options){
			this.log.message('getNodes',a,options);
			if(!a || !this.layers[a]){
				this.log.error('No layer '+a);
				return this;
			}
			if(!options) options = {};
			options['this'] = this;
			this.getNodesFromGeoJSON(a,options,function(e){
				this.log.message('got geojson',this,e);
				// Do things here to build marker cluster layer
				this.trigger('updatenodes',e);
			});
			return this;
		}

		this.addGeoJSONLayer = function(id,opts){
			if(!this.layers) this.layers = {};
			if(!this.layers[id]) this.layers[id] = {};
			this.layers[id].options = extendObject(this.layers[id].options||{},opts);
			
			return this;
		}
		this.setGeoJSONLayer = function(id){
			if(id && this.layers[id]){
				this.selectedLayer = id;
				// Update tiles
				//this.getNodes(this.selectedLayer,this.layers[id].opts);
			}else{
				this.log.warning('No layer specified');
			}
			return this;
		}

		// Add geolocation control and interaction
		var geolocation = null;//new GeoLocation({mapper:this});

		// Convert metres to pixels (used by GeoLocation)
		this.m2px = function(m,lat,zoom){
			if(!lat) lat = this.map.getCenter().lat;
			if(!zoom) zoom = this.map.getZoom();
			var mperpx = 40075016.686 * Math.abs(Math.cos(lat * 180/Math.PI)) / Math.pow(2, zoom+8);
			return m/mperpx;
		}

		this.init = function(){
			
			//this.setGeoJSONLayer(options.);
			//this.trigger('moveend');
			this.updateView(location.search.substr(1));
			var _obj = this;
			if(this.selectedLayer){
				var el = document.getElementById('layers');
				if(el){
					el.value = this.selectedLayer;
				}
			}

			// Add event to change of push state
			window[(pushstate) ? 'onpopstate' : 'onhashchange'] = function(e){
				_obj.updateView(location.search.substr(1));
			};
		}
		
		this.updateView = function(qs){
			var lat,lon,z,l,q;
			if(typeof qs==="string"){
				q = qs.split(/\//);
				l = q[0];
				z = parseInt(q[1]);
				lat = parseFloat(q[2]);
				lon = parseFloat(q[3]);
			}else if(typeof qs==="object"){
				l = qs.l;
				z = (qs.zoom||this.map.getZoom());
				lat = (qs.lat||this.map.getCenter().lat);
				lon = (qs.lon||this.map.getCenter().lng);
				qs = buildQueryString(lat,lon,z,l);
			}
			
			this.setGeoJSONLayer(l);
			
			// Set map view if it isn't in the query string
			if(isNaN(lat) || typeof lat!=="number") lat = 53.79659;
			if(isNaN(lon) || typeof lon!=="number") lon = -1.53385;
			if(isNaN(z) || typeof z!=="number") z = 12;

			this.automatic = true;
			this.map.setView({'lon': lon, 'lat': lat,'l':l,'zoom':z},z);

			return this;
		}


		// Attach a handler to an event for the OSMEditor object in a style similar to that used by jQuery
		//   .on(eventType[,eventData],handler(eventObject));
		//   .on("authenticate",function(e){ console.log(e); });
		//   .on("authenticate",{me:this},function(e){ console.log(e.data.me); });
		this.on = function(ev,e,fn){
			if(typeof ev!="string") return this;
			if(typeof fn==="undefined"){
				fn = e;
				e = {};
			}else{
				e = {data:e}
			}
			if(typeof e!="object" || typeof fn!="function") return this;
			if(this.events[ev]) this.events[ev].push({e:e,fn:fn});
			else this.events[ev] = [{e:e,fn:fn}];
			return this;
		}

		// Trigger a defined event with arguments. This is for internal-use to be 
		// sure to include the correct arguments for a particular event
		this.trigger = function(ev,args){
			if(typeof ev != "string") return;
			if(typeof args != "object") args = {};
			var o = [];
			if(typeof this.events[ev]=="object"){
				for(var i = 0 ; i < this.events[ev].length ; i++){
					var e = extendObject(this.events[ev][i].e,args);
					if(typeof this.events[ev][i].fn == "function") o.push(this.events[ev][i].fn.call(e['this']||this,e))
				}
			}
			if(o.length > 0) return o;
		}

		function buildQueryString(lat,lon,z,lay){
			return '?'+lay+'/'+z+'/'+lat.toFixed(5)+'/'+lon.toFixed(5);
		}
		// Attach events
		this.on('moveend',function(){
			if(this.map.getZoom() >= 11){
				id = (this.selectedLayer && this.layers[this.selectedLayer] ? this.selectedLayer : "");
				if(id) this.getNodes(id,this.layers[id].options);
				if(this.automatic){
					this.automatic = false;
				}else{
					var c = this.map.getCenter();
					var z = this.map.getZoom();
					history.pushState({'lon': c.lng, 'lat': c.lat,'l':this.selectedLayer,'zoom':z}, 'Test', buildQueryString(c.lat,c.lng,z,this.selectedLayer));
				}
			}
		});
		this.map.on("movestart", function(){ _obj.trigger('movestart'); });
		this.map.on("move", function(){ _obj.trigger('move'); });
		this.map.on("moveend", function(){ _obj.trigger('moveend'); });

		return this;
	}
		



	function Tiler(){
		var R = 6378137, sphericalScale = 0.5 / (Math.PI * R);

		function tile2lon(x,z){ return (x/Math.pow(2,z)*360-180); }
		function tile2lat(y,z){ var n=Math.PI-2*Math.PI*y/Math.pow(2,z); return (180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)))); }

		/* Adapted from: https://gist.github.com/mourner/8825883 */
		this.xyz = function(bounds, z) {

			var min = project(bounds._northEast.lat,bounds._southWest.lng, z);//north,west
			var max = project(bounds._southWest.lat,bounds._northEast.lng, z);//south,east
			var tiles = [];
			var x,y;
			for(x = min.x; x <= max.x; x++) {
				for(y = min.y; y <= max.y; y++) {
					tiles.push({
						x: x,
						y: y,
						z: z,
						b: {'_northEast':{'lat':tile2lat(y,z),'lng':tile2lon(x+1,z)},'_southWest':{'lat':tile2lat(y+1,z),'lng':tile2lon(x,z)}}
					});
				}
			}
			return tiles;
		}

		/* 
		Adapts a group of functions from Leaflet.js to work headlessly
		https://github.com/Leaflet/Leaflet
		*/
		function project(lat,lng,zoom) {
			var d = Math.PI / 180,
			max = 1 - 1E-15,
			sin = Math.max(Math.min(Math.sin(lat * d), max), -max),
			scale = 256 * Math.pow(2, zoom);

			var point = {
				x: R * lng * d,
				y: R * Math.log((1 + sin) / (1 - sin)) / 2
			};

			point.x = tiled(scale * (sphericalScale * point.x + 0.5));
			point.y = tiled(scale * (-sphericalScale * point.y + 0.5));

			return point;
		}

		function tiled(num) {
			return Math.floor(num/256);
		}
		return this;
	}

	// Extend objects
	extendObject = (typeof Object.extend === 'undefined') ?
		function(destination, source) {
			for (var property in source) {
				if (source.hasOwnProperty(property)) destination[property] = source[property];
			}
			return destination;
		} : Object.extend;

	var icons = {
		'zoomin':'<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path style="fill:%COLOR%" d="M 11 11 l 0,-5 2,0 0,5 5,0 0,2 -5,0 0,5 -2,0 0,-5 -5,0 0,-2 5,0 M 12,12 m -0.5,-12 a 12, 12, 0, 1, 0, 1, 0 Z m 1 2 a 10, 10, 0, 1, 1, -1, 0 Z M 20.5 20.5 l 1.5,-1.5 8,8 -3,3 -8,-8Z" /></svg>',
		'zoomout':'<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path style="fill:%COLOR%" d="M 12 12 m 0,-1 l 6,0 0,2 -12,0 0,-2Z M 12,12 m -0.5,-12 a 12, 12, 0, 1, 0, 1, 0 Z m 1 2 a 10, 10, 0, 1, 1, -1, 0 Z M 20.5 20.5 l 1.5,-1.5 8,8 -3,3 -8,-8Z" /></svg>',
		'geo':'<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path style="fill:%COLOR%" d="M 16,0 L30,30 0,16 12,12 Z" /></svg>',
		'marker':'<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" width="7.0556mm" height="11.571mm" viewBox="0 0 25 41.001" id="svg2" version="1.1"><g id="layer1" transform="translate(1195.4,216.71)"><path style="fill:%COLOR%;fill-opacity:1;fill-rule:evenodd;stroke:#ffffff;stroke-width:0.1;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1;stroke-miterlimit:4;stroke-dasharray:none" d="M 12.5 0.5 A 12 12 0 0 0 0.5 12.5 A 12 12 0 0 0 1.8047 17.939 L 1.8008 17.939 L 12.5 40.998 L 23.199 17.939 L 23.182 17.939 A 12 12 0 0 0 24.5 12.5 A 12 12 0 0 0 12.5 0.5 z " transform="matrix(1,0,0,1,-1195.4,-216.71)" id="path4147" /><ellipse style="opacity:1;fill:#ffffff;fill-opacity:1;stroke:none;stroke-width:1.428;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1" id="path4173" cx="-1182.9" cy="-204.47" rx="5.3848" ry="5.0002" /></g></svg>'
	}
	
	function getIcon(icon,colour){
		if(icons[icon]) return icons[icon].replace(/%COLOR%/g,(colour||"black"));
		else return icon.replace(/%COLOR%/g,(colour||"black"));
	}

	// Define a logging function
	function Logger(inp){
		if(!inp) inp = {};
		this.logging = (inp.logging||false);
		this.logtime = (inp.logtime||false);
		this.id = (inp.id||"JS");
		this.metrics = {};
		return this;
	}
	Logger.prototype.error = function(){ this.log('ERROR',arguments); };
	Logger.prototype.warning = function(){ this.log('WARNING',arguments); };
	Logger.prototype.info = function(){ this.log('INFO',arguments); };
	Logger.prototype.message = function(){ this.log('MESSAGE',arguments); }
	Logger.prototype.log = function(){
		if(this.logging || arguments[0]=="ERROR" || arguments[0]=="WARNING" || arguments[0]=="INFO"){
			var args,bold;
			args = Array.prototype.slice.call(arguments[1], 0);
			bold = 'font-weight:bold;';
			if(console && typeof console.log==="function"){
				if(arguments[0] == "ERROR") console.error('%c'+this.id+'%c:',bold,'',...args);
				else if(arguments[0] == "WARNING") console.warn('%c'+this.id+'%c:',bold,'',...args);
				else if(arguments[0] == "INFO") console.info('%c'+this.id+'%c:',bold,'',...args);
				else console.log('%c'+this.id+'%c:',bold,'',...args);
			}
		}
		return this;
	}
	Logger.prototype.time = function(key){
		if(!this.metrics[key]) this.metrics[key] = {'times':[],'start':''};
		if(!this.metrics[key].start) this.metrics[key].start = new Date();
		else{
			var t,w,v,tot,l,i,ts;
			t = ((new Date())-this.metrics[key].start);
			ts = this.metrics[key].times;
			// Define the weights for each time in the array
			w = [1,0.75,0.55,0.4,0.28,0.18,0.1,0.05,0.002];
			// Add this time to the start of the array
			ts.unshift(t);
			// Remove old times from the end
			if(ts.length > w.length-1) ts = ts.slice(0,w.length);
			// Work out the weighted average
			l = ts.length;
			this.metrics[key].av = 0;
			if(l > 0){
				for(i = 0, v = 0, tot = 0 ; i < l ; i++){
					v += ts[i]*w[i];
					tot += w[i];
				}
				this.metrics[key].av = v/tot;
			}
			this.metrics[key].times = ts.splice(0);
			if(this.logtime) this.info(key+' '+t+'ms ('+this.metrics[key].av.toFixed(1)+'ms av)');
			delete this.metrics[key].start;
		}
		return this;
	};

	root.OSMMap = OSMMap;

})(window || this);


function ready(f){
	if(/in/.test(document.readyState)) setTimeout('ready('+f+')',9);
	else f();
};

var app;

ready(function(){
	
	app = new OSMMap('map',{'show':{'zoom':true}});

	app.addGeoJSONLayer('bins',{
		'src': 'https://odileeds.github.io/osm-geojson/tiles/bins/{z}/{x}/{y}.geojson',
		'markers': {
			'waste':{'svg':'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42"><path style="fill:%COLOR%;fill-opacity:1" d="M 16 42 L 3,34 3,7 0,7 0,4 8,4 10,0 22,0 24,4 21,4 20,2 12,2 11,4 32,4 32,7 29,7 29,11 29,34 Z" /><path style="fill:#999999;fill-opacity:1" d="M 8,11 l 0,19 3,0 0,-19 -3,0 m 6.5,0 l 0,19 3,0 0,-19 -3,0 m 6.5,0 l 0,19 3,0 0,-19 -3,0" /></svg>','color':'white','background':'black'},
			'recycling':{'svg':'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42"><path style="fill:#0DBC37;fill-opacity:1" d="M 16 42 L 3,34 3,7 0,7 0,4 8,4 10,0 22,0 24,4 21,4 20,2 12,2 11,4 32,4 32,7 29,7 29,34 Z" /><path style="fill:#ffffff;fill-opacity:1" d="M 15 26 l 4,4 0,-2 4,0 4,-6 -3,-5 -2,1 2,4 -2,3 -3,0 0,-2 Z m -1,-1 l 0,3 -4,0 -4,-6 2,-3 -2,-1 4,-1 2,4 -2,-1 -1,2 2,3 z m -2,-8 l -3,-2 4,-5 5,0 3,3 2,-2 0,6 -6,0 2,-2 -2,-2 -3,0" /></svg>','color':'white','background':'#0DBC37'},
			'beverage':{'svg':'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42"><path style="fill:#F9BC26;fill-opacity:1" d="M 16 42 L 3,34 3,12 C 6 0, 26 0, 29 12 L 29,12 L 29,34 Z" /><path style="fill:#D60303;fill-opacity:1" d="M 16 34 l -5,0 0,-5 1,-1 0,-8 -1,-1 0,-4 c 0 -2, 2 -4, 4 -4 l 0,-1 -1,0 0,-4 4,0 0,4 -1,0 0,1 c 2 0, 4 2, 4 4 l 0,4 -1,1 0,8 1,1 0,5 Z" /></svg>','color':'white','background':'#F9BC26'},
			'paper':{'svg':'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42"><path style="fill:#00ace8;fill-opacity:1" d="M 16 42 L 3,34 3,7 0,7 0,4 8,4 10,0 22,0 24,4 21,4 20,2 12,2 11,4 32,4 32,7 29,7 29,34 Z" /><path style="fill:#ffffff;fill-opacity:1" d="M 9,31 l 0,-21 9,0 0,6 6,0 0,2 -12,0 0,2 9,0 0,-2 3,0 0,4 -12,0 0,2 9,0 0,-2 3,0 0,4 -12,0 0,2 9,0 0,-2 3,0 0,5 z m 15,-16 l -5,0 0,-5 z" /></svg>','background':'#00ace8'},
			'glass':{'svg':'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42"><path style="fill:#1DD3A7;fill-opacity:1" d="M 16 42 L 3,34 3,12 C 6 0, 26 0, 29 12 L 29,12 L 29,34 Z" /><path style="fill:#ffffff;fill-opacity:1" d="M 16 32 l -5,0 0,-10 c 0 -4, 4 -6, 4 -14 l 2,0 c 0 6, 4 10, 4 14 l 0,10 Z" /></svg>','background':'#1DD3A7'},
			'battery':{'svg':'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42"><path style="fill:#1DD3A7;fill-opacity:1" d="M 16 42 l -13,-8 0,-26 6,0 0,-5 14,0 0,5 6,0 0,26 Z" /><path style="fill:#ffffff;fill-opacity:1" d="M 12 30 l 9,0 0,-3 -9,0 z M 14.5 13 l 0,-3 3,0 0,3 3,0 0,3 -3,0 0,3 -3,0 0,-3 -3,0 0,-3" /></svg>','background':'#1DD3A7'}
		},
		'marker': 'waste',
		'propertylookup':{
			'OSMID':{'hide':true}
		},
		'popup': function(mark){
			var str,cls,title,types,p,i,ts,ul;
			ul = '';
			str = '';
			cls = '';
			ico = '';
			title = 'Bin';
			types = {};
			ts = 0;
			if(mark.props.amenity){
				if(mark.props.amenity=="waste_basket"){
					title = "Waste";
					cls = "waste";
					ico = "waste";
				}else{
					for(t in mark.props){
						if(t.indexOf("recycling:")==0){
							types[t] = mark.props[t];
						}
					}
					ts = Object.keys(types).length;
					title = "Recycling";
					cls = "recycling";
					ico = "recycling";
					// If only one type of recycling pick that bin
					if(ts==1){
						if(types['recycling:beverage_cartons']){ ico = "beverage"; cls += ' beverage'; }
						if(types['recycling:paper']){ ico = "paper"; cls += " paper"; }
						if(types['recycling:glass_bottles']){ ico = "glass"; cls += ' glass'; }
					}
				}
			}
			i = 0;
			propertylookup = (this.layers[this.selectedLayer].options.propertylookup||{}); 
			for(p in mark.props){
				if(!propertylookup[p] || (propertylookup[p] && !propertylookup[p].hide)){
					ul += '<tr><td><strong>'+(propertylookup[p] ? propertylookup[p].label : p)+'</strong>:</td><td>'+(p == "website" ? '<a href="'+mark.props[p]+'" target="_external">'+mark.props[p]+'</a>' : mark.props[p])+'</td></tr>';
				}
			}
			ul += '<tr><td><strong>OSMID:</strong></td><td>'+mark.id+'</td></tr>'
			ul = '<table class="small">'+ul+'</table>';
			return {'label':'<h3>'+title+'</h3>'+(str ? '<p>'+str+'</p>':'')+ul+'<p class="tiny">'+mark.lastupdate+'</p>', 'options':{'className':cls,'icon':ico}};
		}
	}).addGeoJSONLayer('trees',{
		'src': 'https://odileeds.github.io/osm-geojson/tiles/trees/{z}/{x}/{y}.geojson',
		'markers': {
			'tree':{'svg':'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42"><g transform="translate(-130.66939,-107.49557)"><g transform="matrix(0.153091,0,0,0.15566029,110.65045,90.645502)"><path style="fill:%COLOR%;" d="m 130.765,212.764 c 0,-57.724 34.836,-104.515 104.511,-104.515 69.675,0 104.515,46.791 104.515,104.515 0,57.72 -36.38424,97.95411 -97.12973,146.16614 C 175.17787,319.02533 130.765,270.484 130.765,212.764 Z" /><path transform="translate(125.278,108.14938)" d="m 112.26172,53.445312 c -4.06,0 -7.34961,3.29361 -7.34961,7.34961 l -1.4043,94.636718 -43.855466,-61.626952 c -1.972,-2.978001 -5.993938,-3.794266 -8.960938,-1.822266 -2.978,1.968 -3.787172,5.980984 -1.826172,8.958988 0,0 47.083284,69.73942 50.714844,80.37695 3.120292,9.13993 3.173442,14.17199 3.236332,20.66211 L 101.875,265.4082 c 0,6.013 21.77344,6.013 21.77344,0 l -1.40821,-71.29882 c -0.10522,-7.74371 0.28703,-14.04107 3.48243,-22.88282 3.30183,-9.13627 37.91992,-79.947263 37.91992,-79.947263 1.523,-2.934 0.37922,-6.537547 -2.55078,-8.060547 -2.922,-1.519 -6.53364,-0.373359 -8.05664,2.556641 l -31.79102,57.789059 -1.63476,-82.769528 c 0,-4.06 -3.29166,-7.34961 -7.34766,-7.34961 z" style="fill:#502d16" /></g></g></svg>','color':'#0dbc37','background':'white'}
		},
		'marker': 'tree',
		'propertylookup':{
			'OSMID':{'hide':true}
		},
		'popup': function(mark){
			var str,cls,title,types,p,i,ts,ul;
			ul = '';
			str = '';
			cls = '';
			ico = '';
			title = 'Bin';
			types = {};
			ts = 0;
			if(mark.props.natural){
				if(mark.props.natural=="tree"){
					title = "Tree";
					cls = "tree";
					ico = "tree";
				}
			}
			i = 0;
			propertylookup = (this.layers[this.selectedLayer].options.propertylookup||{}); 
			for(p in mark.props){
				if(!propertylookup[p] || (propertylookup[p] && !propertylookup[p].hide)){
					ul += '<tr><td><strong>'+(propertylookup[p] ? propertylookup[p].label : p)+'</strong>:</td><td>'+(p == "website" ? '<a href="'+mark.props[p]+'" target="_external">'+mark.props[p]+'</a>' : mark.props[p])+'</td></tr>';
				}
			}
			ul += '<tr><td><strong>OSMID:</strong></td><td>'+mark.id+'</td></tr>'
			ul = '<table class="small">'+ul+'</table>';
			return {'label':'<h3>'+title+'</h3>'+(str ? '<p>'+str+'</p>':'')+ul+'<p class="tiny">'+mark.lastupdate+'</p>', 'options':{'className':cls,'icon':ico}};
		}
	});
	app.init();

	ls = document.getElementById('layers');
	
	ls.addEventListener('change', function(e){
		app.updateView({'l':e.currentTarge.value});
	});
	

});