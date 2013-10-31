# MTC Travel Time Maps

## TAZ API
The map needs a way to know which TAZ (Transportation Analysis Zone) a given geographic point (latitude, longitude) belongs to. We're using Code for America's [US Census Area API](https://github.com/codeforamerica/US-Census-Area-API) for this, running at [mtc-taz-api.herokuapp.com](http://mtc-taz-api.herokuapp.com/) (try the [sample request](http://mtc-taz-api.herokuapp.com/areas?lat=37.7571&lon=-122.4410)).

### Setting up the API server

```sh
# 1. clone the Census Area API repo
$ git clone https://github.com/codeforamerica/US-Census-Area-API.git mtc-taz-api
$ cd mtc-taz-api

# 2. point this at the Heroku app named "mtz-taz-api"
$ heroku git:remote -a mtc-taz-api
$ git config heroku.remote heroku

# 3. use CfA's pygeo buildpack
$ heroku config:set BUILDPACK_URL=https://github.com/codeforamerica/heroku-buildpack-pygeo
# 4. point it at our TAZ Shapefile zip
$ heroku config:set ZIPPED_DATA_URL=http://maps.onebayarea.org/data/areas/taz1454_4326.zip
# 5. use the user-env-compile addon
$ heroku labs:enable user-env-compile

# push it (real good)
$ git push heroku master
```
