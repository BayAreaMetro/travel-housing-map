var timer = function() {
	var t = {},
			start,
			end,
			now = function() { return new Date().getTime(); };

	t.start = function() {
		start = now();
		return t;
	};

	t.end = function() {
		end = now();
		return t.elapsed();
	};

	t.elapsed = function() {
		return end - start;
	};

	return t;
};
