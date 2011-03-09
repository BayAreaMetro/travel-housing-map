# these are used to clean up after shapefile zip archives (see: "clean")
SHAPEFILE_EXTS = shp shx prj sbn sbx dbf
LAST_BLKID = 060/971/543/024/999

# Our "all" target makes:
# 1. the TAZ GeoJSON file
# 2. the blk2taz mapping files
all: output/taz1454.json output/blk2taz/$(LAST_BLKID).txt output-html

# Unzip the TAZ boundaries and overwrite the SHP and SHX components with
# simplified geometries.
input/taz1454.shp:
	unzip -d input $(basename $@).zip
	cp $(basename $@)-simplified.shp $(basename $@).shp
	cp $(basename $@)-simplified.shx $(basename $@).shx

# Strip out unnecessary fields from the buildings.csv and remove ":i4" suffix
# from column names.
input/buildings_min.csv: input/buildings.csv
	cat $< | cut -d , -f 1,3,11 > $@
	perl -pi -e 's/:i4//g' $@

# Convert the shapefile to GeoJSON
input/taz1454.json: input/taz1454.shp
	ogr2ogr -f GeoJSON -t_srs EPSG:4326 $@ $<

output:
	mkdir -p output

output-html: output
	rsync -avrC html/ output/

# Merge fields from buildings_min.csv into the TAZ boundaries GeoJSON
output/taz1454.json: input/taz1454.json input/buildings_min.csv output
	python merge_taz.py input/buildings_min.csv $< > $@

# This filename is the last one that should be generated in the list of
# blockgroups.
output/blk2taz/$(LAST_BLKID).txt:
	python publish_blk2taz.py input/BLK00_MTCTAZ.csv $(dir $@)

clean:
	rm -f input/taz1454.json
	rm -f output/*.csv
	rm -f output/*.json
	rm -f $(SHAPEFILE_EXTS:%=input/taz1454.%)

really-clean: clean
	rm -rf output
