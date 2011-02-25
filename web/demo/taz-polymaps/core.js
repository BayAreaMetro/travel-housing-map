$(function() {
	var po = org.polymaps,
			map = po.map()
				.container($("#map")[0].appendChild(po.svg("svg")));
	
	map.center({lon: -122.2757, lat: 37.8355})
	map.zoom(9);
	map.zoomRange([9, 12]);

	var taz = po.geoJson()
		.url(null)
		.tile(false)
		.zoom(map.zoom() + 2);

	var base = po.image()
		.url("http://a.acetate.geoiq.com/tiles/acetate-base/{Z}/{X}/{Y}.png");

	var labels = po.image()
		.url("http://a.acetate.geoiq.com/tiles/acetate-labels/{Z}/{X}/{Y}.png");

	map.add(base);
	map.add(taz);
	map.add(labels);
	map.add(po.interact());
	map.add(po.compass()
	    .pan("none"));
	map.add(po.hash());

	$(labels.container())
		.css("pointer-events", "none");
		
	var scale = pv.Scale.linear()
		.domain(0, 250000, 1000000)
		.range("rgb(222,235,247)", "rgb(158,202,225)", "rgb(8,69,148)");

	var thresholdMin = 0;
	var thresholdMax = 1000000;

	function update() {
		var _out = "LOW:<span> $"+commize(thresholdMin)+"</span>HI:<span> $"+commize(thresholdMax)+"</span>";
		$("#price_range").html(_out);
		// console.log("threshold: " + commize(threshold));
		//var t = timer().start();
		taz.reshow();
		
		//var took = t.end();
		//$("#timer").text("(took " + took + "ms)");
		return false;
	}

	function price(feature) {
		return feature.properties.average_value_per_unit;
	}

	function formatPrice(p) {
		return "$" + commize(p);
	}
	
	function setSlider(min,max){
		var _options = {};
		_options.min = min;
		_options.max = max;
		_options.values = [ thresholdMin , thresholdMax ];
		_options.disabled = false;
		$( "#slider" ).slider( "option", _options );
		$( "#slider" ).css("opacity",1);
	}

	var style = po.stylist();
	style.attr("stroke", "#999");
	style.attr("stroke-width", .5);
	style.title(function(feature) {
		return feature.properties["TAZ1454"] + ": " + formatPrice(price(feature));
	});
	
	// color code fill based on home price value
	style.attr("fill", function(feature) {
		if (price(feature) >= thresholdMin && price(feature) <= thresholdMax) {
			var value = price(feature);
			var color = scale(value).color;
			// console.log(value + " -> " + color);
			return color;
		} else {
			return "#ccc";
		}
	});
	
	//hide features that don't meet our critera
	style.attr("display", function(feature) {
		if (price(feature) >= thresholdMin && price(feature) <= thresholdMax) {
			return "";
		} else {
			return "none";
		}
	});
	
	/* SLIDER INIT */
	$( "#slider" ).slider({
		range: true,
		disabled: true,
		change: function( event, ui ) {
					thresholdMin = ui.values[0];
					thresholdMax = ui.values[1];
					update();
						//updateOutput(output,ui.value);
				},
		create: function(event, ui) { $( "#slider" ).css("opacity",.3); }
	});
	

	taz.on("show", style);

	$("#status").attr("class", "loading").text("Loading...");

	$.ajax("taz.js", {
		dataType: "jsonp",
		jsonpCallback: "loadTaz",
		error: function(req, text, e) {
			$("#status").attr("class", "error").text("Error: " + text);
		},
		success: function(collection) {

			var features = collection.features;

			var min = pv.min(features, price),
					median = pv.median(features, price),
					max = pv.max(features, price);

			var step = 100000;
			function priceGroup(feature) {
				return Math.round(price(feature) / step) * step;
			}
			
			var priceGroups = pv.nest(features)
				.key(priceGroup)
				.rollup(function(group) { return group.length; });
			// [{key: 100000, value: 10}, ...]

			createBars("timescale",priceGroups);

			thresholdMin = median;
			thresholdMax = max;
			
			scale.domain(min, median, max);
			
			$("#status").attr("class", "loaded").text("Loaded " + features.length + " TAZs");
			var _ti = setTimeout(function(){
				$("#status").fadeOut();
			},1000);

			taz.features(features);
			setSlider(min,max);
			initGeocoding();
		}
	});
	
	/**/
	
	function createBars(el,data){

		var _data = [];
		for(i in data){
			_data.push(data[i]);
		}

		if(!_data.length)return;
		
		var min = pv.min(_data),
			max = pv.max(_data);
					
		var _w = $("#"+el).parent().width();
		var _h = 20;
		var _s = Number(_w) / _data.length;
	
		var viz = new pv.Panel()
			.width(_w)
			.height(_h)
			.canvas(el)
		
		//pv.Bar
		var bars = viz.add(pv.Area)
			.data(_data)
			.bottom(0)
			.width(_s)
			.height( function(d) {return (d / max) * _h;} )
			.left( function() { return this.index * _s;} )
			.fillStyle("#166");			

		viz.render();
		 
	}
	
	/* GEOCODING STUFF 
	 *
	 * TODO: validate returned address is within bounds
	*/
	function initGeocoding(){
		var geocoder = new google.maps.Geocoder();
		var $this = this;
		
		$("#geocodeBtn").click(function(e){
			e.preventDefault();
			var _address = $("#address").val();
			if(_address && _address.length)findMe(_address);
		});
	
		function findMe(address){
			geocoder.geocode( { 'address': address}, function(results, status) {
				if (status == google.maps.GeocoderStatus.OK) {
					map.center({lon: results[0].geometry.location.lng(), lat: results[0].geometry.location.lat()})
					map.zoom(12);
					//var t=setTimeout("alertMsg()",3000);
					$("#address").val("enter your address");
				} else {
					$("#address").val("error");
				}
			});
		}
		
	}
	
});