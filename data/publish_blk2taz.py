import csv, sys, re, os.path
import mtc

FIPS_PARTS = [2, 3, 6, 4]

def process_file(in_file, out_dir='.'):
	fp = open(in_file, 'r')
	reader = csv.DictReader(fp, dialect=mtc.MTCDialect)
	written = 0
	for row in iter(reader):
		fips_id = row["BLOCK"][1:]
		taz_id = row["TAZ"]
		parts = []
		for n in FIPS_PARTS:
			parts.append(fips_id[:n])
			fips_id = fips_id[n:]
		if len(parts) > 0:
			filename = os.path.join(out_dir, os.path.join(*parts[:-1]), "%s.txt" % parts[-1])
			print >> sys.stderr, "%s / %s -> %s" % (''.join(parts), taz_id, filename)
			mtc.prepdirs(os.path.dirname(filename))
			dp = open(filename, 'w')
			dp.write(taz_id)
			dp.close()
			written += 1
	fp.close()
	return written

if __name__ == "__main__":
	import optparse

	parser = optparse.OptionParser()
	opts, args = parser.parse_args()

	if len(args) <= 2:
		in_file, out_dir, = args
	elif len(args) == 1:
		in_file, out_dir = (args[0], )
	else:
		parser.error("need a filename")

	written = process_file(in_file, out_dir)
	print >> sys.stderr, "wrote %d file(s)" % written
