#!/bin/sh
INPUT=input/scenarios/$1
OUTPUT=output/scenarios/$1
cd $INPUT && unzip -u "*.zip"
cd -
python publish_scenario.py $INPUT/*.csv $OUTPUT
