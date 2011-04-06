# these are used to clean up after shapefile zip archives (see: "clean")
TAZ_SHAPEFILE = taz1454_clipurb2002
SHAPEFILE_EXTS = shp shx prj sbn sbx dbf
LAST_BLKID = 060/971/543/024/999

# Our "all" target makes:
# 1. the TAZ GeoJSON file
# 2. the blk2taz mapping files
all: output/areas/taz1454.json output/blk2taz/$(LAST_BLKID).txt output-html

# Unzip the TAZ boundaries and overwrite the SHP and SHX components with
# simplified geometries.
input/$(TAZ_SHAPEFILE).shp:
	unzip -d input input/$(TAZ_SHAPEFILE).zip
	cp input/$(TAZ_SHAPEFILE)-simplified.shp input/$(TAZ_SHAPEFILE).shp
	cp input/$(TAZ_SHAPEFILE)-simplified.shx input/$(TAZ_SHAPEFILE).shx

# Strip out unnecessary fields from the buildings.csv and remove "_i4" suffix
# from column names.
input/buildings_min.csv: input/buildings.csv
	cat $< | cut -d , -f 1,3,11 > $@
	perl -pi -e 's/_i4//g' $@

# Convert the shapefile to GeoJSON
input/taz1454.json: input/$(TAZ_SHAPEFILE).shp
	ogr2ogr -f GeoJSON -t_srs EPSG:4326 $@ $<

output:
	mkdir -p $@

output/areas: output
	mkdir -p $@

output-html: output
	rsync -avrC html/ output/

# Merge fields from buildings_min.csv into the TAZ boundaries GeoJSON
output/areas/taz1454.json: input/taz1454.json input/buildings_min.csv output/areas
	python merge_taz.py input/buildings_min.csv $< > $@

# TODO: generate separate files for clipped urban areas!
output/areas/taz1454-clipurb.json: output/areas/taz1454.json
	cp $< $@

# This filename is the last one that should be generated in the list of
# blockgroups.
output/blk2taz/$(LAST_BLKID).txt:
	python publish_blk2taz.py input/BLK00_MTCTAZ.csv $(dir $@)

clean:
	rm -f input/*.json
	rm -f output/*.csv
	rm -f output/areas/*.json
	rm -f $(SHAPEFILE_EXTS:%=input/taz1454.%)

really-clean: clean
	rm -rf output
