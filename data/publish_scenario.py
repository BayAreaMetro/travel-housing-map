import csv, sys, re
import os.path
import itertools
# for better floating point precision
from decimal import Decimal

NULL_VALUE = -999

HEADER_MAP = {
	# origin & destination columns
	"orig": 	"orig",
	"dest": 	"dest",

	# walk/bike -> same
	"walk": 	"walk",
	"bike": 	"bike",

	# x -> auto_{occupancy}(_toll)?
	"da": 		"auto_1",
	"daToll": 	"auto_1_toll",
	"s2": 		"auto_2",
	"s2Toll": 	"auto_2_toll",
	"s3": 		"auto_3",
	"s3Toll": 	"auto_3_toll",

	# access/transit/egress -> trans_{access}_{egress}
	"wTrnW": 	"trans_walk_walk",
	"dTrnW": 	"trans_auto_walk",
	"wTrnD": 	"trans_walk_auto"
}

# only parse numbers out of these keys
MAP_HEADERS = HEADER_MAP.keys()

# filename pattern
FILENAME_MATCH = re.compile('^(\w+)SkimsDatabase([A-Z]{2}).csv$')

# Our MTC CSV dialect has no quotes or escape chars, but should skip initial
# white space (as this is easier to do from within DictReader than calling
# strip() on all the values)
class MTCDialect(csv.Dialect):
	delimiter = ','
	doublequote = False
	escapechar = None
	skipinitialspace = True
	quoting = csv.QUOTE_NONE
	quotechar = None
	lineterminator = '\n'

def map_row(row):
	for col in MAP_HEADERS:
		if row.has_key(col):
			row[HEADER_MAP[col]] = row[col]
			# del row[col]
	return row

def parse_val(val):
	f = Decimal(val.strip())
	return (f == NULL_VALUE and None) or f

# Build a TAZ map for a list of rows keyed on the specified TAZ id column
# (usually "orig" or "dest")
def build_taz_map(rows, taz_col):
	taz_map = {}
	for row in rows:
		taz_id = row.get(taz_col)
		if not taz_map.has_key(taz_id):
			taz_map[taz_id] = []
		taz_map[taz_id].append(row)
	return taz_map

# Build a TAZ map for a list of rows keyed on the specified TAZ id column
# (usually "orig" or "dest")
def build_taz_maps(rows, *cols):
	taz_maps = {}
	for col in cols:
		taz_maps[col] = {}
	for row in rows:
		for col in cols:
			_map = taz_maps[col]
			taz_id = row.get(col)
			if not _map.has_key(taz_id):
				_map[taz_id] = []
			_map[taz_id].append(row)
	return taz_maps

def intersection(a, b):
	return filter(lambda c: c in b, a)

# Process a filename into one or more files in an output directory.
def process_file(in_filename, out_dir='.', **options):
	base = os.path.basename(in_filename)
	# print >> sys.stderr, "checking: %s ; basename = %s" % (filename, base)
	match = FILENAME_MATCH.match(base)
	if match:
		metric, period = match.group(1).lower(), match.group(2)
		
		fp = open(filename, 'r')
		reader = csv.DictReader(fp, dialect=MTCDialect)
		print >> sys.stderr, "+ reading: %s ; metric = %s, period = %s" % (filename, metric, period)

		# use an iterator to avoid reading the whole thing into memory
		rows = itertools.imap(map_row, reader)
		# XXX: uncomment for testing!
		# rows = itertools.islice(rows, 1000)

		# headers to write for all files
		# ("orig" and "dest" followed by a sorted list of mode-specific ones)
		out_headers = ["orig", "dest"] + MAP_HEADERS
		# only write common headers
		common_headers = intersection(reader.fieldnames, out_headers)
		common_headers = map(HEADER_MAP.get, common_headers)

		written = 0

		print >> sys.stderr, ". building TAZ id maps..."
		taz_maps = build_taz_maps(rows, "orig", "dest")

		from_taz = taz_maps["orig"]
		from_headers = common_headers[::]
		# TODO: strip out unnecessary columns once we're sure this is doing The Right Thing
		# from_headers.remove("orig")
		written += write_taz_map(from_taz, os.path.join(out_dir, "%s/%s/from/{taz}.csv" % (metric, period)), from_headers)
		del from_taz

		to_taz = taz_maps["dest"]
		to_headers = common_headers[::]
		# TODO: strip out unnecessary columns once we're sure this is doing The Right Thing
		# to_headers.remove("dest")
		written += write_taz_map(to_taz, os.path.join(out_dir, "%s/%s/to/{taz}.csv" % (metric, period)), to_headers)
		del to_taz

		fp.close()
		del taz_maps

		return written

	print >> sys.stderr, "- no match for filename: %s" % filename
	return False

# Write the TAZ map (a dict of lists with each key a TAZ id) to disk as a
# separate files for each TAZ.
def write_taz_map(taz_map, filename_format, columns):
	print >> sys.stderr, "  + writing %d taz_map entries to: %s..." % (len(taz_map), filename_format)
	written = 0
	for taz_id in taz_map:
		filename = filename_format.replace("{taz}", taz_id)
		if os.path.isfile(filename):
			continue
		prepdirs(filename)
		print >> sys.stderr, "  + writing: %s" % filename
		fp = open(filename, 'w')
		writer = csv.DictWriter(fp, columns, dialect=MTCDialect, extrasaction="ignore")
		# writer.writeheader()
		writer.writerow(dict(zip(columns, columns)))
		writer.writerows(taz_map[taz_id])
		fp.close()
		written += 1
	return written

# recursively make dirs for a given file path
def prepdirs(filename):
	dirname = os.path.dirname(filename)
	if not os.path.isdir(dirname):
		print >> sys.stderr, "  * makedirs(): %s" % dirname
		os.makedirs(dirname)

if __name__ == "__main__":
	import optparse
	import glob

	parser = optparse.OptionParser()
	opts, args = parser.parse_args()

	if len(args) < 2:
		if len(args) == 0:
			in_dir = out_dir = '.'
		elif len(args) == 1:
			in_dir = out_dir = args[0]
		if os.path.isdir(in_dir):
			in_files = glob.glob(os.path.join(in_dir, "*.csv"))
		else:
			in_files = (in_dir, )
	else:
		out_dir = args.pop()
		in_files = args
	
	print >> sys.stderr, "%s -> %s" % (','.join(in_files), out_dir)

	written = 0
	for filename in in_files:
		written += process_file(filename, out_dir)
	print >> sys.stderr, "wrote %d file(s)" % written
