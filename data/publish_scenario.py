import csv, sys, re
import os.path
import itertools
import mtc

NULL_VALUE = -999

# filename pattern
FILENAME_MATCH = re.compile('^(\w+)SkimsDatabase([A-Z]{2})(dest)?.csv$')
COL_TO_DIR = {"orig": "to", "dest": "from"}

# Process a filename into one or more files in an output directory.
def process_file(in_filename, out_dir='.', **options):
	base = os.path.basename(in_filename)
	# print >> sys.stderr, "checking: %s ; basename = %s" % (filename, base)
	match = FILENAME_MATCH.match(base)
	if match:
		metric, period, col = match.group(1).lower(), match.group(2), match.group(3)
		if col is None:
			col = "orig"
		if not COL_TO_DIR.has_key(col):
			print >> sys.stderr, "No matching direction for column '%s'" % col
			return 0

		direction = COL_TO_DIR.get(col)
		# print base, "->", metric, period, col, direction
		# return 0
		
		fp = open(filename, 'r')
		reader = csv.DictReader(fp, dialect=mtc.MTCDialect)

		columns = reader.fieldnames[::]
		columns.remove(col)
		orig = itertools.groupby(reader, lambda row: row[col])
		written = write_taz_map(
			orig,
			os.path.join(out_dir, "%s/%s/%s/{taz}.csv" % (metric, period, direction)),
			columns
		)

		fp.close()
		return written
	return 0

# Write the TAZ map (a dict of lists with each key a TAZ id) to disk as a
# separate files for each TAZ.
def write_taz_map(taz_map, filename_format, columns):
	print >> sys.stderr, "  + writing taz_map entries to: %s..." % filename_format
	written = 0
	for taz_id, rows in taz_map:
		filename = filename_format.replace("{taz}", taz_id)
		written += 1
		if os.path.isfile(filename):
			print >> sys.stderr, "  - skipped: %s" % filename
			continue
		mtc.prepdirs(os.path.dirname(filename))
		print >> sys.stderr, "  + writing: %s" % filename
		fp = open(filename, 'w')
		writer = csv.DictWriter(fp, columns, dialect=mtc.MTCDialect, extrasaction="ignore")
		# writer.writeheader()
		writer.writerow(dict(zip(columns, columns)))
		writer.writerows(rows)

		fp.close()
	return written

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
