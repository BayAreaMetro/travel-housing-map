function blk2url(fips) {
	var url = [], step = 3;
	for (var i = 0; i < fips.length; i += step) {
		url.push(fips.substr(i, step));
	}
	return "http://move.onebayarea.org/data/blk2taz/" + url.join("/") + ".txt";
}

function blk2taz(block, options) {
	var opts = $.extend(options, {
		dataType: "text"
	});
	var url = blk2url(block);
	return $.ajax(url, opts);
}

function location2taz(loc, options) {
	if (typeof loc == "string") {
		loc = loc.split(/\s*,\s*/);
		loc = {lat: loc[0], lon: loc[1]};
	}

	var url = "http://data.fcc.gov/api/block/find";
	return $.ajax(url, {
		dataType: "jsonp",
		data: {
			latitude: loc.lat,
			longitude: loc.lon,
			format: "jsonp"
		},
		success: function(res) {
			if (res.status == "OK") {
				var fips = res.Block.FIPS;
				// console.log("Got FIPS: " + fips);
				if (options.fips) {
					options.fips.call(options.context, fips);
				}
				blk2taz(fips, options);
			} else {
				if (res.Err) {
					options.error.call(options.context, null, res.Err.msg, res.Err);
				}
			}
		},
		error: options.error
	});
}
