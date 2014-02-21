# Data Pipeline

## Prerequisites

The data generation steps have been tested on Mac OS X and should work on Linux as well. You will need `GDAL/OGR` for the `ogr2ogr` conversion utility. The easiest way to install this on Macintosh is with [Homebrew](http://brew.sh/)

Once you have Homebrew installed, installing `GDAL/OGR`:

    brew install gdal

For more in depth information see [Installing Open Source Geo Software](https://github.com/nvkelso/geo-how-to/wiki/Installing-Open-Source-Geo-Software:-Mac-Edition#wiki-gdalogr)

## Downloading MTC data

In each of the directories under `input/scenarios` that are `2020` or above, you must navigate to the URL specified
in the `Makefile` and download the file SimpleTimeSkims.zip from that site. Name this file `skims.zip` in the same directory as the `Makefile`. (This is necessary because there are no longer direct download links.)

## Publishing Scenarios

To publish scenario data, where `$scenario` is the name of a directory in `input/scenarios`, e.g. [2010](https://github.com/stamen/mtc/blob/master/data/input/scenarios/2010/), run:

```sh
$ ./publish_scenario.sh $scenario
```

This should download the requisite scenario files (assuming the scenario directory has a `Makefile`) and generate sorted versions of the time skims, e.g.:

```
input/scenarios/2010/TimeSkimsDatabaseEAdest.csv
```

After that, the shell script will run [publish_scenario.py](publish_scenario.py), which should generate paths that look like:

```
output/scenarios/{name}/time/AM/from/{1-1454}.csv
output/scenarios/{name}/time/EV/to/{1-1454}.csv
```

## Generate GeoJSON data files

Whenever we receive new housing price data we'll need to update the TAZ GeoJSON file to include them. That work happens in [merge_taz.py](merge_taz.py), but to run it with the right inputs just do:

```sh
make output/areas/taz1454.json
```

To rebuild it, just `rm` it first then run `make` again.

## Symlinking to the docroot

Copy, move, or symlink the output directory to `../www/data` so that it's available relative to the docroot:

```sh
$ mv output ../www/data
# or:
$ cd ../www && ln -s ../data/output data
```
