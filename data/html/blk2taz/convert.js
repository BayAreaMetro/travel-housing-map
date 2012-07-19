function blk2url(fips) {
	var n = 0,
		bits = [2, 3, 6, 4],
		url = [];
	for (var i = 0; i < bits.length; i++) {
		url.push(fips.substr(n, bits[i]));
		n += bits[i];
	}
	return [blk2url.baseURL, "blk2taz/", url.join("/"), ".txt"].join("");
}

blk2url.baseURL = "http://move.onebayarea.org/data/";

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
				console.log("Got FIPS: " + fips);
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
