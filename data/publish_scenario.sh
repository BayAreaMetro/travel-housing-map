#!/bin/sh
python publish_scenario.py input/scenarios/$1/*.csv output/scenarios/$1
python publish_blk2taz.py input/BLK00_MTCTAZ.csv output/block2taz
